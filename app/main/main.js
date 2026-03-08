const {
  app,
  Tray,
  Menu,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { listPorts, connectTo, disconnect } = require("../core/taptappaw");
const { get } = require("http");

let tray = null;
const CONFIG_PATH = path.join(app.getPath("userData"), "port-config.json");

function getTrayIconPath() {
  if (process.platform === "darwin") {
    // MUST end with Template.png for macOS tray
    return path.join(__dirname, "../assets/iconTemplate.png");
  } else {
    return path.join(__dirname, "../assets/icon-win.png");
  }
}

function saveConfig(portPath) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ lastPort: portPath }));
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

async function updateTrayMenu(status, currentPortPath) {
  if (!tray) return;

  const ports = await listPorts();
  const portItems = ports.map((p) => ({
    label: p.path,
    type: "radio",
    checked: p.path === currentPortPath,
    click: () => connectToPort(p.path),
  }));

  const contextMenu = Menu.buildFromTemplate([
    { label: "🐾 TapTapPaw by Va&Cob 🐾", enabled: true,
        click: async () => {
        await shell.openExternal("https://github.com/VaAndCob/taptappaw");
        }
     },

    { id: "portStatus", label: "STATUS - " + status, enabled: false },
    { type: "separator" },
    {
      label: "🔄Scan Ports",
      click: () => updateTrayMenu(status, currentPortPath),
    },
    { label: "Select Port:", enabled: false },
    ...portItems,
    { type: "separator" },
    {
      label: "❌Disconnect",
      enabled: currentPortPath !== null,
      click: () => disconnectPort(),
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
  updateTrayMenu(`Connecting to ${portPath}...`, portPath);

  connectTo(
    portPath,
    (portInfo) => {
      saveConfig(portPath);
      updateTrayMenu(`Connected to ${portPath}`, portPath);
    },
    (error) => {
      updateTrayMenu(`Error: ${error.message}`, null);
      dialog.showErrorBox(
        "TapTapPaw Serial Error",
        error?.message || "Unknown serial error",
      );
    },
  );
}

function disconnectPort() {
  disconnect(() => {
    updateTrayMenu("Disconnected", null);
  });
}


function stopWindowsBridge() {
  if (bridgeProcess) {
    bridgeProcess.kill();
    bridgeProcess = null;
  }
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


//App entry point
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
    updateTrayMenu("Initializing...", null);
    
    // Add click handler to open menu on left click
    tray.on("click", () => tray.popUpContextMenu());
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
      updateTrayMenu("Select a port", ports);
    }
  } catch (err) {
    console.error("Startup failure:", err);
  }
});

app.on("window-all-closed", (e) => {
  e.preventDefault();
});


app.on("before-quit", stopWindowsBridge);

