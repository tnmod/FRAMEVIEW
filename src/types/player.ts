export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface Track {
  id: number;
  type: 'audio' | 'sub';
  title: string;
  lang: string;
  codec?: string;
  channels?: number;
  selected: boolean;
}

export type MetadataTab = 'overview' | 'video' | 'audio' | 'subtitles' | 'container';

export interface PlaylistItem {
  id: string;
  path: string;
  name: string;
}
