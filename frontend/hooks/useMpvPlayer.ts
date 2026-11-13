import { useEffect, useRef, useCallback } from 'react';
import {
  init,
  command,
  setProperty,
  observeProperties,
  MpvObservableProperty,
  MpvConfig,
} from 'tauri-plugin-libmpv-api';
import { invoke } from '@tauri-apps/api/core';
import { usePlayerStore } from '../store/playerStore';
import { useSettingsStore } from '../store/settingsStore';
import { useToastStore } from '../store/toastStore';
import { Track } from '../types/player';
import {
  savePlaybackPosition,
  getSavedPlaybackPosition,
  clearPlaybackPosition,
} from '../utils/playbackHistory';
import { formatTime } from '../utils/formatters';

const OBSERVED_PROPERTIES = [
  ['pause', 'flag'],
  ['time-pos', 'double', 'none'],
  ['duration', 'double', 'none'],
  ['volume', 'double', 'none'],
  ['speed', 'double', 'none'],
  ['eof-reached', 'flag', 'none'],
  ['track-list', 'node', 'none'],
] as const satisfies MpvObservableProperty[];

export function useMpvPlayer() {
  const isInitializedRef = useRef(false);
  const store = usePlayerStore();
  const settings = useSettingsStore();
  const showToast = useToastStore((s) => s.showToast);

  const hasResumedRef = useRef<string | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // Initialize libmpv
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const currentSettings = useSettingsStore.getState();

    const mpvConfig: MpvConfig = {
      initialOptions: {
        'vo': 'gpu-next',
        'hwdec': currentSettings.hwdec || 'auto-safe',
        'keep-open': 'yes',
        'force-window': 'yes',
        'autofit-larger': '100%x100%',
        'terminal': 'no',
        'sub-font-size': currentSettings.subFontSize.toString(),
        'sub-color': currentSettings.subColor,
      },
      observedProperties: OBSERVED_PROPERTIES,
    };

    let cleanupFn: (() => void) | null = null;

    init(mpvConfig)
      .then(async () => {
        const unlisten = await observeProperties(OBSERVED_PROPERTIES, ({ name, data }) => {
          const {
            setPlaybackState,
            setCurrentTime,
            setDuration,
            setVolume,
            setSpeed,
            setTracks,
            filePath,
            duration,
          } = usePlayerStore.getState();

          switch (name) {
            case 'pause':
              if (usePlayerStore.getState().filePath) {
                setPlaybackState(data ? 'paused' : 'playing');
              }
              break;

            case 'time-pos':
              if (typeof data === 'number') {
                setCurrentTime(data);

                // Throttled history save (every 2.5 seconds)
                const now = Date.now();
                if (filePath && now - lastSaveTimeRef.current > 2500 && duration > 0) {
                  lastSaveTimeRef.current = now;
                  savePlaybackPosition(filePath, data, duration);
                }
              }
              break;

            case 'duration':
              if (typeof data === 'number') {
                setDuration(data);

                // Auto resume position check when duration is resolved
                const currentFile = usePlayerStore.getState().filePath;
                if (
                  currentFile &&
                  hasResumedRef.current !== currentFile &&
                  useSettingsStore.getState().autoResume
                ) {
                  hasResumedRef.current = currentFile;
                  const savedPos = getSavedPlaybackPosition(currentFile);
                  if (savedPos && savedPos > 3 && savedPos < data - 5) {
                    command('seek', [savedPos.toString(), 'absolute', 'exact'])
                      .then(() => {
                        showToast(`Resumed from ${formatTime(savedPos)}`, {
                          type: 'info',
                          actionLabel: 'Start Over',
                          onAction: () => {
                            command('seek', ['0', 'absolute', 'exact']);
                            clearPlaybackPosition(currentFile);
                          },
                        });
                      })
                      .catch(console.warn);
                  }
                }
              }
              break;

            case 'volume':
              if (typeof data === 'number') {
                setVolume(data);
              }
              break;

            case 'speed':
              if (typeof data === 'number') {
                setSpeed(data);
              }
              break;

            case 'eof-reached':
              if (data === true) {
                const { playlist, currentPlaylistIndex } = usePlayerStore.getState();
                const autoPlayNext = useSettingsStore.getState().autoPlayNext;

                if (autoPlayNext && currentPlaylistIndex >= 0 && currentPlaylistIndex + 1 < playlist.length) {
                  const nextItem = playlist[currentPlaylistIndex + 1];
                  usePlayerStore.getState().setCurrentPlaylistIndex(currentPlaylistIndex + 1);
                  loadFileInternal(nextItem.path);
                  showToast(`Playing next: ${nextItem.name}`, { type: 'info' });
                } else {
                  setPlaybackState('ended');
                }
              }
              break;

            case 'track-list':
              if (Array.isArray(data)) {
                const audio: Track[] = [];
                const subs: Track[] = [];
                data.forEach((item: any) => {
                  if (item.type === 'audio') {
                    audio.push({
                      id: item.id,
                      type: 'audio',
                      title: item.title || item.lang || `Track ${item.id}`,
                      lang: item.lang || '',
                      codec: item.codec || '',
                      channels: item['audio-channels'],
                      selected: !!item.selected,
                    });
                  } else if (item.type === 'sub') {
                    subs.push({
                      id: item.id,
                      type: 'sub',
                      title: item.title || item.lang || `Subtitle ${item.id}`,
                      lang: item.lang || '',
                      codec: item.codec || '',
                      selected: !!item.selected,
                    });
                  }
                });
                setTracks(audio, subs);
              }
              break;
          }
        });
        cleanupFn = unlisten;
      })
      .catch((err) => {
        console.error('Failed to initialize libmpv:', err);
      });

    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [showToast]);

  // Sync settings when modified
  useEffect(() => {
    if (!isInitializedRef.current) return;
    setProperty('hwdec', settings.hwdec).catch(() => {});
    setProperty('sub-font-size', settings.subFontSize).catch(() => {});
    setProperty('sub-color', settings.subColor).catch(() => {});
  }, [settings.hwdec, settings.subFontSize, settings.subColor]);

  const loadFileInternal = useCallback(async (path: string) => {
    try {
      hasResumedRef.current = null;
      store.setFile(path);
      await command('loadfile', [path]);
      store.setPlaybackState('playing');
    } catch (err: any) {
      console.error('Error loading file in mpv:', err);
      store.setErrorMessage(`Could not load media file: ${err.message || err}`);
      store.setPlaybackState('error');
    }
  }, [store]);

  const loadFile = useCallback(async (path: string) => {
    // Also add to playlist if not already there
    store.addToPlaylist([path]);
    await loadFileInternal(path);
  }, [store, loadFileInternal]);

  const play = useCallback(async () => {
    try {
      await setProperty('pause', false);
      store.setPlaybackState('playing');
    } catch (err) {
      console.error('Error playing:', err);
    }
  }, [store]);

  const pause = useCallback(async () => {
    try {
      await setProperty('pause', true);
      store.setPlaybackState('paused');
    } catch (err) {
      console.error('Error pausing:', err);
    }
  }, [store]);

  const togglePlay = useCallback(async () => {
    if (store.playbackState === 'playing') {
      await pause();
    } else {
      await play();
    }
  }, [store.playbackState, play, pause]);

  const seek = useCallback(async (seconds: number, relative: boolean = false) => {
    try {
      if (relative) {
        await command('seek', [seconds.toString(), 'relative', 'exact']);
      } else {
        await command('seek', [seconds.toString(), 'absolute', 'exact']);
      }
    } catch (err) {
      console.error('Error seeking:', err);
    }
  }, []);

  const changeVolume = useCallback(async (vol: number) => {
    try {
      const clamped = Math.max(0, Math.min(100, vol));
      store.setVolume(clamped);
      store.setIsMuted(false);
      await setProperty('volume', clamped);
    } catch (err) {
      console.error('Error setting volume:', err);
    }
  }, [store]);

  const toggleMute = useCallback(async () => {
    try {
      const newMuted = !store.isMuted;
      store.setIsMuted(newMuted);
      await setProperty('mute', newMuted);
    } catch (err) {
      console.error('Error toggling mute:', err);
    }
  }, [store]);

  const changeSpeed = useCallback(async (speed: number) => {
    try {
      store.setSpeed(speed);
      await setProperty('speed', speed);
    } catch (err) {
      console.error('Error setting speed:', err);
    }
  }, [store]);

  const setAudioTracksPlayback = useCallback(async (trackIds: number[]) => {
    try {
      store.setSelectedAudioTracks(trackIds);
      if (trackIds.length > 1) {
        // Multi-track simultaneous playback via mpv lavfi-complex amix filter
        const inputs = trackIds.map((id) => `[aid${id}]`).join('');
        const filter = `${inputs}amix=inputs=${trackIds.length}:dropout_transition=2[ao]`;
        await setProperty('lavfi-complex', filter);
      } else if (trackIds.length === 1) {
        await setProperty('lavfi-complex', '');
        await setProperty('aid', trackIds[0]);
      } else {
        await setProperty('lavfi-complex', '');
        await setProperty('aid', 'no');
      }
    } catch (err) {
      console.error('Error setting multi-track audio playback:', err);
    }
  }, [store]);

  const toggleAudioTrack = useCallback(async (id: number) => {
    const current = usePlayerStore.getState().selectedAudioTracks;
    const exists = current.includes(id);
    const updated = exists ? current.filter((t) => t !== id) : [...current, id];
    await setAudioTracksPlayback(updated);
  }, [setAudioTracksPlayback]);

  const selectAudioTrack = useCallback(async (id: number) => {
    await setAudioTracksPlayback([id]);
  }, [setAudioTracksPlayback]);

  const selectSubtitleTrack = useCallback(async (id: number | null) => {
    try {
      store.setSelectedSubtitleTrack(id);
      if (id === null) {
        await setProperty('sid', 'no');
      } else {
        await setProperty('sid', id);
      }
    } catch (err) {
      console.error('Error selecting subtitle track:', err);
    }
  }, [store]);

  // External Subtitle Loader
  const addSubtitle = useCallback(async (subPath: string) => {
    try {
      await command('sub-add', [subPath, 'select']);
      const name = subPath.replace(/\\/g, '/').split('/').pop() || subPath;
      showToast(`Subtitle loaded: ${name}`, { type: 'success' });
    } catch (err: any) {
      console.error('Error loading subtitle:', err);
      showToast(`Failed to load subtitle: ${err?.message || err}`, { type: 'error' });
    }
  }, [showToast]);

  // Screenshot Capture
  const captureScreenshot = useCallback(async () => {
    if (!store.filePath) return;
    try {
      store.triggerScreenshotFlash();

      // Get screenshot directory
      let targetDir = useSettingsStore.getState().screenshotDir;
      if (!targetDir) {
        targetDir = await invoke<string>('get_default_screenshot_dir');
      }

      // Generate timestamped filename
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const ext = useSettingsStore.getState().screenshotFormat || 'png';
      const fileName = `FrameView_${datePart}_${timePart}.${ext}`;
      const fullPath = `${targetDir.replace(/[\/\\]$/, '')}\\${fileName}`;

      const mode = useSettingsStore.getState().screenshotMode || 'video';
      await command('screenshot-to-file', [fullPath, mode]);

      showToast(`Screenshot captured: ${fileName}`, {
        type: 'success',
        actionLabel: 'Open Folder',
        onAction: () => {
          invoke('open_in_folder', { path: fullPath }).catch(console.error);
        },
      });
    } catch (err: any) {
      console.error('Error capturing screenshot:', err);
      showToast(`Failed to capture screenshot: ${err?.message || err}`, { type: 'error' });
    }
  }, [store, showToast]);

  const frameStep = useCallback(async (forward: boolean) => {
    try {
      await pause();
      if (forward) {
        await command('frame-step', []);
      } else {
        await command('frame-back-step', []);
      }
    } catch (err) {
      console.error('Error frame stepping:', err);
    }
  }, [pause]);

  // Playlist Navigation
  const playPlaylistItem = useCallback(async (index: number) => {
    const playlist = store.playlist;
    if (index >= 0 && index < playlist.length) {
      store.setCurrentPlaylistIndex(index);
      await loadFileInternal(playlist[index].path);
    }
  }, [store, loadFileInternal]);

  const nextPlaylistItem = useCallback(async () => {
    const { playlist, currentPlaylistIndex } = store;
    if (playlist.length === 0) return;
    const nextIndex = (currentPlaylistIndex + 1) % playlist.length;
    await playPlaylistItem(nextIndex);
  }, [store, playPlaylistItem]);

  const prevPlaylistItem = useCallback(async () => {
    const { playlist, currentPlaylistIndex } = store;
    if (playlist.length === 0) return;
    const prevIndex = (currentPlaylistIndex - 1 + playlist.length) % playlist.length;
    await playPlaylistItem(prevIndex);
  }, [store, playPlaylistItem]);

  return {
    loadFile,
    play,
    pause,
    togglePlay,
    seek,
    changeVolume,
    toggleMute,
    changeSpeed,
    selectAudioTrack,
    toggleAudioTrack,
    setAudioTracksPlayback,
    selectSubtitleTrack,
    addSubtitle,
    captureScreenshot,
    frameStep,
    playPlaylistItem,
    nextPlaylistItem,
    prevPlaylistItem,
  };
}
