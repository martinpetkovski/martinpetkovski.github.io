# Missing Pong assets

The PDF contains the source code but not the game's original media files.
The executable uses relative paths, so these files must be in its working
directory at runtime.

## Where to put them

Place the recovered files in:

```text
game-prototypes/pong/assets/
```

Then rebuild the project. CMake copies everything in that directory to:

```text
game-prototypes/pong/build/Release/
```

That is the directory containing `pong.exe`. If you do not want to rebuild,
you can copy the files directly beside `pong.exe` instead and launch it from
that directory.

## Required files

| File | Type | Used for |
| --- | --- | --- |
| `skola.otf` | OpenType font | All menus, loading text, scores, help, and win messages |
| `ball.png` | PNG image | Ball sprite |
| `bat.png` | PNG image | Player and computer paddle sprites |
| `menu_music.wav` | WAV audio | Looping main-menu music |
| `thejohn.wav` | WAV audio | Looping gameplay music |
| `dang.wav` | WAV audio | Paddle-hit sound effect |

The filenames must match exactly. Do not rename the files or place them in a
nested directory.

The restored sprites are sized for the Full HD reference: `ball.png` is
44x44 pixels and `bat.png` is 33x270 pixels. Their pre-resize versions are
preserved under `archive/original-assets/`.

## Save file

`hs.sav` is game data rather than a media asset. The program expects it in the
same directory when updating saved statistics. If the original file is
available, place it in `assets/` too. If it is not available, this does not
explain the immediate startup crash; the missing `skola.otf` is the earliest
unchecked asset load and is the most likely cause.
