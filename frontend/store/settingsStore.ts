import { create } from 'zustand';

export interface SettingsData {
  autoResume: boolean;
  autoPlayNext: boolean;
  defaultVolume: number;
  hwdec: 'auto-safe' | 'auto' | 'd3d11va' | 'nvdec' | 'no';
  subFontSize: number;
  subColor: string;
  screenshotDir: string;
  screenshotFormat: 'png' | 'jpg' | 'webp';
  screenshotMode: 'subtitles' | 'video';
  seekStepSeconds: number;
  controlsHideDelay: number;
  accentColor: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  autoResume: true,
  autoPlayNext: true,
  defaultVolume: 80,
  hwdec: 'auto-safe',
  subFontSize: 46,
  subColor: '#FFFFFF',
  screenshotDir: '',
  screenshotFormat: 'png',
  screenshotMode: 'video',
  seekStepSeconds: 5,
  controlsHideDelay: 3000,
  accentColor: '#3b82f6',
};

const SETTINGS_STORAGE_KEY = 'frameview_settings';

function loadPersistedSettings(): SettingsData {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.warn('Failed to load settings from storage:', err);
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(data: SettingsData): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to persist settings:', err);
  }
}

interface SettingsState extends SettingsData {
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  toggleSettingsOpen: () => void;
  updateSettings: (partial: Partial<SettingsData>) => void;
  resetDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => {
  const initial = loadPersistedSettings();

  return {
    ...initial,
    isSettingsOpen: false,
    setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
    toggleSettingsOpen: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    updateSettings: (partial) => {
      set((state) => {
        const next: SettingsData = {
          autoResume: partial.autoResume ?? state.autoResume,
          autoPlayNext: partial.autoPlayNext ?? state.autoPlayNext,
          defaultVolume: partial.defaultVolume ?? state.defaultVolume,
          hwdec: partial.hwdec ?? state.hwdec,
          subFontSize: partial.subFontSize ?? state.subFontSize,
          subColor: partial.subColor ?? state.subColor,
          screenshotDir: partial.screenshotDir ?? state.screenshotDir,
          screenshotFormat: partial.screenshotFormat ?? state.screenshotFormat,
          screenshotMode: partial.screenshotMode ?? state.screenshotMode,
          seekStepSeconds: partial.seekStepSeconds ?? state.seekStepSeconds,
          controlsHideDelay: partial.controlsHideDelay ?? state.controlsHideDelay,
          accentColor: partial.accentColor ?? state.accentColor,
        };
        persistSettings(next);
        return { ...state, ...next };
      });
    },
    resetDefaults: () => {
      persistSettings(DEFAULT_SETTINGS);
      set({ ...DEFAULT_SETTINGS });
    },
  };
});
