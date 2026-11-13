export interface MediaInfo {
  format: FormatInfo;
  streams: StreamInfo[];
  chapters?: ChapterInfo[];
}

export interface FormatInfo {
  filename: string;
  nb_streams: number;
  nb_programs?: number;
  format_name: string;
  format_long_name?: string;
  start_time?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
  probe_score?: number;
  tags?: Record<string, string>;
}

export interface StreamInfo {
  index: number;
  codec_name?: string;
  codec_long_name?: string;
  codec_type: 'video' | 'audio' | 'subtitle' | 'data' | 'attachment';
  codec_tag_string?: string;
  profile?: string;
  width?: number;
  height?: number;
  coded_width?: number;
  coded_height?: number;
  display_aspect_ratio?: string;
  sample_aspect_ratio?: string;
  pix_fmt?: string;
  level?: number;
  color_range?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  time_base?: string;
  duration?: string;
  bit_rate?: string;
  max_bit_rate?: string;
  nb_frames?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  bits_per_sample?: number;
  bits_per_raw_sample?: string;
  tags?: Record<string, string>;
  disposition?: Record<string, number>;
}

export interface ChapterInfo {
  id: number;
  time_base?: string;
  start: number;
  start_time?: string;
  end: number;
  end_time?: string;
  tags?: Record<string, string>;
}
