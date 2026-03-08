#pragma once
#include <Arduino.h>
#include <lvgl.h>
// state for non‑blocking animation handling
extern unsigned long last_sleep_check;
extern uint8_t evt, cpu, mem_used, battery, charging;

extern bool last_keyDown;
extern bool last_mouseMove;
extern bool last_mouseClick;
extern unsigned long last_chart_update;
extern lv_timer_t *random_mouse_timer;


//------------------------------------------

// sleepy animation (non-blocking)
// eyes blinking animation (non-blocking)
void sleepy_animation();
void eye_blink_animation();
void random_mouse_task(lv_timer_t *timer);
// analog clock animation
void clock_animation(uint8_t h, uint8_t m, uint8_t s);

// chart animation
void chart_animation(uint8_t cpu, uint8_t mem_used, uint8_t battery, bool charging);

// media play status
void media_play_status(uint8_t mediaState);

// media track information
void media_track_status(char *title, char *artist);