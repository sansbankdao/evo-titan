// apps/desktop/src/lib/cache.ts — Evo Titan
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  THE PURE HALF OF THE CONTEST CACHE.                                     ║
// ║                                                                          ║
// ║  Everything here is a plain function over plain data. No Tauri import,   ║
// ║  no database, no network. That is deliberate: the rules that decide      ║
// ║  whether a cached row is still usable, and how a row round-trips to the  ║
// ║  disk shape, are exactly the rules that would otherwise be untestable.   ║
// ║  The Tauri-bound half lives in cache-store.ts.                           ║
// ║                                                                          ║
// ║  This mirrors rpc-core.ts / rpc.ts and dpns.ts / dpns-client.ts. The     ║
// ║  tested code and the shipped code are the same code.                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import type { Contestant, ContestedName, ContestOutcome } from './dpns';

/**
 * The disk shape of one cached contest, as the Rust command sends it.
 *
 * The names are camelCase because the Rust struct carries
 * `#[serde(rename_all = "camelCase")]`, so no mapping layer sits between the
 * two sides that could drift.
 */
export interface CachedContestRow {
  name: string;
  /** The `ContestOutcome` string, stored as text. */
  outcome: string;
  winnerId: number | string | null;
  decidedAtMs: number | string | null;
  decidedAtHeight: number | string | null;
  abstainVotes: number | string | null;
  lockVotes: number | string | null;
  /** A JSON array of `{ identityId, voteTally }`. */
  contestantsJson: string;
  /** Unix milliseconds when this row was fetched from the network. */
  fetchedAtMs: number | string;
}

/** What the cache holds for one network. */
export interface CacheStats {
  count: number;
  oldestFetchedAtMs: number | null;
  newestFetchedAtMs: number | null;
  decided: number;
}

/**
 * How long a cached row stays authoritative before the screen refreshes it.
 *
 * Two minutes. A DPNS contest is decided over a two-week window on mainnet
 * (`MAINNET_CONTEST_DURATION` in dash-evo-tool's contested_names_db.rs is
 * `60 * 60 * 24 * 14`), so vote tallies move on the scale of blocks, not
 * minutes. Two minutes is short enough that a user watching a contested name
 * sees movement, and long enough that stepping away and back does not re-run
 * hundreds of queries.
 *
 * This is a freshness threshold for AUTOMATIC refresh only. An explicit
 * refresh always re-queries, because the user asked.
 */
export const CACHE_TTL_MS = 120_000;

/**
 * Convert one network result into its disk shape.
 *
 * `contestantsJson` is serialised here rather than in Rust so the array shape
 * is defined in exactly one place, and that place has a unit test.
 */
export function toCachedRow(row: ContestedName, fetchedAtMs: number): CachedContestRow {
  return {
    name: row.name,
    outcome: row.outcome,
    winnerId: row.winnerId ?? null,
    decidedAtMs: row.decidedAtMs ?? null,
    decidedAtHeight: row.decidedAtHeight ?? null,
    abstainVotes: row.abstainVotes ?? null,
    lockVotes: row.lockVotes ?? null,
    contestantsJson: JSON.stringify(row.contestants),
    fetchedAtMs,
  };
}

/**
 * Convert one disk row back into the shape the screen renders.
 *
 * Every numeric field is coerced with `Number()` because SQLite INTEGER
 * arrives as a JSON number for small values but a string for large ones
 * (rusqlite exposes 64-bit integers, and serde_json cannot represent a value
 * above 2^53 as a JSON number without loss). `decidedAtMs` is a Unix
 * millisecond timestamp, which is far below 2^53, but the coercion is here so
 * a row cannot silently arrive as the string "1733815276906" and render as
 * that. Nullish stays nullish: an undecided contest keeps `undefined` rather
 * than becoming `0`, which would render as 1 January 1970.
 */
export function fromCachedRow(row: CachedContestRow): ContestedName {
  const num = (v: number | string | null | undefined): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  let contestants: Contestant[] = [];
  try {
    const parsed: unknown = JSON.parse(row.contestantsJson || '[]');
    if (Array.isArray(parsed)) {
      contestants = parsed
        .filter((c): c is { identityId: string; voteTally?: number } => !!c && typeof c === 'object')
        .map((c) => ({ identityId: String(c.identityId), voteTally: num(c.voteTally) }));
    }
  } catch {
    // A corrupt row must not take the whole cache down. An empty contender list
    // still renders the name, its outcome and its decision date, which is the
    // bulk of the value; the tallies are the only loss.
    contestants = [];
  }

  return {
    name: row.name,
    outcome: normaliseStoredOutcome(row.outcome),
    winnerId: row.winnerId === null || row.winnerId === undefined ? undefined : String(row.winnerId),
    contestants,
    abstainVotes: num(row.abstainVotes),
    lockVotes: num(row.lockVotes),
    decidedAtMs: num(row.decidedAtMs),
    decidedAtHeight: num(row.decidedAtHeight),
  };
}

/**
 * Validate a stored outcome string.
 *
 * A row written by a future version could hold a kind this build does not
 * know. It becomes `Unknown`, matching `normaliseOutcome` in dpns.ts, rather
 * than being passed through as an arbitrary string that would index into the
 * style map and come back `undefined`.
 */
export function normaliseStoredOutcome(kind: string): ContestOutcome {
  switch (kind) {
    case 'WonByIdentity':
    case 'Locked':
    case 'NoWinner':
      return kind;
    default:
      return 'Unknown';
  }
}

/**
 * Is a cached set fresh enough to use without a network refresh?
 *
 * An empty set is never fresh: holding no rows is not a cache hit, it is a
 * cold start, and reporting it as fresh would render an empty screen that
 * never fills.
 *
 * "Fresh" is decided by the OLDEST row, not the newest. A partial write could
 * leave a few rows refreshed and the rest stale, and using the newest would
 * then declare the whole set current.
 */
export function isCacheFresh(rows: CachedContestRow[], nowMs: number, ttlMs = CACHE_TTL_MS): boolean {
  if (rows.length === 0) return false;
  let oldest = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const t = Number(row.fetchedAtMs);
    if (Number.isFinite(t) && t < oldest) oldest = t;
  }
  if (!Number.isFinite(oldest)) return false;
  return nowMs - oldest < ttlMs;
}

/**
 * Describe the age of a cache in words a person can read.
 *
 * Kept to whole units and never more precise than the minute, because the
 * banner is telling someone whether to trust what is on screen, not reporting
 * a measurement.
 */
export function describeAge(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'unknown age';
  const s = Math.floor(ageMs / 1000);
  if (s < 60) return `${s}s old`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min old`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h old`;
  return `${Math.floor(h / 24)}d old`;
}
