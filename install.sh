#!/usr/bin/env sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
runtime_dir="$script_dir/extensions/local-memory"
copilot_root=${COPILOT_HOME:-"$HOME/.copilot"}
extension_dir="$copilot_root/extensions/local-memory"
timestamp=$(date +%Y%m%d%H%M%S)

for source_file in extension.mjs memory-store.mjs; do
    if [ ! -f "$runtime_dir/$source_file" ]; then
        echo "Missing required file: $runtime_dir/$source_file" >&2
        exit 1
    fi
done

mkdir -p "$extension_dir"

for source_file in extension.mjs memory-store.mjs; do
    destination="$extension_dir/$source_file"
    if [ -f "$destination" ]; then
        cp -p "$destination" "$destination.bak.$timestamp"
    fi
    cp "$runtime_dir/$source_file" "$destination"
done

echo "Installed Copilot CLI Local Memory to:"
echo "  $extension_dir"
echo
echo "Next steps:"
echo "  1. Start Copilot CLI with: copilot --experimental"
echo "  2. Run: /extensions manage"
echo "  3. Try: /remember Always run tests before committing."
