#pragma once

/*
  LovyanGFX configuration for the "Cheap Yellow Display" (CYD)
  This board is an ESP32-2432S028R.
*/
#include "app_config.h"

#define LGFX_USE_V1
#include <LovyanGFX.hpp>

class LGFX : public lgfx::LGFX_Device {
  // Provide panel parameters
#if (BOARD == USE_CYD_28_1 || BOARD == USE_PURPLE_28_CAPACITIVE) // purple 2.8"
  lgfx::Panel_ILI9341 _panel_instance;
#else // cyd 2.8"
  lgfx::Panel_ILI9341_2 _panel_instance;
#endif

  // Provide bus parameters
  lgfx::Bus_SPI _bus_instance;

#if (BOARD == USE_PURPLE_28_CAPACITIVE)
  lgfx::Touch_FT5x06 _touch_instance; // Provide touch screen parameters
#else
  lgfx::Touch_XPT2046 _touch_instance; // Provide touch screen parameters
#endif

  // Provide backlight control parameters
  lgfx::Light_PWM _light_instance;

public:
  LGFX(void) {
    {
      auto cfg = _bus_instance.config();
      cfg.spi_host = HSPI_HOST;
      cfg.spi_mode = 0;
      cfg.freq_write = 40000000;
      cfg.freq_read = 16000000;
      cfg.spi_3wire = false;
      cfg.use_lock = true;
      cfg.dma_channel = SPI_DMA_CH_AUTO;
      cfg.pin_sclk = 14;
      cfg.pin_mosi = 13;
      cfg.pin_miso = 12;
      cfg.pin_dc = 2;
      _bus_instance.config(cfg);
      _panel_instance.setBus(&_bus_instance);
    }

    {
      auto cfg = _panel_instance.config();
      cfg.pin_cs = 15;
      cfg.pin_rst = -1;
      cfg.pin_busy = -1; // ILI9341 does not have a busy pin
      cfg.panel_width = 240;
      cfg.panel_height = 320;
      cfg.offset_x = 0;
      cfg.offset_y = 0;
#if (BOARD == USE_PURPLE_28_CAPACITIVE || BOARD == USE_CYD_28_1)
      cfg.offset_rotation = 0;
#else
      cfg.offset_rotation = 4;
#endif
      cfg.dummy_read_pixel = 8;
      cfg.dummy_read_bits = 1;
      cfg.readable = true;
#if (BOARD == USE_CYD_28_1) // CYD 2.8" variant1
      cfg.invert = false;
#else
      cfg.invert = true;
#endif

      cfg.rgb_order = false; // Set to true for BGR order
      cfg.dlen_16bit = false; // must be false unless display not show
      cfg.bus_shared = false;
      _panel_instance.config(cfg);
    }

    {
      auto cfg = _touch_instance.config();

#if (BOARD == USE_PURPLE_28_CAPACITIVE)
      cfg.offset_rotation = 2; // 180 degrees
      cfg.x_min = 0;
      cfg.x_max = 240;
      cfg.y_min = 0;
      cfg.y_max = 320;
      cfg.pin_int = 36; // if connected, else -1
      cfg.bus_shared = false; // VERY IMPORTANT
      cfg.i2c_port = 0;
      cfg.i2c_addr = 0x38; // default FT6X36 address
      cfg.pin_sda = 33; // your Wire.begin SDA
      cfg.pin_scl = 32; // your Wire.begin SCL
      cfg.freq = 400000; // 400kHz
#else
      cfg.x_min = 300;
      cfg.x_max = 3600;
      cfg.y_min = 3600;
      cfg.y_max = 300;
      cfg.bus_shared = true; // Touch uses different pins on the same SPI bus
      cfg.pin_int = 36;
      cfg.offset_rotation = 0;
      cfg.spi_host = VSPI_HOST; // Touch controller is on the HSPI bus
      cfg.pin_sclk = 25;
      cfg.pin_mosi = 32;
      cfg.pin_miso = 39;
      cfg.pin_cs = 33;
      cfg.freq = 2500000; // Set to 2.5MHz as per your old config
#endif
      _touch_instance.config(cfg);
      _panel_instance.setTouch(&_touch_instance);
    }

    {
      auto cfg = _light_instance.config();
      cfg.pin_bl = 21;
      cfg.invert = false;
      cfg.freq = 12000;
      cfg.pwm_channel = 0;
      _light_instance.config(cfg);
      _panel_instance.setLight(&_light_instance);
    }

    setPanel(&_panel_instance);
  }
};
