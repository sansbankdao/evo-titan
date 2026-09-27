mod menu;
mod rpc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![rpc::rpc_call])
    .menu(|app| menu::build(app))
    .on_menu_event(|app, event| {
      // `menu::handle` owns the ids it created. Anything it does not claim is
      // reported rather than dropped, so a typo in an id cannot silently
      // disable a menu entry.
      if !menu::handle(app, event.id().as_ref()) {
        log::debug!("unhandled menu event: {}", event.id().as_ref());
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}