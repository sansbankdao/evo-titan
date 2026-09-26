// apps/desktop/src/lib/mock.ts — Evo Titan
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ALL DATA IN THIS FILE IS MOCK.                                          ║
// ║                                                                          ║
// ║  This session is dedicated to UI/UX. No node is running, no RPC has been ║
// ║  verified, and every value below is invented so the interface can be     ║
// ║  designed against something concrete.                                    ║
// ║                                                                          ║
// ║  Protocol CONSTANTS (collateral, share bounds) are sourced from Dash Core║
// ║  v24.0.0-rc.1 and cite their file. Everything else — node names, hashes, ║
// ║  balances, reward amounts, dates, co-owner identities — is fabricated.   ║
// ║                                                                          ║
// ║  Nothing here talks to a network. `rpc.ts` is the seam where real calls  ║
// ║  will go, and it is marked TODO: verify against dashd throughout.        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/** Sourced consensus constants. See `protocol` comments for file references. */
export const protocol = {
  /** src/evo/dmn_types.h — Regular.collat_amount = 1000 * COIN */
  regularCollateral: 1000,
  /** src/evo/dmn_types.h — Evo.collat_amount = 4000 * COIN */
  evoCollateral: 4000,
  /** src/evo/providertx.h:134-135 — MIN_SHARES{2}, MAX_SHARES{8} */
  minShares: 2,
  maxShares: 8,
  /** src/evo/providertx.h:58 — CCollateralShare::MIN_AMOUNT{100 * COIN} */
  minShareAmount: 100,
} as const;

/** MOCK. Node type as it will be reported by the node. */
export type NodeKind = 'regular' | 'evonode';

/** MOCK. Health is derived, not reported directly by dashd. */
export type NodeHealth = 'enabled' | 'posing' | 'expired' | 'down';

export interface FleetNode {
  id: string;
  /** MOCK. Operator-chosen label. */
  alias: string;
  kind: NodeKind;
  health: NodeHealth;
  /** MOCK. Outpoint of the collateral. */
  collateralTxid: string;
  collateralIndex: number;
  /** Sourced value for the type; see `protocol`. */
  collateralAmount: number;
  /** MOCK. Hex, as dashd reports it. */
  proTxHash: string;
  /** MOCK. Human-readable address. */
  payoutAddress: string;
  /** MOCK. Protocol version string. */
  version: string;
  /** MOCK. Whether this node matches the current expected version. */
  versionOk: boolean;
  /** MOCK. Block height the node reports. */
  blockHeight: number;
  /** MOCK. Peer count. */
  peers: number;
  /** MOCK. Last seen, as an ISO timestamp. */
  lastSeen: string;
  /** MOCK. Position in the payment queue, 1-based. */
  queuePosition: number;
  /** MOCK. Seconds until the next expected payment. */
  nextPaymentIn: number;
  /** MOCK. Region label. */
  region: string;
  /** MOCK. Hosting provider label. */
  provider: string;
  /** MOCK. Share holders. Empty for a wholly owned node. */
  shares: Share[];
}

/** MOCK. One co-owner of a shared masternode. */
export interface Share {
  /** MOCK. Display name for the co-owner. */
  owner: string;
  /** Sourced minimum per share is `protocol.minShareAmount`. */
  amount: number;
  /** MOCK. Whether this co-owner has returned their signature. */
  signed: boolean;
  /** MOCK. Truncated key identifier. */
  keyId: string;
}

/**
 * MOCK fleet. Deliberately mixed: a shared node, whole nodes, an evonode, and a
 * node that is down, so every UI state has something to render.
 */
export const fleet: FleetNode[] = [
  {
    id: 'n1',
    alias: 'titan-01',
    kind: 'regular',
    health: 'enabled',
    collateralTxid: 'a3f1c9e2b74d05a8e6c1f0b93d7a2e548c6b1f0a3d9e7c2b4a8f6d1e0c3b5a79',
    collateralIndex: 0,
    collateralAmount: protocol.regularCollateral,
    proTxHash: 'b7e2a1c94f0d38e6a5b2c1f7d9e0a3b8c6f4d2e1a9b7c5f3d0e8a6b4c2f1d9e7',
    payoutAddress: 'XpQ7nR4kL2mV8sT3wY6bH1cF9dG5jZ0a',
    version: '24.0.0',
    versionOk: true,
    blockHeight: 2148317,
    peers: 42,
    lastSeen: '2026-09-25T03:41:00Z',
    queuePosition: 7,
    nextPaymentIn: 93600,
    region: 'eu-central',
    provider: 'Self-hosted',
    shares: [],
  },
  {
    id: 'n2',
    alias: 'shared-atlas',
    kind: 'regular',
    health: 'enabled',
    collateralTxid: 'c8d2b4a6f0e13d5b7a9c2e4f6d8b0a3c5e7f9d1b3a5c7e9f0d2b4a6c8e0f1a3b',
    collateralIndex: 1,
    collateralAmount: protocol.regularCollateral,
    proTxHash: 'd1f3b5a7c9e0d2b4f6a8c0e2d4b6f8a0c2e4d6b8f0a2c4e6d8b0f2a4c6e8d0b2',
    payoutAddress: 'XkN8mQ2vL6rT9sY4bH1cF7dG3jZ5aP0w',
    version: '24.0.0',
    versionOk: true,
    blockHeight: 2148317,
    peers: 38,
    lastSeen: '2026-09-25T03:41:12Z',
    queuePosition: 19,
    nextPaymentIn: 254400,
    region: 'us-east',
    provider: 'Self-hosted',
    shares: [
      { owner: 'You', amount: 600, signed: true, keyId: '8a3f...c21e' },
      { owner: 'atlas-node', amount: 300, signed: true, keyId: '4d7b...9f02' },
      { owner: 'meridian', amount: 100, signed: false, keyId: 'e1c9...7a45' },
    ],
  },
  {
    id: 'n3',
    alias: 'evo-01',
    kind: 'evonode',
    health: 'enabled',
    collateralTxid: 'e4a6c8b0d2f1e3a5c7b9d0f2a4c6e8b1d3f5a7c9e0b2d4f6a8c1e3b5d7f9a0c2',
    collateralIndex: 0,
    collateralAmount: protocol.evoCollateral,
    proTxHash: 'f5b7d9c1e3a0f2b4d6c8e0a2f4b6d8c0e2a4f6b8d0c2e4a6f8b1d3c5e7a9f0b2',
    payoutAddress: 'XrT4wY8bH2cF6dG1jZ9aP3kL7mQ5nV0s',
    version: '24.0.0',
    versionOk: true,
    blockHeight: 2148317,
    peers: 51,
    lastSeen: '2026-09-25T03:41:08Z',
    queuePosition: 3,
    nextPaymentIn: 39600,
    region: 'eu-central',
    provider: 'Self-hosted',
    shares: [],
  },
  {
    id: 'n4',
    alias: 'titan-02',
    kind: 'regular',
    health: 'posing',
    collateralTxid: 'a1c3e5b7d9f0a2c4e6b8d1f3a5c7e9b0d2f4a6c8e1b3d5f7a9c0e2b4d6f8a1c3',
    collateralIndex: 2,
    collateralAmount: protocol.regularCollateral,
    proTxHash: 'b2d4f6a8c0e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f0a2c4e6b8d0f2a4c6e8b1d3',
    payoutAddress: 'XmK5nQ9vL3rT7sY1bH4cF8dG2jZ6aP0w',
    version: '23.1.7',
    versionOk: false,
    blockHeight: 2148291,
    peers: 3,
    lastSeen: '2026-09-25T02:58:44Z',
    queuePosition: 0,
    nextPaymentIn: 0,
    region: 'ap-south',
    provider: 'Self-hosted',
    shares: [],
  },
  {
    id: 'n5',
    alias: 'evo-02',
    kind: 'evonode',
    health: 'down',
    collateralTxid: 'c6e8a0b2d4f3c5e7a9b1d3f5a7c9e0b2d4f6a8c1e3b5d7f9a1c3e5b7d9f0a2c4',
    collateralIndex: 0,
    collateralAmount: protocol.evoCollateral,
    proTxHash: 'd7f9a1c3e5b0d2f4a6c8e1b3d5f7a9c0e2b4d6f8a0c3e5b7d9f1a3c5e7b9d0f2',
    payoutAddress: 'XpN6mQ1vL5rT8sY2bH3cF9dG4jZ7aP0w',
    version: '24.0.0',
    versionOk: true,
    blockHeight: 0,
    peers: 0,
    lastSeen: '2026-09-24T18:12:03Z',
    queuePosition: 0,
    nextPaymentIn: 0,
    region: 'ap-south',
    provider: 'Self-hosted',
    shares: [],
  },
];

/** MOCK. Aggregate figures derived from the fleet above. */
export const summary = {
  /** MOCK total collateral across the fleet, in DASH. */
  totalCollateral: fleet.reduce((sum, n) => sum + n.collateralAmount, 0),
  totalNodes: fleet.length,
  enabled: fleet.filter((n) => n.health === 'enabled').length,
  needsAttention: fleet.filter((n) => n.health !== 'enabled').length,
  /** MOCK. Rewards accrued this month, in DASH. */
  rewardsThisMonth: 18.42,
  /** MOCK. Rewards all-time, in DASH. */
  rewardsAllTime: 241.7,
  /** MOCK. DASH price used to express value in dollars. */
  dashPrice: 0,
};

/** MOCK. A pending transaction awaiting co-owner signatures. */
export interface PendingSigning {
  id: string;
  kind: 'ProRegTx' | 'ProDisTx' | 'ProUpServTx';
  label: string;
  /** MOCK. Short human-checkable code, mirroring SharedSigCollector's intent. */
  humanCode: string;
  required: number;
  collected: number;
  shares: Share[];
}

/** MOCK. One proposal in flight. */
export const pendingSignings: PendingSigning[] = [
  {
    id: 's1',
    kind: 'ProRegTx',
    label: 'Register shared-atlas',
    humanCode: 'ATLAS-4417',
    required: 3,
    collected: 2,
    // Referenced by id rather than index: `noUncheckedIndexedAccess` treats
    // `fleet[1]` as possibly undefined, and an index is brittle if the mock
    // fleet is reordered.
    shares: fleet.find((n) => n.id === 'n2')?.shares ?? [],
  },
];

/** MOCK. A reward payment in the queue. */
export interface RewardEvent {
  id: string;
  node: string;
  amount: number;
  when: string;
  status: 'paid' | 'pending';
}

/** MOCK. Recent reward history. */
export const rewards: RewardEvent[] = [
  { id: 'r1', node: 'evo-01', amount: 1.86, when: '2026-09-22T11:04:00Z', status: 'paid' },
  { id: 'r2', node: 'titan-01', amount: 1.42, when: '2026-09-20T07:31:00Z', status: 'paid' },
  { id: 'r3', node: 'shared-atlas', amount: 0.24, when: '2026-09-18T19:12:00Z', status: 'paid' },
  { id: 'r4', node: 'evo-01', amount: 1.91, when: '2026-09-15T03:47:00Z', status: 'paid' },
];

/** MOCK. Activity feed entries. */
export interface Activity {
  id: string;
  when: string;
  tone: 'ok' | 'warn' | 'info';
  text: string;
}

/** MOCK. Recent activity. */
export const activity: Activity[] = [
  { id: 'a1', when: '2026-09-25T03:41:00Z', tone: 'ok', text: 'evo-01 entered the enabled set' },
  { id: 'a2', when: '2026-09-25T02:58:00Z', tone: 'warn', text: 'titan-02 is posing — version 23.1.7 is behind' },
  { id: 'a3', when: '2026-09-24T18:12:00Z', tone: 'warn', text: 'evo-02 stopped responding' },
  { id: 'a4', when: '2026-09-24T09:20:00Z', tone: 'info', text: 'meridian has not yet signed shared-atlas' },
  { id: 'a5', when: '2026-09-22T11:04:00Z', tone: 'ok', text: 'Reward of 1.86 DASH paid to evo-01' },
];

// ---------------------------------------------------------------------------
// CHART SERIES (MOCK)
// ---------------------------------------------------------------------------

/**
 * MOCK. Deterministic pseudo-random in [0, 1).
 *
 * Deterministic on purpose: `Math.random()` would make every build produce a
 * different chart, so two screenshots of the same commit would disagree. A
 * seeded wobble keeps the mock stable and reproducible.
 */
const wobble = (i: number): number => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** MOCK. One daily point in a time series. */
export interface SeriesPoint {
  /** MOCK. Calendar day, YYYY-MM-DD. */
  date: string;
  /** MOCK. Value in DASH. */
  amount: number;
}

/** MOCK. The last day covered by the series below. */
export const seriesEnd = '2026-09-25';

/** MOCK. 30 days of daily reward income, oldest first. */
export const rewardsSeries: SeriesPoint[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.parse(`${seriesEnd}T00:00:00Z`) - (29 - i) * 86_400_000)
    .toISOString()
    .slice(0, 10),
  amount: Number((0.42 + wobble(i) * 1.74).toFixed(2)),
}));

/** MOCK. Fleet health, counted for the breakdown chart. Derived from `fleet`. */
export const healthBreakdown: { health: NodeHealth; label: string; count: number }[] = (
  ['enabled', 'posing', 'expired', 'down'] as const
).map((health) => ({
  health,
  label: { enabled: 'Enabled', posing: 'Posing', expired: 'Expired', down: 'Down' }[health],
  count: fleet.filter((n) => n.health === health).length,
}));

/** MOCK. Collateral committed per node, for the profile bar chart. */
export const collateralByNode = fleet.map((n) => ({
  alias: n.alias,
  amount: n.collateralAmount,
  kind: n.kind,
}));

// ---------------------------------------------------------------------------
// PROFILE (MOCK)
// ---------------------------------------------------------------------------

/** MOCK. The signed-in operator. Nothing here is fetched. */
export const profile = {
  displayName: 'Sansbank Operator',
  /** MOCK. Internal handle. */
  operatorId: 'op_7f3a9c21',
  /** MOCK. Mirrors the public rank ladder in packages/web/src/config/site.ts. */
  rank: 'IV',
  rankName: 'Evo Operator',
  /** MOCK. Date the account was created. */
  memberSince: '2024-03-11',
  /** MOCK. Primary payout address. */
  payoutAddress: 'XpQ7nR4kL2mV8sT3wY6bH1cF9dG5jZ0a',
  /** MOCK. Contact address. */
  email: 'operator@example.invalid',
  /** MOCK. Display region. */
  region: 'eu-central',
  /** MOCK. IANA zone label. */
  timezone: 'Europe/Berlin',
  /** MOCK. Whether two-factor auth is on. */
  twoFactor: true,
  /** MOCK. Sourced shape from `protocol`; values below are MOCK. */
  totals: {
    nodes: fleet.length,
    collateral: fleet.reduce((sum, n) => sum + n.collateralAmount, 0),
    rewardsAllTime: 241.7,
    /** MOCK. Days since `memberSince`. */
    daysActive: 928,
  },
};

/** MOCK. A device with access to the account. */
export interface Device {
  id: string;
  label: string;
  /** MOCK. OS and version. */
  platform: string;
  /** MOCK. Whether this is the device you are on now. */
  current: boolean;
  /** MOCK. Last activity, ISO timestamp. */
  lastActive: string;
}

/** MOCK. Authorised devices. */
export const devices: Device[] = [
  { id: 'd1', label: 'Sansbank workstation', platform: 'Linux 6.14', current: true, lastActive: '2026-09-25T03:41:00Z' },
  { id: 'd2', label: 'MacBook Pro', platform: 'macOS 15.6', current: false, lastActive: '2026-09-21T17:02:00Z' },
  { id: 'd3', label: 'Pixel 9', platform: 'Android 16', current: false, lastActive: '2026-08-30T09:14:00Z' },
];

// ---------------------------------------------------------------------------
// SETTINGS (MOCK)
// ---------------------------------------------------------------------------

/** MOCK. gRPC/RPC connection settings. Nothing here is dialled. */
export const rpcSettings = {
  /** MOCK. Host. `rpc.ts` currently throws before any of this is used. */
  host: '127.0.0.1',
  /** Sourced default: dashd's RPC port. */
  port: 9998,
  /** MOCK. RPC user. */
  user: 'operator',
  /** MOCK. Never rendered; shown only as a set/unset state. */
  passwordSet: true,
  /** MOCK. Whether to use TLS. */
  tls: false,
  /** MOCK. Timeout in milliseconds. */
  timeoutMs: 15_000,
};

/** MOCK. A user-facing preference toggle. */
export interface Preference {
  id: string;
  label: string;
  /** MOCK. Longer description shown under the label. */
  help: string;
  /** MOCK. Current value. */
  enabled: boolean;
  /**
   * MOCK. Whether the control is wired to anything. The UI renders disabled
   * controls where this is false, rather than pretending the setting applies.
   */
  available: boolean;
}

/** MOCK. Notification preferences. */
export const notificationPrefs: Preference[] = [
  { id: 'nt1', label: 'Node went down', help: 'Alert when a node stops responding to the network.', enabled: true, available: false },
  { id: 'nt2', label: 'Node is posing', help: 'Alert when a node enters the set but lags the expected version.', enabled: true, available: false },
  { id: 'nt3', label: 'Payment received', help: 'Alert on each masternode payment.', enabled: false, available: false },
  { id: 'nt4', label: 'Version behind', help: 'Alert when a node falls behind the required protocol version.', enabled: true, available: false },
];

/** MOCK. Appearance and behaviour preferences. */
export const appPrefs: Preference[] = [
  { id: 'ap1', label: 'Launch at login', help: 'Start Evo Titan when you sign in to this computer.', enabled: false, available: false },
  { id: 'ap2', label: 'Minimise to tray', help: 'Keep running in the background when the window is closed.', enabled: true, available: false },
  { id: 'ap3', label: 'Confirm before signing', help: 'Always show the human-checkable code before approving a signing request.', enabled: true, available: true },
  { id: 'ap4', label: 'Show testnet nodes', help: 'Include testnet nodes in the fleet list.', enabled: false, available: false },
];

// ---------------------------------------------------------------------------
// CUSTODIAL POOL (MOCK)
// ---------------------------------------------------------------------------
//
// The custodial layer is Rank 0 — see packages/web/src/config/site.ts. It is
// PLANNED and NOT OPEN. Everything below is invented so the screen can be
// designed, EXCEPT the protocol constants, which are sourced.
//
// The pool arithmetic is the whole design, so it is worth stating plainly:
//
//   125 DASH per depositor x 8 depositors = 1,000 DASH = one Regular collateral.
//
// 8 is `protocol.maxShares`. This is a coincidence of the numbers, not a rule:
// deposits are not fixed at 125, and a pool could be filled with uneven
// amounts. But 125 x 8 landing exactly on the collateral is why the figure is
// legible as a target, so the screen shows the arithmetic rather than hiding it.
//
// A pool registers ONE Regular masternode. Shared collateral can NEVER be an
// Evo node: Dash Core rejects it with `bad-protx-shares-evo`
// (src/evo/providertx.cpp:280). The pool is a doorway to Rank I, not a path to
// Rank IV.

/** MOCK. One depositor in the custodial pool. */
export interface PoolDepositor {
  /** MOCK. Display name. */
  owner: string;
  /** MOCK. Deposited amount, in DASH. Not fixed — 125 is the target, not a rule. */
  amount: number;
  /** MOCK. ISO date the deposit was confirmed. */
  since: string;
  /** MOCK. Whether this is the operator viewing the screen. */
  you?: boolean;
}

/** MOCK. A custodial pool being assembled toward one masternode. */
export interface Pool {
  /** MOCK. Internal id. */
  id: string;
  /** MOCK. Display name for the pool. */
  name: string;
  /**
   * Sourced shape: one Regular node is `protocol.regularCollateral`. Shared
   * collateral is Regular-only, so this is always 1,000.
   */
  targetCollateral: number;
  /** MOCK. Deposit amounts actually received so far. */
  depositors: PoolDepositor[];
  /** MOCK. Lifecycle state. */
  status: 'filling' | 'ready' | 'operating' | 'waitlisted';
  /** MOCK. Plain-language explanation of `status`. */
  statusNote: string;
  /**
   * MOCK. Conditions blocking the next step, phrased as conditions and never
   * as dates. A date here would be a promise nobody can keep.
   */
  blockedBy: string[];
}

/**
 * MOCK. The operator's own custodial position.
 *
 * `waitlisted: true` is the honest state: the layer is not open, so this
 * represents the shape of the screen, not a deposit that exists.
 */
export const custodialPool: Pool = {
  id: 'pool-01',
  name: 'Titan Pool One',
  targetCollateral: protocol.regularCollateral,
  status: 'filling',
  statusNote:
    'Planned and not open. The figures below show how a pool will be tracked once the arrangement exists — no deposit has been taken.',
  depositors: [
    { owner: 'You', amount: 125, since: '2026-09-02', you: true },
    { owner: 'harborlight', amount: 125, since: '2026-09-04' },
    { owner: 'northgate', amount: 125, since: '2026-09-07' },
    { owner: 'kestrel', amount: 125, since: '2026-09-11' },
    { owner: 'juniper', amount: 125, since: '2026-09-15' },
  ],
  blockedBy: [
    'A licensed custodial arrangement in the jurisdictions we serve.',
    'The remaining deposits to reach 1,000 DASH of pooled collateral.',
  ],
};

/** MOCK. The pool the screen is designed against, derived from `custodialPool`. */
export const poolProgress = ((): {
  raised: number;
  target: number;
  pct: number;
  remaining: number;
  /** How many more even deposits of `ticketSize` would complete the pool. */
  ticketsRemaining: number;
  ticketSize: number;
  /** Sourced ceiling: a pool can never have more than `protocol.maxShares` depositors. */
  maxDepositors: number;
} => {
  const raised = custodialPool.depositors.reduce((s, d) => s + d.amount, 0);
  const target = custodialPool.targetCollateral;
  // The suggested deposit size that would land the pool on the collateral in
  // the fewest remaining slots. 125 is the mock's target, not a protocol value.
  const ticketSize = 125;
  return {
    raised,
    target,
    pct: (raised / target) * 100,
    remaining: target - raised,
    ticketsRemaining: Math.ceil((target - raised) / ticketSize),
    ticketSize,
    maxDepositors: protocol.maxShares,
  };
})();

/** MOCK. Format a DASH amount consistently. */
export const dash = (n: number): string =>
  `${n.toLocaleString(undefined, { maximumFractionDigits: 8 })} DASH`;

/** MOCK. Truncate a hex string the way a block explorer would. */
export const short = (hex: string, head = 8, tail = 6): string =>
  hex.length <= head + tail + 1 ? hex : `${hex.slice(0, head)}…${hex.slice(-tail)}`;
