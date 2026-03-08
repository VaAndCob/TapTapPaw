# 🐾 TapTapPaw

TapTapPaw is a macOS tray utility that:

-   Monitors global keyboard and mouse activity
-   Collects system statistics (CPU, RAM, battery, time)
-   Detects media playback status
-   Sends real-time data to an ESP32 via Serial (115200 baud)
-   Runs as a lightweight background utility (no main window)

Designed for hardware integration and live device dashboards.

------------------------------------------------------------------------

# 📦 Installation (macOS)

## 1. Download & Install

1.  Open the provided `.dmg` file.
2.  Drag **TapTapPaw.app** into the **Applications** folder.
3.  Open **Applications** and launch **TapTapPaw**.

If macOS warns that the app is from the internet:

-   Right-click → **Open**
-   Click **Open** again

------------------------------------------------------------------------

# 🔐 Required macOS Permissions

TapTapPaw uses a global input hook to monitor keyboard and mouse
activity.

You must grant the following permissions:

-   ✅ Accessibility\
-   ✅ Input Monitoring

Go to:

System Settings → Privacy & Security

Enable TapTapPaw under:

-   Accessibility
-   Input Monitoring

After enabling permissions:

-   Fully quit the app
-   Relaunch it

Changes do not apply live.

------------------------------------------------------------------------

# 🔌 Serial Connection

TapTapPaw communicates with ESP32 over serial at:

115200 baud

To connect:

1.  Click the tray icon (menu bar).
2.  Select **Scan Ports**.
3.  Choose your ESP32 serial port.
4.  Status will change to **Connected**.

The last selected port is remembered automatically.

------------------------------------------------------------------------

# 📡 Data Packet Structure

## Status Packet (Sent Every \~100ms)

\[0xFF\] Start Byte\
\[0x01\] Status Header\
\[data_len\]\
\[evt\]\
\[cpu\]\
\[mem_used%\]\
\[battery%\]\
\[charging\]\
\[hour\]\
\[min\]\
\[sec\]\
\[media_state\]

### Event Byte (evt)

Bit flags:

Bit 0 → Keyboard activity\
Bit 1 → Mouse movement\
Bit 2 → Mouse click

------------------------------------------------------------------------

## Music Packet (When Track Changes)

\[0xFF\]\
\[0x02\]\
\[data_length\]\
\[title_length\]\
\[title_bytes\]\
\[artist_length\]\
\[artist_bytes\]

Sent when media track changes.

------------------------------------------------------------------------

# 🛠 Troubleshooting

## Keyboard / Mouse Not Detected

If system stats work but keyboard/mouse bits never change:

### Step 1 --- Remove old TapTapPaw permission from 
1. Accessiblity
2. Input Monitoring ( - )

TRY RUN TapTapPaw once again. 

if not work.

### Step 2 --- Reset TCC

Open Terminal:

tccutil reset Accessibility\
tccutil reset All

### Step 3 --- Reboot

Restart macOS.

### Step 4 --- Reinstall

1.  Launch once.
2.  Re-enable Accessibility and Input Monitoring.
3.  Fully quit.
4.  Relaunch.

------------------------------------------------------------------------

# 🧪 Development

## Run in Development Mode

npm install\
npm run dev

## Build macOS DMG

npm run build:mac

Development builds are unsigned. macOS may require permission
re-approval after rebuilding.

------------------------------------------------------------------------

# ⚠️ Important Notes

-   macOS permissions are tied to the app binary hash.
-   Rebuilding the app may require re-granting permissions.
-   For production distribution, proper Apple Developer ID signing is
    recommended.

------------------------------------------------------------------------

# 🧠 Architecture Overview

-   Electron (Tray-only app)
-   iohook (macOS global input hook)
-   serialport (ESP32 communication)
-   systeminformation (CPU/RAM/Battery)
-   AppleScript integration (Media status)

------------------------------------------------------------------------

# 📌 Requirements

-   macOS (Apple Silicon supported)
-   ESP32 device
-   USB serial connection

------------------------------------------------------------------------

# 🐾 About

TapTapPaw is designed for hardware integration projects where live
system and activity telemetry must be streamed to an external device.

Lightweight. Event-driven. Real-time.
