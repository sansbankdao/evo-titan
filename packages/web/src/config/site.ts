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
// The operator's path
// ---------------------------------------------------------------------------

/**
 * Evo Titan's OWN rank ladder. NONE of these names are Dash protocol terms:
 * "cluster" appears nowhere in Dash Core v24.0.0-rc.1 (a tree-wide grep returns
 * only unrelated fuzz fixtures under src/immer), and neither does any rank name
 * below. The REQUIREMENTS are consensus and sourced; the ranks are our
 * positioning language. The top rank is the product's namesake: run enough
 * evonodes and you are an Evo Titan.
 */
export const levels = [
  {
    rank: 'I',
    name: 'Shareholder',
    requirement: `from ${protocol.minShareAmount} DASH`,
  },
  {
    rank: 'II',
    name: 'Operator',
    requirement: `${protocol.regularCollateral.toLocaleString()} DASH`,
  },
  {
    rank: 'III',
    name: 'Fleet Operator',
    requirement: 'n × 1,000 DASH',
  },
  {
    rank: 'IV',
    name: 'Evo Operator',
    requirement: `${protocol.evoCollateral.toLocaleString()} DASH`,
  },
  {
    rank: 'V',
    name: 'Evo Titan',
    requirement: 'n × 4,000 DASH',
    titan: true,
  },
];

// ---------------------------------------------------------------------------
// The custodial layer — PLANNED, NOT AVAILABLE
// ---------------------------------------------------------------------------

/**
 * A CUSTODIAL entry point that sits BELOW the numbered ranks.
 *
 * It is deliberately Rank 0 rather than a new Rank I: the numbered ladder
 * describes an operator's own collateral, and this layer is a different
 * arrangement — the operator does not hold the collateral, we do. Folding it
 * into the ladder would imply a rung on the same staircase. It is a doorway,
 * not a rung.
 *
 * NOTHING HERE IS LIVE. No deposit is accepted, no address is published, no
 * balance is held. `available: false` gates every surface that renders it, and
 * `waitlist` is the only thing a user can reach.
 *
 * The whole block is data, not copy baked into a component, so the day this
 * ships it is enabled by flipping `available` and filling the TODO fields —
 * rather than hunting through markup for numbers that were only ever prose.
 */
export const custodial = {
  /** Flip to true ONLY when a licensed arrangement and an operator exist. */
  available: false,

  rank: '0',
  name: 'Custodial',
  label: 'Let us run it for you',

  /** The entry threshold. Sourced from the user's decision, not the protocol. */
  minimum: 1,
  minimumLabel: 'from 1 DASH',

  /**
   * MOCK. One sentence, plainly stating the custody relationship. This is the
   * claim most likely to be misread, so it is stated rather than implied: the
   * operator does not hold the collateral.
   */
  body: 'Below the first rank there is a simpler way in. Instead of raising the full collateral, you deposit an amount you choose and we operate a masternode on your behalf. The collateral is held by us, not by you — which is the whole point, and also the trade-off.',

  /**
   * The honest trade-off list. Rendered as-is. Custody means giving something
   * up, and a page that hides that is a page that misleads.
   */
  tradeoffs: [
    'We hold the collateral. You hold a claim on it, not the coins.',
    'You do not hold the node keys or the voting key.',
    'Withdrawal depends on us having the liquidity to return your deposit.',
  ],

  /**
   * What the layer is waiting on. Both are stated as conditions, not dates:
   * there is no date, and inventing one would be a promise we cannot keep.
   */
  waitingOn: [
    'A licensed custodial arrangement in the jurisdictions we serve.',
    'At least 1,000 DASH of pooled deposits, the collateral for a first masternode.',
  ],

  /**
   * MOCK. The waitlist is the ONLY reachable action. No deposit flow exists.
   * TODO(launch): replace with a real form once the arrangement above exists.
   */
  waitlist: {
    label: 'Join the waitlist',
    available: false,
    /**
     * TODO(launch): set to the real endpoint. Left empty on purpose: a
     * placeholder URL that silently accepts a signup would be worse than a
     * disabled button, because a user would believe they had joined.
     */
    endpoint: '',
  },

  /** Rendered under the block so the status is never implied by layout alone. */
  notice: 'Planned. Not open yet — no deposits are accepted and no address is published.',
};

export const journey = {
  title: 'Your first Evo node',
  note: 'Stage requirements are Dash Core v24 consensus. The ranks and names are ours.',
  stages: [
    {
      id: 'share',
      rank: 'I',
      step: '01',
      label: 'Take a share',
      amount: `from ${protocol.minShareAmount} DASH`,
      body: 'Buy into a shared masternode without raising the full collateral. Dash Core v24 allows 2–8 co-owners to pool exactly 1,000 DASH.',
    },
    {
      id: 'whole',
      rank: 'II',
      step: '02',
      label: 'Own a whole masternode',
      amount: `${protocol.regularCollateral.toLocaleString()} DASH`,
      body: 'Once you hold the full regular collateral, register a node in your own name. Rewards stop being split.',
    },
    {
      id: 'many',
      rank: 'III',
      step: '03',
      label: 'Run many',
      amount: 'n × 1,000 DASH',
      body: 'Add nodes to the same console. One identity, one workflow, however large the fleet gets.',
    },
    {
      id: 'evonode',
      rank: 'IV',
      step: '04',
      label: 'Your first Evo node',
      amount: `${protocol.evoCollateral.toLocaleString()} DASH`,
      body: 'Step up to an evonode, which carries four times the voting weight of a regular masternode. It is registered whole, by one owner — shared collateral cannot be used for an evonode.',
    },
    {
      id: 'titan',
      rank: 'V',
      step: '05',
      label: 'Evo Titan',
      amount: 'n × 4,000 DASH',
      body: 'This is the rank the product is named for. Run many evonodes as one enterprise setup — a fleet of high-weight nodes under a single console — and you are an Evo Titan.',
    },
  ],
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
    title: 'Ready before it ships',
    body: 'A USDC-backed stablecoin for Dash is announced for the coming months and is not live yet. Evo Titan is being built to support it from the day it lands, so your dollar position sits beside your node collateral in one portfolio view.',
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
// Pricing
// ---------------------------------------------------------------------------

/**
 * Titan PRO pricing is DECIDED (not mock): $5.00/month, paid in DASH. An
 * earlier 30%-off-for-USDC idea was REMOVED on the user's instruction.
 *
 * Payments are limited to the two assets our audience holds. No third-party
 * processor. `paymentMethods` records what is chargeable today.
 *
 * Standing constraint, not a mock: no tier gates access to a user's own keys or
 * their ability to sign. A lapsed subscription must never lock an operator out
 * of their own collateral.
 */
const PRO_PRICE_MONTHLY = 5;

/** Prices are formatted to 2 decimals so "$5.00" never renders as "$5". */
const money = (n: number): string => `$${n.toFixed(2)}`;

export const pricing = {
  /** Priced in USD, settled in DASH or (later) Dash USDC. */
  currency: 'USD',
  monthly: PRO_PRICE_MONTHLY,
  monthlyLabel: money(PRO_PRICE_MONTHLY),
};

/**
 * Payment methods are LIMITED to DASH and Dash USDC, at the user's direction
 * ("our audience are Dash MNOs"). NOWPayments was dropped entirely.
 *
 * Dash USDC does not exist yet — it is announced for the coming months — so its
 * entry is `available: false` and nothing renders a payable link for it.
 */
export const paymentMethods = [
  { id: 'dash', label: 'DASH', available: true, note: 'Pay from the wallet you already run' },
  {
    id: 'usdc',
    label: 'Dash USDC',
    available: false,
    note: 'Coming soon — Dash USDC is announced but not live',
  },
];

/**
 * MOCK feature list for the tiers. Pricing is real; the feature wording is not.
 */
export const tiers = [
  {
    id: 'free',
    name: 'Operator',
    price: 'Free',
    note: 'Free forever',
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
    price: `${pricing.monthlyLabel}/mo`,
    note: 'Billed monthly',
    /**
     * Gates the payment-method badges in Pricing.astro. The methods themselves
     * come from `paymentMethods`; this flag only says "show them on this tier".
     */
    showPaymentMethods: true,
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
  {
    when: 'Watch',
    what: 'Dash USDC support, tracked from Testnet onward',
    state: 'watching',
  },
];
