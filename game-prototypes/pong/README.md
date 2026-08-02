# Pong source restoration

This directory restores the C++ code printed on pages 11-32 of `pong.pdf`.
The archived code is compiled through a tiny compatibility wrapper so the
original files remain unchanged.

## Dependencies

- A C++17 compiler and CMake 3.25 or newer
- Allegro 5, including the image, primitives, font, TTF, audio, and audio-codec
  add-ons

The checked-in `vcpkg.json` installs Allegro and its transitive dependencies.
Bootstrap a local vcpkg checkout, configure, and build on Windows with:

```powershell
.\build.ps1
```

The script downloads and bootstraps a local vcpkg checkout when necessary.
Pass `-Configuration Debug` to create a Debug build instead.

The executable is written under `build/Release/` by the Visual Studio generator.

## Create a downloadable package

Run:

```powershell
.\package.ps1
```

The self-contained Windows x64 ZIP is written to `dist/`. That directory is
ignored by Git. After uploading the ZIP, paste its public URL into the `build`
field for Pong in `../prototypes.json`. The website's Source code and Project
PDF links are already configured.

## Runtime files

The PDF contains source code only. See `MISSING_ASSETS.md` for the exact file
list and placement instructions. Files placed in `assets/` are copied beside
`pong.exe` automatically when the project is built.

## Minimal compatibility change

The archived program calls the non-standard Windows `itoa` function. The
wrapper in `src/compatibility.hpp` supplies the same operation with standard
C++17 `std::to_chars`; no gameplay code is changed.
