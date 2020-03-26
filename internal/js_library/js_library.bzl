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

"""js_library allows defining a set of javascript sources and assigning a package_name.

DO NOT USE - this is not fully designed, and exists only to enable testing within this repo.
"""

load("//internal/providers:linkable_package_info.bzl", "LinkablePackageInfo")

_AMD_NAMES_DOC = """Mapping from require module names to global variables.
This allows devmode JS sources to load unnamed UMD bundles from third-party libraries."""

AmdNamesInfo = provider(
    doc = "provide access to the amd_names attribute of js_library",
    fields = {"names": _AMD_NAMES_DOC},
)

def write_amd_names_shim(actions, amd_names_shim, targets):
    """Shim AMD names for UMD bundles that were shipped anonymous.

    These are collected from our bootstrap deps (the only place global scripts should appear)

    Args:
      actions: skylark rule execution context.actions
      amd_names_shim: File where the shim is written
      targets: dependencies to be scanned for AmdNamesInfo providers
    """

    amd_names_shim_content = """// GENERATED by js_library.bzl
// Shim these global symbols which were defined by a bootstrap script
// so that they can be loaded with named require statements.
"""
    for t in targets:
        if AmdNamesInfo in t:
            for n in t[AmdNamesInfo].names.items():
                amd_names_shim_content += "define(\"%s\", function() { return %s });\n" % n
    actions.write(amd_names_shim, amd_names_shim_content)

def _impl(ctx):
    if not ctx.files.srcs:
        fail("No srcs specified")

    source_files = ctx.files.srcs[0].is_source
    for src in ctx.files.srcs:
        if src.is_source != source_files:
            fail("Mixing of source and generated files not allowed")

    sources_depset = depset(ctx.files.srcs)

    result = [
        DefaultInfo(
            files = sources_depset,
            runfiles = ctx.runfiles(files = ctx.files.srcs),
        ),
        AmdNamesInfo(names = ctx.attr.amd_names),
    ]

    if ctx.attr.package_name:
        if source_files:
            path = "/".join([p for p in [ctx.label.workspace_root, ctx.label.package] if p])
        else:
            path = "/".join([p for p in [ctx.bin_dir.path, ctx.label.workspace_root, ctx.label.package] if p])
        result.append(LinkablePackageInfo(
            package_name = ctx.attr.package_name,
            path = path,
            files = sources_depset,
        ))

    return result

_js_library = rule(
    implementation = _impl,
    attrs = {
        "package_name": attr.string(),
        "srcs": attr.label_list(allow_files = True),
        "amd_names": attr.string_dict(doc = _AMD_NAMES_DOC),
        # module_name for legagy ts_library module_mapping support
        # TODO: remove once legacy module_mapping is removed
        "module_name": attr.string(),
    },
)

def js_library(
        name,
        srcs,
        amd_names = {},
        package_name = None,
        **kwargs):
    module_name = kwargs.pop("module_name", None)
    if module_name:
        fail("use package_name instead of module_name in target //%s:%s" % (native.package_name(), name))
    _js_library(
        name = name,
        srcs = srcs,
        amd_names = amd_names,
        package_name = package_name,
        # module_name for legagy ts_library module_mapping support
        # TODO: remove once legacy module_mapping is removed
        module_name = package_name,
        **kwargs
    )
