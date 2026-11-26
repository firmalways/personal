#!/bin/sh
# Package the extension as a zip for "Load unpacked", the Chrome Web Store or Edge Add-ons.
set -eu
cd "$(dirname "$0")/.."
version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
out="dist/firmalways-personal-v${version}.zip"
rm -f "$out"
zip -qr "$out" manifest.json _locales icons assets src LICENSE PRIVACY.md
echo "$out"
