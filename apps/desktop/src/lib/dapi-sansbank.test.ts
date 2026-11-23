// apps/desktop/src/lib/dapi-sansbank.test.ts — Evo Titan
//
// Unit tests for the Sansbank DAPI proxy adapter, run against the REAL
// envelopes captured live on 2026-11-23 (fixtures/dapi_sansbank_status_*.json).
// Those captures are the ground truth for the shape: camelCase fields, heights
// as strings, hashes as hex, the {success, method, params, network, result}
// envelope, and the coreChainLockedHeight the public seed does not offer.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SANSBANK_DAPI_URL,
  fetchSansbankStatus,
  parseSansbankStatus,
  sansbankStatusRequest,
  type SansbankEnvelope,
  type SansbankStatusResult,
} from './dapi-sansbank.ts';

const load = (n: 'testnet' | 'mainnet'): SansbankEnvelope<SansbankStatusResult> =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/dapi_sansbank_status_${n}.json`, import.meta.url), 'utf8'),
  ) as SansbankEnvelope<SansbankStatusResult>;

test('the captured envelopes are the shape the adapter reads', () => {
  const t = load('testnet');
  const m = load('mainnet');
  assert.equal(t.success, true);
  assert.equal(t.network, 'testnet');
  assert.equal(m.network, 'mainnet');
  assert.equal(typeof t.result?.chain.coreChainLockedHeight, 'number');
  assert.equal(typeof t.result?.chain.latestBlockHeight, 'string');
  assert.match(t.result?.chain.latestBlockHash ?? '', /^[0-9a-f]{64}$/);
});

test('the request uses the proxy SDK name, not the DAPI JSON-RPC name', () => {
  // The first handoff probed "getStatus" and got Method-not-supported; the
  // proxy speaks "get_status". Pin both facts so neither regresses silently.
  assert.equal(sansbankStatusRequest('testnet'), '{"method":"get_status","params":[],"network":"testnet"}');
  assert.ok(!sansbankStatusRequest('mainnet').includes('getStatus'));
});

test('parseSansbankStatus normalises the captured testnet envelope', () => {
  const v = parseSansbankStatus(load('testnet'), 'testnet');
  assert.equal(v.network, 'testnet');
  assert.equal(v.chainId, 'dash-testnet-51');
  assert.equal(v.catchingUp, false);
  // The string platform height becomes a number; the core height stays one.
  assert.equal(v.platformHeight, 733493);
  assert.equal(v.coreChainLockedHeight, 1597324);
  assert.match(v.dapiVersion, /^5\./);
  assert.equal(v.driveVersion, v.dapiVersion);
  assert.ok(v.peersCount > 0);
});

test('parseSansbankStatus normalises the captured mainnet envelope', () => {
  const v = parseSansbankStatus(load('mainnet'), 'mainnet');
  assert.equal(v.network, 'mainnet');
  assert.equal(v.chainId, 'evo1');
  assert.equal(v.coreChainLockedHeight, 2577299);
  // Cross-check against the core chain measured the same day: blockchair had
  // the mainnet tip at 2,577,229 at 19:07:53Z; the chain-locked height cannot
  // run ahead of the tip, and four hours later 2,577,299 is consistent.
  assert.ok(v.coreChainLockedHeight > 2577229);
});

test('a success:false envelope throws with the proxy own error text', () => {
  const err = load('testnet') as unknown as SansbankEnvelope<SansbankStatusResult>;
  const failing: SansbankEnvelope<SansbankStatusResult> = {
    ...err,
    success: false,
    error: "Method 'getStatus' is not supported.",
    result: undefined,
  };
  assert.throws(() => parseSansbankStatus(failing, 'testnet'), /getStatus/);
});

test('a reply for the wrong network is refused, not rendered', () => {
  assert.throws(() => parseSansbankStatus(load('mainnet'), 'testnet'), /replied for mainnet/);
  assert.throws(() => parseSansbankStatus(load('testnet'), 'mainnet'), /replied for testnet/);
});

test('an unparseable platform height is refused rather than guessed', () => {
  const bad = load('testnet');
  const poisoned: SansbankEnvelope<SansbankStatusResult> = {
    ...bad,
    result: { ...bad.result!, chain: { ...bad.result!.chain, latestBlockHeight: 'later' } },
  };
  assert.throws(() => parseSansbankStatus(poisoned, 'testnet'), /unparseable platform height/);
});

test('fetchSansbankStatus transports the SDK-shaped body and parses the reply', async () => {
  const seen: Array<{ url: string; body: string }> = [];
  const view = await fetchSansbankStatus('mainnet', async (url, body) => {
    seen.push({ url, body });
    return JSON.stringify(load('mainnet'));
  });
  assert.deepEqual(seen, [{ url: SANSBANK_DAPI_URL, body: sansbankStatusRequest('mainnet') }]);
  assert.equal(view.chainId, 'evo1');
  assert.equal(view.coreChainLockedHeight, 2577299);
});

test('a non-JSON transport reply is a thrown error, not a crash', async () => {
  await assert.rejects(
    fetchSansbankStatus('testnet', async () => '<html>Cannot POST</html>'),
    /not JSON/,
  );
});
