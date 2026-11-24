// apps/desktop/src/lib/coordination.test.ts — Evo Titan
//
// Unit tests for the Phase 2 core, pinned to the REAL node replies captured
// from dashpay/dashd:24.0.3 on 2026-11-23 (fixtures/shared_register_prepare.json,
// fixtures/shared_sign.json — a 3-share pool of 500/300/200 DASH) and to the
// consensus rules each validation mirrors.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MIN_SHARES,
  MAX_SHARES,
  MIN_SHARE_DUFFS,
  REGULAR_COLLATERAL_DUFFS,
  formatOperatorReward,
  validateAssembly,
  buildEnvelope,
  encodeEnvelope,
  decodeEnvelope,
  buildSignatureArtifacts,
  encodeSignatureArtifact,
  decodeSignatureArtifact,
  collectSignatures,
  type AssemblyTerms,
  type PrepareReply,
  type ShareInput,
  type SignReply,
} from './coordination.ts';

const prepare: PrepareReply = JSON.parse(
  readFileSync(new URL('./fixtures/shared_register_prepare.json', import.meta.url), 'utf8'),
) as PrepareReply;
const sign: SignReply = JSON.parse(
  readFileSync(new URL('./fixtures/shared_sign.json', import.meta.url), 'utf8'),
) as SignReply;

/** The share table that produced the captured prepare fixture (500/300/200). */
const FIXTURE_SHARES: ShareInput[] = prepare.terms.shares.map((s) => ({
  amountDuffs: s.amount,
  refundAddress: s.refundAddress,
  ownerAddress: s.ownerAddress,
}));

const goodTerms: AssemblyTerms = {
  shares: FIXTURE_SHARES,
  operatorPubKey: prepare.terms.pubKeyOperator,
  votingAddress: prepare.terms.votingAddress,
  operatorRewardPercent: '10.00',
  earlyPeriodBlocks: 10000,
  earlyPenaltyDuffs: 1000000000,
  coreP2PAddrs: '',
};

// ---------- sourced constants ----------

test('sourced constants', () => {
  assert.equal(MIN_SHARES, 2);
  assert.equal(MAX_SHARES, 8);
  assert.equal(MIN_SHARE_DUFFS, 100 * 1e8); // providertx.h:58
  assert.equal(REGULAR_COLLATERAL_DUFFS, 1000 * 1e8); // dmn_types.h
});

test('formatOperatorReward renders the node percent-string argument', () => {
  assert.equal(formatOperatorReward(10), '10.00');
  assert.equal(formatOperatorReward(0), '0.00');
  assert.equal(formatOperatorReward(100), '100.00');
  assert.equal(formatOperatorReward(7.5), '7.50');
});

// ---------- validation ----------

test('the captured 3-share table passes validation', () => {
  assert.deepEqual(validateAssembly(goodTerms), []);
});

test('share-count bounds mirror providertx.h:142-143', () => {
  const one = validateAssembly({ ...goodTerms, shares: goodTerms.shares.slice(0, 1) });
  assert.ok(one.some((e) => e.includes('2–8 shares')));
  const nineAmounts = [112, 112, 112, 112, 112, 112, 112, 112, 104]; // sums to 1000
  const nine = validateAssembly({
    ...goodTerms,
    shares: nineAmounts.map((dash, i) => ({
      amountDuffs: dash * 1e8,
      refundAddress: `refund-${i}`,
      ownerAddress: `owner-${i}`,
    })),
  });
  assert.ok(nine.some((e) => e.includes('2–8 shares')));
});

test('the sum rule mirrors bad-protx-shares-amount-sum', () => {
  const wrong = validateAssembly({
    ...goodTerms,
    shares: [
      { amountDuffs: 500 * 1e8, refundAddress: 'ra', ownerAddress: 'oa' },
      { amountDuffs: 300 * 1e8, refundAddress: 'rb', ownerAddress: 'ob' },
    ],
  });
  assert.ok(wrong.some((e) => e.includes('sum to exactly')));
  // and the exact 1,000 passes
  const right = validateAssembly({
    ...goodTerms,
    shares: [
      { amountDuffs: 500 * 1e8, refundAddress: 'ra', ownerAddress: 'oa' },
      { amountDuffs: 500 * 1e8, refundAddress: 'rb', ownerAddress: 'ob' },
    ],
  });
  assert.ok(!right.some((e) => e.includes('sum to exactly')));
});

test('the 100 DASH minimum mirrors providertx.h:58', () => {
  const err = validateAssembly({
    ...goodTerms,
    shares: [
      { amountDuffs: 900 * 1e8, refundAddress: 'ra', ownerAddress: 'oa' },
      { amountDuffs: 99 * 1e8, refundAddress: 'rb', ownerAddress: 'ob' },
    ],
  });
  assert.ok(err.some((e) => e.includes('100 DASH minimum')));
});

test('duplicate refunds and owners mirror the dup rejections', () => {
  const err = validateAssembly({
    ...goodTerms,
    shares: [
      { amountDuffs: 500 * 1e8, refundAddress: 'same', ownerAddress: 'oa' },
      { amountDuffs: 500 * 1e8, refundAddress: 'same', ownerAddress: 'ob' },
    ],
  });
  assert.ok(err.some((e) => e.includes('bad-protx-shares-dup-refund')));
  const err2 = validateAssembly({
    ...goodTerms,
    shares: [
      { amountDuffs: 500 * 1e8, refundAddress: 'ra', ownerAddress: 'same' },
      { amountDuffs: 500 * 1e8, refundAddress: 'rb', ownerAddress: 'same' },
    ],
  });
  assert.ok(err2.some((e) => e.includes('bad-protx-shares-dup-key')));
});

test('payee-reuse rules: refund/reward vs owner, voting vs every payee', () => {
  const err = validateAssembly({
    ...goodTerms,
    shares: [
      { amountDuffs: 500 * 1e8, refundAddress: 'ra', ownerAddress: 'ra' },
      { amountDuffs: 500 * 1e8, refundAddress: 'rb', ownerAddress: 'ob' },
    ],
  });
  assert.ok(err.some((e) => e.includes('bad-protx-shares-payee-reuse')));
  const err2 = validateAssembly({
    ...goodTerms,
    votingAddress: 'ra',
    shares: [
      { amountDuffs: 500 * 1e8, refundAddress: 'ra', ownerAddress: 'oa' },
      { amountDuffs: 500 * 1e8, refundAddress: 'rb', ownerAddress: 'ob' },
    ],
  });
  assert.ok(err2.some((e) => e.includes('voting address must differ')));
});

test('the percent-string rule refuses numbers and out-of-range values', () => {
  assert.ok(validateAssembly({ ...goodTerms, operatorRewardPercent: '10' }).some((e) => e.includes('percent string')));
  assert.ok(validateAssembly({ ...goodTerms, operatorRewardPercent: '150.00' }).some((e) => e.includes('percent string')));
});

test('the early-penalty rules mirror the help text', () => {
  const err = validateAssembly({ ...goodTerms, earlyPeriodBlocks: 0, earlyPenaltyDuffs: 1 });
  assert.ok(err.some((e) => e.includes('penalty must be zero')));
  const err2 = validateAssembly({ ...goodTerms, earlyPenaltyDuffs: 500 * 1e8 });
  assert.ok(err2.some((e) => e.includes('below the smallest share')));
});

// ---------- envelope ----------

test('the captured prepare reply has the fixture flow shape', () => {
  assert.match(prepare.consentHash, /^[0-9a-f]{64}$/);
  assert.equal(prepare.terms.shares.length, 3);
  assert.equal(prepare.terms.shares[0].amount, 500 * 1e8);
  assert.equal(prepare.terms.shares[1].amount, 300 * 1e8);
  assert.equal(prepare.terms.shares[2].amount, 200 * 1e8);
  assert.equal(prepare.terms.operatorReward, 10);
  // Non-zero penalty => no warning field (measured on 24.0.3).
  assert.equal('warning' in prepare, false);
});

test('the captured sign reply carries a signature per share', () => {
  assert.equal(sign.signatures.length, 3);
  assert.deepEqual(sign.signatures.map((s) => s.shareIndex), [0, 1, 2]);
  for (const s of sign.signatures) assert.ok(s.signature.length > 20);
});

test('envelope round-trips and refuses foreign or truncated documents', () => {
  const env = buildEnvelope('regtest', prepare, goodTerms);
  const raw = encodeEnvelope(env);
  const back = decodeEnvelope(raw);
  assert.equal(back.prepare.consentHash, prepare.consentHash);
  assert.equal(back.assembly.shares.length, 3);
  assert.equal(back.network, 'regtest');

  assert.throws(() => decodeEnvelope('{not json'), /not valid JSON/);
  assert.throws(() => decodeEnvelope(JSON.stringify({ kind: 'other', version: 1 })), /not a shared-registration envelope/);
  const noConsent = JSON.parse(raw) as { prepare: { consentHash: string } };
  noConsent.prepare.consentHash = 'zz';
  assert.throws(() => decodeEnvelope(JSON.stringify(noConsent)), /no valid consent hash/);
  const noShares = JSON.parse(raw) as { prepare: { terms: { shares: unknown[] } } };
  noShares.prepare.terms.shares = [{}];
  assert.throws(() => decodeEnvelope(JSON.stringify(noShares)), /no share table/);
});

// ---------- signature artifacts ----------

test('signature artifacts build from the captured sign reply and round-trip', () => {
  const artifact = buildSignatureArtifacts('regtest', prepare.consentHash, sign);
  const back = decodeSignatureArtifact(encodeSignatureArtifact(artifact));
  assert.equal(back.consentHash, prepare.consentHash);
  assert.deepEqual(back.signatures.map((s) => s.shareIndex), [0, 1, 2]);
});

test('a signature artifact refuses garbage and out-of-range indices', () => {
  assert.throws(() => decodeSignatureArtifact('nope'), /not valid JSON/);
  assert.throws(() => decodeSignatureArtifact(JSON.stringify({ kind: 'x' })), /not a shared-registration signature/);
  const bad = { kind: 'evo-titan.shared-registration-signature', version: 1, consentHash: 'a'.repeat(64), signatures: [{ shareIndex: 9, signature: 's' }] };
  assert.throws(() => decodeSignatureArtifact(JSON.stringify(bad)), /bad shareIndex/);
});

// ---------- collection ----------

test('collection: complete when every share is covered exactly once', () => {
  const artifact = buildSignatureArtifacts('regtest', prepare.consentHash, sign);
  const state = collectSignatures(3, prepare.consentHash, [artifact]);
  assert.deepEqual(state.collected, [0, 1, 2]);
  assert.deepEqual(state.missing, []);
  assert.equal(state.complete, true);
});

test('collection: partial signatures report exactly what is missing', () => {
  const partial = buildSignatureArtifacts('regtest', prepare.consentHash, {
    ...sign,
    signatures: sign.signatures.slice(0, 2),
  });
  const state = collectSignatures(3, prepare.consentHash, [partial]);
  assert.deepEqual(state.collected, [0, 1]);
  assert.deepEqual(state.missing, [2]);
  assert.equal(state.complete, false);
});

test('collection: a signature for ANOTHER session is refused whole', () => {
  const foreign = buildSignatureArtifacts('regtest', 'f'.repeat(64), sign);
  const state = collectSignatures(3, prepare.consentHash, [foreign]);
  assert.equal(state.collected.length, 0);
  assert.equal(state.complete, false);
  assert.deepEqual(state.refused, [0, 1, 2]);
});

test('collection: duplicates are reported, not double-counted', () => {
  const a = buildSignatureArtifacts('regtest', prepare.consentHash, sign);
  const b = buildSignatureArtifacts('regtest', prepare.consentHash, {
    ...sign,
    signatures: sign.signatures.slice(0, 1),
  });
  const state = collectSignatures(3, prepare.consentHash, [a, b]);
  assert.equal(state.complete, true);
  assert.deepEqual(state.duplicates, [0]);
  assert.deepEqual(state.collected, [0, 1, 2]);
});
