// Karma configuration
// GENERATED BY Bazel
try {
  const crypto = require('crypto');
  const fs = require('fs');
  const path = require('path');
  const child_process = require('child_process');
  const runfiles = require(process.env['BAZEL_NODE_RUNFILES_HELPER']);

  const VERBOSE_LOGS = !!process.env['VERBOSE_LOGS'];

  function log_verbose(...m) {
    // This is a template file so we use __filename to output the actual filename
    if (VERBOSE_LOGS) console.error(`[${path.basename(__filename)}]`, ...m);
  }

  // BEGIN ENV VARS
  TMPL_env_vars
  // END ENV VARS

  const configPath = 'TMPL_config_file';

  log_verbose(`running with
    cwd: ${process.cwd()}
    configPath: ${configPath}`);

  /**
   * Helper function to find a particular namedFile
   * within the webTestMetadata webTestFiles
   */
  function findNamedFile(webTestMetadata, key) {
    let result;
    webTestMetadata['webTestFiles'].forEach(entry => {
      const webTestNamedFiles = entry['namedFiles'];
      if (webTestNamedFiles && webTestNamedFiles[key]) {
        result = webTestNamedFiles[key];
      }
    });
    return result;
  }

  /**
   * Helper function to extract a browser archive
   * and return the path to extract executable
   */
  function extractWebArchive(extractExe, archiveFile, executablePath) {
    try {
      // Paths are relative to the root runfiles folder
      extractExe = extractExe ? path.join('..', extractExe) : extractExe;
      archiveFile = path.join('..', archiveFile);
      const extractedExecutablePath = path.join(process.cwd(), executablePath);
      if (!extractExe) {
        throw new Error('No EXTRACT_EXE found');
      }
      child_process.execFileSync(
          extractExe, [archiveFile, '.'], {stdio: [process.stdin, process.stdout, process.stderr]});
      log_verbose(
          `Extracting web archive ${archiveFile} with ${extractExe} to ${extractedExecutablePath}`);
      return extractedExecutablePath;
    } catch (e) {
      console.error(`Failed to extract ${archiveFile}`);
      throw e;
    }
  }

  /**
   * Check if Chrome sandboxing is supported on the current platform.
   */
  function supportChromeSandboxing() {
    if (process.platform === 'darwin') {
      // Chrome 73+ fails to initialize the sandbox on OSX when running under Bazel.
      // ```
      // ERROR [launcher]: Cannot start ChromeHeadless
      // ERROR:crash_report_database_mac.mm(96)] mkdir
      // /private/var/tmp/_bazel_greg/62ef096b0da251c6d093468a1efbfbd3/execroot/angular/bazel-out/darwin-fastbuild/bin/external/io_bazel_rules_webtesting/third_party/chromium/chromium.out/chrome-mac/Chromium.app/Contents/Versions/73.0.3683.0/Chromium
      // Framework.framework/Versions/A/new: Permission denied (13) ERROR:file_io.cc(89)]
      // ReadExactly: expected 8, observed 0 ERROR:crash_report_database_mac.mm(96)] mkdir
      // /private/var/tmp/_bazel_greg/62ef096b0da251c6d093468a1efbfbd3/execroot/angular/bazel-out/darwin-fastbuild/bin/external/io_bazel_rules_webtesting/third_party/chromium/chromium.out/chrome-mac/Chromium.app/Contents/Versions/73.0.3683.0/Chromium
      // Framework.framework/Versions/A/new: Permission denied (13) Chromium Helper[94642] <Error>:
      // SeatbeltExecServer: Failed to initialize sandbox: -1 Operation not permitted Failed to
      // initialize sandbox. [0213/201206.137114:FATAL:content_main_delegate.cc(54)] Check failed:
      // false. 0   Chromium Framework                  0x000000010c078bc9 ChromeMain + 43788137 1
      // Chromium Framework                  0x000000010bfc0f43 ChromeMain + 43035363
      // ...
      // ```
      return false;
    }

    if (process.platform === 'linux') {
      // Chrome on Linux uses sandboxing, which needs user namespaces to be enabled.
      // This is not available on all kernels and it might be turned off even if it is available.
      // Notable examples where user namespaces are not available include:
      // - In Debian it is compiled-in but disabled by default.
      // - The Docker daemon for Windows or OSX does not support user namespaces.
      // We can detect if user namespaces are supported via
      // /proc/sys/kernel/unprivileged_userns_clone. For more information see:
      // https://github.com/Googlechrome/puppeteer/issues/290
      // https://superuser.com/questions/1094597/enable-user-namespaces-in-debian-kernel#1122977
      // https://github.com/karma-runner/karma-chrome-launcher/issues/158
      // https://github.com/angular/angular/pull/24906
      try {
        const res = child_process.execSync('cat /proc/sys/kernel/unprivileged_userns_clone')
                        .toString()
                        .trim();
        return res === '1';
      } catch (error) {
      }
      return false;
    }

    return true;
  }

  /**
   * Helper function to override base karma config values.
   */
  function overrideConfigValue(conf, name, value) {
    if (conf.hasOwnProperty(name)) {
      console.warn(
          `Your karma configuration specifies '${name}' which will be overwritten by Bazel`);
    }
    conf[name] = value;
  }

  /**
   * Helper function to override nested karma config values.
   */
  function overrideNestedConfigValue(conf, name, value) {
    const nameParts = name.split('.');
    const finalName = nameParts.pop();
    for (const property of nameParts) {
      if (!(property in conf)) {
        conf[property] = {};
      }
      conf = conf[property];
    }
    if (conf.hasOwnProperty(name)) {
      console.warn(
          `Your karma configuration specifies '${name}' which will be overwritten by Bazel`);
    }
    conf[finalName] = value;
  }

  /**
   * Helper function to merge base karma config values that are arrays.
   */
  function mergeConfigArray(conf, name, values) {
    if (!conf[name]) {
      conf[name] = [];
    }
    values.forEach(v => {
      if (!conf[name].includes(v)) {
        conf[name].push(v);
      }
    })
  }

  function tryRequire(packageName) {
    try {
      return require(packageName);
    } catch (e) {
      if (e && e.code === 'MODULE_NOT_FOUND') {
        return undefined;
      }

      throw e;
    }
  }

  /**
   * Configuration settings for karma under Bazel common to karma_web_test
   * and karma_web_test_suite.
   */
  function configureBazelConfig(config, conf) {
    // list of karma plugins
    mergeConfigArray(conf, 'plugins', [
      // Loads 'concat_js'
      require('@bazel/concatjs'),
      // Load plugins that are peer deps. These packages are used in this config file.
      require('karma-chrome-launcher'),
      require('karma-firefox-launcher'),
      require('karma-jasmine'),
      require('karma-requirejs'),
      require('karma-sourcemap-loader'),
      // Loads user-installed karma-* packages in the root node_modules.
      'karma-*',
    ]);

    // list of karma preprocessors
    if (!conf.preprocessors) {
      conf.preprocessors = {}
    }
    conf.preprocessors['**/*.js'] = ['sourcemap'];

    // list of test frameworks to use
    overrideConfigValue(conf, 'frameworks', ['jasmine', 'concat_js']);

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    mergeConfigArray(conf, 'reporters', ['progress']);

    // enable / disable colors in the output (reporters and logs)
    if (!conf.colors) {
      conf.colors = true;
    }

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR ||
    // config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    conf.logLevel = VERBOSE_LOGS ? config.LOG_DEBUG : config.LOG_INFO;

    // enable / disable watching file and executing tests whenever
    // any file changes
    overrideConfigValue(conf, 'autoWatch', process.env['IBAZEL_NOTIFY_CHANGES'] === 'y');

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    // note: run_karma.sh may override this as a command-line option.
    overrideConfigValue(conf, 'singleRun', false);

    // Concurrency level
    // how many browser should be started simultaneous
    overrideConfigValue(conf, 'concurrency', Infinity);

    // base path that will be used to resolve all patterns
    // (eg. files, exclude)
    overrideConfigValue(conf, 'basePath', 'TMPL_runfiles_path');

    // Do not show "no timestamp" errors from "karma-requirejs" for proxied file
    // requests. Files which are passed as "static_files" are proxied by default and
    // therefore should not cause such an exception when loaded as expected.
    // See: https://github.com/karma-runner/karma-requirejs/issues/6
    const requireJsShowNoTimestampsError = '^(?!/base/).*$';

    if (conf.client) {
      overrideConfigValue(
          conf.client, 'requireJsShowNoTimestampsError', requireJsShowNoTimestampsError);
    } else {
      conf.client = {requireJsShowNoTimestampsError};
    }

    // Enable the junit reporter if the XML_OUTPUT_FILE environment variable
    // is defined and the karma-junit-reporter package is installed.
    // The configuration for the junit reporter will be created or overridden
    // with the configuration required for bazel to work properly.
    const testOutputFile = process.env.XML_OUTPUT_FILE;
    const karmaJunitReporterPlugin = testOutputFile ? tryRequire('karma-junit-reporter') : undefined;
    if (karmaJunitReporterPlugin) {
      mergeConfigArray(conf, 'plugins', [
        karmaJunitReporterPlugin,
      ]);

      mergeConfigArray(conf, 'reporters', ['junit']);
      overrideNestedConfigValue(conf, 'junitReporter.outputDir', path.dirname(testOutputFile));
      overrideNestedConfigValue(conf, 'junitReporter.outputFile', path.basename(testOutputFile));
      overrideNestedConfigValue(conf, 'junitReporter.useBrowserName', false);
    }
  }

  /**
   * Configure the 'files' and 'proxies' configuration attributes.
   * These are concatenated into a single file by karma-concat-js.
   */
  function configureFiles(conf) {
    overrideConfigValue(conf, 'files', []);
    overrideConfigValue(conf, 'exclude', []);
    overrideConfigValue(conf, 'proxies', {});

    // Static files are added to the files array but configured to not be included,
    // so karma-concat-js does not included them in the bundle. Note that we need
    // to add the static files before adding the included files as we don't want
    // to overwrite included files (changing from included to not included).
    [
        // BEGIN STATIC FILES
        TMPL_static_files
        // END STATIC FILES
    ].forEach((f) => {
      // In Windows, the runfile will probably not be symlinked. Se we need to
      // serve the real file through karma, and proxy calls to the expected file
      // location in the runfiles to the real file.
      const resolvedFile = runfiles.resolve(f);
      conf.files.push({pattern: resolvedFile, included: false});
      // Prefixing the proxy path with '/absolute' allows karma to load local
      // files. This doesn't see to be an official API.
      // https://github.com/karma-runner/karma/issues/2703
      conf.proxies['/base/' + f] = '/absolute' + resolvedFile;
    });

    [
      // BEGIN BOOTSTRAP FILES
      TMPL_bootstrap_files
    // END BOOTSTRAP FILES
    // BEGIN USER FILES
      TMPL_user_files
      // END USER FILES
    ].forEach(f => conf.files.push(runfiles.resolve(f)))

      var requireConfigContent = `
      // A simplified version of Karma's requirejs.config.tpl.js for use with Karma under Bazel.
      // This does an explicit \`require\` on each test script in the files, otherwise nothing will be loaded.
      (function(){
        var runtimeFiles = [
          // BEGIN RUNTIME FILES
          TMPL_runtime_files
          // END RUNTIME FILES
        ].map(function(file) { return file.replace(/\\.js$/, ''); });
        var allFiles = [
            // BEGIN USER FILES
            TMPL_user_files
            // END USER FILES
        ];
        var allTestFiles = [];
        allFiles.forEach(function (file) {
          if (/[^a-zA-Z0-9](spec|test)\\.js$/i.test(file) && !/\\/node_modules\\//.test(file)) {
            allTestFiles.push(file.replace(/\\.js$/, ''))
          }
        });
        require(runtimeFiles, function() { return require(allTestFiles, window.__karma__.start); });
      })();
    `;

      const requireConfigFile = path.join(
          process.env['TEST_TMPDIR'], crypto.randomBytes(6).readUIntLE(0, 6).toString(36) + '.js');
      fs.writeFileSync(requireConfigFile, requireConfigContent);
      conf.files.push(requireConfigFile);
  }

  /**
   * Configure karma under karma_web_test_suite.
   * `browsers` and `customLaunchers` are setup by Bazel.
   */
  function configureTsWebTestSuiteConfig(conf) {
    // WEB_TEST_METADATA is configured in rules_webtesting based on value
    // of the browsers attribute passed to karms_web_test_suite
    // We setup the karma configuration based on the values in this object
    if (!process.env['WEB_TEST_METADATA']) {
      // This is a karma_web_test rule since there is no WEB_TEST_METADATA
      return;
    }

    overrideConfigValue(conf, 'browsers', []);
    overrideConfigValue(conf, 'customLaunchers', null);

    const webTestMetadata = require(runfiles.resolve(process.env['WEB_TEST_METADATA']));
    log_verbose(`WEB_TEST_METADATA: ${JSON.stringify(webTestMetadata, null, 2)}`);
    if (webTestMetadata['environment'] === 'local') {
      // When a local chrome or firefox browser is chosen such as
      // "@io_bazel_rules_webtesting//browsers:chromium-local" or
      // "@io_bazel_rules_webtesting//browsers:firefox-local"
      // then the 'environment' will equal 'local' and
      // 'webTestFiles' will contain the path to the binary to use
      const extractExe = findNamedFile(webTestMetadata, 'EXTRACT_EXE');
      webTestMetadata['webTestFiles'].forEach(webTestFiles => {
        const webTestNamedFiles = webTestFiles['namedFiles'];
        const archiveFile = webTestFiles['archiveFile'];
        if (webTestNamedFiles['CHROMIUM']) {
          // When karma is configured to use Chrome it will look for a CHROME_BIN
          // environment variable.
          if (archiveFile) {
            process.env.CHROME_BIN =
                extractWebArchive(extractExe, archiveFile, webTestNamedFiles['CHROMIUM']);
          } else {
            try {
              process.env.CHROME_BIN = runfiles.resolve(webTestNamedFiles['CHROMIUM']);
            } catch {
              // Fail as this file is expected to be in runfiles
              throw new Error(`Failed to resolve rules_webtesting Chromium binary '${
                  webTestNamedFiles['CHROMIUM']}' in runfiles`);
            }
          }
          // Read any additional chrome options (as specified by the
          // rules_webtesting manifest).
          const chromeOptions = (webTestMetadata['capabilities'] || {})['goog:chromeOptions'];
          const additionalArgs = (chromeOptions ? chromeOptions['args'] : []).filter(arg => {
            // We never want to 'run' Chrome in headless mode.
            return arg != '--headless';
          });
          const browser = process.env['DISPLAY'] ? 'Chrome' : 'ChromeHeadless';
          if (!supportChromeSandboxing()) {
            const launcher = 'CustomChromeWithoutSandbox';
            conf.customLaunchers =
                {[launcher]: {base: browser, flags: ['--no-sandbox', ...additionalArgs]}};
            conf.browsers.push(launcher);
          } else {
            const launcher = 'CustomChrome';
            conf.customLaunchers = {[launcher]: {base: browser, flags: additionalArgs}};
            conf.browsers.push(launcher);
          }
        }
        if (webTestNamedFiles['FIREFOX']) {
          // When karma is configured to use Firefox it will look for a
          // FIREFOX_BIN environment variable.
          if (archiveFile) {
            process.env.FIREFOX_BIN =
                extractWebArchive(extractExe, archiveFile, webTestNamedFiles['FIREFOX']);
          } else {
            try {
              process.env.FIREFOX_BIN = runfiles.resolve(webTestNamedFiles['FIREFOX']);
            } catch {
              // Fail as this file is expected to be in runfiles
              throw new Error(`Failed to resolve rules_webtesting Firefox binary '${
                  webTestNamedFiles['FIREFOX']}' in runfiles`);
            }
          }

          // For Firefox, we need to disable the content sandbox as the browser is already being
          // launched as part of the Bazel sandbox. This is necessary because the integrated content
          // sandbox in Firefox will conflict with the Bazel sandbox due to nested sandboxing.
          // This is similar to why we disable sandbox for Chromium (as seen above).
          process.env.MOZ_DISABLE_CONTENT_SANDBOX = '1';

          conf.browsers.push(process.env['DISPLAY'] ? 'Firefox' : 'FirefoxHeadless');
        }
      });
    } else {
      throw new Error(`Unknown WEB_TEST_METADATA environment '${webTestMetadata['environment']}'`);
    }

    if (!conf.browsers.length) {
      throw new Error('No browsers configured in web test suite');
    }
  }

  function configureTsWebTestConfig(conf) {
    if (process.env['WEB_TEST_METADATA']) {
      // This is a karma_web_test_suite rule since there is a WEB_TEST_METADATA
      return;
    }

    // Fallback to using the system local chrome if no valid browsers have been
    // configured above
    if (!conf.browsers || !conf.browsers.length) {
      console.warn('No browsers configured. Configuring Karma to use system Chrome.');
      conf.browsers = [process.env['DISPLAY'] ? 'Chrome' : 'ChromeHeadless'];
    }
  }

  function configureFormatError(conf) {
    conf.formatError = (msg) => {
      // This is a bazel specific formatError that removes the workspace
      // name from stack traces.
      // Look for filenames of the format "(<filename>:<row>:<column>"
      const FILENAME_REGEX = /\(([^:\n\r]+)(:\d+:\d+)/gm;
      msg = msg.replace(FILENAME_REGEX, (_, p1, p2) => {
        if (p1.startsWith('../')) {
          // Remove all leading "../"
          while (p1.startsWith('../')) {
            p1 = p1.substr(3);
          }
        } else {
          // Remove workspace name(angular, ngdeps etc.) from the beginning.
          const index = p1.indexOf('/');
          if (index >= 0) {
            p1 = p1.substr(index + 1);
          }
        }
        return '(' + p1 + p2;
      });
      return msg + '\n\n';
    };
  }

  module.exports = function(config) {
    let conf = {};

    // Import the user's base karma configuration if specified
    if (configPath) {
      const baseConf = require(runfiles.resolve(configPath));
      if (typeof baseConf !== 'function') {
        throw new Error(
            'Invalid base karma configuration. Expected config function to be exported.');
      }
      const originalSetConfig = config.set;
      config.set = function(c) {
        conf = c;
      };
      baseConf(config);
      config.set = originalSetConfig;
      log_verbose(`base karma configuration: ${JSON.stringify(conf, null, 2)}`);
    }

    configureBazelConfig(config, conf);
    configureFiles(conf);
    configureTsWebTestSuiteConfig(conf);
    configureTsWebTestConfig(conf);
    configureFormatError(conf);

    log_verbose(`karma configuration: ${JSON.stringify(conf, null, 2)}`);

    config.set(conf);
  }
} catch (e) {
  console.error('Error in karma configuration', e.toString());
  throw e;
}
