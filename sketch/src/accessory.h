#pragma once
#include <Arduino.h>
#include <LittleFS.h>
#include <Preferences.h>
#include "LGFX_CYD.h"
extern LGFX tft; /* LGFX instance */
extern Preferences pref;

#define BUTTON_PIN 0
#define LDR_PIN 34
#define LED_RED_PIN 4
#define LED_GREEN_PIN 16
#define LED_BLUE_PIN 17

#define SD_MOSI 23
#define SD_MISO 19
#define SD_SCK 18
#define SD_CS 5

#define SPEAKER_PIN 26
#define SPEAKER_CH 2


//-----------------------------
extern uint8_t volume;
extern bool sound_on;
extern bool flip;
extern uint8_t rotation;
extern bool dim; // back light dim flag
extern uint8_t dim_brightness;
extern uint8_t brightness;
//-----------------------------



void initSpeaker();

// playToneWithVolume(2000, 20, 200);  // 20% volume, 2000 Hz, 200ms
void playToneWithVolume(uint16_t freq, uint8_t volumePercent, uint16_t duration);

void audioPauseForTone();
void audioResumeAfterTone();

void beepbeep();
void beep();
void clickSound();
void offSound();


void autoDim();

// led_onoff function
void led_color(bool r, bool g, bool b  );

//------------- configuration
void load_config();
void save_config();

void initLittleFS();
