//! Self-update via tauri-plugin-updater. Releases publish a signed `latest.json`
//! (see .github/workflows/desktop.yml); the public key lives in tauri.conf.json.

use crate::{show_main, AppState, MAIN};
use std::{sync::Mutex, time::Duration};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

const EV_AVAILABLE: &str = "desktop://update-available";
const EV_READY: &str = "desktop://update-ready";
const EV_PROGRESS: &str = "desktop://update-progress";
const EV_NONE: &str = "desktop://update-none";
const EV_ERROR: &str = "desktop://update-error";

/// How often the background check runs while the app is open.
const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

#[derive(Default)]
pub struct UpdateState {
    /// The newest version found by the last check, not yet installed.
    pending: Mutex<Option<Update>>,
    /// Installed and waiting for a restart.
    ready: Mutex<Option<String>>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
    pub date: Option<String>,
    /// Already installed; a restart applies it.
    pub ready: bool,
}

fn info(update: &Update, ready: bool) -> UpdateInfo {
    UpdateInfo {
        version: update.version.clone(),
        current_version: update.current_version.clone(),
        notes: update.body.clone(),
        date: update.date.map(|d| d.to_string()),
        ready,
    }
}

/// Label for the tray's update item, if there is something to offer.
pub fn tray_label(app: &AppHandle) -> Option<String> {
    let st = app.state::<UpdateState>();
    if let Some(v) = st.ready.lock().unwrap().clone() {
        return Some(format!("Restart to Update to v{v}"));
    }
    let pending = st.pending.lock().unwrap();
    pending.as_ref().map(|u| format!("Install Update v{}…", u.version))
}

async fn check(app: &AppHandle) -> Result<Option<UpdateInfo>, String> {
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    let st = app.state::<UpdateState>();
    let ready = st.ready.lock().unwrap().clone();
    let result = update.as_ref().map(|u| info(u, ready.as_deref() == Some(u.version.as_str())));
    *st.pending.lock().unwrap() = update;
    crate::refresh_tray(app);
    Ok(result)
}

async fn install(app: &AppHandle) -> Result<String, String> {
    let st = app.state::<UpdateState>();
    let cached = st.pending.lock().unwrap().clone();
    let update = match cached {
        Some(u) => u,
        None => match app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())? {
            Some(u) => u,
            None => return Err("You're already on the latest version.".into()),
        },
    };
    let version = update.version.clone();
    let handle = app.clone();
    let mut downloaded: u64 = 0;
    update
        .download_and_install(
            move |chunk, total| {
                downloaded += chunk as u64;
                let _ = handle.emit_to(
                    MAIN,
                    EV_PROGRESS,
                    serde_json::json!({ "downloaded": downloaded, "total": total }),
                );
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    *st.pending.lock().unwrap() = None;
    *st.ready.lock().unwrap() = Some(version.clone());
    crate::refresh_tray(app);
    Ok(version)
}

/// Background check; honours the "install automatically" setting.
async fn background_check(app: &AppHandle) {
    let (auto_check, auto_install) = {
        let s = app.state::<AppState>().settings.lock().unwrap().clone();
        (s.auto_check_updates, s.auto_install_updates)
    };
    if !auto_check || app.state::<UpdateState>().ready.lock().unwrap().is_some() {
        return;
    }
    let Ok(Some(found)) = check(app).await else { return };
    if auto_install {
        if let Ok(version) = install(app).await {
            let _ = app.emit_to(MAIN, EV_READY, serde_json::json!({ "version": version }));
        }
    } else {
        let _ = app.emit_to(MAIN, EV_AVAILABLE, found);
    }
}

pub fn start_background_checks(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        // Let the window settle before the first network call.
        tokio::time::sleep(Duration::from_secs(10)).await;
        loop {
            background_check(&app).await;
            tokio::time::sleep(CHECK_INTERVAL).await;
        }
    });
}

/// "Check for Updates…" from the tray: always reports back, even when up to date.
pub fn check_from_tray(app: &AppHandle) {
    show_main(app);
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match check(&app).await {
            Ok(Some(found)) => {
                let _ = app.emit_to(MAIN, EV_AVAILABLE, found);
            }
            Ok(None) => {
                let _ = app.emit_to(MAIN, EV_NONE, ());
            }
            Err(e) => {
                let _ = app.emit_to(MAIN, EV_ERROR, e);
            }
        }
    });
}

/// The tray's update item: restart if installed, otherwise ask the web app to install (it shows progress).
pub fn on_tray_update(app: &AppHandle) {
    if app.state::<UpdateState>().ready.lock().unwrap().is_some() {
        app.restart();
    }
    let pending = app.state::<UpdateState>().pending.lock().unwrap().as_ref().map(|u| info(u, false));
    if let Some(found) = pending {
        show_main(app);
        let _ = app.emit_to(MAIN, EV_AVAILABLE, found);
    }
}

// ── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    check(&app).await
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<String, String> {
    install(&app).await
}

#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}

#[tauri::command]
pub fn set_update_prefs(
    app: AppHandle,
    state: tauri::State<AppState>,
    auto_check: bool,
    auto_install: bool,
) -> Result<(), String> {
    let mut s = state.settings.lock().unwrap();
    s.auto_check_updates = auto_check;
    s.auto_install_updates = auto_install;
    s.save(&app)
}
