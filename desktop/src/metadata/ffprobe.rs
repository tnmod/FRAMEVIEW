use super::types::MediaInfo;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

/// Locate the ffprobe executable binary
pub fn find_ffprobe_binary() -> Result<PathBuf, String> {
    // 1. Check next to the running executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidate = exe_dir.join("ffprobe-x86_64-pc-windows-msvc.exe");
            if candidate.exists() {
                return Ok(candidate);
            }
            let candidate_simple = exe_dir.join("ffprobe.exe");
            if candidate_simple.exists() {
                return Ok(candidate_simple);
            }
        }
    }

    // 2. Check project-relative sidecar paths
    let candidates = [
        "desktop/binaries/ffprobe-x86_64-pc-windows-msvc.exe",
        "binaries/ffprobe-x86_64-pc-windows-msvc.exe",
        "../desktop/binaries/ffprobe-x86_64-pc-windows-msvc.exe",
        "desktop/binaries/ffprobe.exe",
        "binaries/ffprobe.exe",
    ];

    for path_str in candidates {
        let p = PathBuf::from(path_str);
        if p.exists() {
            return Ok(std::fs::canonicalize(p).unwrap_or_else(|_| PathBuf::from(path_str)));
        }
    }

    // 3. Fallback: check if ffprobe is in PATH
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join("ffprobe.exe");
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    Err("ffprobe binary not found. Please ensure ffprobe is installed in desktop/binaries/".to_string())
}

/// Run ffprobe against the given media file and parse JSON output
pub async fn probe_file<P: AsRef<Path>>(file_path: P) -> Result<MediaInfo, String> {
    let path_ref = file_path.as_ref();
    if !path_ref.exists() {
        return Err(format!("File does not exist: {}", path_ref.display()));
    }

    let ffprobe_path = find_ffprobe_binary()?;
    let path_str = path_ref.to_string_lossy().to_string();

    #[cfg(windows)]
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut cmd = Command::new(&ffprobe_path);
    cmd.args([
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        "-show_chapters",
        &path_str,
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output_future = cmd.output();

    // Max 30 seconds timeout
    let output = match tokio::time::timeout(Duration::from_secs(30), output_future).await {
        Ok(res) => res.map_err(|e| format!("Failed to execute ffprobe: {}", e))?,
        Err(_) => return Err("FFprobe timed out after 30 seconds".to_string()),
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFprobe failed (exit code {:?}): {}", output.status.code(), stderr));
    }

    let stdout_str = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8 in ffprobe output: {}", e))?;

    let media_info: MediaInfo = serde_json::from_str(&stdout_str)
        .map_err(|e| format!("Failed to parse ffprobe JSON output: {}. Raw snippet: {}", e, &stdout_str[..stdout_str.len().min(300)]))?;

    Ok(media_info)
}

/// Fast native keyframe/scene boundary detector for ANY video format (including MKV, WebM, etc.)
pub async fn detect_keyframe_scenes<P: AsRef<Path>>(
    file_path: P,
    min_gap_seconds: Option<f64>,
) -> Result<Vec<f64>, String> {
    let path_ref = file_path.as_ref();
    if !path_ref.exists() {
        return Err(format!("File does not exist: {}", path_ref.display()));
    }

    let ffprobe_path = find_ffprobe_binary()?;
    let path_str = path_ref.to_string_lossy().to_string();

    #[cfg(windows)]
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let min_gap = min_gap_seconds.unwrap_or(15.0);

    // Fast packet-level scan for keyframes (orders of magnitude faster than full frame demuxing)
    let mut cmd = Command::new(&ffprobe_path);
    cmd.args([
        "-v", "error",
        "-select_streams", "v:0",
        "-show_packets",
        "-show_entries", "packet=pts_time,flags,size",
        "-of", "csv=p=0",
        &path_str,
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = match tokio::time::timeout(Duration::from_secs(90), cmd.output()).await {
        Ok(res) => res.map_err(|e| format!("Failed to execute ffprobe: {}", e))?,
        Err(_) => return Err("FFprobe keyframe detection timed out".to_string()),
    };

    let mut timestamps: Vec<f64> = Vec::new();

    if output.status.success() {
        let stdout_str = String::from_utf8_lossy(&output.stdout);
        timestamps = parse_keyframe_packet_csv(&stdout_str, min_gap);
    }

    // Fallback to -show_frames if packet flags were not recognized by container
    if timestamps.is_empty() {
        let mut fallback_cmd = Command::new(&ffprobe_path);
        fallback_cmd.args([
            "-v", "error",
            "-select_streams", "v:0",
            "-show_frames",
            "-skip_frame", "nokey",
            "-show_entries", "frame=pts_time",
            "-of", "csv=p=0",
            &path_str,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

        #[cfg(windows)]
        fallback_cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(Ok(fb_output)) = tokio::time::timeout(Duration::from_secs(60), fallback_cmd.output()).await {
            let fb_str = String::from_utf8_lossy(&fb_output.stdout);
            timestamps = parse_keyframe_frame_csv(&fb_str, min_gap);
        }
    }

    if timestamps.is_empty() || timestamps[0] > 0.5 {
        timestamps.insert(0, 0.0);
    }

    Ok(timestamps)
}

/// Parse FFprobe packet CSV output where keyframes contain 'K' flag
pub fn parse_keyframe_packet_csv(stdout_str: &str, min_gap: f64) -> Vec<f64> {
    let mut timestamps = Vec::new();
    let mut last_t = -min_gap;

    for line in stdout_str.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed.split(',').collect();
        if parts.is_empty() {
            continue;
        }

        let is_keyframe = parts.iter().skip(1).any(|p| p.contains('K'));
        if is_keyframe {
            if let Ok(t) = parts[0].parse::<f64>() {
                if t - last_t >= min_gap {
                    timestamps.push(t);
                    last_t = t;
                }
            }
        }
    }

    timestamps
}

/// Parse FFprobe frame CSV output with pts_time lines
pub fn parse_keyframe_frame_csv(stdout_str: &str, min_gap: f64) -> Vec<f64> {
    let mut timestamps = Vec::new();
    let mut last_t = -min_gap;

    for line in stdout_str.lines() {
        if let Ok(t) = line.trim().parse::<f64>() {
            if t - last_t >= min_gap {
                timestamps.push(t);
                last_t = t;
            }
        }
    }

    timestamps
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_keyframe_packet_csv() {
        let sample_csv = "\
0.000000,120484,K__\n\
0.050000,11023,___\n\
0.100000,9718,___\n\
2.000000,794197,K__\n\
2.050000,12000,___\n\
4.000000,787406,K__\n\
6.000000,784319,K__\n\
8.000000,792823,K__\n\
10.000000,773741,K__\n";

        let result_min_gap_1 = parse_keyframe_packet_csv(sample_csv, 1.0);
        assert_eq!(result_min_gap_1, vec![0.0, 2.0, 4.0, 6.0, 8.0, 10.0]);

        let result_min_gap_3 = parse_keyframe_packet_csv(sample_csv, 3.0);
        assert_eq!(result_min_gap_3, vec![0.0, 4.0, 8.0]);
    }

    #[test]
    fn test_parse_keyframe_frame_csv() {
        let sample_frames = "0.000000\n2.000000\n4.500000\n8.000000\n";
        let result = parse_keyframe_frame_csv(sample_frames, 2.0);
        assert_eq!(result, vec![0.0, 2.0, 4.5, 8.0]);
    }
}
