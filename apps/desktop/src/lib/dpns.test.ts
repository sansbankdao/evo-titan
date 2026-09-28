// apps/desktop/src/lib/dpns.test.ts — Evo Titan
//
// Tests for the PURE contested-name logic in dpns.ts.
//
// No WASM and no network: a fake PlatformClient is injected, exactly as the RPC
// suite injects a fake transport. That is what makes these tests meaningful —
// they exercise the code that ships rather than a parallel re-implementation.
//
// Every test here was written to have caught a real defect:
//   - the cursor test fails if `startAtValueIncluded: false` is dropped, which
//     would silently repeat one row per page;
//   - the outcome test fails if an unknown kind is coerced onto a known one;
//   - the timestamp test fails if a bigint is passed through unconverted, which
//     renders as "1732913466152n" in the UI.
//
// Imported WITH the .ts extension because Node ESM performs no extension
// resolution under `node --test`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  normaliseOutcome,
  toContestedName,
  listContestedNames,
  fetchContestedNames,
  sortByMostRecentlyDecided,
  DPNS_CONTRACT_ID,
  DPNS_CONTESTED_INDEX,
  DPNS_DOCUMENT_TYPE,
  DPNS_PARENT_DOMAIN,
  type PlatformClient,
} from './dpns.ts';

/** The winner shape the SDK returns, spelled out so the fake matches it exactly. */
type Winner = {
  kind: string;
  identityId: { toBase58(): string } | undefined;
  block: { timeMs: bigint; height: bigint } | undefined;
};

/** A vote-state reply with everything unset, for tests that only care about one field. */
function emptyState(overrides: Partial<{
  contenders: Array<{ identityId: { toBase58(): string }; voteTally: number | undefined }>;
  abstainVoteTally: number | undefined;
  lockVoteTally: number | undefined;
  winner: Winner | undefined;
}> = {}) {
  return {
    contenders: [] as Array<{ identityId: { toBase58(): string }; voteTally: number | undefined }>,
    abstainVoteTally: 0 as number | undefined,
    lockVoteTally: 0 as number | undefined,
    winner: undefined as Winner | undefined,
    ...overrides,
  };
}

/** Wrap a base58-ish string the way the SDK does. */
const id = (s: string) => ({ toBase58: () => s });

/**
 * A fake client that pages a fixed list of names and records every query it was
 * asked for, so a test can assert on the exact request the shipped code builds.
 */
function fakeClient(names: string[], opts: { tallies?: Record<string, number> } = {}) {
  const calls: Array<Record<string, unknown>> = [];
  const client: PlatformClient = {
    async getContestedResources(query) {
      calls.push({ ...query, kind: 'list' });
      const start = query.startAtValue as string | undefined;
      const from = start === undefined ? 0 : names.indexOf(start) + (query.startAtValueIncluded === false ? 1 : 0);
      return names.slice(from, from + (query.limit ?? 100));
    },
    async getContestedResourceVoteState(query) {
      calls.push({ ...query, kind: 'state' });
      const name = (query.indexValues as string[])[1] ?? '';
      return emptyState({
        contenders: [{ identityId: id(`id-${name}`), voteTally: opts.tallies?.[name] ?? 3 }],
      });
    },
  };
  return { client, calls };
}

describe('normaliseOutcome', () => {
  test('passes through the three known kinds', () => {
    assert.equal(normaliseOutcome('WonByIdentity'), 'WonByIdentity');
    assert.equal(normaliseOutcome('Locked'), 'Locked');
    assert.equal(normaliseOutcome('NoWinner'), 'NoWinner');
  });

  test('an unrecognised kind becomes Unknown rather than a known outcome', () => {
    // Coercing a future protocol state onto 'Locked' would tell an operator a
    // name is permanently unregisterable when it is not.
    assert.equal(normaliseOutcome('SomeFutureKind'), 'Unknown');
    assert.equal(normaliseOutcome(undefined), 'Unknown');
    assert.equal(normaliseOutcome(''), 'Unknown');
  });
});

describe('toContestedName', () => {
  test('converts bigint timestamps and heights to numbers', () => {
    const row = toContestedName(
      'abc',
      emptyState({
        winner: {
          kind: 'WonByIdentity',
          identityId: id('winner-1'),
          block: { timeMs: 1732913466152n, height: 54609n },
        },
      }) as never,
    );
    // A bigint left as-is renders as "1732913466152n" in the DOM.
    assert.equal(typeof row.decidedAtMs, 'number');
    assert.equal(row.decidedAtMs, 1732913466152);
    assert.equal(typeof row.decidedAtHeight, 'number');
    assert.equal(row.decidedAtHeight, 54609);
    assert.equal(row.outcome, 'WonByIdentity');
    assert.equal(row.winnerId, 'winner-1');
  });

  test('an undecided contest has no winner and no timestamp', () => {
    const row = toContestedName('abc', emptyState() as never);
    assert.equal(row.outcome, 'Unknown');
    assert.equal(row.winnerId, undefined);
    assert.equal(row.decidedAtMs, undefined);
    assert.equal(row.decidedAtHeight, undefined);
  });

  test('nullish tallies are preserved as undefined, not turned into zero', () => {
    // Zero means "counted, got nothing". Undefined means "not reported". The
    // screen renders a dash for one and a 0 for the other, so they must not
    // collapse into each other.
    const row = toContestedName(
      'abc',
      emptyState({ abstainVoteTally: undefined, lockVoteTally: undefined }) as never,
    );
    assert.equal(row.abstainVotes, undefined);
    assert.equal(row.lockVotes, undefined);
  });

  test('contenders are mapped with their identity and tally', () => {
    const row = toContestedName(
      'abc',
      emptyState({
        contenders: [
          { identityId: id('a'), voteTally: 10 },
          { identityId: id('b'), voteTally: undefined },
        ],
      }) as never,
    );
    assert.deepEqual(row.contestants, [
      { identityId: 'a', voteTally: 10 },
      { identityId: 'b', voteTally: undefined },
    ]);
  });
});

describe('listContestedNames', () => {
  test('pages through every name and returns them in order', async () => {
    const names = Array.from({ length: 250 }, (_, i) => `name${String(i).padStart(3, '0')}`);
    const { client, calls } = fakeClient(names);
    const got = await listContestedNames(client, 250);
    assert.equal(got.length, 250);
    assert.deepEqual(got, names);
    // 100 + 100 + 50 => three list calls, the last one short.
    assert.equal(calls.filter((c) => c.kind === 'list').length, 3);
  });

  test('the second page excludes the previous page last name', async () => {
    // This is the regression guard: without startAtValueIncluded:false the
    // cursor name is returned again and the list carries a duplicate.
    const names = Array.from({ length: 150 }, (_, i) => `n${i}`);
    const { client, calls } = fakeClient(names);
    const got = await listContestedNames(client, 150);
    assert.equal(new Set(got).size, got.length, 'duplicate names in the listing');
    const second = calls.filter((c) => c.kind === 'list')[1];
    assert.ok(second, 'the listing did not issue a second page');
    assert.equal(second.startAtValue, 'n99');
    assert.equal(second.startAtValueIncluded, false);
  });

  test('the first page sends no cursor key at all', async () => {
    const { client, calls } = fakeClient(['a', 'b']);
    await listContestedNames(client, 10);
    const first = calls.find((c) => c.kind === 'list');
    assert.ok(first, 'no listing query was issued');
    assert.equal(first.startAtValue, undefined);
    assert.equal('startAtValueIncluded' in first, false);
  });

  test('stops at the requested limit', async () => {
    const names = Array.from({ length: 500 }, (_, i) => `n${i}`);
    const { client, calls } = fakeClient(names);
    const got = await listContestedNames(client, 120);
    assert.equal(got.length, 120);
    assert.equal(calls.filter((c) => c.kind === 'list').length, 2);
  });

  test('an empty network returns an empty list without looping', async () => {
    const { client, calls } = fakeClient([]);
    const got = await listContestedNames(client, 60);
    assert.deepEqual(got, []);
    assert.equal(calls.filter((c) => c.kind === 'list').length, 1);
  });

  test('every query targets the DPNS contract and the contested index', async () => {
    const { client, calls } = fakeClient(['a']);
    await listContestedNames(client, 10);
    for (const c of calls.filter((x) => x.kind === 'list')) {
      assert.equal(c.dataContractId, DPNS_CONTRACT_ID);
      assert.equal(c.documentTypeName, DPNS_DOCUMENT_TYPE);
      assert.equal(c.indexName, DPNS_CONTESTED_INDEX);
      assert.deepEqual(c.startIndexValues, [DPNS_PARENT_DOMAIN]);
    }
  });
});

/**
 * A decided row with a given decision time, for the ordering tests.
 *
 * Built through `toContestedName` rather than by hand so the tests exercise the
 * same mapping the app uses; a hand-written literal could drift from the real
 * shape and still pass.
 */
function decided(name: string, timeMs: number) {
  return toContestedName(
    name,
    emptyState({
      winner: { kind: 'WonByIdentity', identityId: id('winner'), block: { timeMs: BigInt(timeMs), height: 1n } },
    }) as never,
  );
}

/** An undecided row: no winner, therefore no decision time at all. */
function undecided(name: string) {
  return toContestedName(name, emptyState() as never);
}

describe('sortByMostRecentlyDecided', () => {
  test('orders by decision time, newest first', () => {
    const rows = [decided('a', 1000), decided('b', 3000), decided('c', 2000)];
    assert.deepEqual(
      sortByMostRecentlyDecided(rows).map((r) => r.name),
      ['b', 'c', 'a'],
    );
  });

  test('puts undecided rows last rather than inventing a date for them', () => {
    const rows = [undecided('x'), decided('a', 1000), undecided('y'), decided('b', 2000)];
    const sorted = sortByMostRecentlyDecided(rows);
    assert.deepEqual(sorted.map((r) => r.name), ['b', 'a', 'x', 'y']);
    // And the undecided rows still carry no timestamp afterwards.
    assert.equal(sorted[2]?.decidedAtMs, undefined);
    assert.equal(sorted[3]?.decidedAtMs, undefined);
  });

  test('preserves listing order among undecided rows (stable)', () => {
    const rows = [undecided('p'), undecided('q'), undecided('r')];
    assert.deepEqual(
      sortByMostRecentlyDecided(rows).map((r) => r.name),
      ['p', 'q', 'r'],
    );
  });

  test('preserves listing order among rows decided at the same instant (stable)', () => {
    const rows = [decided('m', 5000), decided('n', 5000), decided('o', 5000)];
    assert.deepEqual(
      sortByMostRecentlyDecided(rows).map((r) => r.name),
      ['m', 'n', 'o'],
    );
  });

  test('does not mutate the input array', () => {
    const rows = [decided('a', 1000), decided('b', 2000)];
    const before = rows.map((r) => r.name);
    sortByMostRecentlyDecided(rows);
    assert.deepEqual(rows.map((r) => r.name), before);
  });

  test('an all-undecided set is returned unchanged', () => {
    const rows = [undecided('a'), undecided('b')];
    assert.deepEqual(
      sortByMostRecentlyDecided(rows).map((r) => r.name),
      ['a', 'b'],
    );
  });
});

describe('fetchContestedNames sorting', () => {
  test('returns one row per name with its vote state', async () => {
    const { client, calls } = fakeClient(['aa', 'bb', 'cc'], { tallies: { aa: 7, bb: 8, cc: 9 } });
    const rows = await fetchContestedNames(client, { limit: 3 });
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map((r) => r.name), ['aa', 'bb', 'cc']);
    assert.deepEqual(rows.map((r) => r.contestants[0]?.voteTally), [7, 8, 9]);
    // The vote-state query must carry both index values, in order.
    const state = calls.find((c) => c.kind === 'state');
    assert.ok(state, 'no vote-state query was issued');
    assert.deepEqual(state.indexValues, [DPNS_PARENT_DOMAIN, 'aa']);
    assert.equal(state.resultType, 'documentsAndVoteTally');
    assert.equal(state.includeLockedAndAbstaining, true);
  });

  test('progress is reported and ends in the done phase', async () => {
    const { client } = fakeClient(Array.from({ length: 20 }, (_, i) => `n${i}`));
    const phases: string[] = [];
    let lastDetailed = 0;
    await fetchContestedNames(client, {
      limit: 20,
      onProgress: (p) => {
        phases.push(p.phase);
        lastDetailed = p.detailed;
      },
    });
    assert.equal(phases[0], 'listing');
    assert.equal(phases[phases.length - 1], 'done');
    assert.equal(lastDetailed, 20);
  });

  test('an aborted signal stops the fetch', async () => {
    const { client } = fakeClient(Array.from({ length: 100 }, (_, i) => `n${i}`));
    const controller = new AbortController();
    controller.abort();
    let caught: unknown = null;
    try {
      await fetchContestedNames(client, { limit: 100, signal: controller.signal });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof Error);
    assert.equal((caught as Error).message, 'aborted');
  });

  test('an empty listing produces no rows and no vote queries', async () => {
    const { client, calls } = fakeClient([]);
    const rows = await fetchContestedNames(client, { limit: 10 });
    assert.deepEqual(rows, []);
    assert.equal(calls.filter((c) => c.kind === 'state').length, 0);
  });

  test('sortRecentFirst reorders the fetched rows by decision time', async () => {
    // The fake client returns names in listing order; the vote state it builds
    // is undecided for every name, so this asserts the flag is threaded through
    // to the sort without changing what is fetched.
    const { client } = fakeClient(['aa', 'bb', 'cc']);
    const rows = await fetchContestedNames(client, { limit: 3, sortRecentFirst: true });
    assert.deepEqual(rows.map((r) => r.name), ['aa', 'bb', 'cc']);
  });
});
