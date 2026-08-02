#include <allegro5/allegro.h>
#include <allegro5/allegro_image.h>
#include <allegro5/allegro_primitives.h>
#include <allegro5/allegro_font.h>
#include <allegro5/allegro_ttf.h>
#include <allegro5/allegro_audio.h>
#include <allegro5/allegro_acodec.h>
#include <fstream>
#include <vector>
#include <string>
#include "bam.h"
#include "objects.h"
//==============================================
// PROMENLIVI
//==============================================
int WIDTH, HEIGHT;
bool keys[] = {false, false, false, false, false};
enum KEYS{UP, DOWN, W, S, SPACE, ENTER};
bool done = false;
bool render = false;
int check_win;
ALLEGRO_DISPLAY *display = NULL;
ALLEGRO_EVENT_QUEUE *event_queue = NULL;
ALLEGRO_TIMER *timer;
ALLEGRO_FONT *font_big = NULL, *font_medium = NULL, *font_small = NULL;
ALLEGRO_DISPLAY_MODE disp_data;
//bitmapi
ALLEGRO_BITMAP *topce_image;
ALLEGRO_BITMAP *palka_image;
ALLEGRO_BITMAP *pozadina;
ALLEGRO_SAMPLE *menu_music;
ALLEGRO_SAMPLE *game_music;
ALLEGRO_SAMPLE *dang;
fstream hs;
string hsdata[10], hstmp;
int itohsdata[10];
global_game_settings settings;
string stringToIntAndBack(string oldValue, int modifyBy)
{
char hsbuf[33];
string stmp;
int tmp = atoi(oldValue.c_str());
tmp += modifyBy;
itoa(tmp, hsbuf, 10);
stmp = hsbuf;
return stmp;
}
void single_player(int level)
{
done = false;
bool playstate = false;
topce t(WIDTH, HEIGHT,true,topce_image);
topce v(WIDTH, HEIGHT,false,topce_image);
palka player(WIDTH,HEIGHT,false,palka_image);
palka cpu(WIDTH,HEIGHT,true,palka_image);
settings.scorecpu = 0;
settings.scorep = 0;
al_clear_to_color(al_map_rgb(0,0,0));
event_queue = al_create_event_queue();
timer = al_create_timer(1.0 / 60);
al_register_event_source(event_queue, al_get_timer_event_source(timer));
al_register_event_source(event_queue, al_get_keyboard_event_source());
al_start_timer(timer);
while(!done)
{
ALLEGRO_EVENT ev;
al_wait_for_event(event_queue, &ev);
//==============================================
//INPUT
//==============================================
if(ev.type == ALLEGRO_EVENT_KEY_DOWN)
{
switch(ev.keyboard.keycode)
{
case ALLEGRO_KEY_ESCAPE:
done = true;
break;
case ALLEGRO_KEY_UP:
keys[UP] = true;
break;
case ALLEGRO_KEY_DOWN:
keys[DOWN] = true;
break;
case ALLEGRO_KEY_SPACE:
keys[SPACE] = true;
break;
}
}
else if(ev.type == ALLEGRO_EVENT_KEY_UP)
{
switch(ev.keyboard.keycode)
{
case ALLEGRO_KEY_ESCAPE:
done = true;
break;
case ALLEGRO_KEY_UP:
keys[UP] = false;
break;
case ALLEGRO_KEY_DOWN:
keys[DOWN] = false;
break;
case ALLEGRO_KEY_SPACE:
keys[SPACE] = false;
break;
}
}
//==============================================
//UPDATE
//==============================================
else if(ev.type == ALLEGRO_EVENT_TIMER)
{
if(playstate)
{
if(v.bounce == 2)
t.speed = 10;
if(v.bounce == 0)
v.speed = 10;
}
if(t.speed > level*10)
{
t.speed = level*10;
}
if(keys[UP])
player.move(false);
if(keys[DOWN])
player.move(true);
if(keys[SPACE])
playstate = true;
t.move();
v.move();
if(v.target != -1)
cpu.ai_move(v.target);
cpu.screen_bound();
v.palka_bound(player.x + player.w);
int check_win = t.screen_bound();
if(check_win == 1)
{
t.reset();
v.reset();
v.dx = t.dx; v.dy = t.dy;
settings.scorecpu++;
playstate = false;
if(settings.scorecpu == 11)
{
al_draw_text(font_medium,al_map_rgb(200,0,0),WIDTH/2,HEIGHT/2,ALLEGRO_ALIGN_CENTER,"Компјутерот победи!");
al_flip_display();
hs.open("hs.sav");
int hsi = 0;
while(!hs.eof())
{
getline(hs,hsdata[hsi]);
hsi++;
}
hs.close();
hs.open("hs.sav",ios_base::trunc|ios_base::app);
hs << hsdata[0];
hstmp = stringToIntAndBack(hsdata[1],1);
hs << hstmp;
hstmp = stringToIntAndBack(hsdata[2],settings.dopir1);
hs << hstmp;
hstmp = stringToIntAndBack(hsdata[3],settings.dopir2);
hs << hstmp;
hstmp = stringToIntAndBack(hsdata[4],settings.dopir1 +
settings.dopir2);
hs << hstmp;
hs.close();
al_rest(3);
break;
}
//poen za kompjuterot
}
else if(check_win == 2)
{
t.reset();
v.reset();
v.dx = t.dx; v.dy = t.dy;
settings.scorep++;
playstate = false;
if(settings.scorep == 11)
{
al_draw_text(font_medium,al_map_rgb(200,0,0),WIDTH/2,HEIGHT/2,ALLEGRO_ALIGN_CENTER,"Играчот победи!");
al_flip_display();
al_rest(3);
break;
}
//poen za igrachot
}
else {}//nikomu nishto
player.screen_bound();
if(phy_check_collision(t.x -
t.r,t.y,t.r,t.r,player.x,player.y,player.w,player.h))
{
if(t.dx == 0)
t.dx = 1;
else
t.dx = 0;
t.speed++;
al_play_sample(dang, 0.5, 0.0,1.0,ALLEGRO_PLAYMODE_ONCE,NULL);
}
if(phy_check_collision(t.x + t.r,t.y,t.r,t.r,cpu.x,cpu.y,cpu.w,cpu.h))
{
if(t.dx == 0)
t.dx = 1;
else
t.dx = 0;
v.target = -1;
t.speed++;
al_play_sample(dang, 0.5, 0.0,1.0,ALLEGRO_PLAYMODE_ONCE,NULL);
}
if(phy_check_collision(v.x - v.r,v.y,v.r,v.r,player.x,0,player.w,HEIGHT))
{
v.dx--;
v.bounce++;
v.speed++;
}
if(phy_check_collision(v.x + v.r,v.y,v.r,v.r,cpu.x,0,cpu.w,HEIGHT))
{
v.dx++;
v.bounce++;
v.target = v.y;
v.speed++;
}
cout<<t.speed<<" "<<v.speed<<endl;
render = true;
}
//==============================================
//RENDER
//==============================================
if(render && al_is_event_queue_empty(event_queue))
{
t.draw();
//v.draw();
player.draw();
cpu.draw();
settings.draw_highscore(font_small,WIDTH);
if(t.speed < level*10)
gui_draw_value_bar(t.speed, level*10 ,WIDTH/2 -
50,10,100,10,al_map_rgb(200,200,0),al_map_rgb(100,100,0));
else
gui_draw_value_bar(level*10, level*10 ,WIDTH/2 - 50,
10,100,10,al_map_rgb(200,0,0),al_map_rgb(100,0,0));
render = false;
al_flip_display();
al_clear_to_color(al_map_rgb(0,0,0));
}
}
}
void multiplayer()
{
done = false;
bool playstate = false;
topce t(WIDTH, HEIGHT,true,topce_image);
topce v(WIDTH, HEIGHT,false,topce_image);
palka player(WIDTH,HEIGHT,false,palka_image);
palka cpu(WIDTH,HEIGHT,true,palka_image);
settings.scorecpu = 0;
settings.scorep = 0;
al_clear_to_color(al_map_rgb(0,0,0));
event_queue = al_create_event_queue();
timer = al_create_timer(1.0 / 60);
al_register_event_source(event_queue, al_get_timer_event_source(timer));
al_register_event_source(event_queue, al_get_keyboard_event_source());
al_start_timer(timer);
while(!done)
{
ALLEGRO_EVENT ev;
al_wait_for_event(event_queue, &ev);
//==============================================
//INPUT
//==============================================
if(ev.type == ALLEGRO_EVENT_KEY_DOWN)
{
switch(ev.keyboard.keycode)
{
case ALLEGRO_KEY_ESCAPE:
done = true;
break;
case ALLEGRO_KEY_W:
keys[W] = true;
break;
case ALLEGRO_KEY_S:
keys[S] = true;
break;
case ALLEGRO_KEY_UP:
keys[UP] = true;
break;
case ALLEGRO_KEY_DOWN:
keys[DOWN] = true;
break;
case ALLEGRO_KEY_SPACE:
keys[SPACE] = true;
break;
}
}
else if(ev.type == ALLEGRO_EVENT_KEY_UP)
{
switch(ev.keyboard.keycode)
{
case ALLEGRO_KEY_ESCAPE:
done = true;
break;
case ALLEGRO_KEY_W:
keys[W] = false;
break;
case ALLEGRO_KEY_S:
keys[S] = false;
break;
case ALLEGRO_KEY_UP:
keys[UP] = false;
break;
case ALLEGRO_KEY_DOWN:
keys[DOWN] = false;
break;
case ALLEGRO_KEY_SPACE:
keys[SPACE] = false;
break;
}
}
//==============================================
//UPDATE
//==============================================
else if(ev.type == ALLEGRO_EVENT_TIMER)
{
if(playstate && t.speed < 10)
t.speed = 10;
if(keys[W])
player.move(false);
if(keys[S])
player.move(true);
if(keys[UP])
cpu.move(false);
if(keys[DOWN])
cpu.move(true);
if(keys[SPACE])
playstate = true;
t.move();
v.move();
player.screen_bound();
cpu.screen_bound();
int check_win = t.screen_bound();
if(check_win == 1)
{
t.reset_multi();
settings.scorecpu++;
playstate = false;
if(settings.scorecpu == 11)
{
al_draw_text(font_medium,al_map_rgb(200,0,0),WIDTH/2,HEIGHT/2,ALLEGRO_ALIGN_CENTER,"Вториот играч победи!");
al_flip_display();
al_rest(3);
break;
}
//poen za kompjuterot
}
else if(check_win == 2)
{
t.reset_multi();
settings.scorep++;
playstate = false;
if(settings.scorep == 11)
{
al_draw_text(font_medium,al_map_rgb(200,0,0),WIDTH/2,HEIGHT/2,ALLEGRO_ALIGN_CENTER,"Првиот играч победи!");
al_flip_display();
al_rest(3);
break;
}
//poen za igrachot
}
else {}//nikomu nishto
if(phy_check_collision(t.x -
t.r,t.y,t.r,t.r,player.x,player.y,player.w,player.h))
{
if(t.dx == 0)
t.dx = 1;
else
t.dx = 0;
t.speed++;
al_play_sample(dang, 0.5, 0.0,1.0,ALLEGRO_PLAYMODE_ONCE,NULL);
}
if(phy_check_collision(t.x + t.r,t.y,t.r,t.r,cpu.x,cpu.y,cpu.w,cpu.h))
{
if(t.dx == 0)
t.dx = 1;
else
t.dx = 0;
v.target = -1;
t.speed++;
al_play_sample(dang, 0.5, 0.0,1.0,ALLEGRO_PLAYMODE_ONCE,NULL);
}
render = true;
}
//==============================================
//RENDER
//==============================================
if(render && al_is_event_queue_empty(event_queue))
{
t.draw();
//v.draw();
player.draw();
cpu.draw();
settings.draw_highscore(font_small,WIDTH);
//gui_draw_value_bar(t.speed, 80 ,WIDTH/2 - 50,10,100,10,al_map_rgb(200,200,0),al_map_rgb(100,100,0));
render = false;
al_flip_display();
al_clear_to_color(al_map_rgb(0,0,0));
}
}
}
void demoplay()
{
done = false;
topce t(WIDTH, HEIGHT,true,topce_image);
topce v(WIDTH, HEIGHT,false,topce_image);
palka player(WIDTH,HEIGHT,false,palka_image);
palka cpu(WIDTH,HEIGHT,true,palka_image);
settings.scorecpu = 0;
settings.scorep = 0;
al_clear_to_color(al_map_rgb(0,0,0));
event_queue = al_create_event_queue();
timer = al_create_timer(1.0 / 60);
al_register_event_source(event_queue, al_get_timer_event_source(timer));
al_register_event_source(event_queue, al_get_keyboard_event_source());
al_start_timer(timer);
while(!done)
{
ALLEGRO_EVENT ev;
al_wait_for_event(event_queue, &ev);
//==============================================
//INPUT
//==============================================
if(ev.type == ALLEGRO_EVENT_KEY_DOWN)
{
switch(ev.keyboard.keycode)
{
case ALLEGRO_KEY_ESCAPE:
done = true;
break;
case ALLEGRO_KEY_UP:
keys[UP] = true;
break;
case ALLEGRO_KEY_DOWN:
keys[DOWN] = true;
break;
case ALLEGRO_KEY_SPACE:
keys[SPACE] = true;
break;
}
}
else if(ev.type == ALLEGRO_EVENT_KEY_UP)
{
switch(ev.keyboard.keycode)
{
case ALLEGRO_KEY_ESCAPE:
done = true;
break;
case ALLEGRO_KEY_UP:
keys[UP] = false;
break;
case ALLEGRO_KEY_DOWN:
keys[DOWN] = false;
break;
case ALLEGRO_KEY_SPACE:
keys[SPACE] = false;
break;
}
}
//==============================================
//UPDATE
//==============================================
else if(ev.type == ALLEGRO_EVENT_TIMER)
{
if(v.bounce == 2)
t.speed = 10;
if(v.bounce == 0)
v.speed = 10;
t.move();
v.move();
if(v.target != -1)
cpu.ai_move(v.target);
if(v.targetdemo != -1)
player.ai_move(v.targetdemo);
cpu.screen_bound();
player.screen_bound();
v.palka_bound(player.x + player.w);
int check_win = t.screen_bound();
if(check_win == 1)
{
t.reset();
v.reset();
v.dx = t.dx; v.dy = t.dy;
settings.scorecpu++;
if(settings.scorecpu == 11)
{
al_draw_text(font_medium,al_map_rgb(200,0,0),WIDTH/2,HEIGHT/2,ALLEGRO_ALIGN_CENTER,"Вториот играч победи!");
al_flip_display();
al_rest(3);
}
//poen za kompjuterot
}
else if(check_win == 2)
{
t.reset();
v.reset();
v.dx = t.dx; v.dy = t.dy;
settings.scorep++;
if(settings.scorep == 11)
{
al_draw_text(font_medium,al_map_rgb(200,0,0),WIDTH/2,HEIGHT/2,ALLEGRO_ALIGN_CENTER,"Првиот играч победи!");
al_flip_display();
al_rest(3);
}
//poen za igrachot
}
else {}//nikomu nishto
if(phy_check_collision(t.x -
t.r,t.y,t.r,t.r,player.x,player.y,player.w,player.h))
{
if(t.dx == 0)
t.dx = 1;
else
t.dx = 0;
v.targetdemo = -1;
t.speed++;
al_play_sample(dang, 0.5, 0.0,1.0,ALLEGRO_PLAYMODE_ONCE,NULL);
}
if(phy_check_collision(t.x + t.r,t.y,t.r,t.r,cpu.x,cpu.y,cpu.w,cpu.h))
{
if(t.dx == 0)
t.dx = 1;
else
t.dx = 0;
v.target = -1;
t.speed++;
al_play_sample(dang, 0.5, 0.0,1.0,ALLEGRO_PLAYMODE_ONCE,NULL);
}
if(phy_check_collision(v.x - v.r,v.y,v.r,v.r,player.x,0,player.w,HEIGHT))
{
v.dx--;
v.bounce++;
v.targetdemo = v.y;
v.speed++;
}
if(phy_check_collision(v.x + v.r,v.y,v.r,v.r,cpu.x,0,cpu.w,HEIGHT))
{
v.dx++;
v.bounce++;
v.target = v.y;
v.speed++;
}
cout<<t.speed<<" "<<v.speed<<endl;
render = true;
}
//==============================================
//RENDER
//==============================================
if(render && al_is_event_queue_empty(event_queue))
{
t.draw();
//v.draw();
player.draw();
cpu.draw();
settings.draw_highscore(font_small,WIDTH);
/*
if(t.speed < level*10)
gui_draw_value_bar(t.speed, level*10 ,WIDTH/2 -
50,10,100,10,al_map_rgb(200,200,0),al_map_rgb(100,100,0));
else
gui_draw_value_bar(level*10, level*10 ,WIDTH/2 - 50,
10,100,10,al_map_rgb(200,0,0),al_map_rgb(100,0,0));*/
render = false;
al_flip_display();
al_clear_to_color(al_map_rgb(0,0,0));
}
}
}
int pomosh()
{
done = false;
event_queue = al_create_event_queue();
timer = al_create_timer(1.0 / 60);
al_register_event_source(event_queue, al_get_timer_event_source(timer));
al_register_event_source(event_queue, al_get_keyboard_event_source());
al_start_timer(timer);
while(!done)
{
ALLEGRO_EVENT ev;
al_wait_for_event(event_queue, &ev);
//==============================================
//INPUT
//==============================================
if(ev.type == ALLEGRO_EVENT_KEY_DOWN)
{
switch(ev.keyboard.keycode)
{
case ALLEGRO_KEY_ESCAPE:
return 0;
}
}
else if(ev.type == ALLEGRO_EVENT_KEY_UP)
{
switch(ev.keyboard.keycode)
{
case ALLEGRO_KEY_ESCAPE:
return 0;
}
}
else if(ev.type == ALLEGRO_EVENT_TIMER)
{
render = true;
}
if(render && al_is_event_queue_empty(event_queue))
{
al_clear_to_color(al_map_rgb(0,0,0));
al_draw_text(font_medium,al_map_rgb(0,128,255),50,50,ALLEGRO_ALIGN_LEFT,"Еден играч");
al_draw_text(font_small,al_map_rgb(240,240,240),50,120,ALLEGRO_ALIGN_LEFT,"[Стрелка нагоре] - Движење на палката нагоре");
al_draw_text(font_small,al_map_rgb(240,240,240),50,150,ALLEGRO_ALIGN_LEFT,"[Стрелка надолу] - Движење на палката надолу");
al_draw_text(font_small,al_map_rgb(240,240,240),50,180,ALLEGRO_ALIGN_LEFT,"[SPACE] - Фрлање на топчето");
al_draw_text(font_small,al_map_rgb(240,240,240),50,240,ALLEGRO_ALIGN_LEFT,"Победник во играта е оној кој прв");
al_draw_text(font_small,al_map_rgb(240,240,240),50,270,ALLEGRO_ALIGN_LEFT,"ќе постигне 11 поени. ");
al_draw_text(font_small,al_map_rgb(240,240,240),50,300,ALLEGRO_ALIGN_LEFT,"Статистиката влегува во резултатите.");
al_draw_text(font_medium,al_map_rgb(0,128,255),WIDTH -
50,50,ALLEGRO_ALIGN_RIGHT,"Два играчи");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH -
50,120,ALLEGRO_ALIGN_RIGHT,"[W] - Движење на левата палката нагоре");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH -
50,150,ALLEGRO_ALIGN_RIGHT,"[S] - Движење на левата палката надолу");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH -
50,180,ALLEGRO_ALIGN_RIGHT,"[Стрелка нагоре] - Движење на десната палката нагоре");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH -
50,210,ALLEGRO_ALIGN_RIGHT,"[Стрелка надолу] - Движење на десната палката надолу");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH -
50,240,ALLEGRO_ALIGN_RIGHT,"Топчето се фрла автоматски по постигнување на поен");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH -
50,300,ALLEGRO_ALIGN_RIGHT,"Победник во играта е оној кој прв");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH -
50,330,ALLEGRO_ALIGN_RIGHT,"ќе постигне 11 поени.");
al_draw_text(font_medium,al_map_rgb(0,128,255),WIDTH/2,420,ALLEGRO_ALIGN_CENTER,"За Понг");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH/2,490,ALLEGRO_ALIGN_CENTER,"Играта Понг е направена од Мартин Петковски за неговата матурска проектна задача.");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH/2,520,ALLEGRO_ALIGN_CENTER,"Графиката на играта и музиката во менито е направена од Мартин Петковски.");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH/2,550,ALLEGRO_ALIGN_CENTER,"Музиката во играта е „Ова не е диско“ од Д’Џон и е користена само за презентација.");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH/2,580,ALLEGRO_ALIGN_CENTER,"Фонтовите се превземени бесплатно од страната на МИО.");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH/2,610,ALLEGRO_ALIGN_CENTER,"");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH/2,640,ALLEGRO_ALIGN_CENTER,"Битола, Февруари/Март 2013");
al_draw_text(font_small,al_map_rgb(240,240,240),WIDTH/2,670,ALLEGRO_ALIGN_CENTER,"");
al_flip_display();
}
}
}
int main(int argc, char **argv)
{
//==============================================
// INICIJALIZACIJA NA ALLEGRO
//==============================================
if(!al_init())
return -1;
al_get_display_mode(al_get_num_display_modes() - 1, &disp_data);
al_set_new_display_flags(ALLEGRO_FULLSCREEN);
WIDTH = disp_data.width;
HEIGHT = disp_data.height;
display = al_create_display(WIDTH, HEIGHT);
if(!display)
return -1;
//==============================================
// INICIJALIZACIJA NA DODATOCI
//==============================================
al_install_keyboard();
al_init_image_addon();
al_init_font_addon();
al_init_ttf_addon();
al_init_primitives_addon();
if(!al_install_audio()){
fprintf(stderr, "failed to initialize audio!\n");
return -1;
}
if(!al_init_acodec_addon()){
fprintf(stderr, "failed to initialize audio codecs!\n");
return -1;
}
if (!al_reserve_samples(5)){
fprintf(stderr, "failed to reserve samples!\n");
return -1;
}
//==============================================
//INICIJALIZACIJA NA PROMENLIVI
//==============================================
font_big = al_load_font("skola.otf", 60, 0);
al_clear_to_color(al_map_rgb(0,0,0));
al_draw_text(font_big,al_map_rgb(200,0,0),200,200,0,"Вчитување ...");
al_flip_display();
font_medium = al_load_font("skola.otf", 40, 0);
font_small = al_load_font("skola.otf", 24, 0);
vector<string> options;
options.push_back("Еден играч");
options.push_back("Два играчи");
options.push_back("ВИ Демо");
options.push_back("Резултати");
options.push_back("Помош");
options.push_back("Излез");
vector<string> levels;
levels.push_back("Прелесно");
levels.push_back("Лесно");
levels.push_back("Така-така");
levels.push_back("Тешко");
levels.push_back("Невозможно");
topce_image = al_load_bitmap("ball.png");
if(!topce_image) {
fprintf(stderr, "failed to create topce bitmap!\n");
al_destroy_display(display);
al_destroy_timer(timer);
return -1;
}
palka_image = al_load_bitmap("bat.png");
if(!palka_image) {
fprintf(stderr, "failed to create palka bitmap!\n");
al_destroy_display(display);
al_destroy_timer(timer);
return -1;
}
menu_music = al_load_sample("menu_music.wav");
if(!menu_music)
{
fprintf(stderr, "failed to create menu music!\n");
return -1;
}
game_music = al_load_sample("thejohn.wav");
if(!game_music)
{
fprintf(stderr, "failed to create game music!\n");
return -1;
}
dang = al_load_sample("dang.wav");
if(!dang)
{
fprintf(stderr, "failed to create dang sound!\n");
return -1;
}
//===============================================
// OPCII
//===============================================
int selection, level;
while(1)
{
al_stop_samples();
al_play_sample(menu_music, 0.7, 0.0,1.0,ALLEGRO_PLAYMODE_LOOP,NULL);
selection = gui_generate_menu(options,"Главно мени",font_medium,al_map_rgb(200,0,0),al_map_rgb(255,255,255),al_map_rgb(200,200,0),al_map_rgb(0,0,0),WIDTH/2,100,50);
if(selection == 1)
{
al_clear_to_color(al_map_rgb(0,0,0));
level = gui_generate_menu(levels,"Одбери ниво",font_medium,al_map_rgb(200,0,0),al_map_rgb(255,255,255),al_map_rgb(200,200,0),al_map_rgb(0,0,0),WIDTH/2,100,50);
al_stop_samples();
al_play_sample(game_music, 1.0, 0.0,1.0,ALLEGRO_PLAYMODE_LOOP,NULL);
single_player(level);
}
else if(selection == 2)
{
al_stop_samples();
al_play_sample(game_music, 1.0, 0.0,1.0,ALLEGRO_PLAYMODE_LOOP,NULL);
multiplayer();
}
else if(selection == 3)
{
al_stop_samples();
al_play_sample(game_music, 1.0, 0.0,1.0,ALLEGRO_PLAYMODE_LOOP,NULL);
demoplay();
}
else if(selection == 5)
pomosh();
else if(selection == 6)
break;
}
//==============================================
//UNISHTUVANJE NA ALLEGRO OBJEKTI
//==============================================
al_destroy_font(font_big);
al_destroy_timer(timer);
al_destroy_event_queue(event_queue);
al_destroy_display(display);
al_destroy_sample(menu_music);
return 0;
}
