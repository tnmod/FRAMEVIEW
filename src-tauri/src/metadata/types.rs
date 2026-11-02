use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaInfo {
    pub format: FormatInfo,
    #[serde(default)]
    pub streams: Vec<StreamInfo>,
    #[serde(default)]
    pub chapters: Vec<ChapterInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatInfo {
    pub filename: String,
    pub nb_streams: u32,
    #[serde(default)]
    pub nb_programs: u32,
    pub format_name: String,
    #[serde(default)]
    pub format_long_name: Option<String>,
    #[serde(default)]
    pub start_time: Option<String>,
    #[serde(default)]
    pub duration: Option<String>,
    #[serde(default)]
    pub size: Option<String>,
    #[serde(default)]
    pub bit_rate: Option<String>,
    #[serde(default)]
    pub probe_score: Option<i32>,
    #[serde(default)]
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamInfo {
    pub index: u32,
    #[serde(default)]
    pub codec_name: Option<String>,
    #[serde(default)]
    pub codec_long_name: Option<String>,
    pub codec_type: String, // "video", "audio", "subtitle", "data", "attachment"
    #[serde(default)]
    pub codec_tag_string: Option<String>,
    #[serde(default)]
    pub profile: Option<String>,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
    #[serde(default)]
    pub coded_width: Option<u32>,
    #[serde(default)]
    pub coded_height: Option<u32>,
    #[serde(default)]
    pub display_aspect_ratio: Option<String>,
    #[serde(default)]
    pub sample_aspect_ratio: Option<String>,
    #[serde(default)]
    pub pix_fmt: Option<String>,
    #[serde(default)]
    pub level: Option<i32>,
    #[serde(default)]
    pub color_range: Option<String>,
    #[serde(default)]
    pub color_space: Option<String>,
    #[serde(default)]
    pub color_transfer: Option<String>,
    #[serde(default)]
    pub color_primaries: Option<String>,
    #[serde(default)]
    pub r_frame_rate: Option<String>,
    #[serde(default)]
    pub avg_frame_rate: Option<String>,
    #[serde(default)]
    pub time_base: Option<String>,
    #[serde(default)]
    pub duration: Option<String>,
    #[serde(default)]
    pub bit_rate: Option<String>,
    #[serde(default)]
    pub max_bit_rate: Option<String>,
    #[serde(default)]
    pub nb_frames: Option<String>,
    #[serde(default)]
    pub sample_rate: Option<String>,
    #[serde(default)]
    pub channels: Option<u32>,
    #[serde(default)]
    pub channel_layout: Option<String>,
    #[serde(default)]
    pub bits_per_sample: Option<u32>,
    #[serde(default)]
    pub bits_per_raw_sample: Option<String>,
    #[serde(default)]
    pub tags: HashMap<String, String>,
    #[serde(default)]
    pub disposition: HashMap<String, i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterInfo {
    pub id: i64,
    #[serde(default)]
    pub time_base: Option<String>,
    pub start: i64,
    #[serde(default)]
    pub start_time: Option<String>,
    pub end: i64,
    #[serde(default)]
    pub end_time: Option<String>,
    #[serde(default)]
    pub tags: HashMap<String, String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_ffprobe_sample() {
        let json_data = r#"{
            "streams": [
                {
                    "index": 0,
                    "codec_name": "pcm_s16le",
                    "codec_long_name": "PCM signed 16-bit little-endian",
                    "codec_type": "audio",
                    "codec_tag_string": "[1][0][0][0]",
                    "sample_rate": "22050",
                    "channels": 2,
                    "bits_per_sample": 16,
                    "duration": "5.572245",
                    "bit_rate": "705600"
                }
            ],
            "chapters": [],
            "format": {
                "filename": "C:\\Windows\\Media\\Alarm01.wav",
                "nb_streams": 1,
                "format_name": "wav",
                "format_long_name": "WAV / WAVE (Waveform Audio)",
                "duration": "5.572245",
                "size": "491516",
                "bit_rate": "705663",
                "probe_score": 99
            }
        }"#;

        let res: Result<MediaInfo, _> = serde_json::from_str(json_data);
        assert!(res.is_ok(), "Failed to deserialize: {:?}", res.err());
        let info = res.unwrap();
        assert_eq!(info.format.nb_streams, 1);
        assert_eq!(info.streams.len(), 1);
        assert_eq!(info.streams[0].codec_name.as_deref(), Some("pcm_s16le"));
    }
}

