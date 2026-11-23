// apps/desktop/src/lib/fleet-live.ts — Evo Titan
//
// Mapping from live `protx list <filter> true` entries to the rows the fleet
// and shared screens render. Pure: the shapes come from a real reply captured
// from dashpay/dashd:24.0.3 (fixtures/protx_list_wallet.json, 2026-11-23),
// not from imagination — every field read here appears in that fixture.
//
// Two facts from that capture shape this file:
//   - The share table nests under `state.shares` for a version-3 node, and
//     `protx info` nests it the same way.
//   - `protx list wallet` answers `-1 "protx list wallet" not supported when
//     wallet is disabled` over HTTP 500 when no wallet is loaded — the UI must
//     surface that as a plain error, not a transport failure.

/** One on-chain share of a shared (version 3) masternode. */
export interface ProtxShare {
  /** Duffs. At least 100 DASH per share (providertx.h:58). */
  amount: number;
  refundAddress: string;
  rewardAddress: string;
  ownerAddress: string;
}

/** The state block of a protx list entry; only the fields the UI reads. */
export interface ProtxState {
  version: number;
  registeredHeight: number;
  lastPaidHeight: number;
  consecutivePayments: number;
  PoSePenalty: number;
  PoSeRevivedHeight: number;
  PoSeBanHeight: number;
  revocationReason: number;
  votingAddress: string;
  /** Present on shared (version 3) nodes. */
  shares?: ProtxShare[];
  /** Exit terms, fixed at registration. */
  earlyPeriodBlocks?: number;
  earlyPenalty?: number;
}

/** One `protx list <filter> true` entry; only the fields the UI reads. */
export interface ProtxEntry {
  type: string;
  proTxHash: string;
  collateralHash: string;
  collateralIndex: number;
  /** Percent, 0-100: the node round-trips the registration argument as-is. */
  operatorReward: number;
  state: ProtxState;
  wallet?: {
    hasOwnerKey: boolean;
    hasOperatorKey: boolean;
    hasVotingKey: boolean;
    ownsCollateral: boolean;
    ownsPayeeScript: boolean;
  };
}

/** Sourced consensus collateral per node type (src/evo/dmn_types.h, v24.0.3). */
export const REGULAR_COLLATERAL_DUFFS = 1000 * 1e8;
export const EVO_COLLATERAL_DUFFS = 4000 * 1e8;

/** Duffs to DASH for display. One DASH is 1e8 duffs. */
export function duffsToDash(duffs: number): number {
  return duffs / 1e8;
}

/** A short, copyable-looking truncation of a hash for table rows. */
export function shortHash(hash: string): string {
  return hash && hash.length > 12 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash;
}

/** Does this entry carry an on-chain share table? */
export function isShared(entry: ProtxEntry): boolean {
  return Array.isArray(entry.state?.shares) && (entry.state.shares as ProtxShare[]).length > 0;
}

/** The honest PoSe health of a node, derived the way the node reports it. */
export type PoseHealth = 'enabled' | 'banned' | 'revoked';

export function poseHealth(entry: ProtxEntry): PoseHealth {
  const s = entry.state;
  if (s && typeof s.revocationReason === 'number' && s.revocationReason !== 0) return 'revoked';
  if (s && typeof s.PoSeBanHeight === 'number' && s.PoSeBanHeight > 0) return 'banned';
  return 'enabled';
}

/** A share flattened for rendering. */
export interface ShareView {
  amountDash: number;
  refundAddress: string;
  rewardAddress: string;
  ownerAddress: string;
}

/** A node flattened for rendering. */
export interface LiveNodeView {
  proTxHash: string;
  shortProTx: string;
  kind: 'regular' | 'evo';
  collateralDuffs: number;
  operatorRewardPercent: number;
  health: PoseHealth;
  registeredHeight: number;
  lastPaidHeight: number;
  posePenalty: number;
  poseBanHeight: number;
  votingAddress: string;
  walletHasOwnerKey: boolean | undefined;
  walletOwnsCollateral: boolean | undefined;
  shares: ShareView[];
  earlyExit: { periodBlocks: number; penaltyDuffs: number } | undefined;
}

/** Map one protx list entry to the row the UI renders. */
export function toLiveNodeView(entry: ProtxEntry): LiveNodeView {
  const shares = isShared(entry) ? (entry.state.shares as ProtxShare[]) : [];
  return {
    proTxHash: entry.proTxHash,
    shortProTx: shortHash(entry.proTxHash),
    kind: entry.type === 'Evo' ? 'evo' : 'regular',
    collateralDuffs: entry.type === 'Evo' ? EVO_COLLATERAL_DUFFS : REGULAR_COLLATERAL_DUFFS,
    operatorRewardPercent: entry.operatorReward,
    health: poseHealth(entry),
    registeredHeight: entry.state.registeredHeight,
    lastPaidHeight: entry.state.lastPaidHeight,
    posePenalty: entry.state.PoSePenalty,
    poseBanHeight: entry.state.PoSeBanHeight,
    votingAddress: entry.state.votingAddress,
    walletHasOwnerKey: entry.wallet?.hasOwnerKey,
    walletOwnsCollateral: entry.wallet?.ownsCollateral,
    shares: shares.map((s) => ({
      amountDash: duffsToDash(s.amount),
      refundAddress: s.refundAddress,
      rewardAddress: s.rewardAddress,
      ownerAddress: s.ownerAddress,
    })),
    earlyExit:
      typeof entry.state.earlyPeriodBlocks === 'number' &&
      typeof entry.state.earlyPenalty === 'number'
        ? { periodBlocks: entry.state.earlyPeriodBlocks, penaltyDuffs: entry.state.earlyPenalty }
        : undefined,
  };
}

/** Map a whole list. */
export function toLiveNodeViews(entries: ProtxEntry[]): LiveNodeView[] {
  return entries.map(toLiveNodeView);
}

/** Fleet-level counts for the header row, derived from the live list. */
export interface FleetSummary {
  total: number;
  shared: number;
  evos: number;
  poseBanned: number;
  revoked: number;
  totalCollateralDash: number;
  sharesOnChain: number;
}

export function summarizeFleet(entries: ProtxEntry[]): FleetSummary {
  const views = toLiveNodeViews(entries);
  return {
    total: views.length,
    shared: views.filter((v) => v.shares.length > 0).length,
    evos: views.filter((v) => v.kind === 'evo').length,
    poseBanned: views.filter((v) => v.health === 'banned').length,
    revoked: views.filter((v) => v.health === 'revoked').length,
    totalCollateralDash: duffsToDash(views.reduce((sum, v) => sum + v.collateralDuffs, 0)),
    sharesOnChain: views.reduce((sum, v) => sum + v.shares.length, 0),
  };
}
