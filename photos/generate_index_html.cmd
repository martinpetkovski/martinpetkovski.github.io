echo ^<!doctype html^>^<head^>^<link rel=^"stylesheet^" href=^"core.css^"^> ^</head^>^<body^>^<div class=^"container^"^> >> index.html
for %%j in (*.JFIF, *.png, *.JPG, *.GIF) do echo ^<img src=^"./%%j^" ^>  >> index.html
echo ^</div^>^</body^>^</html^> >> index.html