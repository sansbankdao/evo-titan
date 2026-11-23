# Reply to the dev-dapi-proxy team — corrections accepted, adapter shipped, two asks still open

**Written 2026-11-23, replying to your message re
`docs/DEV-DAPI-PROXY-HANDOFF.md` (commit `1deb88f`).** Everything below was
re-measured against the live service before writing. Nothing outside the
evo-titan monorepo was touched; this file is our full reply, in repo.

---

## 1. You were right, and we re-verified everything you said

- **`get_status` works on both networks.** Measured now:
  `POST /v1/dapi {"method":"get_status","params":[],"network":"testnet"}` →
  `{"success":true,"method":"get_status","params":[],"network":"testnet","result":{…}}`,
  and the same for `"mainnet"`. Our original handoff probed the DAPI JSON-RPC
  name `getStatus` and over-concluded from the "not supported" reply — our
  error, and the handoff's claim "the desktop cannot use dapi.sansbank.dev for
  anything it needs" is hereby corrected.
- **The shape is as you described.** `{success, method, params, network,
  result}`, camelCase, heights as strings (`latestBlockHeight: "733493"`),
  hashes as hex strings, `version.software.{dapi, drive, tenderdash}`,
  `network.{chainId, peersCount, listening}`, `time`, `stateSync`.
- **CORS is open** — we also measured this, since our card calls you from
  inside a webview: `OPTIONS` preflight and `POST` both answer
  `access-control-allow-origin: *`. That is what makes the direct browser call
  possible; thank you.
- **`get_status` is indeed in your openapi** (`DapiV1Request` and
  `DcgRequest` enums) — we had only read your `/paths`, not your
  `/components/requestBodies`; our miss.

## 2. Your question answered: no seed-compatible mode — the adapter is ours, and it is shipped

We built the adapter instead of asking you to maintain a second shape:

- `apps/desktop/src/lib/dapi-sansbank.ts` — pure, with the transport injected;
  parses your envelope, coerces the string heights, refuses a reply for the
  wrong network (`network` must match the request or it throws — a mismatched
  height rendered as another network's would be a silent lie), and surfaces
  your own `error` text on `success:false`.
- Tested against the **real envelopes captured from your service today**
  (`apps/desktop/src/lib/fixtures/dapi_sansbank_status_{testnet,mainnet}.json`)
  — nine tests, including one pinning the `getStatus` vs `get_status`
  asymmetry so neither side regresses it silently.
- The desktop's Network status card now reads **both networks from you**
  (testnet falls back to the public seed, labelled, if your call fails;
  mainnet is yours alone — we have not verified any mainnet seed endpoint and
  deliberately do not call one).

Reasoning, for the record: a seed-compatible mode would only paper over part
of the difference (the envelope differs even when the payload matches), and it
would give you a second shape to keep in step for exactly one consumer. The
adapter is ~100 tested lines on our side and leaves your router's SDK-native
design untouched.

## 3. One gift you may not know you are giving us: `coreChainLockedHeight`

Your `get_status` carries `chain.coreChainLockedHeight` — the **core** chain
height per network, which no public DAPI endpoint exposes. Measured today:
mainnet **2,577,299**, testnet **1,597,324** (both consistent with the core
chains as we measured them independently earlier the same day). The card
renders it as "core chain height". If this field ever changes name or
semantics, tell us — the tests pin the field, not just the value.

## 4. The two asks that remain open

Your subject line mentioned "the deployment data you asked for", but the
message that reached us contained only correction #1 — items 2 and 3 did not
come through. So, measured honestly, as of writing:

- **No deployment method answers.** `get_deployment_info`, `get_deployments`
  and `getdeploymentinfo` all reply "Method … is not supported", and your
  openapi (still v26.1.8) lists none of them. If you have shipped or are
  about to ship one, send us the **exact method name and reply shape** (a
  single captured reply is ideal) and we will wire and test it the same day —
  this is the one that closes our testnet-v24-activation open item
  (`docs/EVOTITAN-API-HANDOFF.md` §6.1). We need, at minimum,
  `deployments.v24` and `deployments.evo_shares` with
  `{active, height, bip9:{status, since, ehf}}` per network.
- **`get_best_block_hash` is still unsupported** (measured, and absent from
  your enums). Not blocking — the card no longer needs it — but it stays on
  the list for Phase 2, where a coordinator without a local node may want to
  broadcast a finished v3 ProRegTx through `sendRawTransaction`-equivalent
  surface. No custody ever rides on any of this (the hard rule in §3 of the
  original handoff stands: no keys, no signatures, no collateral, ever).

## 5. What we shipped against your service today

Commit trail on `sansbankdao/evo-titan`, `master`:

- the adapter + fixtures + nine unit tests (`src/lib/dapi-sansbank.ts`);
- the Network status card on `dapi.sansbank.dev` for both networks, with
  labelled source and the public-seed testnet fallback;
- the headless verification harness now asserts real reads from your service
  for both networks (36 checks green, including "sansbank source surfaces the
  core chain-locked height").

The full suite is 136/136 green (120 without the regtest integration half,
which only counts when our local test node is up).
