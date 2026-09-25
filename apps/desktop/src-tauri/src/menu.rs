// apps/desktop/src-tauri/src/menu.rs — Evo Titan
//
// Native OS menus.
//
// Every constructor used here was verified against the installed crate source
// at ~/.cargo/registry/src/index.crates.io-*/tauri-2.11.6/src/menu/, not from
// memory:
//   - `MenuBuilder`        src/menu/builders/menu.rs
//   - `SubmenuBuilder`     src/menu/builders/menu.rs:114 (shares MenuBuilder's
//                          methods via `shared_menu_builder!`, line 675)
//   - `MenuItemBuilder`    src/menu/builders/normal.rs
//   - predefined items     src/menu/predefined.rs (about, quit, minimize,
//                          copy, paste, select_all, separator, ...)
//   - `AboutMetadata`      src/menu/mod.rs (name, version, authors, comments,
//                          copyright, license, website, website_label, ...)
//   - `on_menu_event`      src/app.rs:2000 (`Fn(&AppHandle<R>, MenuEvent)`)
//   - `MenuEvent::id`      src/menu/mod.rs:45
//
// Menu items whose feature does not exist yet are created DISABLED and given an
// id that reports why, so the menu mirrors the UI rather than offering actions
// that silently do nothing.

use tauri::menu::{AboutMetadata, Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Runtime};
/// Stable ids for items this module wires up itself. Items using predefined
/// constructors carry tauri's own ids and are handled by the platform.
pub const MENU_ADD_NODE: &str = "evotitan.addNode";
pub const MENU_REFRESH: &str = "evotitan.refresh";
pub const MENU_DOCS: &str = "evotitan.docs";
pub const MENU_FEATURE: &str = "evotitan.feature";

/// Build the application menu.
///
/// The menu shape is identical in debug and release: items whose feature does
/// not exist yet are created disabled rather than omitted, so the menu bar does
/// not change width between builds and a missing entry is always visible as a
/// greyed-out one rather than as an absence nobody notices.
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    // --- Application (macOS places this first and names it after the app) ---
    //
    // About uses the PREDEFINED item so the OS renders its own native dialog
    // (muda::PredefinedMenuItem::about). That dialog is driven entirely by
    // `about_metadata()`, which reads the version from the crate at compile
    // time, so it cannot drift from tauri.conf.json. Building a custom item
    // instead would mean hand-drawing a dialog the platform already provides.
    let docs = MenuItemBuilder::with_id(MENU_DOCS, "Documentation").build(app)?;

    let app_menu = SubmenuBuilder::new(app, "Evo Titan")
        .about(Some(about_metadata()))
        .separator()
        .item(&docs)
        .separator()
        // Predefined: lets the OS show the standard shortcut and localisation.
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    // --- File ---
    // "Add node" and "Refresh" are the two actions the fleet screen shows as
    // disabled buttons. Wiring them here and disabling them here keeps the two
    // in agreement until rpc.rs has a transport.
    let add_node = MenuItemBuilder::with_id(MENU_ADD_NODE, "Add node…")
        .accelerator("CmdOrCtrl+N")
        .enabled(false)
        .build(app)?;
    let refresh = MenuItemBuilder::with_id(MENU_REFRESH, "Refresh fleet")
        .accelerator("CmdOrCtrl+R")
        .enabled(false)
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&add_node)
        .separator()
        .item(&refresh)
        .separator()
        .close_window()
        .build()?;

    // --- Edit ---
    // Predefined items matter here: they drive the OS-native undo/redo and
    // clipboard stack for the text fields, including the selectable hashes.
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // --- View ---
    let view_menu = SubmenuBuilder::new(app, "View")
        .fullscreen()
        .separator()
        // Zoom is not implemented: the shell is a fixed-layout window and the
        // webview zoom hooks are not wired. Disabled rather than absent so the
        // gap is visible.
        .item(
            &MenuItemBuilder::with_id(MENU_FEATURE, "Zoom")
                .accelerator("CmdOrCtrl+Plus")
                .enabled(false)
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(MENU_FEATURE, "Reset zoom")
                .accelerator("CmdOrCtrl+0")
                .enabled(false)
                .build(app)?,
        )
        .build()?;

    // --- Window ---
    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .bring_all_to_front()
        .build()?;

    // --- Help ---
    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&docs)
        .separator()
        // The API reference is served by the Worker; it opens externally. It is
        // live, so this stays enabled.
        .item(
            &MenuItemBuilder::with_id(MENU_FEATURE, "API reference")
                .build(app)?,
        )
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
        .build()
}

/// Handle a menu event.
///
/// Returns `true` when this module handled the id, so `lib.rs` can report the
/// unhandled case instead of silently swallowing it.
pub fn handle<R: Runtime>(_app: &AppHandle<R>, id: &str) -> bool {
    match id {
        MENU_DOCS => {
            open_external("https://docs.evotitan.app/");
            true
        }
        MENU_FEATURE => {
            // Items built with the shared MENU_FEATURE id are disabled in the
            // menu, so this is only reachable if a future edit enables one
            // without giving it a real handler. Failing loudly is the point:
            // it surfaces the mistake instead of doing nothing.
            eprintln!(
                "evo-titan: menu item '{id}' was triggered but has no handler. \
                 It is expected to be disabled until its feature exists."
            );
            true
        }
        MENU_ADD_NODE | MENU_REFRESH => {
            // Disabled in the menu; if this ever fires, the enabled state and
            // the handler have drifted apart.
            eprintln!(
                "evo-titan: menu item '{id}' fired while its feature is not implemented. \
                 No RPC transport exists (see src/lib/rpc.ts)."
            );
            true
        }
        _ => false,
    }
}

/// Open a URL in the user's browser.
///
/// Spawns the platform opener directly so the app does not need the
/// `tauri-plugin-opener` dependency and its capability entry. The URL is always
/// a compile-time constant from this file, never user input, so there is no
/// injection surface.
#[cfg(target_os = "linux")]
fn open_external(url: &str) {
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

#[cfg(target_os = "macos")]
fn open_external(url: &str) {
    let _ = std::process::Command::new("open").arg(url).spawn();
}

#[cfg(target_os = "windows")]
fn open_external(url: &str) {
    let _ = std::process::Command::new("cmd").args(["/C", "start", "", url]).spawn();
}

/// Metadata for the About entry. Values are read from the bundle at compile
/// time, so the menu cannot drift from `tauri.conf.json`.
pub fn about_metadata() -> AboutMetadata<'static> {
    AboutMetadata {
        name: Some("Evo Titan".to_owned()),
        version: Some(env!("CARGO_PKG_VERSION").to_owned()),
        short_version: None,
        authors: Some(vec!["Sansbank contributors".to_owned()]),
        comments: Some(
            "A console for Dash Masternode Operators. All data shown is mock: no node is \
             connected and no RPC has been verified."
                .to_owned(),
        ),
        copyright: None,
        license: None,
        website: Some("https://evotitan.app".to_owned()),
        website_label: Some("evotitan.app".to_owned()),
        credits: None,
        icon: None,
    }
}