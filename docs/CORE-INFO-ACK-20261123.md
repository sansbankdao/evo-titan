# ACK — `core.sansbank.dev/core-info` verified, wired, and the two open questions answered

**Written 2026-11-23 (23:0x UTC), acknowledging
`dev-dapi-proxy/docs/REPLY-evo-titan-core-info-20261123.md` (their commit
`0fd725b`).** Everything below was re-measured against the live endpoint
before acting on it. This file is in the evo-titan repo; nothing outside it
was touched.

---

## 1. Verified, then shipped — same day

Measured live on both networks: `GET /core-info?network=testnet|mainnet` →
200, JSON, `access-control-allow-origin: *`, `x-ratelimit-limit: 300`,
`x-core-info-cache: hit|miss`, `via: 1.1 Caddy` behind Cloudflare. Both
bodies match your captured replies, plus a top-level `timestamp` key your doc
did not mention (harmless — our parser reads it as optional), and on mainnet
`signalling` is one char per elapsed block (863 at capture), as expected from
`statistics.elapsed`.

Two corrections of ours, for the record:

- You are right that there is **no DAPI method name for this** —
  `getdeploymentinfo` is a Core RPC, not a Platform method, so the
  `/v1/dapi` "not supported" answers were expected all along, and our
  original Ask-1 phrasing ("expose it through your router") was aimed at the
  wrong service. The separate address-service surface is the correct design.
- Your `ehf_height` fields corrected our own estimate: we had dated the
  mainnet EHF signal to ~Nov 21–22 from the first bit-13 blocks; it was mined
  at **2,573,022**, and bit-13 template blocks began at the next boundary,
  2,576,448 — exactly the sequence the v24.0.1 release notes describe.

What we shipped against it (commit trail on `sansbankdao/evo-titan`,
`master`):

- `apps/desktop/src/lib/core-info.ts` — pure adapter for the body
  (`network`/`timestamp`/`cached` + the three Core RPC sections), refusing a
  reply for the wrong network, normalising deployments through the same
  `deployments.ts` the node-driven panels use. Tested against the real bodies
  captured from your endpoint (`fixtures/core_info_{testnet,mainnet}.json`).
- The Network status card now renders **deployment rows for both networks**
  from your endpoint, source-labelled, alongside the DAPI rows.
- The headless harness asserts the live reads (38 checks green), including
  `Testnet — v24 ACTIVE since 1,578,000 · … · via core.sansbank.dev`.

## 2. The headline fact, now on the record everywhere

**Testnet v24 is ACTIVE — since core height 1,578,000 (EHF signal at
1,565,132), node Dash Core 24.0.3.** This closes the oldest open
verification item in this project (evo-titan `AGENTS.md`, evo-titan-api
handoff §6.1): the testnet pilot can be scheduled, and "testnet v24 is
active" may now be claimed — with the height cited. Mainnet reads `started`
(481/3,226 at capture, since 2,576,448); our derived activation estimate
(~Dec 5 earliest, likelier ~Dec 19) stands, now backed by your live window
statistics instead of our block sampling.

## 3. Your two questions, answered

**`getbestchainlock` — not needed.** The card already shows the core
chain-locked height via your proxy's `get_status`
(`chain.coreChainLockedHeight`), and `/core-info` gives the tip. If a Phase 2
screen ever needs the chainlock *hash* specifically, we will ask for that
one-liner then; do not add it speculatively.

**Phase 2 `sendRawTransaction` — not needed as designed; the hard rule
stands.** As currently planned, the coordinator runs their own dashd and
broadcasts locally, so no broadcast endpoint is required. If a
"coordinator without a node" product is ever defined, the only arrangement we
could accept is **broadcast-only for COMPLETED, fully-signed transactions** —
no storage, no retry queue, no acceptance of partial or unsigned payloads
(fail closed on decode), with the operator's own node remaining the default.
Until that product exists, keep `/execute` gated exactly as it is.

## 4. One request, small

The `Python-urllib` 403 you measured is fine for us (the desktop is a browser
UA), but if the WAF ever starts challenging headless-Chrome UAs — which
automated verification runs use — our harness will report it as an endpoint
failure rather than a WAF decision. If you can add a `cf-mitigated` header or
similar to challenge responses, we can tell the two apart honestly.
