// Rollup configuration
// GENERATED BY Bazel

const rollup = require('rollup');
const nodeResolve = require('rollup-plugin-node-resolve');
const path = require('path');
const fs = require('fs');

const DEBUG = false;

const moduleMappings = TMPL_module_mappings;
const workspaceName = 'TMPL_workspace_name';
const rootDirs = TMPL_rootDirs;
const banner_file = TMPL_banner_file;
const stamp_data = TMPL_stamp_data;

if (DEBUG)
  console.error(`
Rollup: running with
  rootDirs: ${rootDirs}
  moduleMappings: ${JSON.stringify(moduleMappings)}
`);

function resolveBazel(importee, importer, baseDir = process.cwd(), resolve = require.resolve) {
  function resolveInRootDirs(importee) {
    for (var i = 0; i < rootDirs.length; i++) {
      var root = rootDirs[i];
      var candidate = path.join(baseDir, root, importee);
      if (DEBUG) console.error('Rollup: try to resolve at', candidate);
      try {
        var result = resolve(candidate);
        return result;
      } catch (e) {
        continue;
      }
    }
  }

  // process.cwd() is the execroot and ends up looking something like
  // /.../2c2a834fcea131eff2d962ffe20e1c87/bazel-sandbox/872535243457386053/execroot/<workspace_name>
  // from that path to the es6 output is
  // <bin_dir_path>/<build_file_dirname>/<label_name>.es6 from there, sources
  // from the user's workspace are under <user_workspace_name>/<path_to_source>
  // and sources from external workspaces are under
  // <external_workspace_name>/<path_to_source>
  var resolved;
  if (importee.startsWith('.' + path.sep) || importee.startsWith('..' + path.sep)) {
    // relative import
    resolved = path.join(importer ? path.dirname(importer) : '', importee);
    if (resolved) resolved = resolve(resolved);
  }

  if (!resolved) {
    // possible workspace import or external import if importee matches a module
    // mapping
    for (const k in moduleMappings) {
      if (importee == k || importee.startsWith(k + path.sep)) {
        // replace the root module name on a mappings match
        var v = moduleMappings[k];
        importee = path.join(v, importee.slice(k.length + 1));
        resolved = resolveInRootDirs(importee);
        break;
      }
    }
  }

  if (!resolved) {
    // workspace import
    const userWorkspacePath = path.relative(workspaceName, importee);
    resolved = resolveInRootDirs(userWorkspacePath.startsWith('..') ? importee : userWorkspacePath);
  }

  return resolved;
}

let banner = '';
if (banner_file) {
  banner = fs.readFileSync(banner_file, {encoding: 'utf-8'});
  if (stamp_data) {
    const version = fs.readFileSync(stamp_data, {encoding: 'utf-8'})
                        .split('\n')
                        .find(l => l.startsWith('BUILD_SCM_VERSION'))
                        .split(' ')[1]
                        .trim();  // trim() is needed so result is the same on
                                  // windows as in linux/osx
    banner = banner.replace(/0.0.0-PLACEHOLDER/, version);
  }
}

module.exports = {
  resolveBazel,
  banner,
  output: {format: 'iife'},
  plugins: [TMPL_additional_plugins].concat([
    {resolveId: resolveBazel},
    nodeResolve({jsnext: true, module: true}),
  ])
}
