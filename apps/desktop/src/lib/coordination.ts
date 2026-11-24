// apps/desktop/src/lib/coordination.ts — Evo Titan
//
// THE PHASE 2 CORE: pool assembly, the consent envelope, owner signatures and
// collection — all pure, all tested. Desktop-only by design: nothing here
// touches a server; the envelope and signature artifacts are JSON documents
// that travel between desktops by whatever channel their owners choose
// (file, clipboard, message), and every key operation happens in the wallet
// of the machine that owns the key.
//
// Every validation below mirrors a consensus rule the node enforces anyway —
// the UI checks early so a mistake is a field error instead of a rejected
// transaction, but the NODE remains the source of truth and its errors are
// shown verbatim. Sourced constants (Dash Core v24.0.3):
//   - 2..8 shares            src/evo/providertx.h:142-143 (MIN_SHARES/MAX_SHARES)
//   - >= 100 DASH per share  src/evo/providertx.h:58 (CCollateralShare::MIN_AMOUNT)
//   - sum == collateral      providertx.cpp:93 (bad-protx-shares-amount-sum)
//   - distinct refunds       providertx.cpp:123 (bad-protx-shares-dup-refund)
//   - distinct owner keys    providertx.cpp:120 (bad-protx-shares-dup-key)
//   - refund/reward distinct from owner and voting  providertx.cpp:132-141
//     (bad-protx-shares-payee-reuse)
//   - operatorReward is a PERCENT STRING "0.00".."100.00" (rpc/evo.cpp help;
//     ParseFixedPoint(val, 2) — verified against live nodes 2026-09-27 and
//     2026-11-23)
//   - earlyPenalty < smallest share, and zero when the period is zero (help)
//
// The fixtures beside this file (shared_register_prepare.json,
// shared_sign.json) are REAL replies captured from dashpay/dashd:24.0.3 on
// regtest (2026-11-23, 3 shares of 500/300/200 DASH), and the tests pin the
// flow's shapes to them.

// ---------------------------------------------------------------------------
// Sourced constants
// ---------------------------------------------------------------------------

export const MIN_SHARES = 2;
export const MAX_SHARES = 8;
export const MIN_SHARE_DUFFS = 100 * 1e8;
/** Regular masternode collateral (src/evo/dmn_types.h, v24.0.3). */
export const REGULAR_COLLATERAL_DUFFS = 1000 * 1e8;

// ---------------------------------------------------------------------------
// Assembly input
// ---------------------------------------------------------------------------

/** One share as the coordinator defines it, before prepare. */
export interface ShareInput {
  /** Duffs; integer, at least 100 DASH. */
  amountDuffs: number;
  refundAddress: string;
  ownerAddress: string;
  /** Defaults to the refund address when omitted (the node does the same). */
  rewardAddress?: string;
}

/** Everything shared_register_prepare needs besides the funding transaction. */
export interface AssemblyTerms {
  shares: ShareInput[];
  operatorPubKey: string;
  votingAddress: string;
  /** Percent STRING "0.00".."100.00" — NOT a number. */
  operatorRewardPercent: string;
  earlyPeriodBlocks: number;
  earlyPenaltyDuffs: number;
  /** Empty banks on a later ProUpServTx (verified against the live node). */
  coreP2PAddrs: string;
}

/** Format a number as the node's percent-string argument. 10 -> "10.00". */
export function formatOperatorReward(percent: number): string {
  return percent.toFixed(2);
}

/**
 * Early, human-readable validation of an assembly. Returns one message per
 * problem, each naming the rule it mirrors. An empty array means the table is
 * worth sending to the node — not that the node will accept it.
 */
export function validateAssembly(terms: AssemblyTerms): string[] {
  const errors: string[] = [];
  const shares = terms.shares ?? [];

  if (shares.length < MIN_SHARES || shares.length > MAX_SHARES) {
    errors.push(`a shared node has ${MIN_SHARES}–${MAX_SHARES} shares (providertx.h:142-143); you have ${shares.length}`);
  }

  let sum = 0;
  const refunds = new Set<string>();
  const owners = new Set<string>();
  const payees: string[] = [];
  for (const [i, s] of shares.entries()) {
    if (!Number.isInteger(s.amountDuffs) || s.amountDuffs <= 0) {
      errors.push(`share ${i + 1}: the amount must be a whole number of duffs`);
    } else {
      sum += s.amountDuffs;
      if (s.amountDuffs < MIN_SHARE_DUFFS) {
        errors.push(`share ${i + 1}: below the 100 DASH minimum (providertx.h:58)`);
      }
    }
    if (!s.refundAddress) errors.push(`share ${i + 1}: a refund address is required`);
    if (!s.ownerAddress) errors.push(`share ${i + 1}: an owner address is required`);
    if (s.refundAddress) {
      if (refunds.has(s.refundAddress)) errors.push(`share ${i + 1}: duplicate refund address (bad-protx-shares-dup-refund)`);
      refunds.add(s.refundAddress);
    }
    if (s.ownerAddress) {
      if (owners.has(s.ownerAddress)) errors.push(`share ${i + 1}: duplicate owner key (bad-protx-shares-dup-key)`);
      owners.add(s.ownerAddress);
    }
    const reward = s.rewardAddress?.length ? s.rewardAddress : s.refundAddress;
    if (reward && s.ownerAddress && reward === s.ownerAddress) {
      errors.push(`share ${i + 1}: reward/refund must differ from the owner address (bad-protx-shares-payee-reuse)`);
    }
    if (reward) payees.push(reward);
  }

  if (shares.length > 0 && Number.isInteger(sum) && sum !== REGULAR_COLLATERAL_DUFFS) {
    errors.push(
      `the shares must sum to exactly the 1,000 DASH collateral (bad-protx-shares-amount-sum); they sum to ${(sum / 1e8).toLocaleString()} DASH`,
    );
  }

  if (terms.votingAddress && payees.includes(terms.votingAddress)) {
    errors.push('the voting address must differ from every refund/reward payee (bad-protx-shares-payee-reuse)');
  }

  if (!/^\d{1,3}\.\d{2}$/.test(terms.operatorRewardPercent)) {
    errors.push('the operator cut is a percent string like "10.00" (0.00 to 100.00)');
  } else {
    const pct = Number.parseFloat(terms.operatorRewardPercent);
    if (pct < 0 || pct > 100) errors.push('the operator cut is a percent string like "10.00" (0.00 to 100.00)');
  }

  const smallest = shares.length ? Math.min(...shares.filter((s) => s.amountDuffs > 0).map((s) => s.amountDuffs), Infinity) : Infinity;
  if (!Number.isInteger(terms.earlyPeriodBlocks) || terms.earlyPeriodBlocks < 0) {
    errors.push('the early period must be a whole number of blocks (0 or more)');
  }
  if (terms.earlyPeriodBlocks === 0 && terms.earlyPenaltyDuffs !== 0) {
    errors.push('with no early period the penalty must be zero');
  }
  if (Number.isInteger(terms.earlyPenaltyDuffs) && terms.earlyPenaltyDuffs > 0) {
    if (terms.earlyPeriodBlocks === 0) {
      errors.push('with no early period the penalty must be zero');
    } else if (terms.earlyPenaltyDuffs >= smallest) {
      errors.push('the early-exit penalty must be below the smallest share');
    }
  }

  if (!terms.operatorPubKey) errors.push('an operator BLS public key is required (bls generate on the node)');
  if (!terms.votingAddress) errors.push('a voting address is required');

  return errors;
}

// ---------------------------------------------------------------------------
// Node reply shapes (pinned by the captured fixtures)
// ---------------------------------------------------------------------------

/** The decoded registration the node returns with prepare and sign. */
export interface PrepareTerms {
  version: number;
  type: number;
  collateralHash: string;
  collateralIndex: number;
  votingAddress: string;
  shares: Array<{
    amount: number;
    refundAddress: string;
    refundScript: string;
    rewardAddress: string;
    rewardScript: string;
    ownerAddress: string;
  }>;
  earlyPeriodBlocks?: number;
  earlyPenalty?: number;
  pubKeyOperator: string;
  operatorReward: number;
  inputsHash: string;
}

/** `protx shared_register_prepare` reply (fixtures/shared_register_prepare.json). */
export interface PrepareReply {
  tx: string;
  collateralIndex: number;
  consentHash: string;
  terms: PrepareTerms;
  /** Present only when earlyPenalty is zero — measured on 24.0.3. */
  warning?: string;
}

/** `protx shared_sign` reply (fixtures/shared_sign.json). */
export interface SignReply {
  type: number;
  terms: PrepareTerms;
  signatures: Array<{ shareIndex: number; signature: string }>;
}

// ---------------------------------------------------------------------------
// The session envelope (coordinator -> owners)
// ---------------------------------------------------------------------------

export const ENVELOPE_KIND = 'evo-titan.shared-registration-session';
export const ENVELOPE_VERSION = 1;

/** The document the coordinator exports and every owner imports. */
export interface SessionEnvelope {
  kind: typeof ENVELOPE_KIND;
  version: typeof ENVELOPE_VERSION;
  network: string;
  createdAt: string;
  /** The node's prepare reply, verbatim — the tx and consentHash are inside. */
  prepare: PrepareReply;
  /** What the coordinator assembled, for display next to the node's terms. */
  assembly: {
    shares: ShareInput[];
    operatorRewardPercent: string;
    earlyPeriodBlocks: number;
    earlyPenaltyDuffs: number;
    votingAddress: string;
  };
}

/** Build the envelope around a real prepare reply. */
export function buildEnvelope(
  network: string,
  prepare: PrepareReply,
  terms: AssemblyTerms,
): SessionEnvelope {
  return {
    kind: ENVELOPE_KIND,
    version: ENVELOPE_VERSION,
    network,
    createdAt: new Date().toISOString(),
    prepare,
    assembly: {
      shares: terms.shares,
      operatorRewardPercent: terms.operatorRewardPercent,
      earlyPeriodBlocks: terms.earlyPeriodBlocks,
      earlyPenaltyDuffs: terms.earlyPenaltyDuffs,
      votingAddress: terms.votingAddress,
    },
  };
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Encode an envelope for transport (file, clipboard, message). */
export function encodeEnvelope(envelope: SessionEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/**
 * Decode and validate an envelope. Every required field is checked so a
 * truncated or foreign document fails HERE, with a clear message, instead of
 * rendering half a session and looking trusted.
 */
export function decodeEnvelope(raw: string): SessionEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('the envelope is not valid JSON');
  }
  const env = parsed as Partial<SessionEnvelope>;
  if (env.kind !== ENVELOPE_KIND) {
    throw new Error(`this is not a shared-registration envelope (kind "${String(env.kind)}")`);
  }
  if (env.version !== ENVELOPE_VERSION) {
    throw new Error(`unsupported envelope version ${String(env.version)}`);
  }
  if (typeof env.network !== 'string' || !env.network) throw new Error('the envelope carries no network');
  const p = env.prepare;
  if (!p || typeof p.tx !== 'string' || !p.tx) throw new Error('the envelope carries no transaction');
  if (typeof p.consentHash !== 'string' || !HEX64.test(p.consentHash)) {
    throw new Error('the envelope carries no valid consent hash');
  }
  if (!p.terms || !Array.isArray(p.terms.shares) || p.terms.shares.length < MIN_SHARES) {
    throw new Error('the envelope carries no share table');
  }
  return env as SessionEnvelope;
}

// ---------------------------------------------------------------------------
// The signature artifact (owner -> coordinator)
// ---------------------------------------------------------------------------

export const SIGNATURE_KIND = 'evo-titan.shared-registration-signature';
export const SIGNATURE_VERSION = 1;

/**
 * What an owner sends back. One artifact may carry several signatures when
 * the wallet holds several owner keys (a demo wallet does; one owner's wallet
 * normally produces exactly one).
 */
export interface SignatureArtifact {
  kind: typeof SIGNATURE_KIND;
  version: typeof SIGNATURE_VERSION;
  network: string;
  consentHash: string;
  signedAt: string;
  signatures: Array<{ shareIndex: number; signature: string }>;
}

/** Build artifacts from a real shared_sign reply. */
export function buildSignatureArtifacts(
  network: string,
  consentHash: string,
  reply: SignReply,
): SignatureArtifact {
  if (!reply.signatures?.length) throw new Error('the node returned no signatures');
  return {
    kind: SIGNATURE_KIND,
    version: SIGNATURE_VERSION,
    network,
    consentHash,
    signedAt: new Date().toISOString(),
    signatures: reply.signatures.map((s) => ({ shareIndex: s.shareIndex, signature: s.signature })),
  };
}

export function encodeSignatureArtifact(artifact: SignatureArtifact): string {
  return JSON.stringify(artifact, null, 2);
}

/** Decode and validate a signature artifact. */
export function decodeSignatureArtifact(raw: string): SignatureArtifact {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('the signature file is not valid JSON');
  }
  const a = parsed as Partial<SignatureArtifact>;
  if (a.kind !== SIGNATURE_KIND) {
    throw new Error(`this is not a shared-registration signature file (kind "${String(a.kind)}")`);
  }
  if (a.version !== SIGNATURE_VERSION) {
    throw new Error(`unsupported signature version ${String(a.version)}`);
  }
  if (typeof a.consentHash !== 'string' || !HEX64.test(a.consentHash)) {
    throw new Error('the signature file carries no valid consent hash');
  }
  if (!Array.isArray(a.signatures) || a.signatures.length === 0) {
    throw new Error('the signature file carries no signatures');
  }
  for (const s of a.signatures) {
    if (!Number.isInteger(s.shareIndex) || s.shareIndex < 0 || s.shareIndex >= MAX_SHARES) {
      throw new Error(`bad shareIndex ${String(s.shareIndex)} in the signature file`);
    }
    if (typeof s.signature !== 'string' || !s.signature) {
      throw new Error('an empty signature in the signature file');
    }
  }
  return a as SignatureArtifact;
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

export interface CollectionState {
  /** Share indices covered exactly once, in order. */
  collected: number[];
  /** Share indices still without a signature. */
  missing: number[];
  /** Indices that arrived more than once (kept once, reported). */
  duplicates: number[];
  /** Indices from artifacts for a DIFFERENT session, refused. */
  refused: number[];
  complete: boolean;
}

/**
 * Fold signature artifacts into the session's collection. Artifacts whose
 * consentHash does not match the session are refused whole — a signature for
 * another session must never be counted as if it were for this one, which is
 * the whole point of the consent hash.
 */
export function collectSignatures(
  shareCount: number,
  consentHash: string,
  artifacts: SignatureArtifact[],
): CollectionState {
  const seen = new Set<number>();
  const duplicates: number[] = [];
  const refused: number[] = [];
  for (const artifact of artifacts) {
    if (artifact.consentHash !== consentHash || artifact.signatures === undefined) {
      refused.push(...(artifact.signatures ?? []).map((s) => s.shareIndex));
      continue;
    }
    for (const s of artifact.signatures) {
      if (s.shareIndex < 0 || s.shareIndex >= shareCount) {
        refused.push(s.shareIndex);
      } else if (seen.has(s.shareIndex)) {
        duplicates.push(s.shareIndex);
      } else {
        seen.add(s.shareIndex);
      }
    }
  }
  const collected = [...seen].sort((a, b) => a - b);
  const missing: number[] = [];
  for (let i = 0; i < shareCount; i++) {
    if (!seen.has(i)) missing.push(i);
  }
  return { collected, missing, duplicates, refused, complete: missing.length === 0 };
}
