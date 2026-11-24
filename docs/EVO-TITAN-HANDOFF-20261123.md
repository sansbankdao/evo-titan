# Evo Titan — FULL HANDOFF (session end, 2026-11-23)

**Read `/Workspace/sansbank/evo-titan/AGENTS.md` FIRST in every evo-titan
session** — it carries the protocol facts, the sourced constants, the
verification recipes and the rules that must hold. This file is the
session-end state snapshot and the next-session briefing. Everything below
was measured, run, or shipped this day; nothing is scheduled that is not
verifiable, and no date is claimed that is not ours to claim.

---

## 1. What this session did (commit trail, all pushed to `origin/master`)

| Commit | What |
|---|---|
| `27ab673` | Re-verified the whole shared-masternode seam against **Dash Core v24.0.3** (current release): full 2×500 DASH registration e2e on regtest (`txid edcd1847…`, height 501), suite re-run, stale activation facts corrected everywhere |
| `0bae24f` | Handoff for the **evo-titan-api** team: coordination product is desktop-only; API stays metadata/health; hard no-custody rule |
| `c39b5da` | **Phase 1 shipped** — live node wiring: settings connection form, fleet/shared live reads (`protx list wallet`), `getdeploymentinfo` panel, three-state model, 127 tests, 33-check CDP harness |
| `1deb88f` | Handoff for the **dev-dapi-proxy** team (Asks 1–3) |
| `ac50417` | `dapi.sansbank.dev` wired: `get_status` adapter (SDK names!), both networks, `coreChainLockedHeight` surfaced; public seed as labelled testnet fallback |
| `f2086c4` | `core.sansbank.dev/core-info` wired — **the testnet open item closed: v24 ACTIVE since 1,578,000**; ACK answers their two questions |
| `0e842f4` | **Phase 2 shipped** — assembly + consent envelope + owner signing + collection (this commit) |

## 2. Running right now (on this host, at handoff time)

- **The app**: `pnpm tauri dev` is running (log: `/tmp/et-tauri.log`, every
  webview route fetch is logged `[200] …`). Binary: `target/debug/evo-titan`
  (incremental dev build; the Rust side is UNCHANGED this session). Stop with
  `pkill -f evo-titan` or Ctrl-C the `pnpm tauri dev` shell. **Port 4327
  rule** applies (strictPort; the documented incident is in AGENTS.md).
- **The demo node**: docker container `etdashd243`
  (`dashpay/dashd:24.0.3`, regtest), RPC `127.0.0.1:19899`,
  user `titan` / password `titanlocaldev`, **wallet `titan` loaded, 187k DASH**,
  chain at height ~501 with one registered shared node
  (`edcd184777b90367f64273acb5696f317e835104883ab20dc49555bdcd41758d`, 2×500
  DASH shares, PoSe-banned because unserviced — rendered honestly).
  Restart recipe (wallet does NOT autoload): `docker start etdashd243` then
  `loadwallet titan` over RPC.
- Demo config for the app: Settings → Connection → `127.0.0.1:19899`,
  `titan`/`titanlocaldev`, remember, save, test (expect `Connected — 24.0.3`),
  then Demo Mode OFF.

## 3. Verified protocol state (all measured 2026-11-23)

- **Current release: v24.0.3** (`240003`). v24.0.0 final shipped 2026-11-05;
  v24.0.1 (2026-11-13) fixed the LLMK_400_85 DKG that had delayed activation.
- **TESTNET v24 IS ACTIVE — since core height 1,578,000** (EHF signal at
  1,565,132). Source: `https://core.sansbank.dev/core-info?network=testnet`
  (our own public Core-RPC surface, shipped by the DAPI team today, commit
  `0fd725b` their side). **Shared registration is possible on testnet TODAY.**
- **Mainnet v24: `started`** — EHF signal mined at height **2,573,022**;
  miner signalling since boundary **2,576,448**; window at capture
  **481/3,226 with 863 elapsed** (needs ~86.6 % of the remainder to lock in
  this window). Our derived estimate (NOT an official date): earliest
  activation block 2,584,512 (~Dec 5) if the current window recovers; likelier
  2,588,544 (~Dec 19) via the next window at threshold ~3,218.
- **`evo_shares` is `defined` on both networks** — no v24.0.x release signs it;
  a later release (v24.1) is expected to. Shared EvoNode registrations stay
  rejected (`bad-protx-shares-evo`, specialtxman.cpp:1232) until then.
- v24 removed `deployments` from `getblockchaininfo`; **`getdeploymentinfo`**
  is the method. Mainnet RPC port 9998 / testnet 19998 / regtest 19898
  (chainparamsbase.cpp:42-45).
- The e2e registration on 24.0.3 (this session): prepare → shared_sign →
  shared_combine → signrawtransactionwithwallet → sendrawtransaction, and the
  8-share rc.1 run before it — both in AGENTS.md.

## 4. What the desktop app does now

**Phase 1 (live node wiring)** — three-state model (`data-demo-mode` ×
`data-node`): demo ON = mock pages + amber banner (unchanged); demo OFF + no
node = empty state; demo OFF + configured = live sections + emerald banner.
"Configured" is presence, never "connected" — every live card renders its own
per-fetch status and the status bar names the endpoint. Screens: Settings
(real connection form, Test connection → version + full deployment table),
Fleet and Shared (live `protx list wallet`, honest PoSe health), Network
status card (below).

**Phase 2 (coordination, desktop-only, NO SERVER anywhere)** —
`src/lib/coordination.ts` (pure, 19 tests): share-table validation naming each
consensus rejection; the session envelope
(`evo-titan.shared-registration-session` v1, node's prepare reply verbatim);
signature artifacts (`evo-titan.shared-registration-signature` v1); collection
that REFUSES signatures whose consentHash does not match. Screens:
`/assemble/` (coordinator: share table 2–8, wallet-generated addresses,
terms, `shared_register_prepare` with funding inputs from the connected
wallet, envelope copy/download, signature import, live collection; session
persists under `evotitan.assemblySession`) and `/signing/` live section
(owner: envelope import, the NODE's decoded terms with the consentHash as the
human-checkable code, `shared_sign`, signature file export). **Phase 3
(combine/broadcast) is NOT shipped — the screens say so.**

**Network status card** — reads BOTH networks live from our own infra:
`dapi.sansbank.dev/v1/dapi` (`get_status` — SDK method names, adapter
`src/lib/dapi-sansbank.ts`, carries `coreChainLockedHeight`) and
`core.sansbank.dev/core-info` (`src/lib/core-info.ts`). Public testnet seed as
a labelled testnet fallback. Sources are labelled per row.

## 5. Verification state (keep these green before any release)

- `cd apps/desktop && pnpm test` — **164/164 with the regtest node up**
  (148 without the integration half; integration auto-skips).
- `node scripts/verify-live.mjs` (dev server on :4327) — **49/49 checks**:
  the full live UI against REAL captured 24.0.3 fixtures through a stubbed
  Tauri IPC (the stub replays recorded replies; the DAPI/core-info calls are
  REAL network calls), plus the whole Phase 2 flow:
  assemble → prepare (captured consent hash `8cc717d857f3a131…`) →
  envelope → signing (3 share rows from the node's terms, 10 % cut) →
  shared_sign (3 signatures) → back to assemble (session restored) →
  import → **collection complete 3/3**.
- Fixtures in `src/lib/fixtures/` are REAL captures from 24.0.3 and the two
  sansbank services — the tests pin the shapes; if a service changes shape,
  the tests fail before any screen misrenders.

## 6. The three-team exchange (all docs in this repo)

- `docs/EVOTITAN-API-HANDOFF.md` — API team: desktop-only product; they keep
  `/v1/` + `/v1/health`; **never keys/signatures/collateral**. §6.1 (testnet
  state) CLOSED with the core-info source.
- `docs/DEV-DAPI-PROXY-HANDOFF.md` → `-REPLY.md` → `docs/CORE-INFO-ACK-20261123.md`
  — the DAPI team delivered Ask 1 as `core.sansbank.dev/core-info` (live,
  verified, wired). Answered their questions: `getbestchainlock` not needed;
  Phase 2 broadcast not needed (hard rule stands; broadcast-only-for-completed-txs
  is the only acceptable future shape). `get_best_block_hash` remains
  unsupported and unneeded.

## 7. Rules that must hold (the short list; all in AGENTS.md with reasons)

1. The node is the source of truth; node errors render verbatim; no fake
   transport is ever wired to make the UI show data.
2. No server ever in the signing/custody path; the pool is self-custodial.
3. `data-node` is presence, not connection; nothing says "connected" untested.
4. The inline pre-paint script in Layout.astro duplicates
   `node-config.ts`'s `isConfigured` shape — keep them in step.
5. Exit-terms arithmetic: 10,000 blocks × 150 s = **17.36 days** (do not
   re-derive 173); 17,280 blocks = exactly 30 days is the cross-check.
6. Percent-string `operatorReward` ("10.00"), never a number.
7. Demo Mode contract intact: demo ON = fabricated data + amber banner, always.
8. One task = one commit + push, as `Sansbank contributors <hello@sansbank.org>`
   (repo-local git config; never inline flags).

## 8. What remains (next sessions)

1. **Phase 3 — execution**: `shared_combine` (registrations: `submit=false`,
   funding inputs still need signing), `signrawtransactionwithwallet`,
   `sendrawtransaction`, then the **mandatory standby-dissolution offer**
   (`protx shared_dissolve <proTxHash> <shareIndex> <fee> false false`) —
   this is the node help's own IMPORTANT instruction and it belongs in the
   product. All verified primitives exist in `rpc-core.ts`.
2. **Release**: shipping Phases 1–2 means moving the version in its SIX
   documented places (package.json, tauri.conf.json, Cargo.toml, Cargo.lock,
   StatusBar.astro, settings.astro) — a product-owner decision, not assumed.
3. **Mainnet activation watch**: re-read
   `core.sansbank.dev/core-info?network=mainnet` after the window ending
   ~2026-11-28 (block 2,580,480); the app already surfaces it natively.
4. **Testnet pilot**: protocol gate is open (v24 ACTIVE) — schedule a real
   multi-wallet registration on testnet when the operator infrastructure
   exists; the flow is built and verified.
5. `evo_shares` (shared EvoNodes): expected in Dash v24.1 — no date exists;
   do not pre-announce.

*Prepared inside the `evo-titan` monorepo. Neither `evo-titan-api` nor
`dev-dapi-proxy` was modified by this session; their teams were handed the
docs above.*
