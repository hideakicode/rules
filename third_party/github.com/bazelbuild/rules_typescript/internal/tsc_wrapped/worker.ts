import * as path from 'path';
import * as protobufjs from 'protobufjs';

// Equivalent of running node with --expose-gc
// but easier to write tooling since we don't need to inject that arg to
// nodejs_binary
if (typeof global.gc !== 'function') {
  // tslint:disable-next-line:no-require-imports
  require('v8').setFlagsFromString('--expose_gc');
  // tslint:disable-next-line:no-require-imports
  global.gc = require('vm').runInNewContext('gc');
}

/**
 * Whether to print debug messages (to console.error) from the debug function
 * below.
 */
export const DEBUG = false;

/** Maybe print a debug message (depending on a flag defaulting to false). */
export function debug(...args: Array<unknown>) {
  if (DEBUG) console.error.apply(console, args);
}

/**
 * Write a message to stderr, which appears in the bazel log and is visible to
 * the end user.
 */
export function log(...args: Array<{}>) {
  console.error.apply(console, args);
}

/**
 * runAsWorker returns true if the given arguments indicate the process should
 * run as a persistent worker.
 */
export function runAsWorker(args: string[]) {
  return args.indexOf('--persistent_worker') !== -1;
}

/**
 * workerProto declares the static type of the object constructed at runtime by
 * protobufjs, based on reading the protocol buffer definition.
 */
declare namespace workerProto {
  /** Input represents the blaze.worker.Input message. */
  interface Input extends protobufjs.Message<Input> {
    path: string;
    /**
     * In Node, digest is a Buffer. In the browser, it's a replacement
     * implementation. We only care about its toString(encoding) method.
     */
    digest: {toString(encoding: string): string};
  }

  /** WorkRequest repesents the blaze.worker.WorkRequest message. */
  interface WorkRequest extends protobufjs.Message<WorkRequest> {
    arguments: string[];
    inputs: Input[];
  }

  // tslint:disable:variable-name reflected, constructable types.
  const WorkRequest: protobufjs.Type;
  const WorkResponse: protobufjs.Type;
  // tslint:enable:variable-name
}

/**
 * loadWorkerPb finds and loads the protocol buffer definition for bazel's
 * worker protocol using protobufjs. In protobufjs, this means it's a reflection
 * object that also contains properties for the individual messages.
 */
function loadWorkerPb() {
  const protoPath =
      '../worker_protocol.proto';

  // Use node module resolution so we can find the .proto file in any of the
  // root dirs
  let protofile;
  try {
    // Look for the .proto file relative in its @bazel/typescript npm package
    // location
    protofile = require.resolve(protoPath);
  } catch (e) {
  }
  if (!protofile) {
    // If not found above, look for the .proto file in its rules_typescript
    // workspace location
    // This extra lookup should never happen in google3. It's only needed for
    // local development in the rules_typescript repo.
    protofile = require.resolve(
        '../../third_party/github.com/bazelbuild/bazel/src/main/protobuf/worker_protocol.proto');
  }

  const protoNamespace = protobufjs.loadSync(protofile);
  if (!protoNamespace) {
    throw new Error('Cannot find ' + path.resolve(protoPath));
  }
  const workerpb = protoNamespace.lookup('blaze.worker');
  if (!workerpb) {
    throw new Error(`Cannot find namespace blaze.worker`);
  }
  return workerpb as protobufjs.ReflectionObject & typeof workerProto;
}

/**
 * workerpb contains the runtime representation of the worker protocol buffer,
 * including accessor for the defined messages.
 */
const workerpb = loadWorkerPb();

/**
 * runWorkerLoop handles the interacton between bazel workers and the
 * TypeScript compiler. It reads compilation requests from stdin, unmarshals the
 * data, and dispatches into `runOneBuild` for the actual compilation to happen.
 *
 * The compilation handler is parameterized so that this code can be used by
 * different compiler entry points (currently TypeScript compilation and Angular
 * compilation).
 */
export function runWorkerLoop(
    runOneBuild: (args: string[], inputs?: {[path: string]: string}) =>
        boolean) {
  // Hook all output to stderr and write it to a buffer, then include
  // that buffer's in the worker protcol proto's textual output.  This
  // means you can log via console.error() and it will appear to the
  // user as expected.
  let consoleOutput = '';
  process.stderr.write =
      (chunk: string|Buffer, ...otherArgs: Array<unknown>): boolean => {
        consoleOutput += chunk.toString();
        return true;
      };

  // Accumulator for asynchronously read input.
  // protobufjs uses node's Buffer, but has its own reader abstraction on top of
  // it (for browser compatiblity). It ignores Buffer's builtin start and
  // offset, which means the handling code below cannot use Buffer in a
  // meaningful way (such as cycling data through it). The handler below reads
  // any data available on stdin, concatenating it into this buffer. It then
  // attempts to read a delimited Message from it. If a message is incomplete,
  // it exits and waits for more input. If a message has been read, it strips
  // its data of this buffer.
  let buf: Buffer = Buffer.alloc(0);
  process.stdin.on('readable', () => {
    const chunk = process.stdin.read() as Buffer;
    if (!chunk) return;
    buf = Buffer.concat([buf, chunk]);
    try {
      const reader = new protobufjs.Reader(buf);
      // Read all requests that have accumulated in the buffer.
      while (reader.len - reader.pos > 0) {
        const messageStart = reader.len;
        const msgLength: number = reader.uint32();
        // chunk might be an incomplete read from stdin. If there are not enough
        // bytes for the next full message, wait for more input.
        if ((reader.len - reader.pos) < msgLength) return;

        const req = workerpb.WorkRequest.decode(reader, msgLength) as
            workerProto.WorkRequest;
        // Once a message has been read, remove it from buf so that if we pause
        // to read more input, this message will not be processed again.
        buf = buf.slice(messageStart);
        debug('=== Handling new build request');
        // Reset accumulated log output.
        consoleOutput = '';
        const args = req.arguments;
        const inputs: {[path: string]: string} = {};
        for (const input of req.inputs) {
          inputs[input.path] = input.digest.toString('hex');
        }
        debug('Compiling with:\n\t' + args.join('\n\t'));
        const exitCode = runOneBuild(args, inputs) ? 0 : 1;
        process.stdout.write((workerpb.WorkResponse.encodeDelimited({
                               exitCode,
                               output: consoleOutput,
                             })).finish() as Buffer);
        // Force a garbage collection pass.  This keeps our memory usage
        // consistent across multiple compilations, and allows the file
        // cache to use the current memory usage as a guideline for expiring
        // data.  Note: this is intentionally not within runOneBuild(), as
        // we want to gc only after all its locals have gone out of scope.
        global.gc();
      }
      // All messages have been handled, make sure the invariant holds and
      // Buffer is empty once all messages have been read.
      if (buf.length > 0) {
        throw new Error('buffer not empty after reading all messages');
      }
    } catch (e) {
      log('Compilation failed', e.stack);
      process.stdout.write(
          workerpb.WorkResponse
              .encodeDelimited({exitCode: 1, output: consoleOutput})
              .finish() as Buffer);
      // Clear buffer so the next build won't read an incomplete request.
      buf = Buffer.alloc(0);
    }
  });
}