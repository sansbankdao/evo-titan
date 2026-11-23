// apps/desktop/src/lib/core-info.test.ts — Evo Titan
//
// Unit tests for the core.sansbank.dev/core-info adapter, run against the REAL
// bodies captured live on 2026-11-23 (fixtures/core_info_*.json) — the day the
// endpoint closed the project's testnet-v24-activation open item: testnet v24
// reads active since 1,578,000; mainnet reads started with window statistics.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CORE_INFO_URL,
  coreInfoUrl,
  fetchCoreInfo,
  parseCoreInfo,
  type CoreInfoBody,
} from './core-info.ts';

const load = (n: 'testnet' | 'mainnet'): CoreInfoBody =>
  JSON.parse(readFileSync(new URL(`./fixtures/core_info_${n}.json`, import.meta.url), 'utf8')) as CoreInfoBody;

test('the captured bodies are the shape the adapter reads', () => {
  const t = load('testnet');
  const m = load('mainnet');
  assert.equal(t.network, 'testnet');
  assert.equal(m.network, 'mainnet');
  assert.equal(t.getnetworkinfo.version, 240003);
  assert.equal(t.getnetworkinfo.subversion, '/Dash Core:24.0.3/');
  assert.equal(typeof t.timestamp !== 'undefined', true); // present though their doc omits it
});

test('TESTNET v24 IS ACTIVE — the open item this endpoint closed', () => {
  const v = parseCoreInfo(load('testnet'), 'testnet');
  const v24 = v.deployments.find((r) => r.id === 'v24');
  assert.equal(v24?.active, true);
  assert.equal(v24?.status, 'active');
  assert.equal(v24?.since, 1578000);
  assert.equal(v.coreVersion, '24.0.3');
  assert.equal(v.chain, 'test');
  assert.equal(v.height, v.blocks); // deployment read at the tip
  // evo_shares stays defined — no v24.0.x release signs it (release notes).
  const evo = v.deployments.find((r) => r.id === 'evo_shares');
  assert.equal(evo?.active, false);
  assert.equal(evo?.status, 'defined');
  assert.equal(evo?.ehf, true);
});

test('MAINNET v24 reads started with the EHF-gated facts intact', () => {
  const v = parseCoreInfo(load('mainnet'), 'mainnet');
  const v24 = v.deployments.find((r) => r.id === 'v24');
  assert.equal(v24?.active, false);
  assert.equal(v24?.status, 'started');
  assert.equal(v24?.since, 2576448);
  assert.equal(v24?.ehf, true);
  // The activation sequence, pinned: EHF signal was mined at 2,573,022, so
  // miner signalling began at the next 4032-boundary, 2,576,448 — the
  // `since` above. (v24.0.1 release notes describe exactly this sequence.)
  const evo = v.deployments.find((r) => r.id === 'evo_shares');
  assert.equal(evo?.status, 'defined');
  assert.equal(v.chain, 'main');
});

test('key deployments come first in the parsed rows', () => {
  const v = parseCoreInfo(load('mainnet'), 'mainnet');
  assert.deepEqual(
    v.deployments.slice(0, 2).map((r) => r.id),
    ['v24', 'evo_shares'],
  );
});

test('a reply for the wrong network is refused, not rendered', () => {
  assert.throws(() => parseCoreInfo(load('mainnet'), 'testnet'), /replied for mainnet/);
  assert.throws(() => parseCoreInfo(load('testnet'), 'mainnet'), /replied for testnet/);
});

test('a body missing a Core section is refused rather than half-rendered', () => {
  const broken = { ...load('testnet') } as Partial<CoreInfoBody>;
  delete broken.getdeploymentinfo;
  assert.throws(() => parseCoreInfo(broken as CoreInfoBody, 'testnet'), /missing a Core RPC section/);
});

test('coreInfoUrl builds the documented query', () => {
  assert.equal(coreInfoUrl('testnet'), `${CORE_INFO_URL}?network=testnet`);
  assert.equal(coreInfoUrl('mainnet'), `${CORE_INFO_URL}?network=mainnet`);
});

test('fetchCoreInfo transports the query and parses the captured reply', async () => {
  const seen: string[] = [];
  const v = await fetchCoreInfo('testnet', async (url) => {
    seen.push(url);
    return JSON.stringify(load('testnet'));
  });
  assert.deepEqual(seen, [coreInfoUrl('testnet')]);
  assert.equal(v.network, 'testnet');
  assert.equal(v.deployments.find((r) => r.id === 'v24')?.since, 1578000);
});

test('a non-JSON reply is a thrown error, not a crash', async () => {
  await assert.rejects(fetchCoreInfo('mainnet', async () => '<html>403</html>'), /not JSON/);
});
