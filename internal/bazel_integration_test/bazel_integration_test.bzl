# Copyright 2017 The Bazel Authors. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Bazel integration testing
"""

load("@build_bazel_rules_nodejs//:defs.bzl", "BAZEL_VERSION")

BAZEL_BINARY = "@build_bazel_bazel_%s//:bazel_binary" % BAZEL_VERSION.replace(".", "_")

# Helper function to convert a file to a path in the MANIFEST file
def _file_to_manifest_path(ctx, f):
    p = f.short_path
    if p.startswith("../"):
        return p[3:]
    else:
        return ctx.workspace_name + "/" + p

def _bazel_integration_test(ctx):
    # Serialize configuration file for test runner
    config = ctx.actions.declare_file("%s.config.js" % ctx.attr.name)
    workspace_under_test = ctx.attr.workspace_files.label.workspace_name
    ctx.actions.write(
        output = config,
        content = """// bazel_integration_test runner config generated by bazel_integration_test rule
module.exports = {{
    workspaceName: '{TMPL_workspace_name}',
    packageName: '{TMPL_package_name}',
    testName: '{TMPL_test_name}',
    workspaceUnderTest: '{TMPL_workspace_under_test}',
    bazelBinaryWorkspace: '{TMPL_bazel_binary_workspace}',
    bazelCommands: [ {TMPL_bazel_commands} ],
    repositories: {{ {TMPL_repositories} }},
    bazelrcAppend: `{TMPL_bazelrc_append}`,
    bazelrcImports: {{ {TMPL_bazelrc_imports} }},
    npmPackages: {{ {TMPL_npm_packages} }},
    checkNpmPackages: [ {TMPL_check_npm_packages} ],
    packageJsonRepacements: {{ {TMPL_package_json_replacements} }},
}};
""".format(
            TMPL_workspace_name = ctx.workspace_name,
            TMPL_package_name = ctx.label.package,
            TMPL_test_name = ctx.label.name,
            TMPL_workspace_under_test = workspace_under_test,
            TMPL_bazel_binary_workspace = ctx.attr.bazel_binary.label.workspace_name,
            TMPL_bazel_commands = ", ".join(["'%s'" % s for s in ctx.attr.bazel_commands]),
            TMPL_repositories = ", ".join(["'%s': '%s'" % (ctx.attr.repositories[f], _file_to_manifest_path(ctx, f.files.to_list()[0])) for f in ctx.attr.repositories]),
            TMPL_bazelrc_append = ctx.attr.bazelrc_append,
            TMPL_bazelrc_imports = ", ".join(["'%s': '%s'" % (ctx.attr.bazelrc_imports[f], _file_to_manifest_path(ctx, f.files.to_list()[0])) for f in ctx.attr.bazelrc_imports]),
            TMPL_npm_packages = ", ".join(["'%s': '%s'" % (ctx.attr.npm_packages[f], _file_to_manifest_path(ctx, f.files.to_list()[0])) for f in ctx.attr.npm_packages]),
            TMPL_check_npm_packages = ", ".join(["'%s'" % s for s in ctx.attr.check_npm_packages]),
            TMPL_package_json_replacements = ", ".join(["'%s': '%s'" % (f, ctx.attr.package_json_replacements[f]) for f in ctx.attr.package_json_replacements]),
        ),
    )

    # Test executable is a shell script that runs ctx.executable._test_runner
    # and passes it the generated configuration file
    ctx.actions.write(
        output = ctx.outputs.executable,
        is_executable = True,
        content = """#!/usr/bin/env bash
# Immediately exit if any command fails.
set -e

if [ -e "$RUNFILES_MANIFEST_FILE" ]; then
  while read line; do
    declare -a PARTS=($line)
    if [ "${{PARTS[0]}}" == "{TMPL_test_runner}" ]; then
      readonly TEST_RUNNER=${{PARTS[1]}}
    elif [ "${{PARTS[0]}}" == "{TMPL_args}" ]; then
      readonly ARGS=${{PARTS[1]}}
    fi
  done < $RUNFILES_MANIFEST_FILE
else
  readonly TEST_RUNNER=../{TMPL_test_runner}
  readonly ARGS={TMPL_args}
fi

$TEST_RUNNER $ARGS "$@"
""".format(
            TMPL_test_runner = _file_to_manifest_path(ctx, ctx.executable._test_runner),
            TMPL_args = _file_to_manifest_path(ctx, config),
        ),
    )

    runfiles = [config] + ctx.files.bazel_binary + ctx.files.workspace_files + ctx.files.repositories + ctx.files.bazelrc_imports + ctx.files.npm_packages

    return [DefaultInfo(
        runfiles = ctx.runfiles(files = runfiles).merge(ctx.attr._test_runner[DefaultInfo].data_runfiles),
        executable = ctx.outputs.executable,
    )]

BAZEL_INTEGRATION_TEST_ATTRS = {
    "bazel_binary": attr.label(
        default = BAZEL_BINARY,
        doc = """The bazel binary files to test against.

It is assumed by the test runner that the bazel binary is found at label_workspace/bazel (wksp/bazel.exe on Windows)""",
    ),
    "bazel_commands": attr.string_list(
        default = ["test ..."],
        doc = """The list of bazel commands to run. Defaults to `["test ..."]`.""",
    ),
    "bazelrc_append": attr.string(
        doc = """String to append to the .bazelrc file in the workspace-under-test.

This can be used to pass bazel startup args that would otherwise not be possible to set. For example,
```
bazelrc_append = "startup --host_jvm_args=-Xms256m --host_jvm_args=-Xmx2g"
```
""",
    ),
    "bazelrc_imports": attr.label_keyed_string_dict(
        allow_files = True,
        doc = """A label keyed string dictionary of import replacements to make in the .bazelrc file of the workspace
under test.

This can be used to pass a common bazelrc file to all integration tests. For example,
```
bazelrc_imports = {
    "//:common.bazelrc": "import %workspace%/../../common.bazelrc",
},
```""",
    ),
    "check_npm_packages": attr.string_list(
        doc = """A list of npm packages that should be replaced in this test.

This attribute checks that none of the npm packages lists is found in the workspace-under-test's
package.json file unlinked to a generated npm package.

This can be used to verify that all npm package artifacts that need to be tested against are indeed
replaced in all integration tests. For example,
```
check_npm_packages = [
    "@bazel/hide-bazel-files",
    "@bazel/jasmine",
    "@bazel/karma",
    "@bazel/labs",
    "@bazel/less",
    "@bazel/protractor",
    "@bazel/stylus",
    "@bazel/typescript",
],
```
If an `npm_packages` replacement on any package listed is missed then the test will fail. Since listing all
npm packages in `npm_packages` is expensive as any change will result in all integration tests re-running,
this attribute allows a fine grained `npm_packages` per integration test with the added safety that none
are missed for any one test.
""",
    ),
    "npm_packages": attr.label_keyed_string_dict(
        doc = """A label keyed string dictionary of npm package replacements to make in the workspace-under-test's
package.json with generated npm package targets. The targets should be npm_package rules.

For example,
```
npm_packages = {
    "//packages/jasmine:npm_package": "@bazel/jasmine",
    "//packages/karma:npm_package": "@bazel/karma",
    "//packages/typescript:npm_package": "@bazel/typescript",
}
```""",
    ),
    "package_json_replacements": attr.string_dict(
        doc = """A string dictionary of other package.json package replacements to make.
        
This can be used for integration testing against multiple external npm dependencies without duplicating code. For example,
```
[bazel_integration_test(
    name = "e2e_typescript_%s" % tsc_version.replace(".", "_"),
    ...
    package_json_replacements = {
        "typescript": tsc_version,
    },
    ...
) for tsc_version in [
    "2.7.x",
    "2.8.x",
    "2.9.x",
    "3.0.x",
    "3.1.x",
    "3.2.x",
    "3.3.x",
    "3.4.x",
    "3.5.x",
]]```""",
    ),
    "repositories": attr.label_keyed_string_dict(
        doc = """A label keyed string dictionary of repositories to replace in the workspace-under-test's WORKSPACE
file with generated workspace archive targets. The targets should be pkg_tar rules.

This can be used to test against .tar.gz release artifacts in integration tests. For example,
```
repositories = {
    "//:release": "build_bazel_rules_nodejs",
},
```
where `//:release` is the pkg_tar target that generates the `build_bazel_rules_nodejs` `.tar.gz` release artifact that
is published on GitHub.
""",
    ),
    "workspace_files": attr.label(
        doc = """A filegroup of all files in the workspace-under-test necessary to run the test.""",
    ),
    "_test_runner": attr.label(
        executable = True,
        cfg = "host",
        default = Label("@build_bazel_rules_nodejs//internal/bazel_integration_test:test_runner"),
    ),
}

bazel_integration_test = rule(
    implementation = _bazel_integration_test,
    doc = """Runs an integration test by running a specified version of bazel against an external workspace.""",
    attrs = BAZEL_INTEGRATION_TEST_ATTRS,
    test = True,
)
