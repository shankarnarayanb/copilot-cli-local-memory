#!/usr/bin/env sh

set -eu

copilot_root=${COPILOT_HOME:-"$HOME/.copilot"}
extension_dir="$copilot_root/extensions/local-memory"
memory_dir="$copilot_root/instructions/local-memory"

rm -rf -- "$extension_dir"
echo "Removed extension: $extension_dir"

if [ "${1:-}" = "--purge-memories" ]; then
    rm -rf -- "$memory_dir"
    echo "Removed saved memories: $memory_dir"
else
    echo "Saved memories were kept: $memory_dir"
    echo "Run again with --purge-memories to delete them."
fi
