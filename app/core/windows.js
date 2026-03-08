const { uIOhook } = require('uiohook-napi');


// mutable state object exported to callers
const state = {
  kb: false,
  mouseMove: false,
  mouseClick: false
};

// emitter for custom events (e.g. mouse stopped)
//const emitter = new EventEmitter();

// -------- Keyboard Logging --------
uIOhook.on('keydown', event => {
 //console.log("Key down");
 state.kb = true;
});

uIOhook.on('keyup', event => {
  //console.log("Key up");
  state.kb = false;
});

let stopTimer;
const STOP_DELAY = 150; // ms without movement to consider "stopped"

uIOhook.on('mousemove', event => {
 //console.log("Mouse move");
  state.mouseMove = true;
 // reset/arm the stop timer
 clearTimeout(stopTimer);
 stopTimer = setTimeout(() => {

   state.mouseMove = false;

 }, STOP_DELAY);
});

uIOhook.on('mousedown', event => {
 // console.log("Mouse down");
 state.mouseClick = true;
});

uIOhook.on('mouseup', event => {
 //console.log("Mouse up");
 state.mouseClick = false;
});

uIOhook.start();

//------------------------------------------------------sdfsdfsadfsdfsdfdffdsdddfssdfsfsdfsd
// export the mutable state object (and any helpers if needed)
module.exports = state;

