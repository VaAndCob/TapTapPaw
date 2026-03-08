SET(SOURCES ui_Screen_title1.c
    ui_Screen_main.c
    ui_Screen_setting.c
    ui.c
    ui_comp_hook.c
    ui_helpers.c
    ui_events.cpp
    ui_img_taptappaw_png.c
    ui_img_wallpaper_png.c
    ui_img_main_png.c
    ui_img_leftmousepaw_png.c
    ui_img_rightpawdown_png.c
    ui_img_rightpawup_png.c
    ui_img_sleepy_png.c
    ui_img_closeeye_png.c
    ui_img_a_clock_png.c
    ui_img_shorthand_png.c
    ui_img_longhand_png.c
    ui_img_secondhand_png.c
    ui_img_paw_png.c
    fonts/ui_font_DynaPuff10.c
    fonts/ui_font_DynaPuff18.c
    fonts/ui_font_itim16.c)

add_library(ui ${SOURCES})
