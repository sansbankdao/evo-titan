// apps/desktop/src/lib/deployments.test.ts — Evo Titan
//
// Unit tests for the getdeploymentinfo normalisation, run against a REAL reply
// captured from dashpay/dashd:24.0.3 on regtest (fixtures/deploymentinfo.json,
// 2026-11-23). That capture is the ground truth for the shapes: v24 active
// since 300 with ehf false (the regtest vbparams bypass), evo_shares defined
// with ehf true — the deployment no v24.0.x release signs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deploymentRows, formatCoreVersion, KEY_DEPLOYMENTS, type DeploymentInfo } from './deployments.ts';

const fixture: DeploymentInfo = JSON.parse(
  readFileSync(new URL('./fixtures/deploymentinfo.json', import.meta.url), 'utf8'),
) as DeploymentInfo;

test('the captured fixture is the shape the mapper reads', () => {
  // Captured after the 2-share registration confirmed at height 501.
  assert.equal(fixture.height, 501);
  assert.ok(fixture.deployments.v24);
  assert.ok(fixture.deployments.evo_shares);
  assert.equal(fixture.deployments.v24.active, true);
  assert.equal(fixture.deployments.v24.bip9?.status, 'active');
  assert.equal(fixture.deployments.evo_shares.active, false);
  assert.equal(fixture.deployments.evo_shares.bip9?.status, 'defined');
  assert.equal(fixture.deployments.evo_shares.bip9?.ehf, true);
});

test('key deployments come first, in product order', () => {
  const rows = deploymentRows(fixture);
  assert.deepEqual(
    rows.slice(0, KEY_DEPLOYMENTS.length).map((r) => r.id),
    ['v24', 'evo_shares'],
  );
});

test('every deployment appears exactly once, after the key ones', () => {
  const rows = deploymentRows(fixture);
  const ids = rows.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of Object.keys(fixture.deployments)) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
});

test('v24 reads active-at-300 from the fixture; evo_shares reads defined and EHF-gated', () => {
  const rows = deploymentRows(fixture);
  const v24 = rows.find((r) => r.id === 'v24');
  const evo = rows.find((r) => r.id === 'evo_shares');
  assert.equal(v24?.active, true);
  assert.equal(v24?.status, 'active');
  assert.equal(v24?.since, 300);
  assert.equal(v24?.ehf, false);
  assert.equal(evo?.active, false);
  assert.equal(evo?.status, 'defined');
  assert.equal(evo?.ehf, true);
});

test('buried deployments map to a row without bip9 detail', () => {
  const rows = deploymentRows(fixture);
  const dip3 = rows.find((r) => r.id === 'dip0003');
  assert.equal(dip3?.kind, 'buried');
  assert.equal(dip3?.ehf, false);
  // dip0003 activates at height 432 (chainparams, regtest).
  assert.equal(dip3?.since, 432);
});

test('formatCoreVersion follows the node encoding major*10000+minor*100+patch', () => {
  assert.equal(formatCoreVersion(240003), '24.0.3');
  assert.equal(formatCoreVersion(240000), '24.0.0');
  assert.equal(formatCoreVersion(220000), '22.0.0');
  assert.equal(formatCoreVersion(240100), '24.1.0');
  // Non-integers and negatives pass through rather than inventing digits.
  assert.equal(formatCoreVersion(-1), '-1');
  assert.equal(formatCoreVersion(1.5), '1.5');
});
