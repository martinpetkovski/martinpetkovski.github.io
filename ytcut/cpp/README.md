# ytcut (C++ console)

This is a minimal C++ console wrapper that:
1) uses `yt-dlp` to download/merge a YouTube video to MP4
2) uses `ffmpeg` to trim from `start` to `end`

It keeps C++ dependencies minimal by delegating the hard parts to those tools.

## Requirements (runtime)

- Windows
- `yt-dlp.exe` on PATH (or in the same folder as `ytcut.exe`)
- `ffmpeg.exe` on PATH (or in the same folder as `ytcut.exe`)

## Build (Windows)

### CMake + MSVC (recommended)

From this folder:

- `powershell -ExecutionPolicy Bypass -File .\build_windows.ps1 -Configuration Release`

This uses CMake and MSVC. If you do not have a VS Developer shell open, it will try to locate MSVC via `vswhere`.

## Usage

### Interactive

- `ytcut.exe`

### CLI

- Full download (no trimming):
	- `ytcut.exe --url "https://www.youtube.com/watch?v=..."`

- Trim a segment:
	- `ytcut.exe --url "https://www.youtube.com/watch?v=..." --start 00:01:23 --end 00:02:10 --out clip.mp4`

Output behavior:
- If `--out` is omitted, it writes `out.mp4` next to `ytcut.exe`.
- If `--out` is a relative path, it is resolved relative to the `ytcut.exe` folder.

Time formats:
- seconds: `83` or `83.5`
- `MM:SS(.ms)` or `HH:MM:SS(.ms)`

## Notes

- Trimming uses `-c copy` for speed (not frame-accurate in all cases).
- You are responsible for complying with YouTube’s Terms and any applicable laws.
