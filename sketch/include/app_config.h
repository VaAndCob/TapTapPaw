//This is the main configuration options before compile.
//-------------------------------------------

//2. Select board model options
#define USE_PURPLE_28_CAPACITIVE 1 // for CYD 2.8" Capacitive Touch Variant
#define USE_CYD_28_1 2 // for CYD 2.8" Variant 1
#define USE_CYD_28_2 3 // for CYD 2.8" Variant 2

// Enter the CYD model you want to compile
#define BOARD USE_CYD_28_2//<- Set board here
//-------------------------------------------

//3. Display / units defaults (can also be changed at runtime from the desktop app tray menu)
// Colors look negative/inverted? Set to 1 to flip the board's default panel inversion.
#ifndef INVERT_COLORS_DEFAULT
#define INVERT_COLORS_DEFAULT 0 // override at build time with -DINVERT_COLORS_DEFAULT=1
#endif
// 1 = show temperature in Fahrenheit by default
#ifndef USE_FAHRENHEIT_DEFAULT
#define USE_FAHRENHEIT_DEFAULT 0 // override at build time with -DUSE_FAHRENHEIT_DEFAULT=1
#endif

//4. Physical keys (MX switches wired to the CYD extension connectors) - see docs/KEYS_WIRING.md
#define KEYS_ENABLED 1 // 0 = disable local key inputs
#define KEY1_PIN 22 // CN1 / P3 (shared pin)
#define KEY2_PIN 27 // CN1
#define KEY3_PIN -1 // optional: 35 (P3, input-only, needs an external 10k pull-up to 3V3). -1 = unused
#define KEY_DEBOUNCE_MS 25
//-------------------------------------------
