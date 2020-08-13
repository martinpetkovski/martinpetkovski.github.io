@echo off & setlocal
set batchPath=%~dp0
powershell.exe -file "generatethumbs.ps1"

echo ^<!doctype html^>^<head^>^<link rel=^"stylesheet^" href=^"core.css^"^> ^</head^>^<body^>^<div class=^"container^"^> >> index.html
for %%j in (*.JFIF, *.png, *.JPG, *.GIF) do echo ^<a href=^"./%%j^"^>^<img src=^"./thumbnails/%%j^" ^>^</a^>  >> index.html
echo ^</div^>^</body^>^</html^> >> index.html