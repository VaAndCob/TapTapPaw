#!/usr/bin/env bash
# One-shot dev setup for TapTapPaw (macOS / Linux). Run from the repo root: ./scripts/setup-dev.sh
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1 -> $2"; exit 1; }; }
need node "install Node 20+ (https://nodejs.org or 'brew install node')"
need npm  "comes with Node"
need python3 "install Python 3 ('brew install python')"

echo "== Desktop app deps (app/) =="
# --include=dev: Electron is a devDependency and would be skipped if NODE_ENV=production is set in your shell
( cd app && npm install --include=dev )

echo "== PlatformIO (firmware build/flash) =="
if ! command -v pio >/dev/null 2>&1; then
  python3 -m pip install --user platformio
  echo "If 'pio' is not found afterwards, add ~/.local/bin (Linux) or ~/Library/Python/3.x/bin (macOS) to PATH."
fi

cat <<'MSG'

Done. Next:
  Run the desktop app:   cd app && npm run dev
  Build firmware:        cd sketch && pio run
  Flash firmware:        cd sketch && pio run -t upload --upload-port /dev/tty.usbserial-10
  Flash sounds (first time only / after data/ changes):
                         cd sketch && pio run -t uploadfs --upload-port /dev/tty.usbserial-10

Quit the TapTapPaw app (or Disconnect in its tray menu) before flashing: it holds the serial port.
MSG
