"Provide convenience repository for the host platform like @nodejs"

load("//nodejs/private:os_name.bzl", "os_name")

def _nodejs_host_os_alias_impl(repository_ctx):
    # Base BUILD file for this repository
    repository_ctx.file("BUILD.bazel", """# Generated by nodejs_repo_host_os_alias.bzl
package(default_visibility = ["//visibility:public"])
# aliases for exports_files
alias(name = "run_npm.sh.template",     actual = "@{node_repository}_{os_name}//:run_npm.sh.template")
alias(name = "run_npm.bat.template",    actual = "@{node_repository}_{os_name}//:run_npm.bat.template")
alias(name = "bin/node_repo_args.sh",   actual = "@{node_repository}_{os_name}//:bin/node_repo_args.sh")

# aliases for other aliases
alias(name = "node_bin",                actual = "@{node_repository}_{os_name}//:node_bin")
alias(name = "npm_bin",                 actual = "@{node_repository}_{os_name}//:npm_bin")
alias(name = "npx_bin",                 actual = "@{node_repository}_{os_name}//:npx_bin")
alias(name = "yarn_bin",                actual = "@{node_repository}_{os_name}//:yarn_bin")
alias(name = "node",                    actual = "@{node_repository}_{os_name}//:node")
alias(name = "npm",                     actual = "@{node_repository}_{os_name}//:npm")
alias(name = "yarn",                    actual = "@{node_repository}_{os_name}//:yarn")
alias(name = "npm_node_repositories",   actual = "@{node_repository}_{os_name}//:npm_node_repositories")
alias(name = "yarn_node_repositories",  actual = "@{node_repository}_{os_name}//:yarn_node_repositories")
alias(name = "node_files",              actual = "@{node_repository}_{os_name}//:node_files")
alias(name = "yarn_files",              actual = "@{node_repository}_{os_name}//:yarn_files")
alias(name = "npm_files",               actual = "@{node_repository}_{os_name}//:npm_files")
exports_files(["index.bzl"])
""".format(
        node_repository = repository_ctx.attr.user_node_repository_name,
        os_name = os_name(repository_ctx),
    ))

    # index.bzl file for this repository
    repository_ctx.file("index.bzl", content = """# Generated by nodejs_repo_host_os_alias.bzl
host_platform="{host_platform}"
""".format(host_platform = os_name(repository_ctx)))

nodejs_repo_host_os_alias = repository_rule(
    _nodejs_host_os_alias_impl,
    doc = """Creates a repository with a shorter name meant for the host platform, which contains

    - A BUILD.bazel file declaring aliases to the host platform's node binaries
    - index.bzl containing some constants
    """,
    attrs = {
        "user_node_repository_name": attr.string(
            default = "nodejs",
            doc = "User-provided name from the workspace file, eg. node16",
        ),
        # FIXME: this seems unused, but not the time to make that edit right now
        "node_version": attr.string(),
    },
)
