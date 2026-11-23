// apps/desktop/src/lib/fleet-live.test.ts — Evo Titan
//
// Unit tests for the live protx-list mapping, run against the REAL reply
// captured from dashpay/dashd:24.0.3 (fixtures/protx_list_wallet.json,
// 2026-11-23): one shared Regular node, proTxHash edcd1847…, registered at
// height 501, two 500 DASH shares, operatorReward 10, PoSe-banned at 501
// because no operator service ever started. If the node's reply shape changes,
// these tests fail before any screen can silently misrender.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  duffsToDash,
  shortHash,
  isShared,
  poseHealth,
  toLiveNodeView,
  toLiveNodeViews,
  summarizeFleet,
  REGULAR_COLLATERAL_DUFFS,
  EVO_COLLATERAL_DUFFS,
  type ProtxEntry,
} from './fleet-live.ts';

const entries: ProtxEntry[] = JSON.parse(
  readFileSync(new URL('./fixtures/protx_list_wallet.json', import.meta.url), 'utf8'),
) as ProtxEntry[];

test('the captured fixture is the shape the mapper reads', () => {
  assert.equal(entries.length, 1);
  const e = entries[0];
  assert.equal(e.type, 'Regular');
  assert.equal(e.proTxHash, 'edcd184777b90367f64273acb5696f317e835104883ab20dc49555bdcd41758d');
  assert.equal(e.operatorReward, 10);
  assert.equal(e.state.version, 3);
  assert.equal(e.state.shares?.length, 2);
  assert.equal(e.state.registeredHeight, 501);
});

test('duffsToDash divides by 1e8', () => {
  assert.equal(duffsToDash(100000000), 1);
  assert.equal(duffsToDash(50000000000), 500);
});

test('collateral constants are the sourced consensus values', () => {
  assert.equal(REGULAR_COLLATERAL_DUFFS, 1000 * 1e8); // src/evo/dmn_types.h, v24.0.3
  assert.equal(EVO_COLLATERAL_DUFFS, 4000 * 1e8);
});

test('shortHash truncates without dropping the tail', () => {
  const h = 'abcdef1234567890abcd';
  assert.equal(shortHash(h), 'abcdef…abcd');
  assert.equal(shortHash('short'), 'short');
});

test('isShared keys off the on-chain share table', () => {
  assert.ok(isShared(entries[0]));
  assert.ok(!isShared({ ...entries[0], state: { ...entries[0].state, shares: [] } }));
  const noShares = { ...entries[0], state: { ...entries[0].state } } as ProtxEntry;
  delete (noShares.state as { shares?: unknown }).shares;
  assert.ok(!isShared(noShares));
});

test('poseHealth: the unserviced fixture node is honestly banned, not enabled', () => {
  // PoSeBanHeight 501 with no revival: a registered node with no ProUpServTx
  // gets banned — the live UI must say so rather than paint everything green.
  assert.equal(poseHealth(entries[0]), 'banned');
  assert.equal(
    poseHealth({ ...entries[0], state: { ...entries[0].state, PoSeBanHeight: -1 } }),
    'enabled',
  );
  assert.equal(
    poseHealth({ ...entries[0], state: { ...entries[0].state, revocationReason: 1 } }),
    'revoked',
  );
});

test('toLiveNodeView flattens the shared node the way the screen renders it', () => {
  const v = toLiveNodeView(entries[0]);
  assert.equal(v.kind, 'regular');
  assert.equal(v.health, 'banned');
  assert.equal(v.operatorRewardPercent, 10);
  assert.equal(v.shares.length, 2);
  assert.equal(v.shares[0].amountDash, 500);
  assert.equal(v.shares[0].refundAddress, 'yUH4mSYrFB8wVNHkH3Y9NSHjfY1924EyNz');
  assert.equal(v.shares[0].ownerAddress, 'yhJp8asfaNrEhjs2WUrLNLqWMJMbmpFYQ9');
  assert.equal(v.shares[1].amountDash, 500);
  assert.deepEqual(v.earlyExit, { periodBlocks: 10000, penaltyDuffs: 1000000000 });
  assert.equal(v.walletHasOwnerKey, true);
  assert.equal(v.walletOwnsCollateral, false);
});

test('an Evo entry maps to kind evo and the 4000 DASH collateral', () => {
  const evo = toLiveNodeView({ ...entries[0], type: 'Evo' });
  assert.equal(evo.kind, 'evo');
  assert.equal(evo.collateralDuffs, EVO_COLLATERAL_DUFFS);
});

test('summarizeFleet derives every header figure from the list itself', () => {
  const s = summarizeFleet(entries);
  assert.equal(s.total, 1);
  assert.equal(s.shared, 1);
  assert.equal(s.evos, 0);
  assert.equal(s.poseBanned, 1);
  assert.equal(s.revoked, 0);
  assert.equal(s.totalCollateralDash, 1000);
  assert.equal(s.sharesOnChain, 2);
  const empty = summarizeFleet([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.totalCollateralDash, 0);
});

test('toLiveNodeViews maps a whole list one-to-one', () => {
  const views = toLiveNodeViews(entries);
  assert.equal(views.length, entries.length);
  assert.equal(views[0].proTxHash, entries[0].proTxHash);
});
