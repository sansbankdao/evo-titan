// apps/desktop/src/lib/deployments.ts — Evo Titan
//
// Normalisation for `getdeploymentinfo` — the v24 method that reports every
// consensus deployment's activation state. v24 dropped `deployments` (and the
// older `softforks`) from `getblockchaininfo` entirely (verified live against
// 24.0.3 on 2026-11-23: the reply carries neither key), so this is THE method
// for reading whether v24 / evo_shares is active on a connected network.
//
// The fixture beside this file (fixtures/deploymentinfo.json) is a real reply
// captured from dashpay/dashd:24.0.3 on regtest that day, where v24 reads
// active and evo_shares (ehf: true, unsigned by any v24.0.x release) reads
// defined — the exact contrast the UI has to be able to render.

/** One deployment as the node reports it (only the fields the UI reads). */
export interface RawDeployment {
  type: 'buried' | 'bip9' | string;
  /** For buried deployments: the height it became active. */
  height?: number;
  active: boolean;
  /** For bip9 deployments: the signalling detail. */
  bip9?: {
    start_time: number;
    timeout: number;
    ehf: boolean;
    min_activation_height: number;
    status: string;
    since: number;
    status_next: string;
  };
}

/** The parts of a `getdeploymentinfo` reply the UI reads. */
export interface DeploymentInfo {
  hash: string;
  height: number;
  deployments: Record<string, RawDeployment>;
}

/** One flattened row for rendering. */
export interface DeploymentRow {
  id: string;
  kind: 'buried' | 'bip9';
  active: boolean;
  /** bip9 status string ('active', 'defined', 'started', 'locked_in', 'failed'). */
  status: string;
  /** Height the deployment started counting / activated, if reported. */
  since: number | undefined;
  /** True when masternode EHF signalling gates this deployment (v24, evo_shares). */
  ehf: boolean;
}

/** The deployments this product actually makes decisions on, in display order. */
export const KEY_DEPLOYMENTS = ['v24', 'evo_shares'] as const;

/** Extract exactly the rows the UI shows, key deployments first. */
export function deploymentRows(info: DeploymentInfo): DeploymentRow[] {
  const rows: DeploymentRow[] = [];
  const push = (id: string): void => {
    const d = info.deployments[id];
    if (!d) return;
    rows.push({
      id,
      kind: d.type === 'buried' ? 'buried' : 'bip9',
      active: d.active === true,
      status: d.bip9 ? d.bip9.status : d.active ? 'active' : 'unknown',
      since: d.bip9 ? d.bip9.since : d.height,
      ehf: d.bip9 ? d.bip9.ehf === true : false,
    });
  };
  for (const id of KEY_DEPLOYMENTS) push(id);
  for (const id of Object.keys(info.deployments)) {
    if (!rows.some((r) => r.id === id)) push(id);
  }
  return rows;
}

/**
 * Format a Dash Core numeric version the way the node itself prints it.
 * The encoding is major*10000 + minor*100 + patch: 240003 = 24.0.3
 * (measured: v24.0.3 reports 240003 and subversion "/Dash Core:24.0.3/").
 */
export function formatCoreVersion(version: number): string {
  if (!Number.isInteger(version) || version < 0) return String(version);
  const major = Math.floor(version / 10000);
  const minor = Math.floor(version / 100) % 100;
  const patch = version % 100;
  return `${major}.${minor}.${patch}`;
}
