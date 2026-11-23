// apps/desktop/src/lib/core-info.ts — Evo Titan
//
// The adapter for core.sansbank.dev/core-info — the public read-only Core-RPC
// surface the Sansbank address service shipped on 2026-11-23 (their
// docs/REPLY-evo-titan-core-info-20261123.md, our Ask 1). GET, no auth, no
// JSON-RPC envelope, `access-control-allow-origin: *` (measured), 300 requests
// per client IP per 15 min, 30 s per-network cache.
//
// This endpoint closed the project's biggest open item the day it shipped:
// TESTNET v24 IS ACTIVE — since core height 1,578,000, EHF signal at 1,565,132
// (measured live 2026-11-23, fixtures/core_info_testnet.json). Mainnet v24
// reads `started` — since 2,576,448, EHF signal at 2,573,022 — with the
// current window's statistics carried in bip9.statistics (captured at
// 481/3,226 with 863 elapsed; fixtures/core_info_mainnet.json).
//
// Shape notes (from the real captures, matching their doc):
//   - top-level keys: network, timestamp, cached, getnetworkinfo,
//     getblockchaininfo, getdeploymentinfo.
//   - a deployment carries `height` ONLY when active; read active/bip9.status
//     first. Active deployments also omit `bit` and `statistics`.
//   - `signalling` (the per-block -# string) is present only while a
//     deployment is signalling; it grows to window length and is deliberately
//     not rendered by the UI.
//   - bip9.timeout arrives JS-rounded (INT64_MAX through a double); nothing
//     here reads it.
//
// Pure: the transport is injected, and the deployment rows are normalised by
// the same deployments.ts the node-driven panels use.

import {
  deploymentRows,
  formatCoreVersion,
  type DeploymentInfo,
  type DeploymentRow,
} from './deployments.ts';

/** The endpoint, as shipped and measured. */
export const CORE_INFO_URL = 'https://core.sansbank.dev/core-info';

export type CoreInfoNetwork = 'mainnet' | 'testnet';

/** The body, only the fields the app reads. */
export interface CoreInfoBody {
  network: CoreInfoNetwork;
  timestamp?: string | number;
  cached?: boolean;
  getnetworkinfo: {
    version: number;
    subversion: string;
    protocolversion: number;
  };
  getblockchaininfo: {
    chain: string;
    blocks: number;
    headers: number;
    initialblockdownload: boolean;
    bestblockhash: string;
  };
  getdeploymentinfo: DeploymentInfo;
}

/** The normalized view the UI renders. */
export interface CoreInfoView {
  network: CoreInfoNetwork;
  cached: boolean | undefined;
  /** e.g. 24.0.3 from getnetworkinfo.version 240003. */
  coreVersion: string;
  subversion: string;
  chain: string;
  blocks: number;
  tipHash: string;
  height: number;
  /** v24 and evo_shares first, then the rest — same order rule as the panels. */
  deployments: DeploymentRow[];
}

/** The request URL for one network. */
export function coreInfoUrl(network: CoreInfoNetwork): string {
  return `${CORE_INFO_URL}?network=${network}`;
}

/**
 * Parse one reply. Refuses a body whose echoed `network` does not match the
 * one requested — a mismatch rendered as the other network's activation
 * state would be a silent lie, exactly like the DAPI adapter's rule.
 */
export function parseCoreInfo(body: CoreInfoBody, expected: CoreInfoNetwork): CoreInfoView {
  if (body.network !== expected) {
    throw new Error(`the endpoint replied for ${String(body.network)} when ${expected} was requested`);
  }
  if (!body.getdeploymentinfo || !body.getblockchaininfo || !body.getnetworkinfo) {
    throw new Error('the reply is missing a Core RPC section');
  }
  return {
    network: expected,
    cached: body.cached,
    coreVersion: formatCoreVersion(body.getnetworkinfo.version),
    subversion: body.getnetworkinfo.subversion,
    chain: body.getblockchaininfo.chain,
    blocks: body.getblockchaininfo.blocks,
    tipHash: body.getblockchaininfo.bestblockhash,
    height: body.getdeploymentinfo.height,
    deployments: deploymentRows(body.getdeploymentinfo),
  };
}

/**
 * Fetch and parse one network's core-info. The transport is injected so the
 * tests replay the captured fixtures; in the app this is the platform's own
 * fetch — the endpoint answers CORS with `*`, which is what lets a webview
 * call it directly.
 */
export async function fetchCoreInfo(
  network: CoreInfoNetwork,
  transport: (url: string) => Promise<string>,
): Promise<CoreInfoView> {
  const raw = await transport(coreInfoUrl(network));
  let body: CoreInfoBody;
  try {
    body = JSON.parse(raw) as CoreInfoBody;
  } catch {
    throw new Error('the endpoint replied with a body that is not JSON');
  }
  return parseCoreInfo(body, network);
}
