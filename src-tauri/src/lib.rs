//! Desktop shell for DevTools: menubar (tray) item, a global launcher shortcut,
//! launch-at-login, single instance and native downloads.

mod settings;

use settings::{RecentTool, Settings};
use std::sync::Mutex;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder},
    tray::TrayIconBuilder,
    webview::DownloadEvent,
    AppHandle, Emitter, Manager, RunEvent, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as _};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;

const MAIN: &str = "main";
const TRAY_ID: &str = "devtools-tray";
/// Passed by the login item so the app starts quietly in the menubar.
const HIDDEN_ARG: &str = "--hidden";

/// Events the web app listens for (see src/composables/desktop.ts).
const EV_QUICK_OPEN: &str = "desktop://quick-open";
const EV_NAVIGATE: &str = "desktop://navigate";
const EV_OPEN_SETTINGS: &str = "desktop://open-settings";
const EV_DOWNLOADED: &str = "desktop://downloaded";

#[derive(Default)]
struct AppState {
    settings: Mutex<Settings>,
    recents: Mutex<Vec<RecentTool>>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsPayload {
    #[serde(flatten)]
    settings: Settings,
    autostart: bool,
    platform: &'static str,
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN)
}

fn show_main(app: &AppHandle) {
    if let Some(w) = main_window(app) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// The launcher shortcut: hide when the app is in front, otherwise bring it up with the tool search open.
fn toggle_launcher(app: &AppHandle) {
    let Some(w) = main_window(app) else { return };
    let in_front = w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false);
    if in_front {
        let _ = w.hide();
    } else {
        show_main(app);
        let _ = app.emit_to(MAIN, EV_QUICK_OPEN, ());
    }
}

/// "Alt+Shift+Space" → "⌥⇧Space" on macOS, unchanged elsewhere.
fn pretty_shortcut(s: &str) -> String {
    if !cfg!(target_os = "macos") {
        return s.replace("CommandOrControl", "Ctrl").replace("CmdOrCtrl", "Ctrl");
    }
    s.split('+')
        .map(|k| match k {
            "Alt" | "Option" => "⌥".to_string(),
            "Shift" => "⇧".to_string(),
            "Control" | "Ctrl" => "⌃".to_string(),
            "Super" | "Cmd" | "Command" | "Meta" | "CommandOrControl" | "CmdOrCtrl" => "⌘".to_string(),
            other => other.to_string(),
        })
        .collect()
}

fn build_tray_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let state = app.state::<AppState>();
    let shortcut = state.settings.lock().unwrap().launcher_shortcut.clone();
    let recents = state.recents.lock().unwrap().clone();
    let autostart = app.autolaunch().is_enabled().unwrap_or(false);

    let mut recent_menu = SubmenuBuilder::new(app, "Recent Tools");
    if recents.is_empty() {
        recent_menu = recent_menu.item(&MenuItem::with_id(app, "none", "No recent tools", false, None::<&str>)?);
    } else {
        for t in &recents {
            recent_menu = recent_menu.item(&MenuItem::with_id(app, format!("tool:{}", t.id), &t.name, true, None::<&str>)?);
        }
    }

    let quick_label = if shortcut.is_empty() {
        "Search Tools…".to_string()
    } else {
        format!("Search Tools…    {}", pretty_shortcut(&shortcut))
    };

    MenuBuilder::new(app)
        .item(&MenuItem::with_id(app, "open", "Open DevTools", true, None::<&str>)?)
        .item(&MenuItem::with_id(app, "quick", quick_label, true, None::<&str>)?)
        .item(&recent_menu.build()?)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&CheckMenuItem::with_id(app, "autostart", "Launch at Login", true, autostart, None::<&str>)?)
        .item(&MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&MenuItem::with_id(app, "quit", "Quit DevTools", true, None::<&str>)?)
        .build()
}

fn refresh_tray(app: &AppHandle) {
    if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY_ID), build_tray_menu(app)) {
        let _ = tray.set_menu(Some(menu));
    }
}

fn on_tray_menu(app: &AppHandle, id: &str) {
    match id {
        "open" => show_main(app),
        "quick" => {
            show_main(app);
            let _ = app.emit_to(MAIN, EV_QUICK_OPEN, ());
        }
        "settings" => {
            show_main(app);
            let _ = app.emit_to(MAIN, EV_OPEN_SETTINGS, ());
        }
        "autostart" => {
            let al = app.autolaunch();
            let _ = if al.is_enabled().unwrap_or(false) { al.disable() } else { al.enable() };
            refresh_tray(app);
        }
        "quit" => app.exit(0),
        other => {
            if let Some(tool) = other.strip_prefix("tool:") {
                show_main(app);
                let _ = app.emit_to(MAIN, EV_NAVIGATE, format!("/{tool}"));
            }
        }
    }
}

fn apply_dock_visibility(app: &AppHandle, visible: bool) {
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_dock_visibility(visible);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, visible);
}

/// Swaps the registered launcher shortcut. An empty string disables it.
fn register_launcher(app: &AppHandle, previous: &str, next: &str) -> Result<(), String> {
    let gs = app.global_shortcut();
    let parsed = if next.is_empty() {
        None
    } else {
        Some(next.parse::<Shortcut>().map_err(|e| format!("Invalid shortcut: {e}"))?)
    };
    if !previous.is_empty() {
        if let Ok(old) = previous.parse::<Shortcut>() {
            let _ = gs.unregister(old);
        }
    }
    if let Some(sc) = parsed {
        if let Err(e) = gs.register(sc) {
            // Put the old one back so the user isn't left without a launcher.
            if let Ok(old) = previous.parse::<Shortcut>() {
                let _ = gs.register(old);
            }
            return Err(format!("Couldn't register {next}: {e}. It may already be used by another app."));
        }
    }
    Ok(())
}

// ── Commands called from the web app ────────────────────────────────────────

#[tauri::command]
fn get_desktop_settings(app: AppHandle, state: tauri::State<AppState>) -> SettingsPayload {
    SettingsPayload {
        settings: state.settings.lock().unwrap().clone(),
        autostart: app.autolaunch().is_enabled().unwrap_or(false),
        platform: std::env::consts::OS,
    }
}

#[tauri::command]
fn set_launcher_shortcut(app: AppHandle, state: tauri::State<AppState>, shortcut: String) -> Result<(), String> {
    let shortcut = shortcut.trim().to_string();
    let previous = state.settings.lock().unwrap().launcher_shortcut.clone();
    if previous == shortcut {
        return Ok(());
    }
    register_launcher(&app, &previous, &shortcut)?;
    let mut s = state.settings.lock().unwrap();
    s.launcher_shortcut = shortcut;
    s.save(&app)?;
    drop(s);
    refresh_tray(&app);
    Ok(())
}

#[tauri::command]
fn set_close_to_tray(app: AppHandle, state: tauri::State<AppState>, enabled: bool) -> Result<(), String> {
    let mut s = state.settings.lock().unwrap();
    s.close_to_tray = enabled;
    s.save(&app)
}

#[tauri::command]
fn set_show_in_dock(app: AppHandle, state: tauri::State<AppState>, enabled: bool) -> Result<(), String> {
    apply_dock_visibility(&app, enabled);
    let mut s = state.settings.lock().unwrap();
    s.show_in_dock = enabled;
    s.save(&app)
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let al = app.autolaunch();
    if enabled { al.enable() } else { al.disable() }.map_err(|e| e.to_string())?;
    refresh_tray(&app);
    Ok(())
}

#[tauri::command]
fn set_tray_recents(app: AppHandle, state: tauri::State<AppState>, tools: Vec<RecentTool>) {
    *state.recents.lock().unwrap() = tools.into_iter().take(8).collect();
    refresh_tray(&app);
}

#[tauri::command]
fn hide_window(app: AppHandle) {
    if let Some(w) = main_window(&app) {
        let _ = w.hide();
    }
}

#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    let ok = ["https://", "http://", "mailto:"].iter().any(|p| url.starts_with(p));
    if !ok {
        return Err("Only http(s) and mailto links can be opened".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

// ── App setup ───────────────────────────────────────────────────────────────

fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == MAIN)
        .expect("main window config")
        .clone();
    let handle = app.clone();
    WebviewWindowBuilder::from_config(app, &config)?
        // Files the tools export (blob/data URLs) are saved straight to the Downloads folder.
        .on_download(move |_webview, event| {
            match event {
                DownloadEvent::Requested { destination, .. } => {
                    if let Ok(dir) = handle.path().download_dir() {
                        let name = destination
                            .file_name()
                            .map(|n| n.to_owned())
                            .unwrap_or_else(|| "download".into());
                        *destination = unique_path(dir.join(name));
                    }
                }
                DownloadEvent::Finished { path, success, .. } => {
                    let _ = handle.emit_to(
                        MAIN,
                        EV_DOWNLOADED,
                        serde_json::json!({
                            "path": path.map(|p| p.to_string_lossy().into_owned()),
                            "success": success,
                        }),
                    );
                }
                _ => {}
            }
            true
        })
        .build()
}

/// "file.png" → "file (1).png" when the name is taken.
fn unique_path(path: std::path::PathBuf) -> std::path::PathBuf {
    if !path.exists() {
        return path;
    }
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let dir = path.parent().map(|p| p.to_path_buf()).unwrap_or_default();
    (1..)
        .map(|i| dir.join(format!("{stem} ({i}){ext}")))
        .find(|p| !p.exists())
        .unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // We decide visibility ourselves (e.g. start hidden at login).
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        - tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![HIDDEN_ARG])))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    // Only one global shortcut is ever registered: the launcher.
                    if event.state() == ShortcutState::Pressed {
                        toggle_launcher(app);
                    }
                })
                .build(),
        )
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle().clone();
            let settings = Settings::load(&handle);
            *app.state::<AppState>().settings.lock().unwrap() = settings.clone();

            let window = create_main_window(&handle)?;
            if !std::env::args().any(|a| a == HIDDEN_ARG) {
                window.show()?;
            }
            apply_dock_visibility(&handle, settings.show_in_dock);

            if let Err(e) = register_launcher(&handle, "", &settings.launcher_shortcut) {
                eprintln!("launcher shortcut: {e}");
            }

            TrayIconBuilder::with_id(TRAY_ID)
                .icon(app.default_window_icon().expect("app icon").clone())
                .tooltip("DevTools")
                .menu(&build_tray_menu(&handle)?)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| on_tray_menu(app, event.id().as_ref()))
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let keep = window.state::<AppState>().settings.lock().unwrap().close_to_tray;
                if keep && window.label() == MAIN {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_desktop_settings,
            set_launcher_shortcut,
            set_close_to_tray,
            set_show_in_dock,
            set_autostart,
            set_tray_recents,
            hide_window,
            open_external,
        ])
        .build(tauri::generate_context!())
        .expect("error while building DevTools");

    app.run(|app, event| {
        // macOS: clicking the Dock icon brings the window back after it was closed to the menubar.
        #[cfg(target_os = "macos")]
        if let RunEvent::Reopen { .. } = event {
            show_main(app);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}
