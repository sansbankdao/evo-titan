# Handoff for the `dev-dapi-proxy` team — what the Evo Titan desktop needs from `dapi.sansbank.dev`

**Written 2026-11-23, from the evo-titan monorepo, the day Phase 1 live wiring
shipped (commit trail on `sansbankdao/evo-titan`).** Everything below is
measured today or carries a file path. Where something could not be verified it
says so. This repo was not modified by writing this file, and nothing outside
the evo-titan monorepo was touched.

---

## 1. Where we are

The Evo Titan desktop app now reads **live** data: an operator points it at
their own dashd (`Settings → Connection`, persisted as `evotitan.nodeConfig`),
and the fleet / shared / settings screens read `protx list wallet`,
`getblockchaininfo`, `getnetworkinfo` and `getdeploymentinfo` through the app's
verified JSON-RPC client (`apps/desktop/src/lib/rpc-core.ts`) and the release-
shipped Rust proxy (`apps/desktop/src-tauri/src/rpc.rs`).

Independently of any local node, the app also renders a **Testnet status card**
read from the PUBLIC DAPI seed `https://seed-1.testnet.networks.dash.org:1443/`
(`apps/desktop/src/pages/index.astro`, `data-dapi-card`). That call is made
from inside the webview — possible because the public seed answers an OPTIONS
preflight with `access-control-allow-origin` reflecting the request Origin
(measured 2026-11-23 against `http://localhost:4327` and `http://tauri.localhost`).

## 2. What we measured on your service today

- `https://dapi.sansbank.dev/` resolves (Cloudflare) and `/health` reports:
  `mode: "JS-SDK Worker Pool (Race Mode)"`, pool 10, redundancy 5, `alertCount: 0`.
- `/openapi.json` reports **Sansbank DAPI Proxy v26.1.8** — a unified DAPI
  router (`POST /` alias of `/v1/dapi`, plus `/dcg`, `/pshenmic`, `/evo`) built
  on the DCG WASM SDK and Pshenmic libraries.
- The router does NOT speak raw DAPI JSON-RPC: `getBestBlockHash` and
  `getStatus` both answer `{"success":false,"error":"Method '…' is not
  supported.","type":"SDK_EXECUTION_ERROR"}`.
- So today the desktop cannot use `dapi.sansbank.dev` for anything it needs;
  it uses the public seed. We would rather be on your infra.

## 3. The asks, in priority order

### Ask 1 — the one that closes our biggest open verification item: `getdeploymentinfo`

Dash Core v24 **removed** the `deployments`/`softforks` key from
`getblockchaininfo` (verified live against 24.0.3) and replaced it with
**`getdeploymentinfo`** — the only method that reports whether `v24`
(shared masternodes) and `evo_shares` are `defined/started/locked_in/active`
per network. **No public endpoint exposes it**: not the DAPI seed (its JSON-RPC
surface is only `getBestBlockHash`, `getBlockHash`, `getStatus`,
`sendRawTransaction`), not insight, not any explorer.

We therefore cannot tell our users whether testnet v24 is active without
running our own testnet node — and that state gates our whole testnet pilot
(`AGENTS.md` in the evo-titan repo, "Open verification items"; the same item is
§6.1 of `docs/EVOTITAN-API-HANDOFF.md`).

**Ask:** expose a passthrough to a **v24.0.x dashd** (testnet first, mainnet
when you have one) for `getdeploymentinfo`, plus `getblockchaininfo` and
`getnetworkinfo`, e.g.:

```
POST https://dapi.sansbank.dev/v1/core
{"network":"testnet","method":"getdeploymentinfo","params":[]}
```

with a reply carrying at minimum `deployments.v24` and
`deployments.evo_shares` verbatim (`{type, active, height, bip9:{status,
since, ehf}}`). If a raw-core passthrough is out of scope for the router, a
curated `GET /v1/deployments?network=testnet` works just as well for us.

### Ask 2 — the four standard DAPI JSON-RPC methods, so the status card moves onto your domain

`getBestBlockHash`, `getBlockHash(height)`, `getStatus`, `sendRawTransaction`
— the complete JSON-RPC method set a DAPI node offers. We use the first and
third today; the second is useful; the fourth matters in Phase 2 (below).
Two requirements beyond the methods themselves:

1. **CORS**: reflect the request Origin exactly as the public seed does
   (measured: `access-control-allow-origin: <origin>` on both the OPTIONS
   preflight and the POST). A wildcard is fine too; what matters is that a
   Tauri webview origin (`http://tauri.localhost`, `http://localhost:4327`)
   can call it directly from page scripts.
2. **Published rate limits** for desktop clients, so the app can back off
   honestly instead of discovering the limit by being dropped.

### Ask 3 — Phase 2 (later, do not build it yet): broadcasting registrations

When Evo Titan builds shared-masternode registrations (desktop-only,
Phase 2), broadcasting a finished v3 ProRegTx through DAPI
`sendRawTransaction` is an attractive option for coordinators who do not run
their own node: DAPI 5.0 "decodes Dash Core v24 transactions, so version 3
provider transactions (ProRegTx and ProUpServTx), previously refused, are now
accepted" (Platform docs, JSON-RPC reference). We will come back with exact
request/response shapes when Phase 2 starts. Nothing custody-related will
ever be asked of you — see the hard rule below.

### The hard rule (same as the evo-titan-api team's)

**No endpoint of yours may ever accept, relay, store or proxy a consent
signature, an owner key, a funding transaction, or collateral.** The shared
pool is self-custodial: every share owner signs with their own key on their
own hardware, and the product promise is "share owner keys stay on the
hardware you control" (`packages/web/src/config/site.ts:294`). A server in
the signature path would be a server in the custody business — different
product, different licence, not this one.

## 4. Facts your team may want, free of charge (all measured/sourced 2026-11-23)

| Fact | Value | Source |
|---|---|---|
| Current Dash Core release | v24.0.3 (`240003`) | github tags + live regtest node |
| Mainnet v24 activation | NOT active yet; earliest realistic ~Dec 5–19 (our derived estimate) | live block sampling; release notes |
| `getdeploymentinfo` | the v24 method for activation state; `getblockchaininfo` carries none | verified on 24.0.3 |
| DAPI JSON-RPC surface | only `getBestBlockHash`, `getBlockHash`, `getStatus`, `sendRawTransaction` | Platform docs + live calls |
| `getStatus` payload shape | everything nests under `version.v0` — including `chain.catching_up` | live call, 2026-11-23 |
| Testnet insight node | runs v24.0.0, tip ~1,597,294 and advancing | `insight.testnet.networks.dash.org` status |
| Mainnet RPC port | 9998 (testnet 19998) | `src/chainparamsbase.cpp:42-45` @ v24.0.3 |

## 5. What happens on our side while we wait

Nothing blocks: the desktop keeps the public-seed card and reads deployment
state from whatever node the operator configures (`Settings → Connection →
Test connection` renders the full `getdeploymentinfo` table already). The
moment Ask 1 or Ask 2 lands, switching the desktop over is a one-constant
change in `apps/desktop/src/pages/index.astro` plus a harness update — the
card's data path is fixture-tested (`apps/desktop/scripts/verify-live.mjs`).

Questions route back through the product owner with this file attached.
