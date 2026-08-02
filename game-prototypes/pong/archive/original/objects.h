class global_game_settings
{
public:
int scorep, scorecpu;
int dopir1, dopir2;
void draw_highscore(ALLEGRO_FONT *font,int screen_w)
{
al_draw_textf(font,al_map_rgb(255,255,255),screen_w/2,30,ALLEGRO_ALIGN_CENTER,"%d - %d",scorep,scorecpu);
}
};
class topce
{
private:
int w,h;
bool iv;
ALLEGRO_BITMAP *img;
public:
int x, y, r, dx, dy, speed, bounce;
int target, targetdemo;
int grn(int min, int max)
{
srand(time(NULL));
return(rand()%(max-min)+min);
}
topce(int screen_w, int screen_h, bool isnt_virtual, ALLEGRO_BITMAP *image)
{
r = 15;
x = screen_w/2 - r;
y = screen_h/2 - r;
w = screen_w;
h = screen_h;
dx = grn(0,1); dy = grn(0,1);
speed = 0;
iv = isnt_virtual;
bounce = 0;
target = -1;
targetdemo = -1;
img = image;
}
void reset()
{
r = 15;
x = w/2 - r;
y = h/2 - r;
//dx = grn(0,1); dy = grn(0,1);
speed = 0;
bounce = 0;
target = -1;
targetdemo = -1;
}
void reset_multi()
{
r = 15;
x = w/2 - r;
y = h/2 - r;
//dx = grn(0,1); dy = grn(0,1);
speed = 10;
}
int screen_bound()
{
if(x - r < 0)
return 1;
if(x + r > w)
return 2;
if(y - r < 0)
{
y = 0 + r;
dy--;
return 0;
}
if(y + r > h)
{
y = h - r;
dy++;
return 0;
}
}
int palka_bound(int bound)
{
if(y - r < 0)
{
y = 0 + r;
dy--;
bounce ++;
return 0;
}
if(y + r > h)
{
y = h - r;
dy++;
bounce ++;
return 0;
}
}
void draw()
{
if(iv)
{
//al_draw_circle(x,y,r,al_map_rgb(0,200,0),5);
al_draw_bitmap(img,x-r,y-r,0);
}
else
al_draw_circle(x,y,r,al_map_rgb(200,0,0),4);
}
void move()
{
if(dx == 0)
x += speed;
else
x-= speed;
if(dy == 0)
y += speed;
else
y -= speed;
}
};
class palka
{
private:
int sw,sh;
public:
int x, y, w,h, dx, dy, speed;
ALLEGRO_BITMAP *img;
palka(int screen_w, int screen_h, bool cpu, ALLEGRO_BITMAP *image)
{
sw = screen_w;
sh = screen_h;
w = 20;
h = sh/4;
if(cpu)
x = sw - 50;
else
x = 50;
y = sh/2 - h/2;
dx = 0; dy = 1;
speed = 10;
img = image;
}
void move(bool direction)
{
if(direction)
y += speed;
else
y -= speed;
}
void ai_move(int target)
{
if(target < y + 50)
y-=speed;
else if(target > y + h - 50)
y+=speed;
}
void screen_bound()
{
if(y < 0)
y = 0;
if(y+h > sh)
y = sh - h;
}
void draw()
{
//al_draw_filled_rectangle(x,y,x+w,y+h,al_map_rgb(0,0,200));
al_draw_bitmap(img,x,y,0);
}
};
class powerup
{
public:
int xx,yy,t;
powerup(int x,int y,int type)
{
xx = x;
yy = y;
t = type;
}
};
