import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAiStore } from '../store/aiStore';
import { useMpvPlayer } from './useMpvPlayer';
import { useFileHandler } from './useFileHandler';

export function useKeyboardShortcuts() {
  const store = usePlayerStore();
  const settings = useSettingsStore();
  const player = useMpvPlayer();
  const fileHandler = useFileHandler();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          player.togglePlay();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            player.seek(-1, true);
          } else {
            player.seek(-5, true);
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            player.seek(1, true);
          } else {
            player.seek(5, true);
          }
          break;

        case 'KeyJ':
          e.preventDefault();
          player.seek(-10, true);
          break;

        case 'KeyL':
          e.preventDefault();
          player.seek(10, true);
          break;

        case 'ArrowUp':
          e.preventDefault();
          player.changeVolume(store.volume + 5);
          break;

        case 'ArrowDown':
          e.preventDefault();
          player.changeVolume(store.volume - 5);
          break;

        case 'KeyM':
          e.preventDefault();
          player.toggleMute();
          break;

        case 'KeyS':
          e.preventDefault();
          player.captureScreenshot();
          break;

        case 'KeyQ':
          e.preventDefault();
          store.togglePlaylistOpen();
          break;

        case 'KeyO':
          if (e.ctrlKey) {
            e.preventDefault();
            fileHandler.openFileDialog();
          }
          break;

        case 'KeyF':
          e.preventDefault();
          store.setIsFullscreen(!store.isFullscreen);
          break;

        case 'KeyI':
          e.preventDefault();
          store.toggleMetadataOpen();
          break;

        case 'BracketLeft':
          e.preventDefault();
          player.changeSpeed(Math.max(0.25, Math.round((store.speed - 0.25) * 100) / 100));
          break;

        case 'BracketRight':
          e.preventDefault();
          player.changeSpeed(Math.min(2.0, Math.round((store.speed + 0.25) * 100) / 100));
          break;

        case 'Backspace':
          e.preventDefault();
          player.changeSpeed(1.0);
          break;

        case 'Period':
          e.preventDefault();
          player.frameStep(true);
          break;

        case 'Comma':
          e.preventDefault();
          if (e.ctrlKey) {
            settings.toggleSettingsOpen();
          } else {
            player.frameStep(false);
          }
          break;

        case 'KeyN':
          e.preventDefault();
          fileHandler.nextFile();
          break;

        case 'KeyP':
          e.preventDefault();
          if (e.altKey) {
            store.togglePip();
          } else {
            fileHandler.prevFile();
          }
          break;

        case 'PageUp': {
          e.preventDefault();
          const fp = store.filePath;
          const curTime = store.currentTime;
          if (fp) {
            const chapters = useAiStore.getState().sessions[fp]?.chapters || [];
            if (chapters.length > 0) {
              const prevChap = [...chapters]
                .reverse()
                .find((c) => c.startTime < curTime - 1.5);
              if (prevChap) {
                player.seek(prevChap.startTime, false);
              } else if (chapters[0]) {
                player.seek(chapters[0].startTime, false);
              }
            }
          }
          break;
        }

        case 'PageDown': {
          e.preventDefault();
          const fp = store.filePath;
          const curTime = store.currentTime;
          if (fp) {
            const chapters = useAiStore.getState().sessions[fp]?.chapters || [];
            if (chapters.length > 0) {
              const nextChap = chapters.find((c) => c.startTime > curTime + 0.5);
              if (nextChap) {
                player.seek(nextChap.startTime, false);
              }
            }
          }
          break;
        }

        case 'KeyA':
          e.preventDefault();
          useAiStore.getState().toggleAiCenterOpen();
          break;

        case 'Slash':
          if (e.shiftKey) {
            e.preventDefault();
            store.toggleShortcutsOpen();
          }
          break;

        case 'Escape':
          e.preventDefault();
          if (settings.isSettingsOpen) {
            settings.setIsSettingsOpen(false);
          } else if (store.isShortcutsOpen) {
            store.setIsShortcutsOpen(false);
          } else if (useAiStore.getState().isAiCenterOpen) {
            useAiStore.getState().setIsAiCenterOpen(false);
          } else if (store.isPlaylistOpen) {
            store.setIsPlaylistOpen(false);
          } else if (store.isPip) {
            store.togglePip();
          } else if (store.isFullscreen) {
            store.setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, player, fileHandler, settings]);
}
