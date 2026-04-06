#include <Arduino.h>
#include <LittleFS.h>
#include "audio/I2SAudio.h"
#include "audio/WAVFileReader.h"

// DAC output (GPIO25/26)
DACOutput *output = nullptr;
WAVFileReader *reader = nullptr;
FILE *fp = nullptr;

void playAudio(const char *filename) {
    char path[64];
    snprintf(path, sizeof(path), "/littlefs/%s", filename);
    fp = fopen(path, "rb");
    if (!fp) {
        Serial.printf("Failed to open %s. Check if file exists in data folder.\n", path);
        return;
    }

    reader = new WAVFileReader(fp);
    Serial.printf("WAV File Opened. Sample Rate: %d, Channels: %d\n", 
                  reader->sample_rate(), reader->num_channels());
    Serial.printf("WAV File Opened. Sample Rate: %d\n", 
                  reader->sample_rate());

    if (!output) {
        output = new DACOutput();
        output->start(reader->sample_rate());
    } else {
        output->stop();
        output->start(reader->sample_rate());
    }

    const int buffer_size = 512;
    int16_t buffer[buffer_size];
    while (true) {
        int read = reader->read(buffer, buffer_size);
        if (read > 0) {
            output->write(buffer, read);
        } else {
            // EOF or error
            break;
        }
    }
    Serial.println("Finished playing audio");
    fclose(fp);
    fp = nullptr;
    delete reader;
    reader = nullptr;
}

void setup() {
    Serial.begin(115200);
    
    if (!LittleFS.begin(true)) {
        Serial.println("LittleFS Mount Failed");
        return;
    }

    Serial.println("Audio System Initialized");
    playAudio("cute.wav");
    playAudio("squeak.wav");
    playAudio("snore.wav");
    
}

void loop() {

    
    // Small delay to prevent watchdog issues
    vTaskDelay(1);
}
