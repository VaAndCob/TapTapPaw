/* TapTapPaw - A cute system monitor with keyboard/mouse interaction
 * @file main.cpp
 * @author Va&Cob
 * @date 2026-02-24
 * @Copyright (c) 2026 Va&Cob
 *
 * Hardware: CYD 2.8" ESP32 Dev Board
 * IDE: PlatformIO
 * Partition scheme: Custom LittleFS (1.75 MB App with OTA / 300KB LittleFS)
 */
// #define DEBUG_PACKET // Uncomment to enable serial packet debugging
//  Library

//-------------------------------------------------------
#include <Arduino.h>
const char *firmware_version = "1.0.3";
const String version = String(firmware_version) + " | " __DATE__ "-" __TIME__;
//-------------------------------------------------------
#include "LGFX_CYD.h"
#include "ui/ui.h"

#include <lvgl.h>

#include "accessory.h"
#include "animation.h"

//-------------------------------------------------------
#include "audio/I2SAudio.h"
#include "audio/WAVFileReader.h"
#include <driver/dac.h>
#include <driver/gpio.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
DACOutput *output = nullptr;
static bool audio_i2s_active = false;
static uint32_t audio_last_sample_rate = 0;
typedef struct {
  char path[64];
} AudioRequest;
static QueueHandle_t audio_queue = nullptr;
static TaskHandle_t audio_task_handle = nullptr;
static volatile bool audio_playing = false;
//-------------------------------------------------------

#define TFT_WIDTH 320
#define TFT_HEIGHT 240
#define CONNECTION_TIMEOUT 2000 // serial connection timeout in ms
#define SLEEPMODE_TIMEOUT 5 * 60 * 1000 // put display to sleep after disconnect for 5 min

LGFX tft; /* LGFX instance */
// variable
uint16_t x, y;

// Serial packet parsing
static uint8_t packet[256];
static uint8_t packetIndex = 0;
uint8_t b = 0;
static uint8_t packetLength = 0;

unsigned long connect_timer = 0;
bool app_connected = false;
bool last_connected_state = true;

const lv_img_dsc_t weather_icon[6] = {ui_img_sun_png, ui_img_cloud_png, ui_img_rain_png, ui_img_storm_png, ui_img_snow_png, ui_img_moon_png};

//-----------------------------------
static void audioTask(void *param) {
  const int buffer_size = 512;
  int16_t buffer[buffer_size];
  AudioRequest req;

  for (;;) {
    if (xQueueReceive(audio_queue, &req, portMAX_DELAY) != pdTRUE) {
      continue;
    }

    AudioRequest pending;
    bool has_pending = false;

    FILE *fp = fopen(req.path, "rb");
    if (!fp) {
      continue;
    }

    WAVFileReader *reader = new WAVFileReader(fp);

    // Fully reset audio output each play to avoid driver leftovers
    if (output) {
      output->stop();
      delete output;
      output = nullptr;
    }
    dac_output_disable(DAC_CHANNEL_2);
    gpio_reset_pin(GPIO_NUM_26);
    // Release LEDC on speaker pin before enabling DAC (GPIO26)
    ledcWrite(SPEAKER_CH, 0);
    ledcDetachPin(SPEAKER_PIN);
    output = new DACOutput();
    output->start(reader->sample_rate());
    audio_last_sample_rate = reader->sample_rate();
    audio_i2s_active = true;
    audio_playing = true;

    while (true) {
      int read = reader->read(buffer, buffer_size);
      if (read > 0) {
        uint8_t vol = volume;
        if (vol > 100) {
          vol = 100;
        }
        if (vol < 100) {
          for (int i = 0; i < read; i++) {
            int32_t s = (int32_t)buffer[i] * vol / 100;
            if (s > 32767) {
              s = 32767;
            } else if (s < -32768) {
              s = -32768;
            }
            buffer[i] = (int16_t)s;
          }
        }
        output->write(buffer, read);
      } else {
        break;
      }

      AudioRequest tmp;
      if (xQueueReceive(audio_queue, &tmp, 0) == pdTRUE) {
        pending = tmp;
        has_pending = true;
      }
      vTaskDelay(1);
    }

    if (output && audio_i2s_active) {
      output->stop();
      delete output;
      output = nullptr;
      audio_i2s_active = false;
      dac_output_disable(DAC_CHANNEL_2);
      gpio_reset_pin(GPIO_NUM_26);
    }
    // Restore LEDC tone output after DAC playback
    vTaskDelay(5);
    initSpeaker();
    vTaskDelay(5);

    fclose(fp);
    delete reader;
    audio_playing = false;

    if (has_pending) {
      xQueueOverwrite(audio_queue, &pending);
    }
  }
}

void playAudio(const char *filename) {
  if (!audio_queue || !sound_on) {
    return;
  }
  AudioRequest req;
  snprintf(req.path, sizeof(req.path), "/littlefs/%s", filename);
  req.path[sizeof(req.path) - 1] = '\0';
  xQueueOverwrite(audio_queue, &req);
}
//-----------------------------------------

void my_disp_flush(lv_disp_drv_t *disp_drv, const lv_area_t *area, lv_color_t *color_p) {
  uint32_t w = (area->x2 - area->x1 + 1);
  uint32_t h = (area->y2 - area->y1 + 1);
  tft.pushImageDMA(area->x1, area->y1, w, h, (uint16_t *)&color_p->full);
  lv_disp_flush_ready(disp_drv);
}

// touchpad callback
void my_touchpad_read(lv_indev_drv_t *indev_driver, lv_indev_data_t *data) {
  uint16_t touchX, touchY;
  bool touched = tft.getTouch(&touchX, &touchY);

  if (touched) {
    data->state = LV_INDEV_STATE_PR;
    data->point.x = touchX;
    data->point.y = touchY;
  } else {
    data->state = LV_INDEV_STATE_REL;
  }
}

//---- Serial packet format for system status:
// Status: [0xFF] [0x01] [len] [evt] [cpu] [mem] [batt] [chg] [hr] [min] [sec] [media]
// Music:  [0xFF] [0x02] [len] [title_len] [title...] [artist_len] [artist...]
void serial_parse(byte b) {
  // --- State Machine for Packet Parsing ---

  // State 0: Waiting for start byte (0xFF)
  if (packetIndex == 0) {
    if (b == 0xFF) {
      packet[packetIndex++] = b; // Store 0xFF, advance to state 1
    }
    // else, discard byte and remain in state 0
    return;
  }

  // We are inside a packet, store the byte.
  // Check for buffer overflow before storing.
  if (packetIndex < sizeof(packet)) {
    packet[packetIndex++] = b;
  } else {
    packetIndex = 0; // Buffer overflow, reset parser
    return;
  }

  // Firmware version request: [0xFF][0x00]
  if (packetIndex == 2 && packet[0] == 0xFF && packet[1] == 0x00) {
    Serial.println(firmware_version);
    packetIndex = 0;
    packetLength = 0;
    connect_timer = millis();
    led_color(0, 0, 0); // green on to serial connected
    return;
  }

  // Determine packet length once we have enough info (at least 3 bytes).
  // This is only done once per packet.
  if (packetLength == 0 && packetIndex >= 3) {
    if (packet[1] == 0x01) { // System Status Packet
      // Total length = data_length (packet[2]) + 3 header bytes
      packetLength = packet[2] + 3;
    } else if (packet[1] == 0x02) { // Music Packet
      // Total length = data_length (packet[2]) + 3 header bytes
      packetLength = packet[2] + 3;
    } else if (packet[1] == 0x03) { // Weather Packet
      // Total length = data_length (packet[2]) + 3 header bytes
      packetLength = packet[2] + 3;
    }

    // Sanity check the calculated length. If invalid, reset the parser.
    if (packetLength > sizeof(packet) || packetLength == 0) {
      packetIndex = 0;
      packetLength = 0;
      return;
    }
  }

  // If we have a defined length and have read all bytes, process the packet
  if (packetLength > 0 && packetIndex >= packetLength) {

#ifdef DEBUG_PACKET
    char packetdata[100];
    snprintf(packetdata, sizeof(packetdata), "%d %d %d %d %d %d %d %d %d %d %d %d %d", packet[0], packet[1], packet[2], packet[3], packet[4], packet[5], packet[6], packet[7], packet[8], packet[9], packet[10]); //"/ Convert bytes to string and store in packetdata
    lv_textarea_set_text(ui_setting_Textarea_message, packetdata); // Display raw packet data in the debug textarea
#endif

    // System Status Packet
    if (packet[1] == 0x01) {

      // Parse the packet and update global state variables
      evt = packet[3];
      cpu = packet[4];
      mem_used = packet[5];
      battery = packet[6];
      charging = (packet[7] > 0) ? true : false;

      bool keyDown = (evt & 0x01) != 0;
      bool mouseMove = (evt & 0x02) != 0;
      bool mouseClick = (evt & 0x04) != 0;
      bool mouseScroll = (evt & 0x08) != 0;

      // keyboard tapping animation
      if (keyDown != last_keyDown) {
        clickSound();

        if (!keyDown) {
          lv_obj_clear_flag(ui_main_Image_rightpawdown, LV_OBJ_FLAG_HIDDEN);
          lv_obj_add_flag(ui_main_Image_rightpawup, LV_OBJ_FLAG_HIDDEN);
        } else {
          lv_obj_clear_flag(ui_main_Image_rightpawup, LV_OBJ_FLAG_HIDDEN);
          lv_obj_add_flag(ui_main_Image_rightpawdown, LV_OBJ_FLAG_HIDDEN);
        }
        last_keyDown = keyDown;
        last_sleep_check = millis(); // reset sleepy timer on key event
      }

      // mouse move animation
      if (mouseMove != last_mouseMove) {
        if (mouseMove) {
          if (random_mouse_timer == NULL) {
            random_mouse_timer = lv_timer_create(random_mouse_task, 100, NULL);
          }
        } else {
          if (random_mouse_timer != NULL) {
            lv_timer_del(random_mouse_timer);
            random_mouse_timer = NULL;
          }
        }
        last_mouseMove = mouseMove;
        last_sleep_check = millis(); // reset sleepy timer on mouse event
      }

      // Process Music Packet send only when track changes
    } else if (packet[1] == 0x02) {
      uint8_t title_len = packet[3];
      uint8_t artist_len_index = 4 + title_len;
      uint8_t artist_len = packet[artist_len_index];
      uint8_t artist_start_index = artist_len_index + 1;

      char title[title_len + 1];
      memcpy(title, &packet[4], title_len);
      title[title_len] = '\0';

      char artist[artist_len + 1];
      memcpy(artist, &packet[artist_start_index], artist_len);
      artist[artist_len] = '\0';

      // Update the UI with the new track information
      media_track_status(title, artist);

      // packet  type is 0x03 (weather)
    } else if (packet[1] == 0x03) {
      uint8_t weather_group = packet[3]; // weather_group (0-4)
      String temp_c = String(packet[4]);
      String humidity = String(packet[5]);

      char time_str[6]; // HH:MM + null
      snprintf(time_str, sizeof(time_str), "%02d:%02d", packet[6], packet[7]);

      if (weather_group == 0 && packet[6] >= 18 || packet[6] < 6) weather_group = 5; // moon

      if (weather_group >= 0 && weather_group < 6) {
        lv_img_set_src(ui_main_Image_weatherIcon, &weather_icon[weather_group]);
      }
      String weather_info = temp_c + "°C\n" + humidity + "%\n" + time_str;
      lv_label_set_text(ui_main_Label_forecast, weather_info.c_str());

    } // else packet  type is 0x02 (music), which is handled above
    // Reset packet index for next frame
    packetIndex = 0;
    packetLength = 0;
  }
  connect_timer = millis(); // reset connection timer on serial activity
}

// ################### SETUP ############################

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // disable brownout detection
  // init communication
  randomSeed(esp_random());
  Serial.setRxBufferSize(2048);
  Serial.begin(115200);

  initLittleFS();
  audio_queue = xQueueCreate(1, sizeof(AudioRequest));
  if (audio_queue) {
    xTaskCreatePinnedToCore(audioTask, "audioTask", 4 * 1024, nullptr, 0, &audio_task_handle, 0);
  } else {
    Serial.println("Audio queue create failed");
  }
  // pin configuration
  analogSetAttenuation(ADC_0db); // 0dB(1.0 ครั้ง) 0~800mV   for LDR
  pinMode(LDR_PIN, ANALOG); // ldr analog input read brightness
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_BLUE_PIN, OUTPUT);

  // init speaker
  initSpeaker();
  led_color(1, 1, 1); // all off

  // init TFT
  tft.begin();
  tft.setBrightness(brightness);

#if (BOARD != USE_PURPLE_28_CAPACITIVE)
  // screen calibration for resistive touch
  uint16_t calData[8];
  pref.begin("touch", false);
  if (digitalRead(BUTTON_PIN) == LOW) {
    tft.calibrateTouch(calData, TFT_WHITE, TFT_BLACK, 15);
    pref.putBytes("calData", calData, sizeof(calData));
    Serial.println("Touch calibration saved.");
  } else {
    if (pref.getBytes("calData", calData, sizeof(calData)) == sizeof(calData)) {
      tft.setTouchCalibrate(calData);
      Serial.println("Touch calibration loaded.");
    }
  }
  pref.end();
#endif

  const uint16_t screenWidth = tft.width();
  const uint16_t screenHeight = tft.height();

  lv_init();
  // LVGL display buffers
  static lv_disp_draw_buf_t draw_buf;
  // Allocate buffer for 1/10 of the screen size
  static lv_color_t buf1[TFT_WIDTH * TFT_HEIGHT / 10];
  static lv_color_t buf2[TFT_WIDTH * TFT_HEIGHT / 10];
  lv_disp_draw_buf_init(&draw_buf, buf1, buf2, TFT_WIDTH * TFT_HEIGHT / 10);

  // Register display driver
  static lv_disp_drv_t disp_drv;
  lv_disp_drv_init(&disp_drv);
  disp_drv.hor_res = screenWidth;
  disp_drv.ver_res = screenHeight;
  disp_drv.flush_cb = my_disp_flush;
  disp_drv.draw_buf = &draw_buf;
  lv_disp_drv_register(&disp_drv);

  // Touch input driver
  static lv_indev_drv_t indev_drv;
  lv_indev_drv_init(&indev_drv);
  indev_drv.type = LV_INDEV_TYPE_POINTER;
  indev_drv.read_cb = my_touchpad_read;
  lv_indev_drv_register(&indev_drv);

  // App start here
  ui_init(); // start ui and display
  lv_label_set_text(ui_main_Label_charge, LV_SYMBOL_CHARGE);
  lv_label_set_text(ui_setting_Label_version, version.c_str());

  // load config
  load_config();

} // setup

// #################### MAIN  #####################

void loop() {
#ifdef DEBUG_TOUCH
  if (tft.getTouch(&x, &y)) {
    Serial.printf("Touch raw: %d , %d\n", x, y);
  }
#endif

  lv_task_handler();
  autoDim(); // handle auto dimming based on ambient light
  sleepy_animation(); // handle sleepy animation
  eye_blink_animation(); // handle eye blinking animation

  if (Serial.available()) {
    b = Serial.read();
    serial_parse(b);
  }

  //---- Update Animation every 1 second
  unsigned long current_time = millis();
  if (current_time - last_chart_update >= 1000) {
    last_chart_update = current_time;
    chart_animation(cpu, mem_used, battery, charging); // Update chart with current system status from packet
    clock_animation(packet[8], packet[9], packet[10]); // Update clock animation with current time from packet
    media_play_status((packet[11])); // Update media status based on packet data
  }

  //---- Serial port connection status check
  if (millis() - connect_timer > CONNECTION_TIMEOUT)
    app_connected = false;
  else
    app_connected = true;

  if (app_connected != last_connected_state) {
    if (!app_connected) { // serial disconnected
      led_color(0, 1, 1); // all on to indicate  no connection
      if (random_mouse_timer != NULL) {
        lv_timer_del(random_mouse_timer);
        random_mouse_timer = NULL;
      }
      lv_obj_set_style_text_color(ui_main_Label_connection, lv_color_hex(0xFFFF00), LV_PART_MAIN);
      lv_label_set_text(ui_main_Label_connection, LV_SYMBOL_WARNING);
      // beep();
      playAudio("disconnect.wav");
    } else { // serial connected
      tft.wakeup();
      tft.writeCommand(0x29);
      if (!dim)
        tft.setBrightness(brightness);
      else
        tft.setBrightness(dim_brightness);

      led_color(1, 0, 1); // green on to serial connected
      lv_obj_set_style_text_color(ui_main_Label_connection, lv_color_hex(0x00FF00), LV_PART_MAIN);
      lv_label_set_text(ui_main_Label_connection, LV_SYMBOL_USB);
      // beepbeep();
      playAudio("connect.wav");
    }
    last_connected_state = app_connected;
  }
  // put to sleep mode
  if (!app_connected && millis() - connect_timer > SLEEPMODE_TIMEOUT) {
    tft.writeCommand(0x28); // display off
    tft.sleep();
    tft.setBrightness(0); // turn off backlight
  }

  //------------------------------------
} // loop
