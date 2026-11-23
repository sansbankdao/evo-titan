# Evo Titan API — team handoff: the shared-masternode coordination product is DESKTOP-ONLY

**Written 2026-11-23, from the evo-titan monorepo session that re-verified the
whole shared-masternode seam against the current Dash release.** Everything
below carries a source: a file in this repo, a live measurement from today, or
a pinned upstream tag. Nothing here is a guess; where something could not be
verified it is listed under "Open verification items" instead of stated.

---

## 1. The one-sentence version

The full shared-masternode coordination product — participant assembly, consent
collection, per-owner signing, registration execution, exit terms — will be
built **inside the desktop app only** (this monorepo, `apps/desktop`); the API
repo (`evo-titan-api`) keeps metadata/health and is **not** on the critical
path for any Phase 1–3 feature, and must never be on the path for anything
that touches keys, collateral, or signatures.

## 2. Why the API team is explicitly OUT of the money path

- The shared pool is **self-custodial by design**: every share owner holds
  their own key, and the product promise is "share owner keys stay on the
  hardware you control" (`packages/web/src/config/site.ts:294`). The fee is
  coordination-only, 10% of the gross node reward inside a sourced 10–20%
  band (`apps/desktop/src/lib/mock.ts`, `fees`; rationale in `site.ts`).
- The repo's non-negotiable rules already forbid the alternative: "Never gate a
  user's own keys behind payment" and "A fake transport must never be wired to
  make the UI show data" (repo `AGENTS.md`).
- Dash's own consent mechanism enforces it: `shared_register_prepare` returns
  a **consentHash that each share owner signs with their own key**
  (`protx shared_sign` signs "with every share owner key the wallet holds").
  A server collecting those signatures would be a server collecting owner
  keys' signatures — exactly the custodial arrangement this product does not
  sell.

**Therefore: no endpoint of `evo-titan-api` may ever accept, relay, store, or
proxy a consent signature, an owner key, a funding transaction, or collateral.
If a future ticket asks for one, that ticket is asking for the custodial
product and must be routed back to the product owner, not implemented.**

## 3. Verified protocol state (measured 2026-11-23)

These are the facts any API-side planning must start from. Full citations in
repo `AGENTS.md` ("Mainnet v24 activation", "DAPI testnet" sections).

| Fact | State | Source |
|---|---|---|
| Current Dash release | **v24.0.3** (`240003`, `/Dash Core:24.0.3/`) | GitHub tags; measured live on regtest today |
| Mainnet `DEPLOYMENT_V24` | Scheduled from **2026-11-09**; bit 13; window 4032; 80%→60% threshold; EHF-gated | `src/chainparams.cpp:213-220` @ v24.0.3 |
| Mainnet activation status | **NOT ACTIVE** — tip 2,577,229 < earliest possible 2,580,480; EHF signal mined ~Nov 21–22; first counted window ends ~Nov 28 at ~55% sampled signalling | live blockchair/insight sampling today; v24.0.0 + v24.0.1 release notes |
| Earliest realistic activation | Our derived estimate: block 2,584,512 (~Dec 5) best case, likelier 2,588,544 (~Dec 19). **Not an official date** | derived from the release-notes state machine + today's samples |
| Shared registration on mainnet today | **Impossible** (pre-activation) | status above |
| Testnet v24 deployment | Started 2026-09-24; **activation state UNVERIFIED** — no public endpoint exposes `getblockchaininfo`/`getdeploymentinfo` | `chainparams.cpp:425-432`; DAPI/insight method sets, today |
| `evo_shares` (shared EvoNodes) | Bit 14, identical params, **NOT signed by any v24.0.x**; expected in v24.1; `bad-protx-shares-evo` until then | `specialtxman.cpp:1229-1233` @ v24.0.3; release notes |
| The seam (seven `protx shared_*` subcommands) | Verified **end-to-end on v24.0.3 regtest** today: 2×500 DASH shares, txid `edcd1847…`, height 501, `operatorReward "10.00"` → `10` round-trip | `apps/desktop/src/lib/rpc-core.test.ts` (54/54), `rpc-core.ts` header |
| Mainnet RPC port | 9998 (testnet 19998, regtest 19898) | `src/chainparamsbase.cpp:42-45` @ v24.0.3 |
| Deployment state RPC | v24 dropped `deployments` from `getblockchaininfo`; **`getdeploymentinfo`** is the replacement | verified live on 24.0.3 |

## 4. DAPI testnet — the one Dash endpoint a browser CAN reach (verified today)

- `https://seed-1.testnet.networks.dash.org:1443/` — synced **block-exact**
  with `insight.testnet.networks.dash.org` (`getBlockHash(1597239)` identical
  on both). Platform stack reports DAPI/Drive `5.0.0-rc.8`, `catching_up: false`.
- **CORS**: DAPI answers OPTIONS with `access-control-allow-origin` reflecting
  any request Origin (measured with `http://localhost:4327` and
  `http://tauri.localhost`). Unlike dashd (no CORS headers, 501 on OPTIONS),
  DAPI is callable straight from the Tauri webview.
- Complete JSON-RPC method set: `getBestBlockHash`, `getBlockHash`,
  `getStatus`, `sendRawTransaction` — everything else is gRPC(-web).
- DAPI 5.0's `sendRawTransaction` **accepts version-3 provider transactions**
  (ProRegTx/ProUpServTx) that earlier DAPIs refused (Platform docs).
- Consequence for us: the desktop can read testnet chain data (hashes,
  heights, platform status) through DAPI with zero local node. It **cannot**
  read masternode lists (gRPC `getMnListDiff` only), deployment state (no
  method), or anything wallet-scoped. The operator's own dashd remains the
  primary source; DAPI is the fallback for header-level facts.

## 5. What the desktop will build (phases), and what it needs from you

Nothing in Phases 1–3 requires an `evo-titan-api` endpoint. The desktop's own
verified plumbing carries it:

- **Phase 0 — DONE.** RPC seam (`rpc-core.ts` pure client + `rpc.rs` Rust
  transport), 54-test suite, end-to-end registration proof on the current
  release (today).
- **Phase 1 — Node connection + read-only live data.** Settings screen gains
  real host/port/user/password, persistence, "Test connection" (the fields and
  disabled controls already exist in `settings.astro`); fleet screens read
  `protx list` / `protx info` (the `shares` table for version-3 nodes) /
  `masternode winners` / `getblockchaininfo` from the operator's own node
  through the existing Rust proxy. Demo Mode (`evotitan.demoMode`) keeps the
  mock/mock-banner honesty model.
- **Phase 2 — Pool assembly + consent collection, desktop-to-desktop.** A
  coordinator's desktop builds the share table and runs `shared_register_prepare`;
  the resulting session envelope (tx hex + consentHash + decoded terms) is
  exported (file / QR / clipboard — product choice pending) and each owner's
  desktop runs `shared_sign` against THEIR OWN wallet, then returns base64
  signatures keyed by shareIndex. No server holds anything; the signing screen
  model already exists as a mock (`signing.astro`).
- **Phase 3 — Registration execution + exit terms.** `shared_combine`,
  `signrawtransactionwithwallet`, `sendrawtransaction` on the coordinator's
  node; mandatory standby-dissolution creation (`protx shared_dissolve
  <proTxHash> <shareIndex> <fee> false false`) offered to every participant —
  this is the node help's own IMPORTANT instruction. Exit terms
  (`earlyPeriodBlocks` / `earlyPenalty`) fixed at registration, shown before
  signing.
- **Phase 4 — Pooled governance voting.** Per `docs/vote-amplification.md`:
  member preference collection and tally → the pool's single vote cast by the
  voting-key holder. Capture risk must be named next to the participation
  benefit. Platform-published preferences are a design commitment, not a
  shipped property.

**API-side asks (small, deliberate):**

1. Keep `GET /v1/` and `GET /v1/health` truthful (service version, status).
   The desktop may use them for a "backend reachable" indicator only.
2. Do not add product endpoints speculatively. When a desktop feature needs
   one (e.g. a future app-version feed, release-notes feed, or Titan PRO
   subscription validation), the desktop team will open a ticket with the exact
   request/response shape — same OpenAPI-first pattern the repo already uses
   (`createRoute` + zod, `src/index.ts`).
3. The `evotitan.app` Cloudflare zone is still unregistered (per your README);
   nothing above depends on it.
4. If you build anything that references masternodes or DASH amounts, the
   wording rules in this repo's `AGENTS.md` apply verbatim: **share**, never
   "slot"; self-custodial pool ≠ custodial service; the fee ladder is
   0% / 10% / 30% and is OUR price, not consensus; no unsourced numbers —
   especially no APY-as-fact (the node count is a labelled assumption).

## 6. Open verification items (blocking, in order)

1. **Testnet v24 deployment state — CLOSED 2026-11-23.** Verified ACTIVE
   since core height 1,578,000 via
   `https://core.sansbank.dev/core-info?network=testnet` (Sansbank's public
   read-only Core-RPC surface, shipped by the DAPI team that day; evo_shares
   `defined`). The original text follows for the record: it needed
   `getdeploymentinfo` from an operated testnet node and no public endpoint
   exposed it; the pilot may now be scheduled, and "testnet v24 is active"
   may be claimed — with the height cited.
2. **Mainnet activation watch.** Re-read the numbers after the window ending
   ~2026-11-28 (block 2,580,480): sample block versions via blockchair
   (`dash/dashboards/block/<height>` carries `version_hex`; bit 13 = `0x2000`).
   The desktop's Phase 1 should surface this read natively via
   `getdeploymentinfo` against the operator's node.
3. **Full 8-share e2e on v24.0.3** (the 2026-09-27 rc.1 run was 8×125 DASH;
   today's 24.0.3 run was 2×500 DASH). Cheap to repeat with the updated
   recipe in `AGENTS.md` (port **19899**, `-vbparams=…:0`, `createwallet`
   first).
4. **A real `protx update_service` operator-payout test** on 24.0.3, if the
   shared-pool fee (`operatorReward` + `scriptOperatorPayout`) is to be
   exercised rather than left folded into the split — see `AGENTS.md`
   "nOperatorReward on a shared node".

## 7. Reference — the verified RPC surface (v24.0.3)

All are **subcommands of `protx`** (`params[0]`); a top-level `shared_sign`
returns `-32601`. Verified by the suite that ran against 24.0.3 today:

| Call | Arity / notes |
|---|---|
| `protx shared_register_prepare fundingTx shares coreP2PAddrs operatorPubKey votingAddress operatorReward earlyPeriodBlocks earlyPenalty` | `operatorReward` is a **percent string** `"0.00"–"100.00"`; share table order is consensus-significant; result carries `tx`, `collateralIndex`, `consentHash`, `terms`, and `warning` **only when `earlyPenalty` is zero** |
| `protx shared_sign tx (allowTimeLocks)` | signs with every share-owner key the wallet holds; base64 signatures keyed by `shareIndex`; needs a loaded wallet |
| `protx shared_combine tx signatures (submit)` | `submit` unavailable for registrations (funding inputs still need wallet signing) |
| `protx shared_dissolve proTxHash actorIndex (fee submit payPenalty)` | fee ceiling 1,000,000 duffs; `submit=false` returns offline standby hex that never expires after the early period |
| `protx shared_dissolve_prepare` / `protx shared_update_share` (4th arg `feeSourceAddress`) / `protx shared_update_registrar_prepare` | unanimity required for registrar updates |
| `protx info proTxHash` | shares table nests under `state.shares` for version-3 nodes |
| `getdeploymentinfo` | replaces `getblockchaininfo`'s removed `deployments` |

Ports: mainnet RPC 9998, testnet 19998, regtest 19898 (`chainparamsbase.cpp:42-45`).

---

*Prepared inside the `evo-titan` monorepo; `evo-titan-api` was not modified.
Questions route back through the product owner with this file attached.*
