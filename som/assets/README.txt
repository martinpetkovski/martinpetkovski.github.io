trailer.mp4 - the one video (muted). It is downloaded completely behind the loading bar, plays once
from the start, then loops between loopStart and loopEnd (CONFIG in script.js), crossfading the
last `fade` seconds of the loop into its start.
H.264 1920x1080 is a good default; keep it as small as you can - visitors download all of it first.

Pick the loop points: open index.html?loop (from a web server), scrub, set start and end,
press "Preview the seam", then copy the line into CONFIG in script.js.
You can also try values without editing: index.html?loopStart=12.5&loopEnd=41.2&fade=1

steam_logo.svg - the official Steam logo (Valve's store header artwork, downloaded from
store.fastly.steamstatic.com); its round mark is drawn as a pixel glyph before "STEAM" on the button.

Serve the folder from a web server. Opened straight from disk the page still works, but the
progress bar then follows the browser's buffering instead of the download.
