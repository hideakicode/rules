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

load("//:providers.bzl", "LinkablePackageInfo", "declaration_info", "js_module_info")
load("//third_party/github.com/bazelbuild/bazel-skylib:rules/private/copy_file_private.bzl", "copy_bash", "copy_cmd")

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
    files = []
    typings = []
    js_files = []

    for src in ctx.files.srcs:
        if src.is_source and not src.path.startswith("external/"):
            dst = ctx.actions.declare_file(src.basename, sibling = src)
            if ctx.attr.is_windows:
                copy_cmd(ctx, src, dst)
            else:
                copy_bash(ctx, src, dst)
            if dst.basename.endswith(".d.ts"):
                typings.append(dst)
            else:
                files.append(dst)
        elif src.basename.endswith(".d.ts"):
            typings.append(src)
        else:
            files.append(src)

    for p in files:
        if p.basename.endswith(".js") or p.basename.endswith(".js.map") or p.basename.endswith(".json"):
            js_files.append(p)

    files_depset = depset(files)

    providers = [
        DefaultInfo(
            files = files_depset,
            runfiles = ctx.runfiles(files = ctx.files.srcs),
        ),
        AmdNamesInfo(names = ctx.attr.amd_names),
        js_module_info(depset(js_files)),
    ]

    if ctx.attr.package_name:
        path = "/".join([p for p in [ctx.bin_dir.path, ctx.label.workspace_root, ctx.label.package] if p])
        providers.append(LinkablePackageInfo(
            package_name = ctx.attr.package_name,
            path = path,
            files = files_depset,
        ))

    # Don't provide DeclarationInfo if there are no typings to provide.
    # Improves error messaging downstream if DeclarationInfo is required.
    if len(typings):
        providers.append(declaration_info(depset(typings)))

    return providers

_js_library = rule(
    implementation = _impl,
    attrs = {
        "amd_names": attr.string_dict(doc = _AMD_NAMES_DOC),
        "is_windows": attr.bool(mandatory = True, doc = "Automatically set by macro"),
        # module_name for legacy ts_library module_mapping support
        # TODO: remove once legacy module_mapping is removed
        "module_name": attr.string(),
        "package_name": attr.string(),
        "srcs": attr.label_list(
            allow_files = True,
            mandatory = True,
        ),
    },
)

def js_library(
        name,
        srcs,
        amd_names = {},
        package_name = None,
        **kwargs):
    """Internal use only. May be published to the public API in a future release."""
    module_name = kwargs.pop("module_name", None)
    if module_name:
        fail("use package_name instead of module_name in target //%s:%s" % (native.package_name(), name))
    if kwargs.pop("is_windows", None):
        fail("is_windows is set by the js_library macro and should not be set explicitely")
    _js_library(
        name = name,
        srcs = srcs,
        amd_names = amd_names,
        package_name = package_name,
        # module_name for legacy ts_library module_mapping support
        # TODO: remove once legacy module_mapping is removed
        module_name = package_name,
        is_windows = select({
            "@bazel_tools//src/conditions:host_windows": True,
            "//conditions:default": False,
        }),
        **kwargs
    )
