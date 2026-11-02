import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Titlebar } from '../Titlebar/Titlebar';
import { EmptyState } from '../VideoArea/EmptyState';
import { PlayerControls } from '../PlayerControls/PlayerControls';
import { MiniPlayerOverlay } from '../PlayerControls/MiniPlayerOverlay';
import { AudioVisualizer } from '../AudioVisualizer/AudioVisualizer';
import { MetadataPanel } from '../MetadataPanel/MetadataPanel';
import { PlaylistPanel } from '../Playlist/PlaylistPanel';
import { AiAnalysisCenter } from '../AiCenter/AiAnalysisCenter';
import { ShortcutsModal } from '../Modals/ShortcutsModal';
import { SettingsModal } from '../Modals/SettingsModal';
import { ToastContainer } from '../Notifications/ToastContainer';
import { usePlayerStore } from '../../store/playerStore';
import { useMetadata } from '../../hooks/useMetadata';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useMpvPlayer } from '../../hooks/useMpvPlayer';
import { useToastStore } from '../../store/toastStore';

const SUB_EXTENSIONS = new Set(['srt', 'ass', 'ssa', 'vtt', 'sub']);

export const AppLayout: React.FC = () => {
  const filePath = usePlayerStore((s) => s.filePath);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const isPip = usePlayerStore((s) => s.isPip);
  const isAudioOnly = usePlayerStore((s) => s.isAudioOnly);
  const isCapturingScreenshot = usePlayerStore((s) => s.isCapturingScreenshot);
  const addToPlaylist = usePlayerStore((s) => s.addToPlaylist);
  const showToast = useToastStore((s) => s.showToast);

  const { loadFile, addSubtitle } = useMpvPlayer();

  // Initialize metadata and keyboard shortcuts
  useMetadata();
  useKeyboardShortcuts();

  // Show window once React has mounted cleanly
  useEffect(() => {
    invoke('show_main_window').catch((err) => {
      console.warn('Failed to call show_main_window:', err);
    });
  }, []);

  // Check if a file was passed as a startup argument (via "Open with..." or double-click)
  useEffect(() => {
    invoke<string | null>('get_startup_file')
      .then((startupFile) => {
        if (startupFile) {
          loadFile(startupFile);
        }
      })
      .catch((err) => console.warn('Failed to get startup file:', err));
  }, [loadFile]);

  // Listen to file open events forwarded by single-instance plugin
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    listen<string>('open_file', (event) => {
      if (event.payload) {
        loadFile(event.payload);
      }
    })
      .then((unlisten) => {
        unlistenFn = unlisten;
      })
      .catch(console.warn);

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [loadFile]);

  // Sync fullscreen state with Tauri window
  useEffect(() => {
    const syncFullscreen = async () => {
      try {
        await invoke('set_window_fullscreen', { fullscreen: isFullscreen });
      } catch (err) {
        try {
          const appWindow = getCurrentWebviewWindow();
          await appWindow.setFullscreen(isFullscreen);
        } catch (e) {
          console.warn('Error syncing fullscreen:', e);
        }
      }
    };
    syncFullscreen();
  }, [isFullscreen]);

  // Listen to file drop via Tauri event
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    try {
      const appWindow = getCurrentWebviewWindow();
      appWindow.onDragDropEvent((event) => {
        if (event.payload.type === 'drop') {
          const paths = event.payload.paths;
          if (!paths || paths.length === 0) return;

          // Check if user dropped a subtitle file
          const firstExt = paths[0].split('.').pop()?.toLowerCase();
          if (firstExt && SUB_EXTENSIONS.has(firstExt)) {
            addSubtitle(paths[0]);
            return;
          }

          // Add dropped video/audio(s) to playlist
          addToPlaylist(paths);
          loadFile(paths[0]);
          if (paths.length > 1) {
            showToast(`Added ${paths.length} items to playlist`, { type: 'success' });
          }
        }
      }).then((unlisten) => {
        unlistenFn = unlisten;
      });
    } catch (err) {
      console.warn('Drag drop listener setup:', err);
    }

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [loadFile, addSubtitle, addToPlaylist, showToast]);

  return (
    <div className="h-screen w-screen flex flex-col bg-transparent overflow-hidden relative">
      {/* Camera shutter flash animation */}
      {isCapturingScreenshot && (
        <div className="fixed inset-0 bg-white/40 z-50 pointer-events-none transition-opacity duration-150 animate-out fade-out" />
      )}

      {/* Top Titlebar (hidden in fullscreen or PiP) */}
      {!isFullscreen && !isPip && <Titlebar />}

      {/* Main Workspace - Fixed 100% Canvas with Floating Overlays */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        {/* Video / Audio Canvas Container - Always fixed full width and height */}
        <div
          onDoubleClick={() => {
            if (filePath && !isPip) {
              usePlayerStore.getState().setIsFullscreen(!isFullscreen);
            }
          }}
          className="w-full h-full relative overflow-hidden bg-transparent"
        >
          {/* Empty State when no media loaded */}
          {!filePath && <EmptyState />}

          {/* Audio Visualizer Studio for audio-only media */}
          {filePath && isAudioOnly && <AudioVisualizer />}

          {/* Mini Player / PiP Overlay or Standard Controls */}
          {isPip ? (
            <MiniPlayerOverlay />
          ) : (
            filePath && <PlayerControls />
          )}
        </div>

        {/* Floating Side Panels (Overlay on top of player, never shifts or resizes player) */}
        {!isPip && <PlaylistPanel />}
        {!isPip && <MetadataPanel />}
        {!isPip && <AiAnalysisCenter />}
      </div>

      {/* Global Notifications and Modals */}
      <ToastContainer />
      <ShortcutsModal />
      <SettingsModal />
    </div>
  );
};
