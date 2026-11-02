use crate::file::find_adjacent_file;
use crate::metadata::{probe_file, MediaInfo};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;
use sysinfo::{Disks, System};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use tauri::{PhysicalPosition, PhysicalSize, Position, Size, State, WebviewWindow};

#[derive(Default)]
pub struct StartupFile(pub Mutex<Option<String>>);

#[derive(Default)]
pub struct PipState(pub Mutex<Option<(PhysicalPosition<i32>, PhysicalSize<u32>)>>);

pub struct ResourceMonitor(pub Mutex<System>);

#[derive(serde::Serialize)]
pub struct ResourceStats {
    cpu_percent: f32,
    memory_used_bytes: u64,
    memory_total_bytes: u64,
    disk_used_bytes: Option<u64>,
    disk_total_bytes: Option<u64>,
    gpu_percent: Option<f32>,
    gpu_memory_used_bytes: Option<u64>,
    gpu_memory_total_bytes: Option<u64>,
}

#[tauri::command]
pub fn get_resource_stats(monitor: State<'_, ResourceMonitor>) -> Result<ResourceStats, String> {
    let mut system = monitor.0.lock().map_err(|e| e.to_string())?;
    system.refresh_cpu_usage();
    system.refresh_memory();

    let system_root = std::env::var("SystemDrive")
        .unwrap_or_else(|_| "C:".to_string())
        .to_ascii_lowercase();
    let disks = Disks::new_with_refreshed_list();
    let system_disk = disks.list().iter().find(|disk| {
        disk.mount_point()
            .to_string_lossy()
            .to_ascii_lowercase()
            .starts_with(&system_root)
    });

    let mut gpu_command = Command::new("nvidia-smi");
    #[cfg(windows)]
    gpu_command.creation_flags(0x08000000);
    let gpu = gpu_command
        .args([
            "--query-gpu=utilization.gpu,memory.used,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|output| {
            let mut values = output.trim().split(',').map(str::trim);
            let utilization = values.next()?.parse::<f32>().ok()?;
            let used_mb = values.next()?.parse::<u64>().ok()?;
            let total_mb = values.next()?.parse::<u64>().ok()?;
            Some((utilization, used_mb * 1024 * 1024, total_mb * 1024 * 1024))
        });

    Ok(ResourceStats {
        cpu_percent: system.global_cpu_usage(),
        memory_used_bytes: system.used_memory(),
        memory_total_bytes: system.total_memory(),
        disk_used_bytes: system_disk.map(|disk| disk.total_space() - disk.available_space()),
        disk_total_bytes: system_disk.map(|disk| disk.total_space()),
        gpu_percent: gpu.map(|stats| stats.0),
        gpu_memory_used_bytes: gpu.map(|stats| stats.1),
        gpu_memory_total_bytes: gpu.map(|stats| stats.2),
    })
}

#[tauri::command]
pub fn get_startup_file(state: State<'_, StartupFile>) -> Result<Option<String>, String> {
    let mut lock = state.0.lock().map_err(|e| e.to_string())?;
    Ok(lock.take())
}


#[tauri::command]
pub async fn get_media_info(path: String) -> Result<MediaInfo, String> {
    probe_file(path).await
}

#[tauri::command]
pub fn get_adjacent_file(current_path: String, direction: String) -> Result<Option<String>, String> {
    find_adjacent_file(&current_path, &direction)
}

#[tauri::command]
pub fn show_main_window(window: WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn start_drag(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn minimize_window(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_maximize_window(window: WebviewWindow) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub fn close_window(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_pip(window: WebviewWindow, state: State<'_, PipState>) -> Result<bool, String> {
    let mut saved_rect = state.0.lock().map_err(|e| e.to_string())?;

    if let Some((prev_pos, prev_size)) = saved_rect.take() {
        // Exit PiP mode
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.set_size(Size::Physical(prev_size)).map_err(|e| e.to_string())?;
        window.set_position(Position::Physical(prev_pos)).map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        // Enter PiP mode
        let current_pos = window.outer_position().map_err(|e| e.to_string())?;
        let current_size = window.outer_size().map_err(|e| e.to_string())?;
        *saved_rect = Some((current_pos, current_size));

        let pip_width = 440u32;
        let pip_height = 248u32;

        if let Ok(Some(monitor)) = window.current_monitor() {
            let scale_factor = monitor.scale_factor();
            let phys_w = (pip_width as f64 * scale_factor) as u32;
            let phys_h = (pip_height as f64 * scale_factor) as u32;

            let mon_pos = monitor.position();
            let mon_size = monitor.size();

            let margin = (28.0 * scale_factor) as i32;
            let target_x = mon_pos.x + mon_size.width as i32 - phys_w as i32 - margin;
            let target_y = mon_pos.y + mon_size.height as i32 - phys_h as i32 - margin;

            window.set_size(Size::Physical(PhysicalSize { width: phys_w, height: phys_h })).map_err(|e| e.to_string())?;
            window.set_position(Position::Physical(PhysicalPosition { x: target_x, y: target_y })).map_err(|e| e.to_string())?;
        } else {
            window.set_size(Size::Physical(PhysicalSize { width: pip_width, height: pip_height })).map_err(|e| e.to_string())?;
        }

        window.set_always_on_top(true).map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub fn get_default_screenshot_dir() -> Result<String, String> {
    let pictures_dir = if let Ok(userprofile) = std::env::var("USERPROFILE") {
        std::path::PathBuf::from(userprofile).join("Pictures").join("FrameView")
    } else {
        std::env::temp_dir().join("FrameView").join("Screenshots")
    };
    std::fs::create_dir_all(&pictures_dir).map_err(|e| e.to_string())?;
    Ok(pictures_dir.to_string_lossy().to_string())
}

fn ai_frame_capture_path(file_name: &str) -> Result<std::path::PathBuf, String> {
    if file_name.is_empty()
        || file_name.contains('/')
        || file_name.contains('\\')
        || file_name.contains("..")
        || !file_name.ends_with(".jpg")
    {
        return Err("Invalid AI frame capture file name".to_string());
    }

    let directory = std::env::temp_dir().join("FrameView").join("AiFrames");
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    Ok(directory.join(file_name))
}

#[tauri::command]
pub fn prepare_ai_frame_capture(file_name: String) -> Result<String, String> {
    Ok(ai_frame_capture_path(&file_name)?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_ai_frame_base64(file_name: String) -> Result<String, String> {
    let path = ai_frame_capture_path(&file_name)?;
    let image = std::fs::read(&path).map_err(|e| format!("Could not read captured video frame: {e}"))?;
    let _ = std::fs::remove_file(path);
    Ok(BASE64.encode(image))
}

#[tauri::command]
pub fn remove_ai_frame_capture(file_name: String) -> Result<(), String> {
    let path = ai_frame_capture_path(&file_name)?;
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn open_in_folder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if p.is_file() {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|e| e.to_string())?;
    } else if p.is_dir() {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    } else {
        return Err("Path does not exist".to_string());
    }
    Ok(())
}

const MEDIA_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "m4v", "ts", "mts", "m2ts", "vob",
    "mp3", "flac", "wav", "aac", "m4a", "ogg", "opus", "wma", "alac", "aiff",
];

#[tauri::command]
pub fn scan_directory_videos(dir_path: String) -> Result<Vec<String>, String> {
    let path = std::path::Path::new(&dir_path);
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut video_files = Vec::new();
    let entries = std::fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                if MEDIA_EXTENSIONS.iter().any(|&v_ext| v_ext.eq_ignore_ascii_case(ext)) {
                    video_files.push(p.to_string_lossy().to_string());
                }
            }
        }
    }

    video_files.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    Ok(video_files)
}

#[tauri::command]
pub fn set_window_fullscreen(window: WebviewWindow, fullscreen: bool) -> Result<(), String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
pub struct AiHttpRequest {
    pub url: String,
    pub method: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(serde::Serialize)]
pub struct AiHttpResponse {
    pub status: u16,
    pub body: String,
    pub ok: bool,
}

#[tauri::command]
pub async fn ai_http_request(req: AiHttpRequest) -> Result<AiHttpResponse, String> {
    let timeout = std::time::Duration::from_millis(req.timeout_ms.unwrap_or(60000));
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|e| e.to_string())?;

    let method = match req.method.to_uppercase().as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        _ => reqwest::Method::GET,
    };

    let mut builder = client.request(method, &req.url);

    if let Some(headers) = req.headers {
        for (k, v) in headers {
            builder = builder.header(k, v);
        }
    }

    if let Some(body) = req.body {
        builder = builder.body(body);
    }

    let res = builder.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let ok = res.status().is_success();
    let body = res.text().await.map_err(|e| e.to_string())?;

    Ok(AiHttpResponse { status, body, ok })
}

#[tauri::command]
pub async fn detect_video_scenes(path: String, min_gap_seconds: Option<f64>) -> Result<Vec<f64>, String> {
    crate::metadata::detect_keyframe_scenes(path, min_gap_seconds).await
}
