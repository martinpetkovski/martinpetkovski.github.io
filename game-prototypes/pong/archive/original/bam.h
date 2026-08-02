#include<string>
#include<iostream>
#include<vector>
#include<allegro5/allegro.h>
#include<allegro5/allegro_image.h>
#include<allegro5/allegro_primitives.h>
#include<allegro5/allegro_font.h>
#include<allegro5/allegro_ttf.h>
using namespace std;
//========================//
// STATIC EFFECTS //
//========================//
void fx_static_fadein(ALLEGRO_COLOR fade_from, int screen_w, int screen_h, int duration, ALLEGRO_BITMAP
*image, int ix, int iy);
void fx_static_fadeout(ALLEGRO_COLOR fade_to, int screen_w, int screen_h, int duration, ALLEGRO_BITMAP
*image, int ix, int iy);
void fx_static_fadetoggle(ALLEGRO_COLOR fade_from, ALLEGRO_COLOR fade_to, int screen_w, int screen_h, int
duration, ALLEGRO_BITMAP *image, int ix, int iy, int pause);
//==============================//
// DYNAMIC EFFECTS #TODO //
//==============================//
//====================//
// GUI TWEAKS //
//====================//
void gui_draw_value_bar(double current_value, double max_value, int x , int y, int w, int h, ALLEGRO_COLOR
color, ALLEGRO_COLOR border_color);
int gui_generate_menu(vector<string> options, string title, ALLEGRO_FONT *font, ALLEGRO_COLOR title_color,
ALLEGRO_COLOR default_color,
ALLEGRO_COLOR focus_color, ALLEGRO_COLOR background_color, int
margin_left, int margin_top, int options_padding,
ALLEGRO_BITMAP *image, int theme);
//========================//
// PHYSICS ENGINE //
//========================//
bool phy_check_collision(int b1_x, int b1_y, int b1_w, int b1_h, int b2_x, int b2_y, int b2_w, int b2_h);
bool phy_check_collision_top(int x1,int w1,int y1, int h1, int x2, int y2, int w2, double thickness);
bool phy_check_collision_bottom(int x1,int w1,int y1, int h2, int x2, int y2, int w2, double thickness);
bool phy_check_collision_left(int x1,int w1,int y1, int h2, int x2, int y2, int h1, double thickness);
bool phy_check_collision_right(int x1,int w2,int y1, int h2, int x2, int y2, int h1, double thickness);
double phy_add_gravity(double speed, double max_speed, int fps);
//=======================================================================//
// //
// STATIC EFFECTS //
// //
//=======================================================================//
void fx_static_fadein(ALLEGRO_COLOR fade_from, int screen_w, int screen_h, int duration, ALLEGRO_BITMAP
*image = NULL,int ix = NULL, int iy = NULL)
{
int alpha = 255;
al_clear_to_color(fade_from);
while(alpha >= 0)
{
if(image != NULL)
al_draw_bitmap(image,ix,iy,0);
al_draw_filled_rectangle(0,0,screen_w,screen_h,al_map_rgba(0,0,0,alpha));
al_flip_display();
al_rest(duration/255);
alpha--;
}
}
void fx_static_fadeout(ALLEGRO_COLOR fade_to, int screen_w, int screen_h, int duration, ALLEGRO_BITMAP
*image = NULL,int ix = NULL, int iy = NULL)
{
int alpha = 0;
al_clear_to_color(fade_to);
while(alpha <= 255)
{
if(image != NULL)
al_draw_bitmap(image,ix,iy,0);
al_draw_filled_rectangle(0,0,screen_w,screen_h,al_map_rgba(0,0,0,alpha));
al_flip_display();
al_rest(duration/255);
alpha++;
}
}
void fx_static_fadetoggle(ALLEGRO_COLOR fade_from, ALLEGRO_COLOR fade_to, int screen_w, int screen_h, int
duration,
ALLEGRO_BITMAP *image, int ix, int iy, int pause)
{
fx_static_fadein(fade_from,screen_w,screen_h,duration,image,0,0);
al_rest(pause);
fx_static_fadeout(fade_to,screen_w,screen_h,duration,image,0,0);
}
//=======================================================================//
// #TODO //
// DYNAMIC EFFECTS (MULTITHREADING NEEDED) //
// //
//=======================================================================//
//=======================================================================//
// //
// GUI TWEAKS //
// //
//=======================================================================//
void gui_draw_value_bar(double current_value, double max_value, int x, int y, int w, int h, ALLEGRO_COLOR
color, ALLEGRO_COLOR border_color)
{
al_draw_rectangle(x,y,x+w,y+h,border_color,2);
al_draw_filled_rectangle(x,y,x + current_value*w/max_value,y+h,color);
}
int gui_generate_menu(vector<string> options, string title, ALLEGRO_FONT *font, ALLEGRO_COLOR title_color,
ALLEGRO_COLOR default_color, ALLEGRO_COLOR focus_color, ALLEGRO_COLOR background_color,
int margin_left, int margin_top, int options_padding)
{
int position = 1;
int numOptions = options.size();
ALLEGRO_EVENT_QUEUE *menu_event_queue = NULL;
ALLEGRO_TIMER *menu_timer;
bool render = false;
bool keys[] = {false, false, false, false, false};
enum KEYS{UP, DOWN, LEFT, RIGHT, SPACE};
menu_event_queue = al_create_event_queue();
menu_timer = al_create_timer(1/13.0);
al_register_event_source(menu_event_queue, al_get_timer_event_source(menu_timer));
al_register_event_source(menu_event_queue, al_get_keyboard_event_source());
al_start_timer(menu_timer);
while(1)
{
ALLEGRO_EVENT menu_ev;
al_wait_for_event(menu_event_queue, &menu_ev);
//==============================================
//INPUT
//==============================================
if(menu_ev.type == ALLEGRO_EVENT_KEY_DOWN)
{
switch(menu_ev.keyboard.keycode)
{
case ALLEGRO_KEY_UP:
keys[UP] = true;
break;
case ALLEGRO_KEY_DOWN:
keys[DOWN] = true;
break;
case ALLEGRO_KEY_ENTER:
keys[SPACE] = true;
break;
}
}
else if(menu_ev.type == ALLEGRO_EVENT_KEY_UP)
{
switch(menu_ev.keyboard.keycode)
{
case ALLEGRO_KEY_UP:
keys[UP] = false;
break;
case ALLEGRO_KEY_DOWN:
keys[DOWN] = false;
break;
case ALLEGRO_KEY_ENTER:
keys[SPACE] = false;
break;
}
}
//==============================================
//UPDATE
//==============================================
else if(menu_ev.type == ALLEGRO_EVENT_TIMER)
{
if(keys[UP])
position--;
else if(keys[DOWN])
position++;
else if(keys[SPACE])
return position;
if(position < 1)
position = numOptions;
if(position > numOptions)
position = 1;
render = true;
}
//==============================================
//RENDER
//==============================================
if(render && al_is_event_queue_empty(menu_event_queue))
{
//cout<<"success"<<endl;
al_draw_text(font,title_color,margin_left,50,ALLEGRO_ALIGN_CENTER,
title.c_str());
for(int i = 1; i<=numOptions; i++)
{
if(i == position)
{
al_draw_text(font, focus_color, margin_left,
margin_top+i*options_padding, ALLEGRO_ALIGN_CENTER, options[i-1].c_str());
}
else
{
al_draw_text(font, default_color, margin_left,
margin_top+i*options_padding, ALLEGRO_ALIGN_CENTER, options[i-1].c_str());
}
}
al_flip_display();
al_clear_to_color(al_map_rgb(0,0,0));
render = false;
}
}
}
//=======================================================================//
// //
// PHYSICS ENGINE //
// //
//=======================================================================//
bool phy_check_collision(int b1_x, int b1_y, int b1_w, int b1_h, int b2_x, int b2_y, int b2_w, int b2_h)
{
if ((b1_x > b2_x + b2_w - 1) || (b1_y > b2_y + b2_h - 1) || (b2_x > b1_x + b1_w - 1) || (b2_y >
b1_y + b1_h - 1))
return false;
else return true;
}
bool phy_check_collision_top(int x1,int w1,int y1, int h1, int x2, int y2, int w2, int h2, double
thickness)
{
if(thickness < 5) thickness = 5;
if((x1+w1 > x2 && x1 < x2+w2) && (y1+h1 >= y2 && y1+h1 <= y2+h2-10))
return true;
return false;
}
bool phy_check_collision_bottom(int x1,int w1,int y1, int h2, int x2, int y2, int w2, double thickness)
{
if(thickness < 5) thickness = 5;
if((x1+w1 > x2 && x1 < x2+w2) && (y1 <= y2+h2 && y1+thickness >= y2+h2))
return true;
return false;
}
bool phy_check_collision_left(int x1,int w1,int y1, int h2, int x2, int y2, int h1, double thickness)
{
if(thickness < 5) thickness = 5;
if((y1 < y2 + h2 && y1 + h1 > y2) && (x1 + w1 >= x2 && x1 + w1 <= x2 + thickness))
return true;
return false;
}
bool phy_check_collision_right(int x1,int w2,int y1, int h2, int x2, int y2, int h1, double thickness)
{
if(thickness < 5) thickness = 5;
if((y1 < y2 + h2 && y1 + h1 > y2) && (x1 <= x2 + w2 && x1 + thickness >= x2 + w2 ))
return true;
return false;
}
double phy_add_gravity(double speed, double max_speed, int fps)
{
const double acceleration = 9.81;
double timeElapsed = 1 / (double)fps;
if(speed > max_speed)
return max_speed;
else return speed + acceleration * timeElapsed;
}
