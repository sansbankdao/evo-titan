// apps/desktop/src/lib/cache-store.ts — Evo Titan
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  THE TAURI-BOUND HALF OF THE CONTEST CACHE.                              ║
// ║                                                                          ║
// ║  This is the only file in the cache path that imports Tauri, exactly as  ║
// ║  dpns-client.ts is the only file that touches WASM. Every rule about     ║
// ║  freshness and row shape lives in cache.ts, which runs under            ║
// ║  `node --test` with no Tauri present.                                    ║
// ║                                                                          ║
// ║  Every command is called through a dynamic import() so a page that never ║
// ║  touches the cache does not pull the Tauri API into its bundle.          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import {
  fromCachedRow,
  toCachedRow,
  type CachedContestRow,
  type CacheStats,
} from './cache';
import type { ContestedName } from './dpns';

/** The networks the cache is partitioned by. Matches the DPNS client's union. */
export type CacheNetwork = 'mainnet' | 'testnet';

/** The four commands registered in src-tauri/src/cache.rs. */
async function call<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

/**
 * Read every cached row for a network.
 *
 * Returns rows in the disk shape as well as the rendered shape, because the
 * caller needs the timestamps to decide freshness while the screen only wants
 * `ContestedName`. Returning both avoids a second read.
 */
export async function readCache(
  network: CacheNetwork,
): Promise<{ rows: CachedContestRow[]; names: ContestedName[] }> {
  const rows = await call<CachedContestRow[]>('cache_read_contests', { network });
  return { rows, names: rows.map(fromCachedRow) };
}

/**
 * Persist a freshly fetched set.
 *
 * `fetchedAtMs` is taken once for the whole batch rather than per row, so
 * every row in a set shares a timestamp and `isCacheFresh` cannot be misled by
 * a slow batch. Stamping per row would let the first row of a long fetch look
 * minutes older than the last.
 */
export async function writeCache(
  network: CacheNetwork,
  names: ContestedName[],
  fetchedAtMs: number,
): Promise<number> {
  if (names.length === 0) return 0;
  const rows = names.map((n) => toCachedRow(n, fetchedAtMs));
  return call<number>('cache_write_contests', { network, rows });
}

/** Drop the cache for a network. */
export async function clearCache(network: CacheNetwork): Promise<number> {
  return call<number>('cache_clear_contests', { network });
}

/** How much is cached, and how old it is. */
export async function cacheStats(network: CacheNetwork): Promise<CacheStats> {
  return call<CacheStats>('cache_stats', { network });
}

/**
 * Turn any cache failure into a sentence the banner can show.
 *
 * A cache is an optimisation, never a requirement. Every caller treats a throw
 * from this module as "no cache" and proceeds to the network, so the worst case
 * is the behaviour we had before the cache existed.
 */
export function describeCacheError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not.*tauri|window.*undefined|__TAURI/i.test(msg)) return 'cache unavailable outside the desktop app';
  return msg;
}