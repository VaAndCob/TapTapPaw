#pragma once


#include <stdio.h>


#pragma pack(push, 1)
typedef struct _wav_header
{
  // RIFF Header
  char riff_header[4]; // Contains "RIFF"
  int wav_size = 0;    // Size of the wav portion of the file, which follows the first 8 bytes. File size - 8
  char wave_header[4]; // Contains "WAVE"

  // Format Header
  char fmt_header[4];      // Contains "fmt " (includes trailing space)
  int fmt_chunk_size = 16; // Should be 16 for PCM
  short audio_format = 1;  // Should be 1 for PCM. 3 for IEEE Float
  short num_channels = 1;
  int sample_rate = 16000;
  int byte_rate = 32000;      // Number of bytes per second. sample_rate * num_channels * Bytes Per Sample
  short sample_alignment = 2; // num_channels * Bytes Per Sample
  short bit_depth = 16;       // Number of bits per sample

  // Data
  char data_header[4]; // Contains "data"
  int data_bytes = 0;  // Number of bytes in data. Number of samples * num_channels * sample byte size
  // uint8_t bytes[]; // Remainder of wave file is bytes
  _wav_header()
  {
    riff_header[0] = 'R';
    riff_header[1] = 'I';
    riff_header[2] = 'F';
    riff_header[3] = 'F';
    wave_header[0] = 'W';
    wave_header[1] = 'A';
    wave_header[2] = 'V';
    wave_header[3] = 'E';
    fmt_header[0] = 'f';
    fmt_header[1] = 'm';
    fmt_header[2] = 't';
    fmt_header[3] = ' ';
    data_header[0] = 'd';
    data_header[1] = 'a';
    data_header[2] = 't';
    data_header[3] = 'a';
  }
} wav_header_t;
#pragma pack(pop)


//---------------------------------
class WAVFileReader
{
private:
    wav_header_t m_wav_header;

    FILE *m_fp;

public:
    WAVFileReader(FILE *fp);
    int sample_rate() { return m_wav_header.sample_rate; }
    int num_channels() { return m_wav_header.num_channels; }
    int data_bytes() { return m_wav_header.data_bytes; }
    int read(int16_t *samples, int count);
    int rewind() { return fseek(m_fp, sizeof(wav_header_t), SEEK_SET); }
};
