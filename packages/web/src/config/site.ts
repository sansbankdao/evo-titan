// packages/web/src/config/site.ts — Evo Titan
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  CONTENT STATUS                                                          ║
// ║                                                                          ║
// ║  PROTOCOL FACTS are sourced from Dash Core v24.0.0-rc.1 and cite the     ║
// ║  file that proves them. Do not change those without changing the source. ║
// ║                                                                          ║
// ║  EVERYTHING MARKED `MOCK` IS INVENTED. Pricing, statistics, testimonials,║
// ║  roadmap dates and product capabilities have NOT been verified. They are ║
// ║  placeholders so the page renders. Replace before launch.                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const site = {
  name: 'Evo Titan',
  tagline: 'Own a masternode together. Run a fleet alone.',
  lede: 'Evo Titan is the desktop command centre for Dash masternode and evonode operators. Pool collateral with up to eight co-owners, coordinate every signature, and watch your whole fleet from one screen.',
  previewBadge: 'Preview — placeholder content',
};

// ---------------------------------------------------------------------------
// Protocol facts (sourced)
// ---------------------------------------------------------------------------

/**
 * Verified from Dash Core v24.0.0-rc.1. Each number cites its file.
 * These are consensus rules, not marketing.
 */
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
  /** src/evo/providertx.cpp:280 — shared registration requires MnType::Regular.
   *  Evo nodes are rejected with `bad-protx-shares-evo`. */
  sharedSupportedOnEvoNodes: false,
  /** src/evo/providertx.cpp:466 — dissolution is unilateral OR unanimous. */
  dissolution: 'unilateral or unanimous',
  /** src/evo/providertx.cpp — earlyPenalty must be < smallest share amount. */
  earlyExitPenalty: true,
};

// ---------------------------------------------------------------------------
// The four pillars
// ---------------------------------------------------------------------------

/** MOCK descriptions. The four pillars are the agreed direction; wording is invented. */
export const pillars = [
  {
    id: 'shared',
    label: 'Shared ownership',
    title: 'Split the collateral, not the control',
    body: `Dash Core v24 lets ${protocol.minShares}–${protocol.maxShares} operators co-own one masternode. Evo Titan is the coordination layer: collect every co-owner signature, verify each one, and register the node without a single copy-pasted hex blob.`,
  },
  {
    id: 'fleet',
    label: 'Fleet management',
    title: 'Every node, one umbrella',
    body: 'Regular masternodes and evonodes side by side. Status, version compliance, reward queue and collateral health across the whole fleet — not one SSH session at a time.',
  },
  {
    id: 'intents',
    label: 'Dash Intents',
    title: 'The recommended way into Dash Intents',
    body: 'Evo Titan is built to be the recommended desktop companion for Dash Intents. Review solver offers and settle intents with the same identity you already use to run your nodes.',
  },
  {
    id: 'usdc',
    label: 'Dash USDC',
    title: 'Manage your shielded dollar position',
    body: 'Track a USDC-backed stablecoin position alongside your node collateral, in the same portfolio view as your masternode rewards.',
  },
];

// ---------------------------------------------------------------------------
// MOCK statistics — invented
// ---------------------------------------------------------------------------

export const stats = [
  { label: 'Co-owners supported', value: `${protocol.minShares}–${protocol.maxShares}`, sourced: true },
  { label: 'Collateral pooled', value: `${protocol.regularCollateral.toLocaleString()} DASH`, sourced: true },
  { label: 'Operators waiting', value: '2,300+', sourced: false },
  { label: 'Uptime target', value: '99.99%', sourced: false },
];

// ---------------------------------------------------------------------------
// MOCK feature grid — invented wording
// ---------------------------------------------------------------------------

export const features = [
  {
    icon: 'share',
    title: 'Signature collection without the ritual',
    body: 'Assemble the transaction, circulate a short session envelope, and absorb each co-owner signature only after it verifies against their key. A participant who cannot verify is never counted.',
  },
  {
    icon: 'pulse',
    title: 'Fleet health at a glance',
    body: 'Port checks, block height, peer count and protocol version for every node, refreshed continuously and grouped by provider or region.',
  },
  {
    icon: 'coins',
    title: 'Reward and penalty tracking',
    body: 'Follow the deterministic payout queue, see which co-owner is paid next, and keep the early-exit penalty terms visible before anyone signs them.',
  },
  {
    icon: 'shield',
    title: 'Keys that never leave your machine',
    body: 'Signing happens in the desktop client. Collateral, voting keys and share owner keys stay on the hardware you control.',
  },
  {
    icon: 'bell',
    title: 'Alerts that reach you',
    body: 'Know when a node leaves the enabled set, falls behind the expected version, or is due a payment you have not claimed.',
  },
  {
    icon: 'layers',
    title: 'Many nodes, one workflow',
    body: 'Apply updates in bulk, compare fleets over time, and keep a consistent view as you grow from one node to thirty.',
  },
];

// ---------------------------------------------------------------------------
// MOCK onboarding steps — invented
// ---------------------------------------------------------------------------

export const steps = [
  { title: 'Connect', body: 'Add your nodes by RPC endpoint. Read-only to begin, no keys required.' },
  { title: 'Coordinate', body: 'Invite co-owners, agree the split, and collect signatures inside Evo Titan.' },
  { title: 'Compound', body: 'Track rewards across the fleet and plan your next node with the calculator below.' },
];

// ---------------------------------------------------------------------------
// MOCK pricing — invented, and deliberately does NOT gate key access
// ---------------------------------------------------------------------------

/**
 * MOCK tiers. The agreed direction: PRO sells AI assistance, automation and
 * reporting, and is gated by the API. PRO must never gate access to a user's
 * own keys or their ability to sign — a lapsed subscription cannot be allowed
 * to lock someone out of their collateral.
 */
export const tiers = [
  {
    id: 'free',
    name: 'Operator',
    price: 'Free',
    note: 'MOCK PRICING',
    features: [
      'Unlimited local nodes',
      'Shared masternode coordination',
      'Fleet health dashboard',
      'Client-side signing, always',
    ],
    cta: 'Download',
    available: false,
  },
  {
    id: 'pro',
    name: 'Titan PRO',
    price: '$—/mo',
    note: 'MOCK PRICING — price undecided',
    features: [
      'AI assistant for automation and reporting',
      'Hosted API: remote metrics, remote alerts',
      'Cross-fleet governance automation',
      'Priority node version guidance',
      'Keys remain client-side',
    ],
    cta: 'Join the waitlist',
    available: false,
    highlighted: true,
  },
];

// ---------------------------------------------------------------------------
// MOCK calculator defaults — invented, user-overridable
// ---------------------------------------------------------------------------

/**
 * The projection is a USER-DRIVEN calculator, not a promise. Every default is a
 * placeholder and every figure is recomputed from what the operator types, so
 * the page never asserts an expected return.
 */
export const calculator = {
  defaults: {
    /** MOCK: number of nodes an operator plans to run. */
    nodes: 3,
    /** MOCK: operator's share of each node, in percent. */
    sharePercent: 100,
    /** MOCK: reward per node per month, in DASH. */
    dashPerNodeMonth: 4.4,
    /** MOCK: DASH price used to express the result in dollars. */
    dashPrice: 0,
  },
};

/** MOCK roadmap. Nothing here is scheduled or funded. */
export const roadmap = [
  { when: 'Now', what: 'Desktop client, shared-ownership coordination', state: 'planned' },
  { when: 'Next', what: 'Titan PRO: AI assistance and hosted API', state: 'planned' },
  { when: 'Later', what: 'Dash Intents companion, Dash USDC view', state: 'planned' },
];
