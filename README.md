# FRAMEVIEW

FRAMEVIEW is a Windows media player for reviewing video. Turn a video into a clickable timeline of scene cuts, listen to several audio tracks together, and inspect or capture the frame you need.

[Download FRAMEVIEW for Windows x64](https://github.com/tnmod/FRAMEVIEW/releases/latest)

## What sets FRAMEVIEW apart

### Detect scene cuts and jump to them

Open a video and run **AI Intelligence → Tasks → Scene Cut Detection**. FRAMEVIEW compares frames locally, marks the detected cuts, and divides the timeline into segments. Click a cut marker to jump to that point in the video.

Adjust detection sensitivity or enable **Let Vision Model confirm cuts** for a second pass. The model reviews frames on either side of selected candidates, and the timeline shows the cuts it confirms. Choose a vision model from a local Ollama server or an OpenAI-compatible endpoint under **Providers**. With a remote endpoint, FRAMEVIEW sends the frames selected for review to that provider.

### Play multiple audio tracks at once

Select several audio tracks from the same file and hear them mixed during playback. For example, keep the original soundtrack audible while listening to commentary stored on another track.

### Inspect the file and capture the frame

Hover over the timeline to preview a frame, then use `,` and `.` to step backward or forward one frame at a time. Press `S` to save the current frame as PNG, JPG, or WebP, with optional subtitles.

Open **Media Inspector** with `I` to check the file’s video, audio, and subtitle streams. It shows details such as codec, frame rate, color space, pixel format, bitrate, and audio channel layout when available.

## Try it

Run the Windows x64 setup executable from GitHub Releases. It includes the WebView2 Runtime. Drag a media file into FRAMEVIEW or press `Ctrl+O` to open one. Press `A` to open AI Intelligence, or `?` to see all keyboard shortcuts.

## Run from source

Use Windows x64 with Node.js 22.12+ in the 22.x series or Node.js 24.x, stable Rust with the `x86_64-pc-windows-msvc` toolchain, and Microsoft C++ Build Tools with **Desktop development with C++**. Native dependency setup uses Windows PowerShell, `curl.exe`, `tar.exe`, and `expand.exe`. [Tauri setup guide for Windows](https://v2.tauri.app/start/prerequisites/#windows)

```powershell
git clone https://github.com/tnmod/FRAMEVIEW.git
cd FRAMEVIEW
npm ci
npm run tauri dev
```

Tauri prepares pinned versions of libmpv, FFprobe, and WebView2 before running or building the desktop app. The setup verifies downloads with SHA-256 and reuses matching local copies. Use `npm run setup:native` to prepare dependencies before running Cargo directly.

Update the pinned WebView2 version when publishing runtime security updates. [Microsoft's Fixed Version distribution guide](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#the-fixed-version-runtime-distribution-mode)

| Command | Result |
| --- | --- |
| `npm test` | Run the Vitest suite |
| `npm run build` | Type-check and build the frontend |
| `npm run build:fast` | Build the release executable |
| `npm run build:installer` | Build the Windows NSIS installer in `desktop/target/release/bundle/nsis/` |

The React interface lives in [`frontend/`](frontend/). The Tauri and Rust app lives in [`desktop/`](desktop/). See the [bundled media components](desktop/lib/THIRD-PARTY.md) for upstream sources and licenses.
