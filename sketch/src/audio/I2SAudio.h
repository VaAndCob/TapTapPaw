#pragma once

#include <freertos/FreeRTOS.h>
#include <driver/i2s.h>

/**
 * Base Class for both the DAC and I2S output
 **/
class AudioOutput
{
public:
  AudioOutput() {};
  virtual void start(uint32_t sample_rate) = 0;
  virtual void stop() = 0;
  // override this in derived classes to turn the sample into
  // something the output device expects - for the default case
  // this is simply a pass through
  virtual int16_t process_sample(int16_t sample) { return sample; }
  // write samples to the output
  virtual void write(int16_t *samples, int count) = 0;
};

/**
 * Base Class for both the DAC, PCM and PDM output
 **/
class I2SAudio : public AudioOutput
{
protected:
  i2s_port_t m_i2s_port = I2S_NUM_1;
  int16_t *m_tmp_frames = NULL;
public:
  I2SAudio(i2s_port_t i2s_port);
  void stop();
  void write(int16_t *samples, int count);
  // override this in derived classes to turn the sample into
  // something the output device expects - for the default case
  // this is simply a pass through
  virtual int16_t process_sample(int16_t sample) { return sample; }
};

 //Use I2S to output to the DAC
 
class DACOutput : public I2SAudio
{
public:
    DACOutput() : I2SAudio(I2S_NUM_0) {}
    void start(uint32_t sample_rate);
    virtual int16_t process_sample(int16_t sample)
    {
        // DAC needs unsigned 16 bit samples
        return sample + 32768;
    }
};
