#!/bin/sh
# Creates the per-terminal launcher. Plain `claude` stays mod-free.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$HOME/.local/bin"
printf '#!/bin/sh\nexec claude --plugin-dir "%s" "$@"\n' "$HERE" > "$HOME/.local/bin/claude-band"
chmod +x "$HOME/.local/bin/claude-band"
echo "installed: ~/.local/bin/claude-band -> $HERE"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "note: add ~/.local/bin to PATH";; esac
