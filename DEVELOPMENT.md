# Running TapTapPaw yourself

Quick path: `./scripts/setup-dev.sh`

## Desktop app (Electron)
```
cd app
npm install --include=dev   # --include=dev matters if NODE_ENV=production is set in your shell (Electron is a devDependency)
npm run dev
```
macOS: grant **Accessibility** and **Input Monitoring** to the app that launches it (Terminal / VS Code / Electron).
Quit any installed TapTapPaw app first (only one program can hold the serial port).
Tray menu: pick your port (e.g. `/dev/tty.usbserial-10`), then use **Temperature Unit** and **Invert Display Colors**.

## Firmware (PlatformIO)
```
cd sketch
# set BOARD in include/app_config.h (USE_PURPLE_28_CAPACITIVE | USE_CYD_28_1 | USE_CYD_28_2)
pio run                                              # build
pio run -t upload   --upload-port /dev/tty.usbserial-10   # firmware
pio run -t uploadfs --upload-port /dev/tty.usbserial-10   # sounds (LittleFS), first time
```
Disconnect the desktop app first; it holds the serial port.

## Negative / inverted colors
Quickest: tray menu -> **Invert Display Colors**. Permanent: set `INVERT_COLORS_DEFAULT 1` in `app_config.h`, or try the
other board constant (`USE_CYD_28_1` runs the panel without inversion).

## Serial protocol additions
Settings packet: `[0xFF][0x04][len=1][flags]`, flags bit0 = Fahrenheit, bit1 = flip color inversion. Stored on the device.
Weather temperature byte is now signed (two's complement) so sub-zero values display correctly.

## Tips
- **On-device °C/°F:** tap the weather panel on the main screen. Saved on the device.
- **PlatformIO needs Python <= 3.13:** on macOS, Homebrew Python 3.14/3.15 broke `pip` for PlatformIO's esptool install
  (truststore bug). Use a venv from an older Python (e.g. `/usr/bin/python3 -m venv ~/.venvs/pio && ~/.venvs/pio/bin/pip install platformio`).
- **Wrong touch / no touch on resistive boards:** the firmware calibrates on first boot; to redo it, hold BOOT while powering up.
