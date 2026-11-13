const STORAGE_KEY = 'frameview_playback_history';
const MAX_HISTORY_ITEMS = 200;

interface HistoryEntry {
  position: number;
  duration: number;
  updatedAt: number;
}

type HistoryMap = Record<string, HistoryEntry>;

function getHistoryMap(): HistoryMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse playback history:', err);
    return {};
  }
}

function saveHistoryMap(map: HistoryMap): void {
  try {
    // Keep only the most recent MAX_HISTORY_ITEMS
    const entries = Object.entries(map);
    if (entries.length > MAX_HISTORY_ITEMS) {
      entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
      const pruned = Object.fromEntries(entries.slice(0, MAX_HISTORY_ITEMS));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to save playback history:', err);
  }
}

export function savePlaybackPosition(path: string, position: number, duration: number): void {
  if (!path || position <= 0) return;
  const map = getHistoryMap();
  map[path] = {
    position,
    duration,
    updatedAt: Date.now(),
  };
  saveHistoryMap(map);
}

export function getSavedPlaybackPosition(path: string): number | null {
  if (!path) return null;
  const map = getHistoryMap();
  const entry = map[path];
  if (!entry) return null;

  // Only resume if position is > 3 seconds and at least 8 seconds before the end
  if (entry.position > 3 && (entry.duration <= 0 || entry.position < entry.duration - 8)) {
    return entry.position;
  }
  return null;
}

export function clearPlaybackPosition(path: string): void {
  const map = getHistoryMap();
  delete map[path];
  saveHistoryMap(map);
}

export function clearAllPlaybackHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear playback history:', err);
  }
}
