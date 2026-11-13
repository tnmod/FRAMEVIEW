use std::path::PathBuf;

const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "m4v", "ts", "mts", "m2ts", "vob",
    "mp3", "flac", "wav", "aac", "m4a", "ogg", "opus", "wma", "alac", "aiff",
];

pub fn find_adjacent_file(current_path_str: &str, direction: &str) -> Result<Option<String>, String> {
    let current_path = PathBuf::from(current_path_str);
    let parent_dir = match current_path.parent() {
        Some(dir) => dir,
        None => return Ok(None),
    };

    if !parent_dir.is_dir() {
        return Ok(None);
    }

    let mut video_files: Vec<PathBuf> = Vec::new();
    let entries = std::fs::read_dir(parent_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if VIDEO_EXTENSIONS.iter().any(|&v_ext| v_ext.eq_ignore_ascii_case(ext)) {
                    video_files.push(path);
                }
            }
        }
    }

    if video_files.is_empty() {
        return Ok(None);
    }

    // Sort files case-insensitively
    video_files.sort_by(|a, b| {
        let a_str = a.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
        let b_str = b.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
        a_str.cmp(&b_str)
    });

    let current_norm = std::fs::canonicalize(&current_path).unwrap_or(current_path);

    let current_index = video_files.iter().position(|p| {
        let norm = std::fs::canonicalize(p).unwrap_or_else(|_| p.clone());
        norm == current_norm
    });

    match current_index {
        Some(idx) => {
            let total = video_files.len();
            let next_idx = if direction.eq_ignore_ascii_case("prev") {
                (idx + total - 1) % total
            } else {
                (idx + 1) % total
            };
            Ok(Some(video_files[next_idx].to_string_lossy().to_string()))
        }
        None => {
            // If current not found in directory, return first file
            Ok(Some(video_files[0].to_string_lossy().to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_adjacent_file_navigation() {
        let temp_dir = std::env::temp_dir().join("frameview_nav_test");
        let _ = std::fs::create_dir_all(&temp_dir);

        let file_a = temp_dir.join("video_a.mp4");
        let file_b = temp_dir.join("video_b.mkv");
        let file_c = temp_dir.join("video_c.webm");
        let file_txt = temp_dir.join("readme.txt");

        std::fs::write(&file_a, b"test").unwrap();
        std::fs::write(&file_b, b"test").unwrap();
        std::fs::write(&file_c, b"test").unwrap();
        std::fs::write(&file_txt, b"test").unwrap();

        let a_str = file_a.to_string_lossy().to_string();
        let b_str = file_b.to_string_lossy().to_string();
        let c_str = file_c.to_string_lossy().to_string();

        // Next from A should be B
        let next_a = find_adjacent_file(&a_str, "next").unwrap();
        assert_eq!(next_a.as_deref(), Some(b_str.as_str()));

        // Next from B should be C
        let next_b = find_adjacent_file(&b_str, "next").unwrap();
        assert_eq!(next_b.as_deref(), Some(c_str.as_str()));

        // Next from C wraps around to A
        let next_c = find_adjacent_file(&c_str, "next").unwrap();
        assert_eq!(next_c.as_deref(), Some(a_str.as_str()));

        // Prev from A wraps around to C
        let prev_a = find_adjacent_file(&a_str, "prev").unwrap();
        assert_eq!(prev_a.as_deref(), Some(c_str.as_str()));

        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

