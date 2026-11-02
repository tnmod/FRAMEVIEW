pub mod commands;
pub mod file;
pub mod metadata;

use commands::*;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_file = std::env::args()
        .skip(1)
        .find(|arg| !arg.starts_with('-') && std::path::Path::new(arg).exists());

    let startup_state = StartupFile(std::sync::Mutex::new(initial_file));
    let pip_state = PipState(std::sync::Mutex::new(None));

    tauri::Builder::default()
        .manage(startup_state)
        .manage(pip_state)
        .manage(ResourceMonitor(std::sync::Mutex::new(sysinfo::System::new())))
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(path) = args.into_iter().skip(1).find(|a| !a.starts_with('-') && std::path::Path::new(a).exists()) {
                let _ = app.emit("open_file", path);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_libmpv::init())
        .invoke_handler(tauri::generate_handler![
            get_startup_file,
            get_resource_stats,
            get_media_info,
            get_adjacent_file,
            show_main_window,
            start_drag,
            minimize_window,
            toggle_maximize_window,
            close_window,
            toggle_pip,
            get_default_screenshot_dir,
            prepare_ai_frame_capture,
            read_ai_frame_base64,
            remove_ai_frame_capture,
            open_in_folder,
            scan_directory_videos,
            set_window_fullscreen,
            ai_http_request,
            detect_video_scenes
        ])
        .run(tauri::generate_context!())
        .expect("error while running FrameView application");
}
