const {
  app,
  Tray,
  Menu,
  dialog,
  shell,
  BrowserWindow,
  ipcMain,
} = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const {
  listPorts,
  connectTo,
  disconnect,
  stopWindowsBridge,
  startStateUpdateLoop,
  requestFirmwareVersion,
} = require("../core/taptappaw");


let tray = null;
const CONFIG_PATH = path.join(app.getPath("userData"), "port-config.json");
const FIRMWARE_MANIFEST_URL =
  "https://raw.githubusercontent.com/VaAndCob/webpage/main/firmware/taptappaw/taptappaw_purple_28_capacitive_manifest.json";
const GITHUB_LATEST_RELEASE_URL =
  "https://api.github.com/repos/vaandcob/taptappaw/releases/latest";
let currentPortPath = null;
let lastTrayStatus = "Initializing...";

// ----------- Function ------------------
function getTrayIconPath() {
  if (process.platform === "darwin") {
    // MUST end with Template.png for macOS tray
    return path.join(__dirname, "../assets/iconTemplate.png");
  } else {
    return path.join(__dirname, "../assets/icon-win.png");
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("Failed to save config", e);
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch (e) {
    console.error("Failed to load config", e);
  }
  return {};
}

function fetchJson(url, headers, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    console.log(`fetchJson: GET ${url}`);
    const options = headers ? { headers } : undefined;
    const req = https.get(url, options, (res) => {
        console.log(`fetchJson: ${url} -> ${res.statusCode}`);
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      console.error(`fetchJson: ${url} -> timeout after ${timeoutMs}ms`);
      req.destroy(new Error("Request timed out"));
    });
  });
}

function isNewerVersion(latest, current) {
  const latestParts = String(latest).split(".").map((n) => parseInt(n, 10));
  const currentParts = String(current).split(".").map((n) => parseInt(n, 10));

  if (latestParts.some(Number.isNaN) || currentParts.some(Number.isNaN)) {
    return false;
  }

  const len = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < len; i += 1) {
    const a = latestParts[i] || 0;
    const b = currentParts[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

function normalizeVersion(version) {
  if (version === null || version === undefined) return "";
  return String(version).trim().replace(/^v/i, "");
}

function buildDownloadUrl(tagName) {
  const tag = String(tagName || "").trim();
  if (!tag) return null;

  if (process.platform === "darwin") {
    return `https://github.com/VaAndCob/TapTapPaw/releases/download/${tag}/TapTapPaw-${tag.replace(/^v/i, "")}-arm64.dmg`;
  }
  if (process.platform === "win32") {
    return `https://github.com/VaAndCob/TapTapPaw/releases/download/${tag}/TapTapPaw.Setup.${tag.replace(/^v/i, "")}.exe`;
  }
  return null;
}

async function checkAppUpdate() {
  try {
    const currentVersion = normalizeVersion(app.getVersion());
    console.log(`App version check: current=${currentVersion}`);

    const release = await fetchJson(GITHUB_LATEST_RELEASE_URL, {
      "User-Agent": "TapTapPaw",
      Accept: "application/vnd.github+json",
    });
    const latestTag = release?.tag_name;
    const latestVersion = normalizeVersion(latestTag);

    if (!latestVersion) {
      console.warn("GitHub release missing tag_name.");
      return;
    }
    console.log(`App version check: latest=${latestVersion} (tag ${latestTag})`);

    if (isNewerVersion(latestVersion, currentVersion)) {
      const downloadUrl = buildDownloadUrl(latestTag);
      const platformLabel =
        process.platform === "darwin"
          ? "macOS Apple Silicon"
          : process.platform === "win32"
            ? "Windows x64"
            : "your platform";

      const result = await dialog.showMessageBox({
        type: "info",
        buttons: ["Open Download Page", "OK"],
        defaultId: 0,
        cancelId: 1,
        title: "Update Available",
        message: "A newer TapTapPaw app version is available.",
        detail: `Current: ${currentVersion}\nLatest: ${latestVersion}\n\nDownload (${platformLabel})`,
      });

      if (result.response === 0) {
        if (downloadUrl) {
          await shell.openExternal(downloadUrl);
        } else {
          await shell.openExternal("https://github.com/VaAndCob/TapTapPaw/releases/latest");
        }
      }
    } else {
      console.log("No app update available.");
    }
  } catch (err) {
    console.error("App update check failed:", err);
  }
}

async function checkFirmwareUpdate() {
  try {
    const config = loadConfig();
    const currentVersion = config.firmwareVersion;
    console.log(`Firmware version check: current=${currentVersion || "unknown"}`);
    if (!currentVersion) {
      console.warn("Firmware version not available yet.");
      return;
    }

    const manifest = await fetchJson(FIRMWARE_MANIFEST_URL, {
      "User-Agent": "TapTapPaw",
      Accept: "application/json",
    });
    const latestVersion = manifest?.version;
    console.log(`Firmware version check: latest=${latestVersion || "unknown"}`);
    if (!latestVersion) {
      console.warn("Firmware manifest missing version.");
      return;
    }

    if (isNewerVersion(latestVersion, currentVersion)) {
      saveConfig({
        ...config,
        firmwareUpdateAvailable: true,
        latestFirmwareVersion: latestVersion,
      });
      const result = await dialog.showMessageBox({
        type: "info",
        buttons: ["Open Download Page", "OK"],
        defaultId: 0,
        cancelId: 1,
        title: "Firmware Update Available",
        message: "A newer 🐾TapTapPaw🐾 firmware is available.",
        detail: `Current: ${currentVersion}\nLatest: ${latestVersion}\n\nDownload instructions:\n1. Open the download page.\n2. Select the TapTapPaw tab.`,
      });
      if (result.response === 0) {
        await shell.openExternal("https://vaandcob.github.io/webpage/src/index.html?tab=taptappaw");
      }
      updateTrayMenu(lastTrayStatus);
    } else {
      saveConfig({
        ...config,
        firmwareUpdateAvailable: false,
        latestFirmwareVersion: latestVersion,
      });
      console.log("No firmware update available.");
      updateTrayMenu(lastTrayStatus);
    }
  } catch (err) {
    console.error("Firmware update check failed:", err);
  }
}

async function updateTrayMenu(status) {
  if (!tray) return;

  lastTrayStatus = status;
  const version = app.getVersion();
  const config = loadConfig();
  const locationMode = config.location?.mode || "auto";
  const latestFirmwareVersion = config.latestFirmwareVersion || "unknown";
  const firmwareLabel = config.firmwareUpdateAvailable
    ? `Firmware: Update Available! (${latestFirmwareVersion})`
    : config.firmwareVersion
      ? `Firmware: ${config.firmwareVersion}`
      : "Firmware: Unknown";
  console.log(
    `Tray firmware label: ${firmwareLabel} (version=${config.firmwareVersion || "unknown"}, update=${config.firmwareUpdateAvailable ? "yes" : "no"})`,
  );

  const loginSettings = app.getLoginItemSettings();
  const openAtLogin = loginSettings.openAtLogin;

  const ports = await listPorts();
  const portItems = ports.map((p) => ({
    label: p.path,
    type: "radio",
    checked: p.path === currentPortPath,
    click: () => connectToPort(p.path),
  }));

  const contextMenu = Menu.buildFromTemplate([
    { label: `🐾 TapTapPaw ${version} by Va&Cob 🐾`, enabled: true,
        click: async () => {
        await shell.openExternal("https://github.com/VaAndCob/taptappaw");
        }
     },
     {
       label: firmwareLabel,
       enabled: true,
       click: async () => {
         if (config.firmwareUpdateAvailable) {
           await shell.openExternal("https://vaandcob.github.io/webpage/src/index.html?tab=taptappaw");
         }
       },
     },
    { type: "separator" },
    { id: "portStatus", label: "STATUS - " + status, enabled: true },
    {
      label: "Select Port",
      submenu: portItems.length > 0 ? portItems : [{ label: "No ports found", enabled: false }],
    },
 
        {
      label: "❌ Disconnect",
      enabled: currentPortPath !== null,
      click: () => disconnectPort(),
    },
    { type: "separator" },
    {
      label: "📍 Weather Condition Geolocation",
      submenu: [
        {
          label: "Auto-detect",
          type: "radio",
          checked: locationMode === "auto",
          click: () => setLocationMode("auto"),
        },
        {
          label: "Set Manually...",
          type: "radio",
          checked: locationMode === "manual",
          click: () => setLocationManually(),
        },
      ],
    },
    { type: "separator" },
    {
      label: "🖥 Run on Startup",
      type: "checkbox",
      checked: openAtLogin,
      click: (item) => {
        // This will work correctly only in a packaged app.
        // In development, it may register the Electron executable itself.
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          path: app.getPath('exe'),
          args: [
            // This argument is added so that the app can detect it was
            // launched on startup and decide to, for example, not show a window.
            '--hidden',
            // In development, we need to pass the path to the main script.
            // In production, the app is self-contained and this is not needed.
            ...(app.isPackaged ? [] : [path.resolve(process.argv[1])])
          ]
        });
      },
    },
    { type: "separator" },
    {
      label: "🚪Quit",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function connectToPort(portPath) {
  checkAppUpdate();
  updateTrayMenu(`Connecting to ${portPath}...`);
  const config = loadConfig();

  connectTo(
    portPath,
    async (portInfo) => {
      currentPortPath = portPath;
      const newConfig = { ...config, lastPort: portPath };
      saveConfig(newConfig);
      updateTrayMenu(`Connected to ${portPath}`);
      try {
        const firmwareVersion = await requestFirmwareVersion();
        const nextConfig = {
          ...loadConfig(),
          firmwareVersion,
        };
        saveConfig(nextConfig);
        updateTrayMenu(`Connected to ${portPath}`);
        await checkFirmwareUpdate();
      } catch (err) {
        console.error("Firmware version read failed:", err.message);
      } finally {
        startStateUpdateLoop();
      }
    },
    (error) => {
      currentPortPath = null;
      updateTrayMenu(`Error: ${error.message}`);
      dialog.showErrorBox(
        "TapTapPaw Serial Error",
        error?.message || "Unknown serial error",
      );
    },
    { location: config.location, deferStart: true },
  );
}

function disconnectPort() {
  disconnect(() => {
    currentPortPath = null;
    updateTrayMenu("Disconnected");
  });
}

function setLocationMode(mode) {
  const config = loadConfig();
  if (!config.location) config.location = {};
  config.location.mode = mode;
  saveConfig(config);

  if (currentPortPath) {
    connectToPort(currentPortPath); // Reconnect to apply changes
  }
  updateTrayMenu(currentPortPath ? `Connected to ${currentPortPath}` : "Disconnected");
}

async function setLocationManually() {
  await shell.openExternal("https://www.google.com/maps");

  const promptContent = `
    <html>
      <body style="font-family: sans-serif; padding: 1em; text-align: center; background-color: #282c34; color: white;">
        <h3>Enter Coordinates</h3>
        <p>Find coordinates on Google Maps, then paste them here.</p>
        <form style="display: flex; flex-direction: column; align-items: center;">
          <div style="display: flex; justify-content: center; align-items: center;">
            Lat: <input id="lat" type="text" placeholder="e.g., 40.7128" required style="margin-right: 10px; width: 180px;" />
            Lon: <input id="lon" type="text" placeholder="e.g., -74.0060" required style="width: 180px;" /></div><br/>
          <button type="submit" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background-color: #4CAF50; color: white; border: none; border-radius: 5px;">💾 Save</button>
        </form>
        <script>
          const { ipcRenderer } = require('electron'); // This is safe because nodeIntegration is true for this specific window
          document.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            const lat = document.querySelector('#lat').value;
            const lon = document.querySelector('#lon').value;
            if (lat && lon) {
              ipcRenderer.send('manual-location-update', { lat, lon });
            }
          });
        </script>
      </body>
    </html>
  `;

  const promptWindow = new BrowserWindow({
    width: 500, height: 250, title: "Enter Coordinates", autoHideMenuBar: true, alwaysOnTop: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  promptWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(promptContent)}`);

  ipcMain.once("manual-location-update", (event, { lat, lon }) => {
    if (promptWindow && !promptWindow.isDestroyed()) promptWindow.close();

    const config = loadConfig();
    if (!config.location) config.location = {};
    config.location.mode = "manual";
    config.location.lat = parseFloat(lat);
    config.location.lon = parseFloat(lon);
    saveConfig(config);

    if (currentPortPath) connectToPort(currentPortPath);
    updateTrayMenu(currentPortPath ? `Connected to ${currentPortPath}` : "Disconnected");
  });
}

process.on("exit", stopWindowsBridge);
process.on("SIGINT", () => {
  stopWindowsBridge();
  process.exit();
});
process.on("SIGTERM", () => {
  stopWindowsBridge();
  process.exit();
});

//===================================================
// APP Entry Point
//===================================================
app.whenReady().then(async () => {
  try {
    // --- macOS tray-only mode ---
    if (process.platform === "darwin") {
      app.setActivationPolicy("accessory");
    }

    // --- Create tray FIRST ---
    const iconPath = getTrayIconPath();
    tray = new Tray(iconPath);
    tray.setToolTip("TapTapPaw");
    updateTrayMenu("Initializing...");
   // checkFirmwareUpdate();
    
    // Add click handler to open menu on left click
    tray.on("click", async () => {
      await updateTrayMenu(lastTrayStatus);
      tray.popUpContextMenu();
    });
    // Right click does nothing
     tray.on("right-click", () => {});
    console.log("Tray created successfully");


    // --------------------------------------------------
    // SERIAL INITIALIZATION (wrapped safely)
    // --------------------------------------------------

    let ports = [];
    try {
      ports = await listPorts();
      console.log("Ports:", ports);
    } catch (err) {
      console.error("Serial list failed:", err);
    }

    const config = loadConfig();
    let autoConnected = false;

    if (config?.lastPort && ports.length > 0) {
      const portExists = ports.find((p) => p.path === config.lastPort);
      if (portExists) {
        try {
          connectToPort(config.lastPort);
          autoConnected = true;
        } catch (err) {
          console.error("Auto connect failed:", err);
        }
      }
    }

    if (!autoConnected) {
      updateTrayMenu("Select a port");
    }
  } catch (err) {
    console.error("Startup failure:", err);
  }
});

app.on("window-all-closed", (e) => {
  e.preventDefault();
});


app.on("before-quit", stopWindowsBridge);
