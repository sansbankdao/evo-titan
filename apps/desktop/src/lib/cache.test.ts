// apps/desktop/src/lib/cache.test.ts — Evo Titan
//
// Tests for the pure contest-cache layer. No Tauri, no database, no network:
// every function under test is a plain transformation, so these run under
// `node --test` on a machine with no app installed.
//
// The bar for these tests is the same as for rpc-core.test.ts: they must catch
// a real regression, not restate the implementation. The cases that matter most
// are the ones where a wrong answer is silently plausible -- a null timestamp
// becoming 1970, an empty cache reported as fresh, a corrupt row taking the
// whole set down.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  toCachedRow,
  fromCachedRow,
  normaliseStoredOutcome,
  isCacheFresh,
  describeAge,
  CACHE_TTL_MS,
  type CachedContestRow,
} from './cache.ts';
import type { ContestedName } from './dpns.ts';

/** A decided row, built the way the screen builds one. */
function decided(name: string, timeMs: number | undefined): ContestedName {
  return {
    name,
    outcome: 'WonByIdentity',
    winnerId: 'Winner1',
    contestants: [{ identityId: 'Winner1', voteTally: 56 }],
    abstainVotes: 8,
    lockVotes: 47,
    decidedAtMs: timeMs,
    decidedAtHeight: timeMs === undefined ? undefined : 1000,
  };
}

/** A row as the Rust command sends it, with values already stringified. */
function diskRow(overrides: Partial<CachedContestRow> = {}): CachedContestRow {
  return {
    name: 'abc',
    outcome: 'WonByIdentity',
    winnerId: 'Winner1',
    decidedAtMs: 1_733_815_276_906,
    decidedAtHeight: 83754,
    abstainVotes: 8,
    lockVotes: 47,
    contestantsJson: JSON.stringify([{ identityId: 'Winner1', voteTally: 56 }]),
    fetchedAtMs: 1_733_815_276_906,
    ...overrides,
  };
}

describe('toCachedRow', () => {
  test('carries every field through, mapping undefined to null', () => {
    const row = toCachedRow(decided('abc', 5000), 9000);
    assert.equal(row.name, 'abc');
    assert.equal(row.outcome, 'WonByIdentity');
    assert.equal(row.winnerId, 'Winner1');
    assert.equal(row.decidedAtMs, 5000);
    assert.equal(row.decidedAtHeight, 1000);
    assert.equal(row.abstainVotes, 8);
    assert.equal(row.lockVotes, 47);
    assert.equal(row.fetchedAtMs, 9000);
  });

  test('an undecided row stores nulls, not zeroes', () => {
    const row = toCachedRow(decided('abc', undefined), 9000);
    assert.equal(row.decidedAtMs, null);
    assert.equal(row.decidedAtHeight, null);
  });

  test('contestants are serialised as JSON in one column', () => {
    const row = toCachedRow(decided('abc', 5000), 9000);
    assert.deepEqual(JSON.parse(row.contestantsJson), [{ identityId: 'Winner1', voteTally: 56 }]);
  });
});

describe('fromCachedRow', () => {
  test('round-trips a decided row unchanged', () => {
    const original = decided('abc', 1_733_815_276_906);
    const back = fromCachedRow(toCachedRow(original, 1_733_815_276_906));
    assert.deepEqual(back, original);
  });

  test('accepts large integers arriving as strings', () => {
    // rusqlite exposes 64-bit integers and serde_json cannot always send one as
    // a JSON number, so a timestamp can arrive as "1733815276906". It must
    // become a number, not render as that literal string.
    const back = fromCachedRow(diskRow({ decidedAtMs: '1733815276906', abstainVotes: '8' }));
    assert.equal(back.decidedAtMs, 1_733_815_276_906);
    assert.equal(back.abstainVotes, 8);
  });

  test('null timestamps stay undefined and never become 1970', () => {
    const back = fromCachedRow(diskRow({ decidedAtMs: null, decidedAtHeight: null }));
    assert.equal(back.decidedAtMs, undefined);
    assert.equal(back.decidedAtHeight, undefined);
  });

  test('a null winner stays undefined', () => {
    const back = fromCachedRow(diskRow({ winnerId: null }));
    assert.equal(back.winnerId, undefined);
  });

  test('a corrupt contestants column does not throw and still yields the row', () => {
    const back = fromCachedRow(diskRow({ contestantsJson: 'not json at all' }));
    assert.deepEqual(back.contestants, []);
    // The rest of the row survives: only the tallies are lost.
    assert.equal(back.name, 'abc');
    assert.equal(back.decidedAtMs, 1_733_815_276_906);
  });

  test('an empty contestants column yields an empty list', () => {
    assert.deepEqual(fromCachedRow(diskRow({ contestantsJson: '' })).contestants, []);
  });

  test('contestants missing a tally keep undefined rather than zero', () => {
    const back = fromCachedRow(diskRow({ contestantsJson: JSON.stringify([{ identityId: 'X' }]) }));
    assert.equal(back.contestants[0]?.identityId, 'X');
    assert.equal(back.contestants[0]?.voteTally, undefined);
  });

  test('non-object entries in the contestants array are dropped', () => {
    const back = fromCachedRow(diskRow({ contestantsJson: JSON.stringify([1, null, 'x', { identityId: 'ok' }]) }));
    assert.equal(back.contestants.length, 1);
    assert.equal(back.contestants[0]?.identityId, 'ok');
  });
});

describe('normaliseStoredOutcome', () => {
  test('passes the three known outcomes through', () => {
    for (const k of ['WonByIdentity', 'Locked', 'NoWinner'] as const) {
      assert.equal(normaliseStoredOutcome(k), k);
    }
  });

  test('an unrecognised stored outcome becomes Unknown, not a pass-through', () => {
    assert.equal(normaliseStoredOutcome('SomeFutureKind'), 'Unknown');
    assert.equal(normaliseStoredOutcome(''), 'Unknown');
    assert.equal(normaliseStoredOutcome('wonbyidentity'), 'Unknown');
  });
});

describe('isCacheFresh', () => {
  const now = 1_000_000;

  test('an empty cache is never fresh', () => {
    assert.equal(isCacheFresh([], now), false);
  });

  test('rows fetched just now are fresh', () => {
    assert.equal(isCacheFresh([diskRow({ fetchedAtMs: now })], now), true);
  });

  test('rows older than the TTL are stale', () => {
    assert.equal(isCacheFresh([diskRow({ fetchedAtMs: now - CACHE_TTL_MS - 1 })], now), false);
  });

  test('the oldest row decides freshness, not the newest', () => {
    // One stale row among fresh ones must make the set stale, otherwise a
    // partial write would be reported as a complete refresh.
    const rows = [
      diskRow({ name: 'a', fetchedAtMs: now }),
      diskRow({ name: 'b', fetchedAtMs: now - CACHE_TTL_MS - 1 }),
      diskRow({ name: 'c', fetchedAtMs: now }),
    ];
    assert.equal(isCacheFresh(rows, now), false);
  });

  test('exactly at the TTL boundary is stale', () => {
    assert.equal(isCacheFresh([diskRow({ fetchedAtMs: now - CACHE_TTL_MS })], now), false);
    assert.equal(isCacheFresh([diskRow({ fetchedAtMs: now - CACHE_TTL_MS + 1 })], now), true);
  });

  test('a row with an unparseable timestamp does not make the set fresh', () => {
    assert.equal(isCacheFresh([diskRow({ fetchedAtMs: 'soon' })], now), false);
  });
});

describe('describeAge', () => {
  test('reports seconds under a minute', () => {
    assert.equal(describeAge(45_000), '45s old');
  });

  test('reports whole minutes under an hour', () => {
    assert.equal(describeAge(5 * 60_000 + 30_000), '5 min old');
  });

  test('reports hours under a day', () => {
    assert.equal(describeAge(3 * 3_600_000 + 60_000), '3h old');
  });

  test('reports days beyond that', () => {
    assert.equal(describeAge(2 * 86_400_000 + 3_600_000), '2d old');
  });

  test('a negative or non-finite age is reported as unknown, not as a time', () => {
    assert.equal(describeAge(-5), 'unknown age');
    assert.equal(describeAge(Number.NaN), 'unknown age');
    assert.equal(describeAge(Number.POSITIVE_INFINITY), 'unknown age');
  });
});
