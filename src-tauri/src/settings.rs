use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

pub const DEFAULT_SHORTCUT: &str = "Alt+Shift+Space";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Global shortcut that toggles the launcher. Empty disables it.
    pub launcher_shortcut: String,
    /// Closing the window keeps the app running in the menubar.
    pub close_to_tray: bool,
    /// macOS only: show the Dock icon.
    pub show_in_dock: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            launcher_shortcut: DEFAULT_SHORTCUT.into(),
            close_to_tray: true,
            show_in_dock: true,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RecentTool {
    pub id: String,
    pub name: String,
}

fn path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("settings.json"))
}

impl Settings {
    pub fn load(app: &AppHandle) -> Self {
        path(app)
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), String> {
        let p = path(app).ok_or("No config directory")?;
        if let Some(dir) = p.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(p, json).map_err(|e| e.to_string())
    }
}
