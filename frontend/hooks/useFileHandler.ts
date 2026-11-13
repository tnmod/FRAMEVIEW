import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { usePlayerStore } from '../store/playerStore';
import { useMpvPlayer } from './useMpvPlayer';
import { useToastStore } from '../store/toastStore';

const MEDIA_FILTERS = [
  {
    name: 'Media Files',
    extensions: [
      'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'ts', 'mts', 'm2ts', 'vob',
      'mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'alac', 'aiff',
    ],
  },
  {
    name: 'Video Files',
    extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'ts', 'mts', 'm2ts', 'vob'],
  },
  {
    name: 'Audio Files',
    extensions: ['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'alac', 'aiff'],
  },
  {
    name: 'All Files',
    extensions: ['*'],
  },
];

const SUBTITLE_FILTERS = [
  {
    name: 'Subtitle Files',
    extensions: ['srt', 'ass', 'ssa', 'vtt', 'sub'],
  },
  {
    name: 'All Files',
    extensions: ['*'],
  },
];

export function useFileHandler() {
  const filePath = usePlayerStore((s) => s.filePath);
  const playlist = usePlayerStore((s) => s.playlist);
  const addToPlaylist = usePlayerStore((s) => s.addToPlaylist);
  const showToast = useToastStore((s) => s.showToast);
  const { loadFile, addSubtitle, nextPlaylistItem, prevPlaylistItem } = useMpvPlayer();

  const openFileDialog = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        filters: MEDIA_FILTERS,
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length > 0) {
        addToPlaylist(paths);
        await loadFile(paths[0]);
        if (paths.length > 1) {
          showToast(`Added ${paths.length} files to queue`, { type: 'success' });
        }
      }
    } catch (err) {
      console.error('Error opening file dialog:', err);
    }
  }, [addToPlaylist, loadFile, showToast]);

  const openFolderDialog = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: true,
      });

      if (!selected || typeof selected !== 'string') return;

      const videos = await invoke<string[]>('scan_directory_videos', {
        dirPath: selected,
      });

      if (videos && videos.length > 0) {
        addToPlaylist(videos);
        await loadFile(videos[0]);
        showToast(`Loaded ${videos.length} videos from folder`, { type: 'success' });
      } else {
        showToast('No supported video files found in folder', { type: 'warning' });
      }
    } catch (err) {
      console.error('Error opening folder dialog:', err);
      showToast('Could not scan folder', { type: 'error' });
    }
  }, [addToPlaylist, loadFile, showToast]);

  const openSubtitleDialog = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: SUBTITLE_FILTERS,
      });

      if (selected && typeof selected === 'string') {
        await addSubtitle(selected);
      }
    } catch (err) {
      console.error('Error opening subtitle dialog:', err);
    }
  }, [addSubtitle]);

  const navigateAdjacent = useCallback(async (direction: 'next' | 'prev') => {
    // If playlist has multiple items, navigate playlist
    if (playlist.length > 1) {
      if (direction === 'next') {
        await nextPlaylistItem();
      } else {
        await prevPlaylistItem();
      }
      return;
    }

    // Fallback: navigate adjacent file in folder
    if (!filePath) return;
    try {
      const adjacent = await invoke<string | null>('get_adjacent_file', {
        currentPath: filePath,
        direction,
      });

      if (adjacent) {
        await loadFile(adjacent);
      }
    } catch (err) {
      console.error('Error navigating adjacent file:', err);
    }
  }, [playlist.length, nextPlaylistItem, prevPlaylistItem, filePath, loadFile]);

  return {
    openFileDialog,
    openFolderDialog,
    openSubtitleDialog,
    nextFile: () => navigateAdjacent('next'),
    prevFile: () => navigateAdjacent('prev'),
  };
}
