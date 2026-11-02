use std::path::PathBuf;

fn main() {
    // Copy libmpv DLLs to the output directory on Windows
    #[cfg(target_os = "windows")]
    copy_mpv_dlls();

    tauri_build::build()
}

#[cfg(target_os = "windows")]
fn copy_mpv_dlls() {
    let lib_dir = PathBuf::from("lib");
    if !lib_dir.exists() {
        println!("cargo:warning=src-tauri/lib directory not found. libmpv will not be bundled.");
        return;
    }

    let out_dir = std::env::var("OUT_DIR").unwrap();
    // Navigate from OUT_DIR up to the target/{profile} directory
    let dest_dir = PathBuf::from(&out_dir)
        .ancestors()
        .nth(3)
        .expect("Failed to determine target directory")
        .to_path_buf();

    let _ = std::fs::create_dir_all(&dest_dir);

    if let Ok(entries) = std::fs::read_dir(&lib_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "dll") {
                let file_name = path.file_name().unwrap();
                let dest = dest_dir.join(file_name);
                if let Err(e) = std::fs::copy(&path, &dest) {
                    println!("cargo:warning=Failed to copy {:?} to {:?}: {}", path, dest, e);
                } else {
                    println!("cargo:warning=Copied {:?} -> {:?}", path.file_name().unwrap(), dest);
                }
            }
        }
    }

    // Tell cargo to rerun if lib dir changes
    println!("cargo:rerun-if-changed=lib/");
}
