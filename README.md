# FRAMEVIEW

FRAMEVIEW is a Windows video and audio player powered by libmpv. Step through video frame by frame, inspect media metadata with FFprobe, and jump to detected scene cuts directly from the timeline.

## Features

- Open multiple files, drag and drop media, or load videos from a folder. Queue files for playback and resume from where you left off.
- Preview frames by hovering over the timeline, step forward or backward one frame at a time, adjust playback speed, and switch to fullscreen or Picture-in-Picture.
- Select an audio track or play multiple tracks from the same file at once. Switch subtitle tracks or load external subtitles such as SRT, ASS, and VTT.
- View video, audio, and subtitle metadata in **Media Inspector**. Capture frames as PNG, JPG, or WebP, with optional subtitles.
- Detect scene cuts and click their timeline markers to jump to the corresponding frames.

Common formats include MP4, MKV, MOV, WebM, and AVI for video, and MP3, FLAC, WAV, and M4A for audio.

## Usage

Press `Ctrl+O` or drag media files into the window. When you open multiple files, FRAMEVIEW adds them to the playback queue and opens the first one.

| Shortcut | Action |
| --- | --- |
| `Space` | Play or pause |
| `←` / `→` | Seek backward or forward 5 seconds |
| `Shift+←` / `Shift+→` | Seek backward or forward 1 second |
| `J` / `L` | Seek backward or forward 10 seconds |
| `,` / `.` | Step backward or forward one frame |
| `[` / `]` | Decrease or increase playback speed |
| `P` / `N` | Open the previous or next file |
| `Q` / `I` | Toggle the playback queue or Media Inspector |
| `S` | Capture the current frame |
| `F` / `Alt+P` | Toggle fullscreen or Picture-in-Picture |
| `A` | Toggle the AI Intelligence panel |
| `Ctrl+,` | Open settings |
| `?` | View all keyboard shortcuts |

### Scene cut detection

1. Open a video, press `A`, and go to **Tasks → Scene Cut Detection**.
2. Run detection to mark scene cuts on the timeline. FRAMEVIEW can detect cuts locally by comparing video frames.
3. For optional model verification, open **Providers** and connect to Ollama (default endpoint `http://localhost:11434`) or add an OpenAI-compatible endpoint. Select a vision-capable model under **Scene Cut Detection Model**, then return to **Tasks**, enable **Let Vision Model confirm cuts**, and run detection again.

When you use a remote endpoint for verification, FRAMEVIEW sends the frames it needs to review to that endpoint.

## Run from source

### Requirements

- 64-bit Windows.
- Node.js 22.12 or later in the 22.x series, or Node.js 24.x, with npm.
- Stable Rust with the `x86_64-pc-windows-msvc` toolchain, Microsoft C++ Build Tools with the **Desktop development with C++** workload, and Microsoft Edge WebView2 Runtime. [Tauri setup guide for Windows](https://v2.tauri.app/start/prerequisites/#windows)
- `ffprobe.exe` from a static 64-bit Windows build of FFmpeg. [FFmpeg downloads](https://ffmpeg.org/download.html#build-windows)

### Setup

Clone the repository and install its dependencies from PowerShell.

```powershell
git clone https://github.com/tnmod/FRAMEVIEW.git
cd FRAMEVIEW
npm ci
```

Create the `src-tauri/binaries` directory and copy the extracted `ffprobe.exe` to `src-tauri/binaries/ffprobe-x86_64-pc-windows-msvc.exe`. Tauri expects the executable at that path for development and production builds. The repository already includes the libmpv DLLs in `src-tauri/lib`. [Tauri sidecar naming guide](https://v2.tauri.app/develop/sidecar/)

Start the desktop app.

```powershell
npm run tauri dev
```

## Test and build

| Command | Result |
| --- | --- |
| `npm test` | Run the Vitest suite |
| `npm run build` | Type-check and build the frontend into `dist/` |
| `npm run build:fast` | Compile the release desktop executable |
| `npm run build:installer` | Create the Windows NSIS installer in `src-tauri/target/release/bundle/nsis/` with the default build configuration |

The frontend uses React, TypeScript, Vite, Tailwind CSS, and Zustand. The desktop application uses Tauri 2 and Rust. See the bundled [libmpv license](src-tauri/lib/LICENSE).
