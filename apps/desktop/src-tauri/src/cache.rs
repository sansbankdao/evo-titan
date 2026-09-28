// apps/desktop/src-tauri/src/cache.rs — Evo Titan
//
// Local SQLite cache for contested DPNS names.
//
// WHY THIS EXISTS. Loading the contested-names screen costs one listing query
// plus ONE VOTE-STATE QUERY PER NAME. At sixty names in chunks of eight that is
// seconds of network work for data that changes slowly, and a second visit
// repeats all of it. Caching the vote states locally means a revisit renders
// from disk immediately and skips the per-name queries entirely while the
// entries are fresh.
//
// WHY SQLITE AND NOT JSON. SQLite is a single file, transactional, and needs no
// server. It also survives a hard kill mid-write, which a hand-rolled JSON file
// does not: a truncated JSON file is unparseable and loses the whole cache,
// while SQLite recovers to the last committed transaction. WAL mode is on so a
// write does not block a read.
//
// WHY rusqlite AND NOT tauri-plugin-sql. The plugin would add a second crate
// AND an npm package AND a capability permission, and would move the SQL into
// the webview. A pair of narrow commands keeps the database behind the same
// boundary as the RPC proxy in rpc.rs, and keeps the surface to four functions
// that each do one thing.
//
// THE VERSION IS PINNED to `=0.38.0`. That is the version dash-evo-tool pins
// (its Cargo.toml:90) and the version whose sibling `libsqlite3-sys 0.36.0` is
// already present in the local cargo cache, so the pair is known to compile.
// `bundled` compiles SQLite from source into the binary, so there is no system
// libsqlite3 dependency to go missing on a user's machine.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Database file name inside the app data directory.
const DB_FILE: &str = "contest-cache.sqlite3";

/// One cached vote state.
///
/// The field names are camelCase on the wire so the TypeScript side can use
/// them directly without a mapping layer that could drift.
///
/// `contestants` is stored as a JSON array in a single column rather than in a
/// child table. The contenders of a contest are always read and written as a
/// set, never queried individually, so a child table would add a join and a
/// migration to maintain for no query we actually make. This mirrors how
/// dash-evo-tool nests contender rows inside the contest record
/// (src/context/contested_names_db.rs).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedContestRow {
  pub name: String,
  pub outcome: String,
  #[serde(default)]
  pub winner_id: Option<String>,
  #[serde(default)]
  pub decided_at_ms: Option<i64>,
  #[serde(default)]
  pub decided_at_height: Option<i64>,
  #[serde(default)]
  pub abstain_votes: Option<i64>,
  #[serde(default)]
  pub lock_votes: Option<i64>,
  /// JSON array of `{ identityId, voteTally }`, exactly as the UI uses it.
  #[serde(default)]
  pub contestants_json: String,
  /// When this row was fetched from the network. Drives cache freshness.
  pub fetched_at_ms: i64,
}

/// Summary of what is held for a network, for the provenance banner.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
  pub count: i64,
  pub oldest_fetched_at_ms: Option<i64>,
  pub newest_fetched_at_ms: Option<i64>,
  pub decided: i64,
}

/// Resolve the database path, creating the app data directory if needed.
fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
  std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
  Ok(dir.join(DB_FILE))
}

/// Open the database at an explicit path and apply the schema.
///
/// This takes a path rather than an `AppHandle` so the SQL below is reachable
/// from a unit test. The `#[tauri::command]` wrappers resolve the app data
/// directory and call this, which means the tested code and the shipped code
/// are the same code -- the same split as rpc-core.ts / rpc.ts.
///
/// The schema is idempotent, so it runs on every open. That is cheaper to
/// reason about than a migration table for a cache that can always be rebuilt
/// from the network: if the shape ever changes incompatibly, the fix is to drop
/// the file rather than to write a migration.
fn open_at(path: &Path) -> Result<Connection, String> {
  let conn = Connection::open(path).map_err(|e| format!("cannot open {}: {e}", path.display()))?;

  // WAL lets a read proceed while a write is in flight, which is exactly what
  // the screen does: render from cache, then persist the network refresh.
  conn
    .pragma_update(None, "journal_mode", "WAL")
    .map_err(|e| format!("cannot enable WAL: {e}"))?;
  // Durable across a process crash but not across power loss. A cache is
  // rebuildable, so trading a sync for a much faster write is the right call.
  conn
    .pragma_update(None, "synchronous", "NORMAL")
    .map_err(|e| format!("cannot set synchronous: {e}"))?;

  conn
    .execute_batch(
      "CREATE TABLE IF NOT EXISTS contested_name (\n         network           TEXT    NOT NULL,\n         name              TEXT    NOT NULL,\n         outcome           TEXT    NOT NULL,\n         winner_id         TEXT,\n         decided_at_ms     INTEGER,\n         decided_at_height INTEGER,\n         abstain_votes     INTEGER,\n         lock_votes        INTEGER,\n         contestants_json  TEXT    NOT NULL DEFAULT '[]',\n         fetched_at_ms     INTEGER NOT NULL,\n         PRIMARY KEY (network, name)\n       );\n       CREATE INDEX IF NOT EXISTS contested_name_recent\n         ON contested_name (network, decided_at_ms DESC);",
    )
    .map_err(|e| format!("cannot apply schema: {e}"))?;

  Ok(conn)
}

/// Open the database in the app data directory. The only place the `AppHandle`
/// is needed.
fn open(app: &AppHandle) -> Result<Connection, String> {
  open_at(&db_path(app)?)
}

/// Read every row for a network. Pure over a connection, so it is testable.
fn read_contests(conn: &Connection, network: &str) -> Result<Vec<CachedContestRow>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT name, outcome, winner_id, decided_at_ms, decided_at_height,\n              abstain_votes, lock_votes, contestants_json, fetched_at_ms\n         FROM contested_name\n        WHERE network = ?1",
    )
    .map_err(|e| format!("cannot prepare read: {e}"))?;

  let rows = stmt
    .query_map(params![network], |r| {
      Ok(CachedContestRow {
        name: r.get(0)?,
        outcome: r.get(1)?,
        winner_id: r.get(2)?,
        decided_at_ms: r.get(3)?,
        decided_at_height: r.get(4)?,
        abstain_votes: r.get(5)?,
        lock_votes: r.get(6)?,
        contestants_json: r.get(7)?,
        fetched_at_ms: r.get(8)?,
      })
    })
    .map_err(|e| format!("cannot read contests: {e}"))?;

  let mut out = Vec::new();
  for row in rows {
    out.push(row.map_err(|e| format!("cannot decode cached row: {e}"))?);
  }
  Ok(out)
}

/// Insert or replace rows for a network, in one transaction.
fn write_contests(
  conn: &mut Connection,
  network: &str,
  rows: &[CachedContestRow],
) -> Result<usize, String> {
  let tx = conn
    .transaction()
    .map_err(|e| format!("cannot begin transaction: {e}"))?;

  {
    let mut stmt = tx
      .prepare(
        "INSERT INTO contested_name\n           (network, name, outcome, winner_id, decided_at_ms, decided_at_height,\n            abstain_votes, lock_votes, contestants_json, fetched_at_ms)\n         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)\n         ON CONFLICT(network, name) DO UPDATE SET\n           outcome           = excluded.outcome,\n           winner_id         = excluded.winner_id,\n           decided_at_ms     = excluded.decided_at_ms,\n           decided_at_height = excluded.decided_at_height,\n           abstain_votes     = excluded.abstain_votes,\n           lock_votes        = excluded.lock_votes,\n           contestants_json  = excluded.contestants_json,\n           fetched_at_ms     = excluded.fetched_at_ms",
      )
      .map_err(|e| format!("cannot prepare write: {e}"))?;

    for row in rows {
      stmt
        .execute(params![
          network,
          row.name,
          row.outcome,
          row.winner_id,
          row.decided_at_ms,
          row.decided_at_height,
          row.abstain_votes,
          row.lock_votes,
          row.contestants_json,
          row.fetched_at_ms,
        ])
        .map_err(|e| format!("cannot write {}: {e}", row.name))?;
    }
  }

  tx.commit().map_err(|e| format!("cannot commit: {e}"))?;
  Ok(rows.len())
}

/// Delete every row for a network.
fn clear_contests(conn: &Connection, network: &str) -> Result<usize, String> {
  conn
    .execute("DELETE FROM contested_name WHERE network = ?1", params![network])
    .map_err(|e| format!("cannot clear cache: {e}"))
}

/// What the cache holds for a network.
fn stats_for(conn: &Connection, network: &str) -> Result<CacheStats, String> {
  conn
    .query_row(
      "SELECT COUNT(*), MIN(fetched_at_ms), MAX(fetched_at_ms),\n              SUM(CASE WHEN decided_at_ms IS NOT NULL THEN 1 ELSE 0 END)\n         FROM contested_name\n        WHERE network = ?1",
      params![network],
      |r| {
        Ok(CacheStats {
          count: r.get(0)?,
          oldest_fetched_at_ms: r.get(1)?,
          newest_fetched_at_ms: r.get(2)?,
          decided: r.get::<_, Option<i64>>(3)?.unwrap_or(0),
        })
      },
    )
    .map_err(|e| format!("cannot read cache stats: {e}"))
}

/// Every cached row for a network.
///
/// Deliberately unordered: the ordering rules (most recently decided first,
/// undecided last) live in TypeScript, where they are unit-tested against the
/// live node's real reply shape. Sorting here as well would create a second
/// implementation of the same rule that no test exercises.
#[tauri::command]
pub fn cache_read_contests(
  app: AppHandle,
  network: String,
) -> Result<Vec<CachedContestRow>, String> {
  read_contests(&open(&app)?, &network)
}

/// Insert or replace rows for a network, in one transaction.
///
/// Returns the number of rows written. A transaction is what makes a refresh
/// atomic: either the whole batch lands or none of it does, so the cache never
/// holds a half-updated listing.
#[tauri::command]
pub fn cache_write_contests(
  app: AppHandle,
  network: String,
  rows: Vec<CachedContestRow>,
) -> Result<usize, String> {
  write_contests(&mut open(&app)?, &network, &rows)
}

/// Delete every cached row for a network. Returns how many were removed.
#[tauri::command]
pub fn cache_clear_contests(app: AppHandle, network: String) -> Result<usize, String> {
  clear_contests(&open(&app)?, &network)
}

/// What the cache holds for a network.
#[tauri::command]
pub fn cache_stats(app: AppHandle, network: String) -> Result<CacheStats, String> {
  stats_for(&open(&app)?, &network)
}

#[cfg(test)]
mod tests {
  use super::*;

  /// A unique database path per test, so tests never share state.
  fn temp_db(tag: &str) -> PathBuf {
    let mut p = std::env::temp_dir();
    p.push(format!(
      "evotitan-cache-test-{}-{}-{}.sqlite3",
      tag,
      std::process::id(),
      std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0)
    ));
    p
  }

  fn row(name: &str, decided: Option<i64>, fetched: i64) -> CachedContestRow {
    CachedContestRow {
      name: name.to_string(),
      outcome: "WonByIdentity".to_string(),
      winner_id: Some("Winner1".to_string()),
      decided_at_ms: decided,
      decided_at_height: decided.map(|_| 1000),
      abstain_votes: Some(8),
      lock_votes: Some(47),
      contestants_json: "[{\"identityId\":\"Winner1\",\"voteTally\":56}]".to_string(),
      fetched_at_ms: fetched,
    }
  }

  #[test]
  fn schema_is_idempotent() {
    let path = temp_db("idem");
    let a = open_at(&path).expect("first open");
    drop(a);
    let b = open_at(&path).expect("second open must not fail on an existing schema");
    let _ = clear_contests(&b, "mainnet");
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn an_empty_cache_reads_back_empty() {
    let path = temp_db("empty");
    let conn = open_at(&path).expect("open");
    let rows = read_contests(&conn, "mainnet").expect("read");
    assert!(rows.is_empty());
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn rows_round_trip_with_every_field_intact() {
    let path = temp_db("roundtrip");
    let mut conn = open_at(&path).expect("open");
    let written = write_contests(&mut conn, "mainnet", &[row("abc", Some(5000), 9000)]).expect("write");
    assert_eq!(written, 1);

    let rows = read_contests(&conn, "mainnet").expect("read");
    assert_eq!(rows.len(), 1);
    let r = &rows[0];
    assert_eq!(r.name, "abc");
    assert_eq!(r.outcome, "WonByIdentity");
    assert_eq!(r.winner_id.as_deref(), Some("Winner1"));
    assert_eq!(r.decided_at_ms, Some(5000));
    assert_eq!(r.decided_at_height, Some(1000));
    assert_eq!(r.abstain_votes, Some(8));
    assert_eq!(r.lock_votes, Some(47));
    assert_eq!(r.contestants_json, "[{\"identityId\":\"Winner1\",\"voteTally\":56}]");
    assert_eq!(r.fetched_at_ms, 9000);
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn an_undecided_row_stores_nulls_and_reads_them_back_as_null() {
    let path = temp_db("undecided");
    let mut conn = open_at(&path).expect("open");
    write_contests(&mut conn, "mainnet", &[row("never", None, 9000)]).expect("write");
    let rows = read_contests(&conn, "mainnet").expect("read");
    assert_eq!(rows[0].decided_at_ms, None);
    assert_eq!(rows[0].decided_at_height, None);
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn writing_the_same_name_twice_updates_rather_than_duplicating() {
    let path = temp_db("upsert");
    let mut conn = open_at(&path).expect("open");
    write_contests(&mut conn, "mainnet", &[row("abc", Some(5000), 9000)]).expect("first");
    let mut newer = row("abc", Some(6000), 12000);
    newer.lock_votes = Some(99);
    write_contests(&mut conn, "mainnet", &[newer]).expect("second");

    let rows = read_contests(&conn, "mainnet").expect("read");
    assert_eq!(rows.len(), 1, "a repeat write must not duplicate the row");
    assert_eq!(rows[0].decided_at_ms, Some(6000));
    assert_eq!(rows[0].lock_votes, Some(99));
    assert_eq!(rows[0].fetched_at_ms, 12000);
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn networks_are_partitioned() {
    let path = temp_db("nets");
    let mut conn = open_at(&path).expect("open");
    write_contests(&mut conn, "mainnet", &[row("abc", Some(1), 10)]).expect("mainnet");
    write_contests(&mut conn, "testnet", &[row("xyz", Some(2), 20)]).expect("testnet");

    let main = read_contests(&conn, "mainnet").expect("read main");
    let test = read_contests(&conn, "testnet").expect("read test");
    assert_eq!(main.len(), 1);
    assert_eq!(test.len(), 1);
    assert_eq!(main[0].name, "abc");
    assert_eq!(test[0].name, "xyz");
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn clearing_one_network_leaves_the_other() {
    let path = temp_db("clear");
    let mut conn = open_at(&path).expect("open");
    write_contests(&mut conn, "mainnet", &[row("abc", Some(1), 10)]).expect("mainnet");
    write_contests(&mut conn, "testnet", &[row("xyz", Some(2), 20)]).expect("testnet");

    let removed = clear_contests(&conn, "mainnet").expect("clear");
    assert_eq!(removed, 1);
    assert!(read_contests(&conn, "mainnet").expect("read").is_empty());
    assert_eq!(read_contests(&conn, "testnet").expect("read").len(), 1);
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn stats_report_count_range_and_decided_total() {
    let path = temp_db("stats");
    let mut conn = open_at(&path).expect("open");
    write_contests(
      &mut conn,
      "mainnet",
      &[row("a", Some(100), 1000), row("b", Some(200), 5000), row("c", None, 3000)],
    )
    .expect("write");

    let s = stats_for(&conn, "mainnet").expect("stats");
    assert_eq!(s.count, 3);
    assert_eq!(s.oldest_fetched_at_ms, Some(1000));
    assert_eq!(s.newest_fetched_at_ms, Some(5000));
    assert_eq!(s.decided, 2, "only the two rows with a decision time count as decided");
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn stats_on_an_empty_cache_report_zero_not_an_error() {
    let path = temp_db("empty-stats");
    let conn = open_at(&path).expect("open");
    let s = stats_for(&conn, "mainnet").expect("stats");
    assert_eq!(s.count, 0);
    assert_eq!(s.oldest_fetched_at_ms, None);
    assert_eq!(s.newest_fetched_at_ms, None);
    assert_eq!(s.decided, 0);
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn the_wire_shape_is_camel_case() {
    // The TypeScript side reads these names directly, so a rename here without
    // a matching change there would silently produce undefined fields.
    let json = serde_json::to_value(row("abc", Some(5000), 9000)).expect("serialize");
    for key in [
      "winnerId",
      "decidedAtMs",
      "decidedAtHeight",
      "abstainVotes",
      "lockVotes",
      "contestantsJson",
      "fetchedAtMs",
    ] {
      assert!(json.get(key).is_some(), "missing wire field {key}");
    }
    for key in ["winner_id", "decided_at_ms", "contestants_json", "fetched_at_ms"] {
      assert!(json.get(key).is_none(), "snake_case field {key} leaked onto the wire");
    }
  }

  #[test]
  fn stats_wire_shape_is_camel_case() {
    let json = serde_json::to_value(CacheStats {
      count: 1,
      oldest_fetched_at_ms: Some(1),
      newest_fetched_at_ms: Some(2),
      decided: 1,
    })
    .expect("serialize");
    assert!(json.get("oldestFetchedAtMs").is_some());
    assert!(json.get("newestFetchedAtMs").is_some());
    assert!(json.get("oldest_fetched_at_ms").is_none());
  }

  #[test]
  fn a_cache_file_survives_reopening() {
    // The whole point of SQLite over a hand-written JSON file: the data is
    // there on the next launch, not just the next call.
    let path = temp_db("persist");
    {
      let mut conn = open_at(&path).expect("open");
      write_contests(&mut conn, "mainnet", &[row("abc", Some(5000), 9000)]).expect("write");
    }
    let conn = open_at(&path).expect("reopen");
    let rows = read_contests(&conn, "mainnet").expect("read after reopen");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].name, "abc");
    // Clean up the WAL sidecars too.
    let _ = std::fs::remove_file(&path);
    let _ = std::fs::remove_file(path.with_extension("sqlite3-wal"));
    let _ = std::fs::remove_file(path.with_extension("sqlite3-shm"));
  }
}
