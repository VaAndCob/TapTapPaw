# TapTapPaw

A cross-platform desktop application built with Electron.

![](../document/desktopapp.jpg)

## Description

TapTapPaw appears to be a utility that interfaces with hardware through a serial port while also monitoring system-wide keyboard and mouse inputs. It's designed to run on both Windows and macOS.

*(Please update this description with more specific details about your project's purpose!)*

## Features

- Cross-platform support (Windows & macOS).
- Listens for global keyboard and mouse events.
- Communicates with hardware devices via serial port.
- Persistent application data storage.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (which includes npm)
- [Git](https://git-scm.com/)
- **Windows Only:** Build tools for native modules (`npm install --global --production windows-build-tools`)

### Installation

1.  Clone the repository (replace `your-username` with your GitHub username):
    ```bash
    git clone https://github.com/your-username/TapTapPaw.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd TapTapPaw
    ```
3.  Install the dependencies. This will also trigger `electron-rebuild` for native modules.
    ```bash
    npm install
    ```

## Development

To run the application in development mode:

```bash
npm run dev
```

### Rebuilding Native Dependencies

If you encounter issues with native modules (like `iohook-macos`, `uiohook-napi`, or `serialport`), you may need to manually rebuild them for your specific Electron version:

```bash
npm run rebuild
```

## Building for Production

You can build the application for different platforms using the following scripts:

-   **Build for all configured platforms:**
    ```bash
    npm run build
    ```
-   **Build for Windows only:**
    ```bash
    npm run build:win
    ```
-   **Build for macOS only:**
    ```bash
    npm run build:mac
    ```

The distributable files will be located in the `dist/` directory.

## Core Technologies

-   Electron
-   electron-builder
-   uiohook-napi for global input listening.
-   node-serialport for serial communication.
-   electron-store for data persistence.
-   systeminformation for system info.
-   @foobar404/windows-media-controller for Windows media status.

---