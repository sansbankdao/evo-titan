// apps/desktop/src/lib/dpns.ts — Evo Titan
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  THIS FILE IS *NOT* MOCK DATA. It reads real state from Dash Platform.    ║
// ║                                                                          ║
// ║  Contested DPNS usernames are a MASTERNODE VOTING concern: when two or    ║
// ║  more identities request the same label inside a 3–19 character window,   ║
// ║  Dash Platform resolves it by masternode vote rather than first-come.     ║
// ║  That is why this screen sits alongside governance work rather than in    ║
// ║  the fleet views.                                                         ║
// ║                                                                          ║
// ║  The screen that renders this carries a provenance banner saying the      ║
// ║  rows are live, in contrast to the MOCK banner on the rest of the build.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * The DPNS system data contract identifier, as base58.
 *
 * SOURCE, not recalled: `packages/dpns-contract/src/lib.rs` in dashpay/platform
 * (checked out at rev 37ea011) declares
 *
 *     pub const ID_BYTES: [u8; 32] = [
 *         230, 104, 198, 89, 175, 102, 174, 225, 231, 44, 24, 109, 222, 123,
 *         91, 126, 10, 29, 113, 42, 9, 196, 13, 87, 33, 246, 34, 191, 83,
 *         197, 49, 85,
 *     ];
 *
 * Those bytes, base58-encoded, are the value below. It is a fixed protocol
 * constant: every network (mainnet, testnet, devnet) shares it, so it is not
 * per-network configuration and must not be made configurable.
 */
export const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';

/**
 * The contested index on the DPNS `domain` document type.
 *
 * SOURCE: `packages/dpns-contract/schema/v2/dpns-contract-documents.json`
 * declares the index `parentNameAndLabel` over
 * `[normalizedParentDomainName, normalizedLabel]` with
 *
 *     "contested": {
 *       "fieldMatches": [
 *         { "field": "normalizedLabel", "regexPattern": "^[a-zA-Z01-]{3,19}$" }
 *       ],
 *       "resolution": 0,
 *       ...
 *     }
 *
 * The regex is why only labels of 3–19 characters can be contested at all: a
 * 2-character or 20-character label is decided without a vote. The screen states
 * this so an operator is not surprised that a favourite short name is absent.
 */
export const DPNS_CONTESTED_INDEX = 'parentNameAndLabel';

/** The DPNS document type that carries the contested index. */
export const DPNS_DOCUMENT_TYPE = 'domain';

/**
 * The `startIndexValues` prefix for every DPNS contested query.
 *
 * The index is composite: [normalizedParentDomainName, normalizedLabel]. Every
 * DPNS name lives under the parent domain `dash`, which is the `dash` in
 * `alice.dash`. It is hardcoded for the same reason `dash-evo-tool` hardcodes
 * it (src/backend_task/contested_names/query_dpns_contested_resources.rs
 * comments it "// hardcoded for dpns"): DPNS defines exactly one parent domain.
 */
export const DPNS_PARENT_DOMAIN = 'dash';

/**
 * How a contest was resolved.
 *
 * Mapped from the SDK's `ContestedResourceVoteWinner.kind` string, whose values
 * were read from a live mainnet response rather than assumed:
 *   `WonByIdentity` — one contender took a majority and holds the name.
 *   `Locked`        — no contender reached the threshold, so the name is
 *                     permanently unregisterable. This is a real and common
 *                     outcome, not an error state.
 *   `NoWinner`      — the vote closed with no decision.
 *
 * `Unknown` exists so an unrecognised future kind degrades to a visible label
 * instead of silently rendering as one of the three known outcomes.
 */
export type ContestOutcome = 'WonByIdentity' | 'Locked' | 'NoWinner' | 'Unknown';

/** A single identity competing for a contested label. */
export interface Contestant {
  /** The competing identity, base58. */
  identityId: string;
  /**
   * Masternode votes cast for this identity at the time of the query.
   * `undefined` when the vote tally was not requested or not returned.
   */
  voteTally: number | undefined;
}

/** One contested DPNS label, with its live vote state. */
export interface ContestedName {
  /** The label without the `.dash` suffix, e.g. `000`. */
  name: string;
  /** How the contest stands. */
  outcome: ContestOutcome;
  /** The winning identity, base58, when `outcome` is `WonByIdentity`. */
  winnerId: string | undefined;
  /** Identities that contested the label, with their tallies. */
  contestants: Contestant[];
  /** Votes to resolve with no winner. */
  abstainVotes: number | undefined;
  /** Votes to lock the name permanently. */
  lockVotes: number | undefined;
  /**
   * When the contest was decided, in Unix milliseconds.
   * `undefined` while a contest is still undecided.
   */
  decidedAtMs: number | undefined;
  /** The platform block height at which it was decided, if decided. */
  decidedAtHeight: number | undefined;
}

/** Progress emitted while a fetch is in flight, so the UI can show real work. */
export interface ContestProgress {
  /** Names listed so far. */
  listed: number;
  /** Vote states retrieved so far. */
  detailed: number;
  /** Total names to detail, known once listing completes. */
  total: number;
  /** What the fetch is doing right now. */
  phase: 'listing' | 'votes' | 'done';
}

/** Options for {@link fetchContestedNames}. */
export interface FetchContestedOptions {
  /**
   * How many names to return. A full mainnet listing is ~880 names, and each
   * name costs a second query for its vote state, so the UI requests a page
   * rather than the whole set.
   */
  limit?: number;
  /** Called as work completes. */
  onProgress?: (progress: ContestProgress) => void;
  /** Abort signal, so leaving the screen cancels in-flight work. */
  signal?: AbortSignal;
}

/**
 * The subset of the SDK this module uses.
 *
 * Declared structurally rather than imported as the class type so that this
 * module stays testable with a fake: the tests pass an object with these three
 * methods and no WASM is loaded. That is the same split as rpc-core.ts, where
 * the transport is injected rather than reached for.
 */
export interface PlatformClient {
  getContestedResources(query: {
    dataContractId: string;
    documentTypeName: string;
    indexName: string;
    startIndexValues?: unknown[];
    startAtValue?: unknown;
    startAtValueIncluded?: boolean;
    limit?: number;
    orderAscending?: boolean;
  }): Promise<string[]>;
  getContestedResourceVoteState(query: {
    dataContractId: string;
    documentTypeName: string;
    indexName: string;
    indexValues?: unknown[];
    resultType?: 'documents' | 'voteTally' | 'documentsAndVoteTally';
    limit?: number;
    includeLockedAndAbstaining?: boolean;
  }): Promise<{
    contenders: Array<{ identityId: { toBase58(): string }; voteTally: number | undefined }>;
    abstainVoteTally: number | undefined;
    lockVoteTally: number | undefined;
    winner:
      | {
          kind: string;
          identityId: { toBase58(): string } | undefined;
          block: { timeMs: bigint; height: bigint } | undefined;
        }
      | undefined;
  }>;
}

/**
 * Normalise the SDK's `kind` string into our union.
 *
 * An unrecognised value becomes `Unknown` rather than being coerced to a known
 * outcome. Silently mapping a new protocol state onto "Locked" would tell an
 * operator a name is permanently unregisterable when it may not be.
 */
export function normaliseOutcome(kind: string | undefined): ContestOutcome {
  switch (kind) {
    case 'WonByIdentity':
    case 'Locked':
    case 'NoWinner':
      return kind;
    default:
      return 'Unknown';
  }
}

/**
 * Convert one raw vote-state response into a {@link ContestedName}.
 *
 * Every field is read defensively: the WASM boundary returns `undefined` for
 * absent values rather than throwing, and a missing `winner.block` is normal
 * for an undecided contest. Numbers arriving as `bigint` are converted only
 * where they fit safely — a millisecond timestamp exceeds 2^53 only in the far
 * future, and a height is far below it.
 */
export function toContestedName(name: string, raw: Awaited<ReturnType<PlatformClient['getContestedResourceVoteState']>>): ContestedName {
  const winner = raw.winner;
  return {
    name,
    outcome: normaliseOutcome(winner?.kind),
    winnerId: winner?.identityId?.toBase58(),
    contestants: (raw.contenders ?? []).map((c) => ({
      identityId: c.identityId.toBase58(),
      voteTally: c.voteTally,
    })),
    abstainVotes: raw.abstainVoteTally,
    lockVotes: raw.lockVoteTally,
    decidedAtMs: winner?.block ? Number(winner.block.timeMs) : undefined,
    decidedAtHeight: winner?.block ? Number(winner.block.height) : undefined,
  };
}

/**
 * Page through every contested DPNS label, newest index order.
 *
 * The SDK returns at most `limit` results per call, so a cursor loop is
 * required to reach the full set. `startAtValueIncluded: false` is essential:
 * without it the previous page's last name repeats as the next page's first,
 * which quietly duplicates rows.
 *
 * The parameter names are the SDK's own and were read from its type definition
 * (`startAtValue` / `startAtValueIncluded`, sdk.d.ts:2632-2638), not guessed.
 * An earlier draft of this file used `startValueIncluded`, which the SDK would
 * have ignored as an unknown key — the listing would still have looked correct
 * while silently repeating one row per page.
 *
 * The loop is bounded even though a short page also terminates it, so a server
 * that kept returning full pages could not spin forever.
 */
export async function listContestedNames(
  client: PlatformClient,
  limit: number,
  onPage?: (names: string[]) => void,
): Promise<string[]> {
  const all: string[] = [];
  let cursor: string | undefined;
  const PAGE = 100;
  const MAX_PAGES = 50;

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await client.getContestedResources({
      dataContractId: DPNS_CONTRACT_ID,
      documentTypeName: DPNS_DOCUMENT_TYPE,
      indexName: DPNS_CONTESTED_INDEX,
      startIndexValues: [DPNS_PARENT_DOMAIN],
      limit: PAGE,
      orderAscending: true,
      ...(cursor === undefined ? {} : { startAtValue: cursor, startAtValueIncluded: false }),
    });
    if (batch.length === 0) break;
    all.push(...batch);
    onPage?.(batch);
    if (batch.length < PAGE || all.length >= limit) break;
    cursor = batch[batch.length - 1];
  }

  return all.slice(0, limit);
}

/**
 * Fetch contested DPNS labels with their live vote state.
 *
 * Listing is one query; each name's vote state is a second. Requests are
 * chunked rather than fired all at once: a few hundred simultaneous gRPC-web
 * calls to a DAPI node is exactly the pattern that gets a client rate-limited,
 * and the chunk size keeps progress moving while staying polite.
 */
export async function fetchContestedNames(
  client: PlatformClient,
  options: FetchContestedOptions = {},
): Promise<ContestedName[]> {
  const { limit = 60, onProgress, signal } = options;
  const CHUNK = 8;

  onProgress?.({ listed: 0, detailed: 0, total: limit, phase: 'listing' });
  const names = await listContestedNames(client, limit);

  const out: ContestedName[] = [];
  for (let i = 0; i < names.length; i += CHUNK) {
    if (signal?.aborted) throw new Error('aborted');
    const chunk = names.slice(i, i + CHUNK);
    const rows = await Promise.all(
      chunk.map(async (name) => {
        const raw = await client.getContestedResourceVoteState({
          dataContractId: DPNS_CONTRACT_ID,
          documentTypeName: DPNS_DOCUMENT_TYPE,
          indexName: DPNS_CONTESTED_INDEX,
          indexValues: [DPNS_PARENT_DOMAIN, name],
          resultType: 'documentsAndVoteTally',
          includeLockedAndAbstaining: true,
        });
        return toContestedName(name, raw);
      }),
    );
    out.push(...rows);
    onProgress?.({ listed: names.length, detailed: out.length, total: names.length, phase: 'votes' });
  }

  onProgress?.({ listed: names.length, detailed: out.length, total: names.length, phase: 'done' });
  return out;
}
