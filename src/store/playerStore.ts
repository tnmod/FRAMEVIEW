import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { PlaybackState, Track, MetadataTab, PlaylistItem } from '../types/player';
import { MediaInfo } from '../types/metadata';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'alac', 'aiff'
]);

interface PlayerState {
  // File state
  filePath: string | null;
  fileName: string | null;
  
  // Playback state
  playbackState: PlaybackState;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  speed: number;
  
  // Tracks
  audioTracks: Track[];
  subtitleTracks: Track[];
  selectedAudioTrack: number | null;
  selectedAudioTracks: number[];
  selectedSubtitleTrack: number | null;
  
  // Metadata state
  mediaInfo: MediaInfo | null;
  isMetadataLoading: boolean;
  metadataError: string | null;
  isMetadataOpen: boolean;
  metadataActiveTab: MetadataTab;
  
  // Playlist state
  playlist: PlaylistItem[];
  currentPlaylistIndex: number;
  isPlaylistOpen: boolean;

  // UI states
  isFullscreen: boolean;
  isPip: boolean;
  isAudioOnly: boolean;
  isControlsVisible: boolean;
  isShortcutsOpen: boolean;
  isCapturingScreenshot: boolean;
  errorMessage: string | null;

  // Actions
  setFile: (path: string | null) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setSpeed: (speed: number) => void;
  setTracks: (audio: Track[], sub: Track[]) => void;
  setSelectedAudioTrack: (id: number | null) => void;
  setSelectedAudioTracks: (ids: number[]) => void;
  toggleSelectedAudioTrack: (id: number) => void;
  setSelectedSubtitleTrack: (id: number | null) => void;
  setMediaInfo: (info: MediaInfo | null) => void;
  setIsMetadataLoading: (loading: boolean) => void;
  setMetadataError: (err: string | null) => void;
  toggleMetadataOpen: () => void;
  setIsMetadataOpen: (open: boolean) => void;
  setMetadataActiveTab: (tab: MetadataTab) => void;

  // Playlist actions
  addToPlaylist: (paths: string[], playImmediately?: boolean) => void;
  removeFromPlaylist: (id: string) => void;
  clearPlaylist: () => void;
  setCurrentPlaylistIndex: (index: number) => void;
  togglePlaylistOpen: () => void;
  setIsPlaylistOpen: (open: boolean) => void;

  // UI actions
  setIsFullscreen: (fs: boolean) => void;
  setIsPip: (pip: boolean) => void;
  togglePip: () => Promise<void>;
  setControlsVisible: (vis: boolean) => void;
  toggleShortcutsOpen: () => void;
  setIsShortcutsOpen: (open: boolean) => void;
  triggerScreenshotFlash: () => void;
  setErrorMessage: (msg: string | null) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  filePath: null,
  fileName: null,
  playbackState: 'idle',
  currentTime: 0,
  duration: 0,
  volume: 80,
  isMuted: false,
  speed: 1.0,
  audioTracks: [],
  subtitleTracks: [],
  selectedAudioTrack: null,
  selectedAudioTracks: [],
  selectedSubtitleTrack: null,
  mediaInfo: null,
  isMetadataLoading: false,
  metadataError: null,
  isMetadataOpen: false,
  metadataActiveTab: 'overview',
  playlist: [],
  currentPlaylistIndex: -1,
  isPlaylistOpen: false,
  isFullscreen: false,
  isPip: false,
  isAudioOnly: false,
  isControlsVisible: true,
  isShortcutsOpen: false,
  isCapturingScreenshot: false,
  errorMessage: null,

  setFile: (path) => {
    if (!path) {
      set({
        filePath: null,
        fileName: null,
        playbackState: 'idle',
        currentTime: 0,
        duration: 0,
        audioTracks: [],
        subtitleTracks: [],
        selectedAudioTrack: null,
        selectedAudioTracks: [],
        selectedSubtitleTrack: null,
        mediaInfo: null,
        metadataError: null,
        errorMessage: null,
        isAudioOnly: false,
      });
      return;
    }
    const cleanPath = path.replace(/\\/g, '/');
    const name = cleanPath.split('/').pop() || path;
    const ext = name.split('.').pop()?.toLowerCase();
    const isAudio = ext ? AUDIO_EXTENSIONS.has(ext) : false;
    
    // Check if file is in playlist, update index
    const playlist = get().playlist;
    const existingIndex = playlist.findIndex((item) => item.path === path);

    set({
      filePath: path,
      fileName: name,
      playbackState: 'loading',
      currentTime: 0,
      duration: 0,
      audioTracks: [],
      subtitleTracks: [],
      selectedAudioTrack: null,
      selectedAudioTracks: [],
      selectedSubtitleTrack: null,
      mediaInfo: null,
      metadataError: null,
      errorMessage: null,
      isAudioOnly: isAudio,
      currentPlaylistIndex: existingIndex !== -1 ? existingIndex : get().currentPlaylistIndex,
    });
  },

  setPlaybackState: (state) => set({ playbackState: state }),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setDuration: (duration) => set({ duration: Math.max(0, duration) }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setSpeed: (speed) => set({ speed }),
  setTracks: (audioTracks, subtitleTracks) => {
    const selectedAudio = audioTracks.filter((t) => t.selected).map((t) => t.id);
    const fallbackAudio = selectedAudio.length > 0 ? selectedAudio : (audioTracks[0] ? [audioTracks[0].id] : []);
    set({
      audioTracks,
      subtitleTracks,
      selectedAudioTracks: fallbackAudio,
      selectedAudioTrack: fallbackAudio[0] ?? null,
    });
  },
  setSelectedAudioTrack: (selectedAudioTrack) =>
    set({
      selectedAudioTrack,
      selectedAudioTracks: selectedAudioTrack !== null ? [selectedAudioTrack] : [],
    }),
  setSelectedAudioTracks: (selectedAudioTracks) =>
    set({
      selectedAudioTracks,
      selectedAudioTrack: selectedAudioTracks[0] ?? null,
    }),
  toggleSelectedAudioTrack: (id) => {
    const current = get().selectedAudioTracks;
    const exists = current.includes(id);
    const updated = exists ? current.filter((t) => t !== id) : [...current, id];
    set({
      selectedAudioTracks: updated,
      selectedAudioTrack: updated[0] ?? null,
    });
  },
  setSelectedSubtitleTrack: (selectedSubtitleTrack) => set({ selectedSubtitleTrack }),
  setMediaInfo: (mediaInfo) => {
    let isAudio = get().isAudioOnly;
    if (mediaInfo?.streams) {
      const hasVideo = mediaInfo.streams.some((s) => s.codec_type === 'video');
      const hasAudio = mediaInfo.streams.some((s) => s.codec_type === 'audio');
      if (hasAudio && !hasVideo) {
        isAudio = true;
      }
    }
    set({ mediaInfo, isAudioOnly: isAudio, isMetadataLoading: false, metadataError: null });
  },
  setIsMetadataLoading: (isMetadataLoading) => set({ isMetadataLoading }),
  setMetadataError: (metadataError) => set({ metadataError, isMetadataLoading: false }),
  toggleMetadataOpen: () => set((state) => ({ isMetadataOpen: !state.isMetadataOpen })),
  setIsMetadataOpen: (isMetadataOpen) => set({ isMetadataOpen }),
  setMetadataActiveTab: (metadataActiveTab) => set({ metadataActiveTab }),

  addToPlaylist: (paths, _playImmediately = false) => {
    const newItems: PlaylistItem[] = paths.map((path) => {
      const cleanPath = path.replace(/\\/g, '/');
      const name = cleanPath.split('/').pop() || path;
      return {
        id: Math.random().toString(36).substring(2, 9),
        path,
        name,
      };
    });

    set((state) => {
      const existingPaths = new Set(state.playlist.map((p) => p.path));
      const filtered = newItems.filter((item) => !existingPaths.has(item.path));
      const nextPlaylist = [...state.playlist, ...filtered];
      
      let nextIndex = state.currentPlaylistIndex;
      if (nextIndex === -1 && nextPlaylist.length > 0) {
        nextIndex = 0;
      }

      return {
        playlist: nextPlaylist,
        currentPlaylistIndex: nextIndex,
      };
    });
  },

  removeFromPlaylist: (id) => {
    set((state) => {
      const index = state.playlist.findIndex((item) => item.id === id);
      if (index === -1) return state;

      const nextPlaylist = state.playlist.filter((item) => item.id !== id);
      let nextIndex = state.currentPlaylistIndex;

      if (index === state.currentPlaylistIndex) {
        if (nextIndex >= nextPlaylist.length) {
          nextIndex = nextPlaylist.length - 1;
        }
      } else if (index < state.currentPlaylistIndex) {
        nextIndex -= 1;
      }

      return {
        playlist: nextPlaylist,
        currentPlaylistIndex: nextIndex,
      };
    });
  },

  clearPlaylist: () => set({ playlist: [], currentPlaylistIndex: -1 }),
  setCurrentPlaylistIndex: (index) => set({ currentPlaylistIndex: index }),
  togglePlaylistOpen: () => set((state) => ({ isPlaylistOpen: !state.isPlaylistOpen })),
  setIsPlaylistOpen: (open) => set({ isPlaylistOpen: open }),

  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  setIsPip: (isPip) => set({ isPip }),
  togglePip: async () => {
    try {
      const isPip = await invoke<boolean>('toggle_pip');
      set({ isPip });
    } catch (err) {
      console.error('Failed to toggle Picture-in-Picture mode:', err);
    }
  },
  setControlsVisible: (isControlsVisible) => set({ isControlsVisible }),
  toggleShortcutsOpen: () => set((state) => ({ isShortcutsOpen: !state.isShortcutsOpen })),
  setIsShortcutsOpen: (isShortcutsOpen) => set({ isShortcutsOpen }),
  triggerScreenshotFlash: () => {
    set({ isCapturingScreenshot: true });
    setTimeout(() => set({ isCapturingScreenshot: false }), 200);
  },
  setErrorMessage: (errorMessage) => set({ errorMessage }),
}));
