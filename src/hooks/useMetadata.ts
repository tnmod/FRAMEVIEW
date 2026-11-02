import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePlayerStore } from '../store/playerStore';
import { MediaInfo } from '../types/metadata';

export function useMetadata() {
  const filePath = usePlayerStore((s) => s.filePath);
  const setMediaInfo = usePlayerStore((s) => s.setMediaInfo);
  const setIsMetadataLoading = usePlayerStore((s) => s.setIsMetadataLoading);
  const setMetadataError = usePlayerStore((s) => s.setMetadataError);

  useEffect(() => {
    if (!filePath) {
      setMediaInfo(null);
      return;
    }

    let isCancelled = false;
    setIsMetadataLoading(true);
    setMetadataError(null);

    invoke<MediaInfo>('get_media_info', { path: filePath })
      .then((info) => {
        if (!isCancelled) {
          setMediaInfo(info);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to probe media with FFprobe:', err);
          setMetadataError(typeof err === 'string' ? err : err?.message || 'Failed to inspect media file');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [filePath, setMediaInfo, setIsMetadataLoading, setMetadataError]);
}
