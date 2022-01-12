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

"""Install NodeJS & Yarn

This is a set of repository rules for setting up hermetic copies of NodeJS and Yarn.
See https://docs.bazel.build/versions/main/skylark/repository_rules.html
"""

load("@bazel_tools//tools/build_defs/repo:utils.bzl", "maybe")
load("@rules_nodejs//nodejs/private:os_name.bzl", "OS_ARCH_NAMES", "node_exists_for_os", "os_name")
load("@rules_nodejs//nodejs:repositories.bzl", "DEFAULT_NODE_VERSION", "nodejs_register_toolchains", node_repositories_rule = "node_repositories")
load("@rules_nodejs//nodejs:yarn_repositories.bzl", "yarn_repositories")
load("//internal/common:check_bazel_version.bzl", "check_bazel_version")

def node_repositories(**kwargs):
    """
    Wrapper macro around node_repositories_rule to call it for each platform.

    Also register bazel toolchains, and make other convenience repositories.

    Args:
      **kwargs: the documentation is generated from the node_repositories_rule, not this macro.
    """

    # Require that users update Bazel, so that we don't need to support older ones.
    check_bazel_version(
        message = """
    Bazel current LTS version (4.0.0) is the minimum required to use rules_nodejs.
    """,
        minimum_bazel_version = "4.0.0",
    )

    # Back-compat: allow yarn_repositories args to be provided to node_repositories
    yarn_args = {}
    yarn_name = kwargs.pop("yarn_repository_name", "yarn")
    for k, v in kwargs.items():
        if k.startswith("yarn_"):
            yarn_args[k] = kwargs.pop(k)
    yarn_repositories(
        name = yarn_name,
        **yarn_args
    )

    # This needs to be setup so toolchains can access nodejs for all different versions
    node_version = kwargs.get("node_version", DEFAULT_NODE_VERSION)
    for os_arch_name in OS_ARCH_NAMES:
        os_name = "_".join(os_arch_name)

        # If we couldn't download node, don't make an external repo for it either
        if not node_exists_for_os(node_version, os_name):
            continue
        node_repository_name = "nodejs_%s" % os_name
        maybe(
            node_repositories_rule,
            name = node_repository_name,
            **kwargs
        )

    # Install new toolchain under "nodejs" repository name prefix
    nodejs_register_toolchains(name = "nodejs")
