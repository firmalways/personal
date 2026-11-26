#!/bin/sh
# Build release assets: the hook (tar.gz, installed by install.sh) and the browser extension (zip).
set -eu
cd "$(dirname "$0")/.."
version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
hook="dist/firmalways-personal-hook.tar.gz"
ext="dist/firmalways-personal-extension-v${version}.zip"
rm -f "$hook" "$ext"
COPYFILE_DISABLE=1 tar -czf "$hook" hook src/core src/i18n.js LICENSE PRIVACY.md README.md package.json
zip -qr "$ext" manifest.json _locales icons assets src LICENSE PRIVACY.md
cp install.sh dist/install.sh
echo "$hook"
echo "$ext"
