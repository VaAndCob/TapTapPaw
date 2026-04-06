
#include <Arduino.h>
#include "I2SAudio.h"
#include <esp_log.h>
#include <driver/i2s.h>

static const char *TAG = "AUDIO";

// number of frames to try and send at once (a frame is a left and right sample)
const size_t NUM_FRAMES_TO_SEND=1024;

I2SAudio::I2SAudio(i2s_port_t i2s_port) : m_i2s_port(i2s_port)
{
  m_tmp_frames = (int16_t *)malloc(2 * sizeof(int16_t) * NUM_FRAMES_TO_SEND);
}

void I2SAudio::stop()
{
  // stop the i2S driver
  i2s_stop(m_i2s_port);
  i2s_driver_uninstall(m_i2s_port);
}

void I2SAudio::write(int16_t *samples, int count)
{
  int sample_index = 0;
  while (sample_index < count)
  {
    int samples_to_send = 0;
    for (int i = 0; i < NUM_FRAMES_TO_SEND && sample_index < count; i++)
    {
      // shift up to 16 bit samples
      int sample = process_sample(samples[sample_index]);
      // write the sample to both channels
      m_tmp_frames[i * 2] = sample;
      m_tmp_frames[i * 2 + 1] = sample;
      samples_to_send++;
      sample_index++;
    }
    // write data to the i2s peripheral
    size_t bytes_written = 0;
    esp_err_t res = i2s_write(m_i2s_port, m_tmp_frames, samples_to_send * sizeof(int16_t) * 2, &bytes_written, 1000 / portTICK_PERIOD_MS);
    if (res != ESP_OK)
    {
      ESP_LOGE(TAG, "Error sending audio data: %d", res);
    }
    if (bytes_written != samples_to_send * sizeof(int16_t) * 2)
    {
      ESP_LOGE(TAG, "Did not write all bytes");
    }
  }
}



void DACOutput::start(uint32_t sample_rate)
{
    // only include this if we're using DAC - the ESP32-S3 will fail compilation if we include this
    #ifdef USE_DAC_AUDIO
    // i2s config for writing both channels of I2S
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX | I2S_MODE_DAC_BUILT_IN),
        .sample_rate = sample_rate,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_MSB,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = 1024,
        .use_apll = true,
        .tx_desc_auto_clear = true,
        .fixed_mclk = 0};
    //install and start i2s driver
    esp_err_t res = i2s_driver_install(m_i2s_port, &i2s_config, 0, NULL);
    if (res != ESP_OK) {
        log_e("i2s_driver_install failed: %d\n", res);
    }
    // enable the DAC channels
    // Use only DAC2 (GPIO26). DAC1 (GPIO25) is used by touch SCLK on CYD.
    res = i2s_set_dac_mode(I2S_DAC_CHANNEL_LEFT_EN);
    if (res != ESP_OK) {
        log_e("i2s_set_dac_mode failed: %d\n", res);
    }
    // clear the DMA buffers
    res = i2s_zero_dma_buffer(m_i2s_port);
    if (res != ESP_OK) {
        log_e("i2s_zero_dma_buffer failed: %d\n", res);
    }

    res = i2s_start(m_i2s_port);
    if (res != ESP_OK) {
        log_e("i2s_start failed: %d\n", res);
    }
    #endif
}
