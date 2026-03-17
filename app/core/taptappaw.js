//-----------------------------------------
console.log("Starting TapTapPaw 🐾");
let si;
try {
  si = require("systeminformation");
} catch (err) {
  console.error(
    "⚠️  could not load 'systeminformation' module. run `npm install systeminformation` and restart.",
  );
  // we'll fall back to the built-in os module later
}
const { SerialPort } = require("serialport");

// choose correct input module depending on host OS
let system_os = 0; //darwing 1=windows

const platform = process.platform; // 'win32', 'darwin', etc.
let state;
if (platform === "darwin") {
  state = require("./macos.js");
  console.log("🖥 running on macOS");
} else {
  state = require("./windows.js");
  console.log("💻 running on Windows (or other)");
}

const { getWeather, getGeoLocation } = require("./weather.js");

// ---------------------------------------------------------
// ⚙️ CONFIGURATION
// ---------------------------------------------------------
const BAUD_RATE = 115200;
let port;
let queryLoopRunning = false;
let stateUpdateTimers = []; // To hold interval timer IDs'
let currentOptions = {};

async function listPorts() {
  return await SerialPort.list();
}

function connectTo(path, onConnect, onError, options) {
  currentOptions = options || {};
  if (port && port.isOpen) {
    port.close((err) => {
      if (err) console.log("Error closing port:", err.message);
      performOpen(path, onConnect, onError);
    });
  } else {
    performOpen(path, onConnect, onError);
  }
}

function disconnect(onDisconnect) {
  if (port && port.isOpen) {
    port.close((err) => {
      if (err) {
        console.log("Error closing port:", err.message);
      }
      stopStateUpdateLoop();
      currentOptions = {};
      if (onDisconnect) onDisconnect();
    });
  } else {
    stopStateUpdateLoop();
    currentOptions = {};
    if (onDisconnect) onDisconnect();
  }
}

function performOpen(path, onConnect, onError) {
  port = new SerialPort({
    path: path,
    baudRate: BAUD_RATE,
    autoOpen: false,
  });

  port.open((err) => {
    if (err) {
      console.log("❌ Error opening port:", err.message);
      if (onError) onError(err);
      return;
    }
    console.log(`✅ Connected on ${path}`);
    if (onConnect) onConnect({ path });

    if (!queryLoopRunning) {
      // set time once on connect
      startStateUpdateLoop();
      if (process.platform === "win32") {
         startWindowsBridge();
      }
      queryLoopRunning = true;
    }
  });
}

//for testing only
async function setupSerialPort(onConnect, onError) {
  try {
    const ports = await listPorts();
    if (ports.length === 0) {
      throw new Error("No serial ports found.");
    }

    // If running in Electron, auto-connect to the first port to avoid blocking on stdin
    if (process.versions.electron) {
      console.log(
        `🔌 Electron detected. Auto-connecting to first port: ${ports[0].path}`,
      );
      connectTo(ports[0].path, onConnect, onError);
      return;
    }

    console.log("Available serial ports:");
    ports.forEach((p, i) => {
      console.log(`${i + 1}: ${p.path}`);
    });

    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question("Please select a port: ", (selection) => {
      readline.close();
      const selectedPort = ports[parseInt(selection) - 1];
      if (!selectedPort) {
        const err = new Error("Invalid selection.");
        console.log("❌ Invalid selection.");
        if (onError) onError(err);
        return;
      }
      connectTo(selectedPort.path, onConnect, onError);
    });
  } catch (err) {
    console.log(`❌ ${err.message}`);
    if (onError) onError(err);
  }
}

//setupSerialPort();

function stopStateUpdateLoop() {
  if (!queryLoopRunning) return;
  console.log("Stopping state update loop...");
  stateUpdateTimers.forEach((timerId) => clearInterval(timerId));
  stateUpdateTimers = [];
  queryLoopRunning = false;
}

// ---------------------------------------------------------
// 🧠 MAIN LOOP
// ---------------------------------------------------------
// Note: System stats are now sent with each event in queryState()
// This function is intentionally kept minimal or removed
// as queryState() handles all serial communication

// ---------------------------------------------------------
// 📊 SYSTEM STATS
// ---------------------------------------------------------
const os = require("os");

async function getSystemStats() {
  // If the systeminformation module didn't load, use a simple os-based fallback
  if (!si) {
    const cpuUsage = os.loadavg()[0] * 100 || 0; // loadavg only meaningful on *nix
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    return {
      cpu: Math.round(cpuUsage),
      ram_used: memPercent,
      batt: 0,
      charging: false,
    };
  }

  try {
    const cpuData = await si.currentLoad();
    const memData = await si.mem();
    const battData = await si.battery();

    if (platform === "darwin") {
      return {
        cpu: Math.round(cpuData.currentLoad),
        ram_used: Math.round((memData.buffcache / memData.total) * 100), //macOS
        batt: battData.percent,
        charging: battData.isCharging,
      };
    } else {
      return {
        cpu: Math.round(cpuData.currentLoad),
        ram_used: Math.round((memData.used / memData.total) * 100), //windows
        batt: battData.percent,
        charging: battData.isCharging,
      };
    }
  } catch (e) {
    console.error("systeminformation error:", e.message);
    return { cpu: 0, ram_used: 0, batt: 0, charging: false };
  }
}

// ---------------------------------------------------------
// 🎵 MEDIA STATUS
// ---------------------------------------------------------
//for windows
let bridgeProcess = null;
let latestWindowsMedia = {
  state: 0,
  track: "",
  artist: "",
  app: ""
};

function stopWindowsBridge() {
  if (bridgeProcess && process.platform === "win32") {
    bridgeProcess.kill();
    bridgeProcess = null;
  }
}


function startWindowsBridge() {
  if (process.platform !== "win32") return;
  if (bridgeProcess) return; // already started

  let bridgePath;

if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, "MediaBridge.exe"))) {
  bridgePath = path.join(process.resourcesPath, "MediaBridge.exe");
} else {
  bridgePath = path.join(__dirname, "..", "resources", "MediaBridge.exe");
}

  if (!fs.existsSync(bridgePath)) {
    console.error("MediaBridge.exe not found:", bridgePath);
    return;
  }

  bridgeProcess = spawn(bridgePath, [], {
    windowsHide: true
  });
  console.log("MediaBridge started");
  bridgeProcess.stdout.on("data", (data) => {
    try {
      const json = JSON.parse(data.toString());
      latestWindowsMedia = {
        state: json.state || 0,
        track: json.track || "",
        artist: json.artist || "",
        app: json.app || ""
      };
    } catch (e) {
      console.error("Invalid JSON from MediaBridge:", data.toString());
    }
  });

  bridgeProcess.on("exit", (code) => {
    console.log("MediaBridge exited:", code);
    bridgeProcess = null;
  });
}

//---------------------------------------

const { execFile, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { send } = require("process");

async function getMediaInfo() {
    // =========================
    // macOS (your existing code)
    // =========================
  if (process.platform === "darwin") {

    const getPlayerInfo = (appName) => {
      return new Promise((resolve) => {
        const script = `
        if application "${appName}" is running then
          try
            tell application "${appName}"
              if player state is playing or player state is paused then
                set trackName to name of current track
                set artistName to artist of current track
                set pState to player state as string
                return pState & "||" & trackName & "||" & artistName
              end if
            end tell
          end try
        end if
        return "stopped||||"
        `;

        execFile('osascript', ['-e', script], (error, stdout, stderr) => {
          if (error || stderr) return resolve(null);

          const [stateStr, track, artist] = stdout.trim().split("||");
          const state = stateStr.toLowerCase();

          let numericState = 0;
          if (state === "playing") numericState = 1;
          else if (state === "paused") numericState = 2;

          resolve({
            state: numericState,
            track: track || "",
            artist: artist || "",
          });
        });
      });
    };

    const mediaApps = ["Spotify", "Music", "iTunes"];
    let pausedApp = null;

    for (const app of mediaApps) {
      const info = await getPlayerInfo(app);
      if (info && info.state === 1) return info;
      if (info && info.state === 2 && !pausedApp) pausedApp = info;
    }

    return pausedApp || { state: 0, track: "", artist: "" };
  }

 // =========================
// Windows (persistent bridge)
// =========================
  if (process.platform === "win32") {
    return latestWindowsMedia;
  }
  return { state: 0, track: "", artist: "" };
}



// Cache for system stats (updated every 1000ms)
let cachedSysData = {
  cpu: 0,
  ram_used: 0,
  batt: 0,
  charging: false,
  media: {
    state: 0, // 0: stopped, 1: playing, 2: paused
    track: "",
    artist: "",
  },
};

// Main loop to poll system state and send it to the device
function startStateUpdateLoop() {
  const start_header = 0xff;
  const status_header = 0x01; // 0x01 indicates this packet contains system status
  const data_length = 9; // Number of bytes in the data packet (excluding start byte and length byte)
  const WEATHER_UPDATE_INTERVAL = 15*60*1000; // 15 minutes
  const STAT_UPDATE_INTERVAL = 1000; // ms
  const SERIAL_SEND_INTERVAL = 100; // ms
  let lastStatUpdateTime = 0;

  // 1. keyboard & mouse monitoring 100 ms interval
  const serialSendTimer = setInterval(async () => {
    try {
      // one byte per input (bit positions):
      // bit0 = key down (1)
      // bit1 = mouse move (2)
      // bit2 = mouse click (4)
      const evt =
        (state.kb ? 1 : 0) |
        (state.mouseMove ? 2 : 0) |
        (state.mouseClick ? 4 : 0);

      // Build binary packet:
      // [0xff] [evt] [cpu] [mem_used%] [battery] [charging] [hour] [min] [sec] [media_state]
      const cpu = Math.min(Math.max(cachedSysData.cpu, 0), 255);
      const memUsed = Math.min(Math.max(cachedSysData.ram_used, 0), 100);
      const charging = cachedSysData.charging ? 0x01 : 0x00;
      const battery = Math.min(
        Math.max(Math.round(cachedSysData.batt), 0),
        100,
      );
      const date = new Date();
      const hour = date.getHours();
      const min = date.getMinutes();
      const sec = date.getSeconds();
      const mediaState = cachedSysData.media.state || 0;

      //buffer to send to ESP32 (10 bytes total)
      const buf = Buffer.from([
        start_header,
        status_header,
        data_length,
        evt,
        cpu,
        memUsed,
        battery,
        charging,
        hour,
        min,
        sec,
        mediaState,
      ]);
      // console.log(buf);
      if (port && port.isOpen) {
        port.write(buf, (err) => {
          if (err) console.log("Event write error:", err.message);
        });
      }
    } catch (error) {
      console.error("Error in state update loop:", error.message);
    }
  }, SERIAL_SEND_INTERVAL);
  stateUpdateTimers.push(serialSendTimer);

  // 2. SYSTEM STATUS and MEDIA INFOMATION every 1 sec
  const statUpdateTimer = setInterval(async () => {
    try {
      const sysStats = await getSystemStats();
      const mediaInfo = await getMediaInfo();

      // 2. Log track changes for user feedback
      if (mediaInfo.track && mediaInfo.track !== cachedSysData.media.track) {
        sendMusic(mediaInfo.track, mediaInfo.artist); // Send music info to ESP32
        console.log(
          `🎵 Now Playing: ${mediaInfo.track} by ${mediaInfo.artist}`,
        );
      } else if (!mediaInfo.track && cachedSysData.media.track) {
        console.log("🎵 Media stopped.");
      }

      cachedSysData = { ...sysStats, media: mediaInfo };
    } catch (error) {
      console.error("Error in state update loop:", error.message);
    }
  }, STAT_UPDATE_INTERVAL);
  stateUpdateTimers.push(statUpdateTimer);

  // 3. WEATHER CONDITION every 15 minutes
  const updateWeather = async () => {
    try {
      let location;
      const locationConfig = currentOptions.location || { mode: "auto" };

      if (locationConfig.mode === "manual" && locationConfig.lat && locationConfig.lon) {
        location = { lat: locationConfig.lat, lon: locationConfig.lon };
        console.log(
          `📍 Using manual location: Lat ${location.lat}, Lon ${location.lon}`,
        );
      } else {
        location = await getGeoLocation();
        console.log(`📍 Got location via IP: Lat ${location.lat}, Lon ${location.lon}`);
      }
      const weather = await getWeather(location.lat, location.lon);
      sendWeather(weather);
    } catch (error) {
      console.error("Error getting weather:", error.message);
    }
  };

  // Update weather immediately on start, then at the regular interval.
  updateWeather();
  const weatherUpdateTimer = setInterval(updateWeather, WEATHER_UPDATE_INTERVAL);
  stateUpdateTimers.push(weatherUpdateTimer);

} // startStateUpdate

//---------------------
/*
Music Packet Format:
[0xFF]        - Start byte
[0x02]        - Music packet header
[data_length] - Total length of the following data
[title_len]   - Length of title string
[...title]    - UTF-8 bytes of title
[artist_len]  - Length of artist string
[...artist]   - UTF-8 bytes of artist
*/
function sendMusic(title, artist) {
  const start_header = 0xff;
  const music_header = 0x02; // 0x02 indicates this packet contains music info
  const titleBuf = Buffer.from(title, "utf8");
  const artistBuf = Buffer.from(artist, "utf8");
  const dataLength = 1 + titleBuf.length + 1 + artistBuf.length;

  const packet = Buffer.concat([
    Buffer.from([start_header, music_header, dataLength, titleBuf.length]),
    titleBuf,
    Buffer.from([artistBuf.length]),
    artistBuf,
  ]);
  console.log(packet);
  if (port && port.isOpen) {
    port.write(packet, (err) => {
      if (err) console.log("Music write error:", err.message);
    });
  }
}


  /*
  Weather Packet Format:
[0xFF]        - Start byte
[0x03]        - Weather packet header
[data_length] - Total length of the following data
[weather_group] - Weather group 
[temp_c]      - Temperature in Celsius
[humid]       - Humidity percentage
[time_h]      - Hour of the day
[time_m]      - Minute of the hour
*/
function sendWeather(weather) {
  const start_header = 0xff;
  const weather_header = 0x03; // 0x03 weather packet
  const data_length = 5; // weather_group, temp_c, humid, time_h, time_m
  const weather_group = weather.weather_group;
  const temp_c = weather.temp_c;
  const humid = weather.humidity;
  const date = new Date(weather.observed_at);
  const time_h = date.getHours();
  const time_m = date.getMinutes();
  
  const packet =  Buffer.from([start_header, weather_header, data_length, weather_group, temp_c, humid, time_h, time_m]);

  console.log(packet);
  if (port && port.isOpen) {
    port.write(packet, (err) => {
      if (err) console.log("Weather write error:", err.message);
    });
  }
}

//------------------------------------

//================================
module.exports = { setupSerialPort, listPorts, connectTo, disconnect, stopWindowsBridge };
