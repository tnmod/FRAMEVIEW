import { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface ThumbnailResult {
  thumbnailUrl: string | null;
  isLoading: boolean;
  isUnsupported: boolean;
}

const THUMBNAIL_WIDTH = 160;
const THUMBNAIL_HEIGHT = 90;
const MAX_CACHE_SIZE = 120;

export function useTimelineThumbnail(
  filePath: string | null,
  hoverTime: number | null
): ThumbnailResult {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsupported, setIsUnsupported] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef = useRef<Map<number, string>>(new Map());
  const pendingTimeRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize or reset offscreen video on file change
  useEffect(() => {
    if (!filePath) {
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current = null;
      }
      cacheRef.current.clear();
      setThumbnailUrl(null);
      setIsUnsupported(false);
      return;
    }

    cacheRef.current.clear();
    setIsUnsupported(false);

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    // Use Tauri's convertFileSrc
    try {
      video.src = convertFileSrc(filePath);
    } catch {
      setIsUnsupported(true);
      return;
    }

    video.onerror = () => {
      setIsUnsupported(true);
      setIsLoading(false);
    };

    videoRef.current = video;

    const canvas = document.createElement('canvas');
    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = THUMBNAIL_HEIGHT;
    canvasRef.current = canvas;

    return () => {
      video.src = '';
      videoRef.current = null;
      canvasRef.current = null;
      cacheRef.current.clear();
    };
  }, [filePath]);

  // Handle hover time seeking
  useEffect(() => {
    if (hoverTime === null || !videoRef.current || isUnsupported) {
      setThumbnailUrl(null);
      setIsLoading(false);
      return;
    }

    const roundedTime = Math.max(0, Math.floor(hoverTime));

    // Check cache
    const cached = cacheRef.current.get(roundedTime);
    if (cached) {
      setThumbnailUrl(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      pendingTimeRef.current = roundedTime;

      const handleSeeked = () => {
        video.removeEventListener('seeked', handleSeeked);

        if (pendingTimeRef.current !== roundedTime) return;

        try {
          const ctx = canvas.getContext('2d');
          if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
            ctx.drawImage(video, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);

            // Add to cache
            if (cacheRef.current.size >= MAX_CACHE_SIZE) {
              const firstKey = cacheRef.current.keys().next().value;
              if (firstKey !== undefined) cacheRef.current.delete(firstKey);
            }
            cacheRef.current.set(roundedTime, dataUrl);

            setThumbnailUrl(dataUrl);
            setIsLoading(false);
          }
        } catch {
          setIsUnsupported(true);
          setIsLoading(false);
        }
      };

      video.addEventListener('seeked', handleSeeked, { once: true });
      video.currentTime = roundedTime;
    }, 40);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [hoverTime, isUnsupported]);

  return { thumbnailUrl, isLoading, isUnsupported };
}
