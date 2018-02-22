"""The npm_package rule creates a directory containing a publishable npm artifact.

It also produces two named outputs:
:label.pack
:label.publish

These can be used with `bazel run` to create a .tgz of the package and to publish
the package to the npm registry, respectively.
"""

load("//internal:node.bzl", "sources_aspect")

def create_package(ctx, devmode_sources):
  """Creates an action that produces the npm package.

  It copies srcs and deps into the artifact and produces the .pack and .publish
  scripts.

  Args:
    ctx: the skylark rule context
    devmode_sources: the .js files which belong in the package

  Returns:
    The tree artifact which is the publishable directory.
  """

  package_dir = ctx.actions.declare_directory(ctx.label.name)

  args = ctx.actions.args()
  args.add(package_dir.path)
  args.add([s.path for s in ctx.files.srcs], join_with=",")
  args.add(ctx.bin_dir.path)
  args.add([s.path for s in devmode_sources], join_with=",")
  args.add([ctx.outputs.pack.path, ctx.outputs.publish.path])

  ctx.action(
      executable = ctx.executable._packager,
      inputs = ctx.files.srcs + devmode_sources + [ctx.file._run_npm_template],
      outputs = [package_dir, ctx.outputs.pack, ctx.outputs.publish],
      arguments = [args],
  )
  return package_dir

def _npm_package(ctx):
  files = depset()
  for d in ctx.attr.deps:
    files = depset(transitive = [files, d.files, d.node_sources])

  package_dir = create_package(ctx, files.to_list())

  return [DefaultInfo(
      files = depset([package_dir]),
  )]

NPM_PACKAGE_ATTRS = {
    "srcs": attr.label_list(allow_files = True),
    "deps": attr.label_list(aspects = [sources_aspect]),
    "_packager": attr.label(
        default = Label("//internal/npm_package:packager"),
        cfg = "host", executable = True),
    "_run_npm_template": attr.label(
        default = Label("@nodejs//:run_npm.sh.template"),
        allow_single_file = True),
}

NPM_PACKAGE_OUTPUTS = {
  "pack": "%{name}.pack",
  "publish": "%{name}.publish",
}

npm_package = rule(
    implementation = _npm_package,
    attrs = NPM_PACKAGE_ATTRS,
    outputs = NPM_PACKAGE_OUTPUTS,
)
