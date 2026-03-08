#include "animation.h"
#include "accessory.h"
#include "ui/ui.h"
//=========================== custom animation task ===========================

// state for non‑blocking animation handling
unsigned long last_sleep_check = 0;
bool current_sleep_state = false;
bool last_sleep_state = false;
#define SLEEP_TIMER 60000 // sleep state after 1 minute
// state for non‑blocking blink handling
long eyelid_show_timer = 0; // when the eyelid was made visible
bool eyelid_visible = false; // are we currently showing the eyelid

bool last_keyDown = false;
bool last_mouseMove = false;
bool last_mouseClick = false;
unsigned long eye_blink_timer = 0; // next time we may blink
unsigned long delayTime = 0; // random delay until next blink

uint8_t last_hour = 0;
uint8_t last_min = 0;
uint8_t last_sec = 0;
uint8_t last_mediaState = 3; // invalid initial state to ensure first update occurs

// Chart data - single series with 4 points: [cpu, mem, batt, charge]
static lv_chart_series_t *chart_data_series = NULL;
uint8_t evt, cpu, mem_used, battery, charging = 0;

static uint8_t last_charge = true;
unsigned long last_chart_update = 0;
// ---------- Timer handle ----------
lv_timer_t *random_mouse_timer = NULL;

//------------------------------------------

// sleepy animation (non-blocking)
// eyes blinking animation (non-blocking)
void sleepy_animation() {
  unsigned long now = millis();

  if (now - last_sleep_check >= SLEEP_TIMER) {
    current_sleep_state = true; // toggle sleepy state every 60 seconds for demo purposes (replace with actual sleep detection logic)
  } else {
    current_sleep_state = false;
  } 

  if (current_sleep_state != last_sleep_state) {
    if (current_sleep_state) {
      lv_obj_clear_flag(ui_main_Image_sleepy, LV_OBJ_FLAG_HIDDEN); // sleepy now
    } else {
      lv_obj_add_flag(ui_main_Image_sleepy, LV_OBJ_FLAG_HIDDEN); // not sleepy
      last_sleep_check = now;
    }
    last_sleep_state = current_sleep_state;
  }
}

// eyes blinking animation (non-blocking)
void eye_blink_animation() {
  unsigned long now = millis();

  if (!eyelid_visible) {
    // waiting for next blink

    if (now - eye_blink_timer > delayTime) {
      eye_blink_timer = now;
      eyelid_visible = true;
      eyelid_show_timer = now;
      lv_obj_clear_flag(ui_main_Image_eyelid, LV_OBJ_FLAG_HIDDEN); // close eye
      delayTime = 1000 + (esp_random() % 6000);
    }
  } else {
    // eyelid currently shown, check if 200 ms elapsed
    if (now - eyelid_show_timer >= 200) {
      eyelid_visible = false;
      lv_obj_add_flag(ui_main_Image_eyelid, LV_OBJ_FLAG_HIDDEN); // open eye
    }
  }
}

// Cat moving mouse animation
static ui_anim_user_data_t cat_sprite_ud;
static ui_anim_user_data_t cat_move_ud;
int last_x_cat = 76; // first cat pos in ui_Screen_Info.c
int target_x_cat = 0;
int travel_time = 0;
#define MIN_MOUSE_POS 65
#define MAX_MOUSE_POS 85
#define frame_speed 0.5
static const lv_img_dsc_t *ui_imgset_cat_left_const[] = {&ui_img_leftmousepaw_png, &ui_img_leftmousepaw_png};
// Persistent LVGL animations (do NOT put on stack)
static lv_anim_t cat_sprite_anim;
static lv_anim_t cat_move_anim;
// Stop mouseing sprite animation when movement ends
static void mouse_move_ready_cb(lv_anim_t *a) {
  ui_anim_user_data_t *move_ud = (ui_anim_user_data_t *)a->user_data;
  lv_obj_t *obj = move_ud->target;
  lv_anim_del(obj, NULL); // stop all animations on this obj
  ui_anim_user_data_t *sprite_ud;
  sprite_ud = &cat_sprite_ud;
  // Freeze sprite animation
  sprite_ud->imgset_size = 1;
  lv_img_set_src(obj, sprite_ud->imgset[0]);
}

// ------ Generalized animation function for mouse movement + sprite change------
void mouse_animation(lv_obj_t *obj, int beginX, int endX, lv_img_dsc_t **imgset, uint8_t imgset_size, uint8_t frameBegin, uint8_t frameEnd, uint16_t time, uint16_t playbackDelay, uint16_t playbackTime) {
  lv_anim_del(obj, NULL); // stop previous animations
  ui_anim_user_data_t *sprite_ud;
  ui_anim_user_data_t *move_ud;
  lv_anim_t *sprite_anim;
  lv_anim_t *move_anim;

  sprite_ud = &cat_sprite_ud;
  move_ud = &cat_move_ud;
  sprite_anim = &cat_sprite_anim;
  move_anim = &cat_move_anim;

  // ---------- SPRITE ----------
  sprite_ud->target = obj;
  sprite_ud->imgset = imgset;
  sprite_ud->imgset_size = imgset_size;
  sprite_ud->val = -1;

  lv_anim_init(sprite_anim);
  lv_anim_set_var(sprite_anim, obj);
  lv_anim_set_user_data(sprite_anim, sprite_ud);
  lv_anim_set_time(sprite_anim, frame_speed);
  lv_anim_set_values(sprite_anim, frameBegin, frameEnd);
  lv_anim_set_custom_exec_cb(sprite_anim, _ui_anim_callback_set_image_frame);
  lv_anim_set_path_cb(sprite_anim, lv_anim_path_linear);
  // lv_anim_set_repeat_count(sprite_anim, LV_ANIM_REPEAT_INFINITE);
  lv_anim_set_repeat_count(sprite_anim, time / frame_speed);
  lv_anim_start(sprite_anim);

  // ---------- MOVE ----------
  move_ud->target = obj;
  move_ud->val = -1;

  lv_anim_init(move_anim);
  lv_anim_set_var(move_anim, obj);
  lv_anim_set_user_data(move_anim, move_ud);
  lv_anim_set_time(move_anim, time);
  lv_anim_set_values(move_anim, beginX, endX);
  lv_anim_set_custom_exec_cb(move_anim, _ui_anim_callback_set_x);
  lv_anim_set_path_cb(move_anim, lv_anim_path_linear);
  lv_anim_set_playback_time(move_anim, playbackTime);
  lv_anim_set_playback_delay(move_anim, playbackDelay);
  lv_anim_set_ready_cb(move_anim, mouse_move_ready_cb);
  lv_anim_start(move_anim);
}

// ---------- Timer-based random mouse move----------
void random_mouse_task(lv_timer_t *timer) {
  travel_time = random(200, 400); // faster: reduced from 500-1000ms to 200-400ms
  uint32_t next_delay = travel_time;
  target_x_cat = random(MIN_MOUSE_POS, MAX_MOUSE_POS);
  lv_img_dsc_t **image_set_cat = (lv_img_dsc_t **)ui_imgset_cat_left_const;
  mouse_animation(ui_main_Image_leftpaw, last_x_cat, target_x_cat, image_set_cat, 2, 0, 1, travel_time, 0, 0);
  last_x_cat = target_x_cat;
  lv_timer_set_period(timer, next_delay);
}

// analog clock animation
void clock_animation(uint8_t h, uint8_t m, uint8_t s) {

  if (m != last_min) {  //update shorthand and longhand only when minute changes (to reduce unnecessary updates)
    lv_img_set_angle(ui_main_Image_shorthand, h * 300 + m * 5); 
    lv_img_set_angle(ui_main_Image_longhand, m * 60);
    last_min = m;
  }
  if (s != last_sec) {// update second hand only when second changes
    lv_img_set_angle(ui_main_Image_secondhand, s * 60);
    last_sec = s;
  }
}

// chart animation
void chart_animation(uint8_t cpu, uint8_t mem_used, uint8_t battery, bool charging) {
      // symtem information bar chart animation
      static lv_coord_t chart_data[3] = {0, 0, 0};
      chart_data[0] = cpu;
      chart_data[1] = mem_used;
      chart_data[2] = battery;
      //charge status icon display
      if (charging != last_charge) {
        if (charging) {
          lv_obj_clear_flag(ui_main_Label_charge, LV_OBJ_FLAG_HIDDEN);
        } else {
          lv_obj_add_flag(ui_main_Label_charge, LV_OBJ_FLAG_HIDDEN);
        }
        last_charge = charging;
      }

      // Update chart using the data array
      lv_chart_series_t *s = lv_chart_get_series_next(ui_main_Chart_systeminfo, NULL);
      if (s != NULL) {
        lv_chart_set_ext_y_array(ui_main_Chart_systeminfo, s, chart_data);
      }
}

// media play status
void media_play_status(uint8_t mediaState) {

  if (mediaState != last_mediaState) {
    last_mediaState = mediaState;
    switch (mediaState) {
    case 0: lv_label_set_text(ui_main_Label_status, "[ STOPPED ]"); break;
    case 1: lv_label_set_text(ui_main_Label_status, "[ PLAYING ]"); break;
    case 2: lv_label_set_text(ui_main_Label_status, "[ PAUSED ]"); break;
    }
  }
}

// media track information
void media_track_status(char *title, char *artist) {
  lv_label_set_text(ui_main_Label_title, title);
  lv_label_set_text(ui_main_Label_artist, artist);
}