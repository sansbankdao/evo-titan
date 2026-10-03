# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository. Use it as the primary reference for structure, commands, and conventions to minimize errors and hallucinations.

## Non-negotiable rules

1. **Never guess, assume, or infer.** Every factual claim about Dash, its protocol, or this codebase must cite a verifiable source — a file path, a commit, or a command whose output is shown. If a fact cannot be verified, say so and stop. Do not fill gaps with plausible-sounding detail.
2. **Use pnpm, never npm.** `.npmrc` sets `save-exact=true`, `strict-peer-dependencies=true`, `engine-strict=true`.
3. **Pin all versions exactly.** No `^`, no `~`. When adding a dependency, resolve the version first (`npm view <pkg> version`) and write it literally.
4. **Branch is `master` for everything.** Never force-push over shared `master`. If a bad commit was already pushed, revert and recommit.
5. **Do not present unshipped things as live.** Dash USDC does not exist. Anything not yet available is marked unavailable in config and must not render a payable link or an "available" affordance.
6. **Never gate a user's own keys behind payment.** A lapsed subscription must never lock an operator out of their own collateral or their ability to sign. This is a product constraint, not a preference.

## Project overview

Evo Titan is a multi-platform toolkit for Dash Masternode Operators: a desktop client, a static marketing site, documentation, and an API.

**Stack:**
- **Desktop** (`apps/desktop`) — Tauri v2 + Astro + Tailwind CSS v4. Rust backend, static Astro frontend.
- **Web** (`packages/web`) — Astro + Tailwind CSS v4, static output.
- **Docs** (`packages/docs`) — Astro Starlight.
- **API** — Hono 4 on Cloudflare Workers. **Lives in a separate repository** (`evo-titan-api`, hosted on Gitea), not in this monorepo.
- **Mobile** (`apps/mobile`) — bare React Native + NativeWind. No Expo.
- **Config** (`packages/config`) — shared tsconfig and tooling presets.

Turborepo orchestrates the workspace. Node `>=24` (see `.nvmrc`).

## Commands

```bash
pnpm install          # install everything
pnpm build            # build all workspaces
pnpm dev              # run all workspaces in dev
pnpm lint             # lint all
pnpm typecheck        # typecheck all
pnpm format           # prettier
```

Desktop specifically:

```bash
cd apps/desktop
pnpm dev              # Astro dev server only
pnpm tauri dev        # THE correct way to run the desktop app
pnpm tauri build      # production bundle
```

## The 4327 port rule

**Desktop dev port is 4327. `apps/desktop/astro.config.mjs` (`server.port`) and `apps/desktop/src-tauri/tauri.conf.json` (`build.devUrl`) must always agree.** If they drift, Tauri waits forever or loads the wrong thing.

This is a documented incident, not a preference. The port was originally 4321. A **debug** Tauri binary loads `devUrl` — not the bundled `frontendDist` — and port 4321 was already occupied by an unrelated project that had been serving there for days. Running the built binary directly therefore displayed **a completely different application's UI** inside our window, with no error. `strictPort: true` is set so any future collision fails loudly.

**Rules that follow:**
- Run the app with `pnpm tauri dev`. It starts the frontend, waits for the port, then launches the binary.
- Never launch `src-tauri/target/debug/evo-titan` directly against an unverified port.
- A debug build shows `devUrl`; only a release build shows the bundled `frontendDist`. When testing the real bundle, build a release binary.

## Desktop shell: window and menus

The window is `label: "main"`, default **1440×900**, minimum **1024×640**, centred. The label matters: `menu.rs` resolves the window by that id.

Native OS menus live in `apps/desktop/src-tauri/src/menu.rs`. Every constructor there was checked against the installed `tauri-2.11.6` source under `~/.cargo/registry/src/.../tauri-2.11.6/src/menu/`. Do the same before adding entries — do not write menu APIs from memory.

Conventions that file follows, and that new entries must keep:

- **Disabled, not absent, when unimplemented.** `Add node` and `Refresh fleet` mirror the fleet screen's disabled buttons and are created with `.enabled(false)`. A menu item that looks live but does nothing is worse than a greyed-out one.
- **Unclaimed ids are reported.** `menu::handle` returns `false` for ids it does not own and `lib.rs` logs that; a typo cannot silently deaden an entry.
- **`MENU_FEATURE` ids log loudly.** Items built with the shared placeholder id are disabled; if one ever fires, it prints that the handler is missing rather than doing nothing.
- **Prefer predefined items.** About, quit, copy, paste, undo, select-all and friends are `muda` predefined items, so the OS supplies native behaviour, accelerators and localisation. `about_metadata()` reads the version from the crate at compile time.
- **No shell plugin.** `open_external` spawns `xdg-open`/`open`/`cmd` directly with a compile-time-constant URL, avoiding `tauri-plugin-opener` and its capability entry.

## The custodial layer (PLANNED — NOT LIVE)

`custodial` in `packages/web/src/config/site.ts` is a placeholder for a future custodial entry point, **waitlisted at launch**, gated behind `available: false`. The desktop mirror is `custodialPool` in `apps/desktop/src/lib/mock.ts` and the screen `apps/desktop/src/pages/custodial.astro`.

Rules:

- **It is Rank 0, not a new Rank I.** The numbered ladder describes collateral the operator actually holds; the custodial layer is the opposite arrangement. Presenting it as a rung would imply the same ownership.
- **"Custodial" names THIS SERVICE ONLY.** The ordinary shared masternode is **self-custodial** — every share owner holds their own key. Do not use the word "custodial" for the shared pool, and do not use "self-custodial" for this service. A screen that swaps the two is factually wrong about who holds the keys.
- **The service accepts ANY amount.** Because we form the on-chain shares from pooled deposits, the protocol floor of 100 DASH per share (`CCollateralShare::MIN_AMOUNT`, src/evo/providertx.h:58) is a rule WE satisfy internally. It is not a floor a depositor has to meet. Do not add a minimum to this screen or to `site.ts`.
- **The waitlist lives at OUR SERVICE LEVEL.** It is an off-chain list we keep; no Dash RPC exposes a waitlist. Never present it as a protocol feature.
- **Do not flip `available` to `true`** until a licensed arrangement exists. No deposit address is published and none should be.
- **Do not invent a date.** `waitingOn` / `blockedBy` list conditions (a licence, 1,000 DASH of pooled deposits), not a schedule.
- **Custody is stated, never implied.** The trade-off list says we hold the collateral, we form the shares, the user does not hold the keys, and withdrawal depends on our liquidity. Keep that list; a page that hides the trade-off misleads.
- **The waitlist is the only affordance**, and it is disabled with an empty `endpoint`. A placeholder URL that appears to accept a signup is worse than a disabled button, because the user believes they joined.
- **Do not describe this as "licensing a masternode."** Dash has no masternode licensing. The mechanic is pooling deposits and operating a node on depositors' behalf. Write that, not a protocol claim.
- **Say SHARE, never "slot".** The protocol term is `CCollateralShare` / `CollateralShares`. "Slot" appears nowhere in the protocol.

### `nOperatorReward` on a shared node (VERIFIED)

The shared-pool fee mechanism is now closed end-to-end:

- `nOperatorReward` exists **only in `CProRegTx`** and is **immutable after registration**. `shared_register_prepare` takes it as **argument 6**, a **percent string** `"0.00"`–`"100.00"` (parsed with 2 decimals and stored as 0–10000 basis points), and there is **no operator-payout-address argument**.
- `PrepareSharedRegistration` sets `nOperatorReward` but never sets `scriptOperatorPayout`, and `CDeterministicMNState(const CProRegTx&)` does not copy one, so it defaults to empty `CScript()`. `src/masternode/payments.cpp` pays the operator **only when `nOperatorReward != 0 && scriptOperatorPayout != CScript()`** — therefore **`nOperatorReward` alone is inert** on a shared node and the reward folds into the share split.
- **`protx update_service` CAN set the payout on a shared node.** `protx_update_service_common_wrapper` (src/rpc/evo.cpp:1049) has **no** shared-node guard — it parses the payout address unchecked and delegates to `evo::provider::UpdateService`.
- **`UpdateService` (src/evo/providertx_service.cpp:788) has no `IsShared()` rejection**, unlike `UpdateRegistrar` (same file:868), which explicitly refuses shared nodes. So ProUpServTx is allowed on a shared node.
- **Consensus accepts it too**: `CheckProUpServTx` / `ApplyProUpServTx` (src/evo/specialtxman.cpp:110, :1326) have no shared guard; `ApplyProUpServTx` copies `state_mn.scriptOperatorPayout = proTx.scriptOperatorPayout` (line 120). The only gate is `bad-protx-operator-payee` (line ~1396): the payout script must be P2PKH or P2SH, and `nOperatorReward` must be non-zero — which it can be, because `shared_register_prepare` set it.
- **Conclusion:** a shared-pool operator fee is payable, but only via a later `protx update_service` that supplies the payout address. It cannot be set at registration.

### Fees

Wayback-sourced competitor figures (CrowdNode) are **not publishable** until the exact snapshot URLs are re-pinned. Do not quote a competitor percentage without a live, citable source.

### The 125 figure

The 125-per-depositor figure is **our product choice, not consensus**. Only the floor (100 DASH) and ceiling (8 shares) are protocol constants. Phrase it as our arithmetic, never as a protocol rule.

### Release versioning

The desktop version appears in **six** places and they must move together: `apps/desktop/package.json`, `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/Cargo.lock`, `apps/desktop/src/components/StatusBar.astro` (`appVersion`), and `apps/desktop/src/pages/settings.astro` (`data-setting="version"`). `26.9.26` is the first release carrying Profile, Settings, the two charts, the custodial screen, the shared-RPC seam, and the shares-not-slots wording.

## Charting

`chart.js` **4.5.1** is the charting library, a dependency of `apps/desktop` only. It was chosen because it bundles its own TypeScript types (no `@types` package) and declares **no peer dependencies**, which `strict-peer-dependencies=true` in `.npmrc` requires.

- Two charts live on the start screen: `RewardsChart.astro` (line/area) and `HealthChart.astro` (doughnut).
- Series data is passed from `mock.ts` through a `data-series` JSON attribute rather than fetched, because there is nothing to fetch from.
- Both are created client-side in processed `<script>` tags with `chart.js/auto`. `animation: false` is deliberate: an animating chart implies live data arriving.
- A canvas parent must own an explicit height (the components use `h-40` / `h-32`) because `maintainAspectRatio: false` otherwise collapses the canvas to zero on first paint.
- `profile.astro` deliberately uses **inline SVG** for the collateral bars, not Chart.js: static bars with no interaction do not justify a canvas renderer.

### Proving a chart renders

Do not trust markup alone. A canvas element is present in the HTML whether or not any script ever ran, so presence proves nothing.

`google-chrome` exists on this machine at `/usr/bin/google-chrome`. Drive it over the DevTools Protocol (Node 24 has a built-in `WebSocket`, so no dependency is needed) and read pixels back:

1. Launch headless with `--remote-debugging-port`.
2. `Page.navigate`, then **wait for `Page.loadEventFired`** before evaluating. Evaluating too early is the trap: the canvases still report the default 300×150 and zero painted pixels, which looks exactly like a broken chart.
3. Call `getImageData` and count pixels with `alpha > 0`. Chart.js sets `width`/`height` attributes only on a successful instantiation, and a drawn chart paints thousands of pixels.

Known-good result at the time of writing: `rewards-trend` 464×160 with 27,187 painted pixels; `health-breakdown` 128×128 with 6,918.

Beware the related trap when grepping: a naive byte search for a string in a release binary can report a false negative, because the compiler may split a literal across separate `mov reg, imm64` immediates. Confirm by searching for the pieces (
`<code>"Refresh "</code>` + `<code>"sh fleet"</code>`) before concluding anything is missing.

## Verifying UI work

The session runs on **Wayland**. `import` is X11-only and `grim`, `slurp`, `xdotool`, and `wmctrl` are not installed, so **a screenshot of the running window is not possible.** Do not claim a window "looks right" — that cannot be verified here.

Verify UI by:
- The dev log, which records each route Tauri fetched (`[200] /`, `[200] /shared`, …).
- `curl` against the dev server, checking for expected markers in the returned HTML.
- Process state (`ps -o stat,nlwp,rss`) to confirm the webview initialized rather than crash-looping.

## Legibility floor

**No text renders below 14px**, on any surface.

- Tailwind's default `text-xs` is **12px**, which is under the floor. The floor is applied by overriding the token in the theme — `--text-xs: 0.875rem;` (14px) — at the top of `apps/desktop/src/styles/global.css` and `packages/web/src/styles/global.css`. Overriding the token is what lifts every existing `text-xs` at once.
- **14px is deliberately the same size as Tailwind's `text-sm`**, so the two classes now agree instead of sitting 1px apart. The line-height matches `text-sm` as well.
- Do not reintroduce `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[12px]` or `text-[13px]`. All are below the floor.
- **Do not invent CSS.** `min-font-size` is not a real property; a fix that relies on it does nothing. Verify with computed style in a browser, not by reading the class list.
- Verify by measuring: `getComputedStyle(el).fontSize` over every text-bearing element must have a minimum of `14px`.

## The earnings model

The reward figures are **derived from consensus**, not observed. There is no node, so no on-chain reading is possible; instead the arithmetic is reproduced and every input is cited in `packages/web/src/config/site.ts` (`yieldModel`) and `apps/desktop/src/lib/mock.ts` (`yieldModel`, `nodeEarnings`, `shareEarnings`, `fees`).

Verified inputs, Dash Core `v24.0.0-rc.1`:

| Input | Value | Source |
|---|---|---|
| block time | 150 s | `src/chainparams.cpp:200` (`nPowTargetSpacing = 2.5 * 60`) |
| blocks / year | 210,240 | `src/chainparams.cpp:162` (`nSubsidyHalvingInterval`) |
| subsidy base | 5 DASH | `src/validation.cpp` (`nSubsidyBase`, V20+) |
| treasury | 20% | `src/validation.cpp` (`nSuperblockPart = nSubsidy / 5`) |
| interval decline | 1/14 | `src/validation.cpp` (`nSubsidy -= nSubsidy / 14`) |
| MN share of block value | 75% | `src/masternode/payments.cpp:101` (`blockValue * 3 / 4`) |
| Platform cut of MN share | 37.5% | `src/masternode/payments.cpp:53` (`reward * 375 / 1000`) |
| payments per node per cycle | 1 | `src/evo/deterministicmns.cpp:230` (`isMNRewardReallocation ? 1 : voting_weight`) |

**Evo and Regular nodes are paid the same per-node amount.** The 4× `voting_weight` on Evo nodes is gated behind `!isMNRewardReallocation` (`src/evo/deterministicmns.cpp:167`), and mainnet passed `MN_RRHeight` (2,128,896) long ago. Evo's lower APY in the table is therefore **only** its 4× larger collateral — not a smaller payment. Do not describe it as Evo earning less.

Derived: block value `3.714286` — MN gross `2.785714` — Platform `1.044643` — MN net `1.741071` DASH/block — **366,043 DASH/year to all masternodes**.

- **The node count is the only unsourced input.** It is exposed as a control on the web and labelled `assumedNodes` on the desktop. Never hide it.
- APY is `annualMasternodePot / nodes / collateral` (Regular 1,000 DASH, Evo 4,000). The pot **shrinks ~7.1% every 210,240 blocks**. This is a model, not a yield.
- **Earnings figures use 4 decimals** (`dash4`), never the 8-decimal `dash()`. Eight decimals claims precision the model does not have.
- **Fees are set by how much trust we ask for, cheapest first.** There are exactly three arrangements and they must be presented in this order, because full self-custody is the default:
  1. **Full self-custody — 0%.** The operator owns the collateral, holds the keys, signs locally. We hold nothing, so there is nothing to charge for. This is a **price, not a discount or a promotional rate**, and it is not time-limited. Titan PRO ($5/mo) is an optional **subscription** here, never a cut of the reward: an operator who never buys PRO pays 0% forever.
  2. **Shared pool — 10%.** Self-custodial shares; the depositor keeps their keys and each share pays its own reward script. We only coordinate. Recommended at the low end of a 10–20% band. Set by user decision 2026-10-03 after sourcing hosting costs.
  3. **Custodial — 30%.** We hold the keys. The only arrangement where we carry custody risk, which is why it is triple the pool.
- **Why 10%** for the shared pool, in order of weight: (a) it sits **midway between the two sourced comparables** — NodeHub charges 5% of rewards **plus hosting from $3.90/month** (official `docs.dash.org/en/stable/masternodes/hosting.html` hosting-services list, read 2026-10-03) and CrowdNode charges **20%** of rewards for non-custodial shares (pinned 2025-06-20 capture), so 10% with hosting included is cheaper than the incumbent without pretending to match a loss-leader; (b) **the fee does not buy servers** — sourced hosting is ~0.105 DASH/node/month, about **1.4% of a node's monthly reward**, so even 5% covers hosting 3.6× over and the rate decision is an operating-cost decision, not a hosting one; 10% funds ops, support and development; (c) the fee is **immutable per registration** (`shared_update_registrar_prepare` cannot change `operatorReward`), so a later change affects only new pools — early depositors keep their rate, and every pool assembled while the rate is low keeps it for its whole life, which argues for pricing honestly at the start rather than planning an upward move.
- **Never present the 0% as a limited tier**, and never imply that full self-custody is a degraded mode. It is the arrangement the protocol was designed for; the paid tiers exist because we do work, not because we gate access.
- None of the three figures is a consensus constant. All three are product prices.
- On a shared node the operator cut comes off the **whole node** before the split, and the remainder is split **by collateral** (`SplitAmountByShares`). A 125 DASH deposit is 12.5% of a 1,000 DASH node's reward — not 12.5% of the post-fee remainder.
- **Competitor fees are now sourced and publishable.** CrowdNode's own knowledge-base article `knowledge.crowdnode.io/en/articles/2225953` ("How much does CrowdNode cost?"), read via pinned Wayback snapshots: `20240519054519` says *"We take 15% of the rewards being generated"*; `20250620013136` says *"We take 35% of the rewards being generated from custodial assets under management, 20% from non-custodial masternodes"*. The percentages are a cut of the **reward**, not the deposit. **Custodial (35%) is compared only to our custodial 30%; non-custodial (20%) only to our shared-pool 10%.** Never quote one against the other arrangement. **Full self-custody has no comparable line**, because we do not charge for it — do not manufacture one.
- **A fee is not a per-share charge.** `nOperatorReward` is basis points of the **whole-node** reward, taken at `src/masternode/payments.cpp:167` **before** the share split at `:175`. Every depositor therefore loses the same percentage of their own reward; a 125 DASH share and a 500 DASH share are cut identically. Never describe it as falling harder on small depositors.

### Hosting costs (sourced 2026-10-03, rate-decision evidence)

- **The official docs publish no hardware-requirements table.** The binding constraint is disk, measured not guessed: Dash mainnet is **43.24 GB** at block 2,566,300 (Blockchair stats API, `api.blockchair.com/dash/stats`) — so 40 GB-class VPS disks are already too small and a **100 GB SSD** tier is the reference. Runtime is Ubuntu 22.04 + Docker per `dashmate`'s installation guide (`dashpay/platform/packages/dashmate/docs/installation.md`). One **public IP:port per node** — hosting cost scales linearly with nodes.
- **Reference VPS price:** Contabo **Cloud VPS 4** (4 vCPU / 8 GB RAM / 100 GB SSD) lists at **€5.50/month incl. VAT** (contabo.com/en/vps/, read 2026-10-03; page notes a first-24-months condition). At the same-day DASH price ($58.95, CoinGecko 2026-10-03T17:44Z) that is **~0.105 DASH per node per month, ~1.4% of a node's monthly reward**. Never convert with an unsourced price.
- **Market prices for the same service** (all from the official `docs.dash.org/en/stable/masternodes/hosting.html` hosting-services list, read 2026-10-03): NodeHub.io **from $3.90/month** (billed daily at $0.13); Allnodes **from $9/month** (yearly billing); Masternodehosting **€18/month**; SID Hosting **€27.50/month**. The market charges ~1.6×–5× raw VPS cost for hosting.
- **These figures are internal evidence for pricing decisions, not publishable copy.** Do not put our hosting costs, break-even tables or provider price comparisons on a public screen without labelling and re-verification.

## Colour and size contrast on featured values

The earnings figures are the reason the visitor is on the page, so the hierarchy is carried by **colour and type size**, not by position alone.

- On the block-reward row the context figures sit at `slate`/`rose` and the payout figures at `indigo`/`white`; the **net** figure — what actually reaches an operator — is the largest on the row (`text-4xl` web, `text-3xl` desktop) with a 2px indigo border and a tinted background.
- "You keep" is always the biggest number in any fee breakdown. The fee is tinted rose, the gross is neutral, and the net is the headline.
- **The three fee percentages themselves are the largest type on their row** (`text-4xl` web, `text-3xl` desktop), coloured by arrangement: emerald for the free self-custody row, indigo for the pool, rose for custody. A price list where every number looks the same forces the reader to hunt for the one that applies to them.
- Do not flatten this back to one size and one colour. A row of identically-styled numbers makes the reader do the prioritisation the design was supposed to do.

## Demo Mode

`Settings → Demo Mode` (`apps/desktop/src/components/DemoModeToggle.astro`) toggles the mock data on and off across every screen. It is the **only fully wired control in the build** — every other toggle renders disabled with a "Not wired" tag.

- State lives in `localStorage` under `evotitan.demoMode`, defaulting to **on**. It is applied in an **inline script in `<head>`** (`Layout.astro`) so the document never paints the wrong state.
- The banner is hidden **in step with the data**, via `[data-demo-mode='off'] [data-notice='mock-data']` and `[data-demo-mode='off'] [data-demo-content]` in `global.css`. Hiding the warning while leaving fabricated figures on screen recreates the exact failure the banner exists to prevent.
- The empty state (`[data-when-demo='off']`) is a **sibling of `<main>`**, not inside it, and carries a **re-enable button**. Settings is itself hidden when Demo Mode is off, so without that button the toggle would be a one-way door.
- `Settings → About → Data source` must read `Mock` when on and `None` when off. Do not leave it saying "Mock" over blank screens.

## Mock data

All desktop data is mock and lives in `apps/desktop/src/lib/mock.ts`, behind a file header stating so.

- A **non-dismissible** banner renders on every desktop screen: `MOCK DATA — no node connected`. Keep it. It exists so a screenshot can never be mistaken for real fleet data.
- The RPC client is split so the tested code is the shipped code. `apps/desktop/src/lib/rpc-core.ts` holds the **pure** layer — the `DashRpc` class, the JSON-RPC envelope, reply parsing and error interpretation — and imports neither Tauri nor the DOM, which is what lets `node --test` run it. `apps/desktop/src/lib/rpc.ts` adds only the environment-specific transports: `tauriTransport` (delegates to the Rust command `rpc_call`) and `nodeFetchTransport` (used by the tests). Reimplementing the envelope or error mapping anywhere but `rpc-core.ts` is a regression.
- **`npm run test` / `pnpm test` runs the suite locally: `node --test src/lib/rpc-core.test.ts`.** Zero new dependencies (Node's built-in runner plus native TypeScript). It has two halves: unit tests against a recording transport that always run, and integration tests against a real dashd that **skip automatically when no node is reachable**, so the suite stays green without docker. `apps/desktop/src/lib/rpc.ts` no longer throws by design; `unconfiguredRpc` does, and it is what the UI would get. Nothing in the UI imports the live client — `grep -rn "lib/rpc" src --include='*.astro'` returns comments only. Methods carry `TODO: verify against dashd` until the call has actually been RUN against a real node; a signature confirmed from `help` is not the same as a call confirmed to succeed.
- **A v24 node IS obtainable, and was run on 2026-09-27.** `docker` is present and the daemon responds; `docker pull dashpay/dashd:24.0.0-rc.1` works. Recipe (regtest, no sync, no peer traffic):

  ```sh
  docker run -d --name etdashd -p 127.0.0.1:19898:19898 dashpay/dashd:24.0.0-rc.1 \
    dashd -regtest -server -txindex -listen=0 \
      -rpcport=19898 -rpcbind=0.0.0.0 \
      -rpcuser=titan -rpcpassword=titanlocaldev \
      -rpcallowip=0.0.0.0/0 -fallbackfee=0.0001
  ```

  Notes that cost time to find: the image runs as uid 1000 (`dash`) and its data dir is `/home/dash/.dashcore`, so a bind mount must be `chmod 777`; `-rpcbind` is rejected outside a `[regtest]` config section **only** when passed as a config file line — it is accepted on the command line; without `-rpcport` the node binds RPC on `::1` at a port it does not report via `docker port`; and `-listen=0` keeps it off the network entirely.
- **The seven shared commands are SUBCOMMANDS of `protx`.** `src/rpc/evo.cpp:2439-2445` registers them in the `protx` table as `"protx shared_sign"`, `"protx shared_combine"` and so on. A top-level call to `shared_sign` returns `-32601` (method not found) even though the string is in the binary. Call them as `protx` with the subcommand as `params[0]`.
- **Three facts CORRECTED against the live node** (regtest v24.0.0-rc.1, 2026-09-27). Each was wrong in the first, source-derived draft:
  1. `operatorReward` on `shared_register_prepare` is a **PERCENT STRING**, e.g. `"15.00"`, not basis points. The node help says "The fraction in %% to share with the operator (0.00 to 100.00)", and the source at `src/rpc/evo.cpp:2166-2173` confirms `ParseFixedPoint(val, 2, &operatorReward)` then a 0–10000 check before `static_cast<uint16_t>`.
  2. `shared_update_share` takes a **fourth argument, `feeSourceAddress`**, a wallet address the fee is paid from. Omitting it yields `-1` (usage text); supplying it reaches validation.
  3. `shared_combine` has a **third `submit` argument** (default `false`) which is unavailable for registrations, whose funding inputs still need signing. Signatures are **base64**, and `shared_sign` needs the wallet unlocked (-18 when no wallet is loaded).
- **Three MORE facts CORRECTED against the live node** (same session), which the earlier source-derived draft got wrong:
  1. **`masternode status` takes NO arguments.** Passing a ProTx hash is a usage error (`-1`). The command reports the masternode the **local node** runs (on a node not running one: `-32603` "This node does not run an active masternode"). For an arbitrary ProTx hash use **`protx info`**.
  2. **`masternode genkey` does NOT exist in v24** (`-8` "Must be a valid command"). Operator keys are **BLS**: `bls generate` returns `{secret, public, scheme}` with a 64-hex secret and 96-hex public, `scheme` = `"basic"`.
  3. **`masternode winners` takes at most TWO arguments** (`count`, `"filter"`) and returns an **object keyed by height (a map), not an array**. A caller treating it as an array silently iterates nothing. Also: `protx list registered true <height>` requires a height **greater than zero** (`0` → `-8` "invalid height specified"), and `protx list wallet` is `-1` when the wallet is disabled.
- **The end-to-end shared registration was RUN, not just inferred.** Eight shares of 125 DASH (1000 DASH collateral, `operatorReward:"15.00"`) registered a real version 3 shared masternode on regtest at height 502 — `proTxHash bd42b688…`, `collateralIndex 1`, `consentHash e770361f…`. The successful path is `shared_register_prepare` → 8× `shared_sign` → `shared_combine` → `signrawtransactionwithwallet` → `sendrawtransaction`.
- **`operatorReward` round-trips as a percent, and it is the SAME primitive as our fee.** Input `"15.00"` is parsed by `ParseFixedPoint(val, 2)` into `1500`, stored as `operator_reward`, and serialised back by `src/rpc/evo.cpp:83` as `static_cast<double>(nOperatorReward) / 100` = `15`. So a 15% shared-pool fee maps exactly onto Dash's own operator-reward field rather than needing a side channel.
- **Shared masternodes are NOT activatable on mainnet in v24.0.0-rc.1.** `src/chainparams.cpp:213` sets `DEPLOYMENT_V24.nStartTime = Consensus::BIP9Deployment::NEVER_ACTIVE; // TODO` inside `CMainParams` (which spans lines 158–358). The other networks are scheduled: testnet 2026-09-24, devnet 2025-07-01, regtest 0. This is why the custodial/shared layer ships as `available: false` — the feature cannot be registered on mainnet yet, and no date may be invented. Activating it on regtest additionally required `-vbparams=v24:0:9223372036854775807:0:100:80:60:5:0` (the 9th field, `useehf=0`, is essential: an EHF deployment cannot signal on a single node) and mining past height 432 for `dip0003`.
- **A share's refund/reward address must be distinct** from that share's owner address and from the node's voting address, or the node rejects the registration with `bad-protx-shares-payee-reuse`. Duplicate owner keys and duplicate refund addresses are also rejected, and the amounts must sum to the collateral.
- The JSON-RPC envelope is confirmed working: `{"jsonrpc":"1.0","id":...,"method":"protx","params":["shared_sign","00"]}` over HTTP with HTTP basic auth reaches the wallet layer. JSON-RPC **1.0** is accepted; the `id` is echoed back as a string.

### The RPC transport lives in Rust

- dashd sends **no `Access-Control-Allow-Origin` header** and answers an **OPTIONS preflight with 501 Not Implemented** (measured against `dashpay/dashd:24.0.0-rc.1`). A Tauri webview is a browser, so a `fetch()` from the frontend is blocked before it reaches the node. The call must leave the webview.
- `apps/desktop/src-tauri/src/rpc.rs` is a **thin proxy**, not a second RPC client. Its `rpc_call` command takes a fully-specified `RpcHttpRequest { url, user, password, body }` (the frontend builds the envelope) and returns the raw `RpcHttpResponse { status, body, elapsedMs, transportError }` untouched. **All JSON-RPC semantics stay in TypeScript**, so the local tests exercise the same code that ships. Do not move result-vs-error parsing into Rust.
- **The RPC password never enters page scripts on a remote origin and is never returned or logged.** `RpcHttpRequest` deliberately does **not** derive `Debug`, so it cannot be printed by accident. The struct is `camelCase` via `#[serde(rename_all = "camelCase")]`, which is why the frontend sends `{ request: { url, user, password, body } }` to `invoke('rpc_call', ...)`.
- `reqwest` is pinned to **`=0.13.5`** — the exact version already in `Cargo.lock` as a transitive dependency of Tauri, so no new crate enters the tree. The `cargo check` proof is "zero new crates compiled".

The RPC transport cannot be moved back into the webview, and a fake transport must never be wired "to make the UI show data".

**Protocol constants in copy must be sourced.** Currently sourced from Dash Core `v24.0.0-rc.1`: Regular collateral `1000 * COIN` and Evo `4000 * COIN` (`src/evo/dmn_types.h`), `MIN_SHARES{2}`/`MAX_SHARES{8}` (`src/evo/providertx.h:134-135`), `MIN_AMOUNT{100 * COIN}` (`src/evo/providertx.h:58`), Evo voting weight 4× Regular (`src/evo/dmn_types.h`), and the `bad-protx-shares-evo` rejection (`src/evo/providertx.cpp:280`). Everything else on the marketing site is **mock** and is labelled in `packages/web/src/config/site.ts`.

"Cluster" is **not** a Dash protocol term. Marketing copy must not present invented vocabulary as protocol.

## Governance voting (verified from source)

Verified from Dash Core `v24.0.0-rc.1` while reviewing the vote-amplification explainer (corrected internal version: `docs/vote-amplification.md`). These facts govern any pooled-voting or governance copy:

- **A masternode casts one vote per signal per proposal, and the latest vote replaces the earlier one.** `src/governance/object.cpp:878-893` (`CountMatchingVotes`) iterates `mapCurrentMNVotes` keyed by masternode outpoint, holding a **single instance per signal**.
- **The vote is not "binary" — it is one of three outcomes**: `NONE / YES / NO / ABSTAIN` (`src/governance/vote.h:22-27`). "Indivisible" is the accurate word. Votes are per **signal** — `FUNDING / VALID / DELETE / ENDORSED` (`src/governance/vote.h:32-38`) — not merely per proposal.
- **Voting weight attaches to the node TYPE, not the deposit**: Regular = 1 vote / 1,000 DASH, Evo = 4 votes / 4,000 DASH (`src/evo/dmn_types.h:33-39`; the `4x` comment sits at `object.cpp:887`). A pooled node's hundred funders still share one vote (or four).
- **A shared masternode has exactly one voting key**, and consensus requires it to differ from every share's refund and reward payee — `src/evo/providertx.cpp:132` (`IsShareListVotingKeySafe`). Turning a member tally into the node's vote is therefore a **service the pool builds**, never a protocol feature.
- **"Vote amplification" is a trade-off, never pure upside.** Whoever shows up controls the pooled node's entire vote: low turnout lets a cheap participant steer a 1,000-DASH vote, and silent members' weight flowing to the loudest is exactly what a vote-buyer wants. Any copy must name the capture risk next to the participation benefit.
- **"Preferences live on Platform where anyone can read them" is a design commitment, not a free property.** It is true only if the pool writes member preferences as Platform documents (identity, contract, credits, UI). Until shipped, the non-custodial verification argument is aspirational and must be labelled as such.

### The CrowdNode voting mechanism is UNVERIFIED

- The claim that CrowdNode offered five member options (Yes / No / Abstain / Delegate / DoNothing) weighted by balance, and that **Delegate is the default for silent members**, is **NOT verified**. The previously pinned Wayback snapshots (`knowledge.crowdnode.io/en/articles/2225953`) cover **fees only**.
- Verification attempt of 2026-10-03 failed on every route: the knowledge base root returns **404** live, `crowdnode.com` does not connect, the Wayback CDX API answered **429 Too Many Requests** all day (even after 5-minute backoffs), and the availability API has no snapshot for any voting path on either host.
- Until a voting page is pinned and quoted verbatim, the mechanism is **"described, not verified"** — internal use with that label only; never publish it as fact.
- The source draft's line *"nothing else in this note depends on that wording"* was **wrong**: the single-member-controls-100%-of-the-vote example depends entirely on the unverified Delegate default. Under a DoNothing default it collapses to the active member's own balance.
- The draft's "CrowdNode's aggregate results tracked the network-wide vote closely" had **no source** and was dropped in the corrected version.

## The contested-names SQL cache

Shipped in commit `55a0e5d`. The contested screen used to re-read the whole DPNS list on every visit; it now caches in SQLite and serves instantly with stale-while-revalidate.

- **Storage is `rusqlite =0.38.0` with the `bundled` feature** (`apps/desktop/src-tauri/Cargo.toml`) — the exact pair (`rusqlite 0.38.0` / `libsqlite3-sys 0.36.0`) already in the local registry and pinned by dash-evo-tool, so no version was guessed. **`tauri-plugin-sql` was rejected**: it needs a plugin, an npm package and a permission, and it would move SQL into the webview.
- **Schema is idempotent, not migration-tracked** (`CREATE TABLE IF NOT EXISTS`): one `contested_name` table, PK `(network, name)` so a repeat write updates instead of duplicating and mainnet can never contaminate testnet; contenders are a JSON column (always read and written as a set), mirroring dash-evo-tool's nesting. **WAL + `synchronous=NORMAL`**: the screen reads while the refresh writes, and a rebuildable cache gets nothing from a sync per write. DB file: `contest-cache.sqlite3` in the app data dir.
- **Same split as RPC/DPNS — the tested code is the shipped code.** `cache.rs` keeps all SQL in plain functions over `&Connection` with four thin `#[tauri]` wrappers (`cache_read_contests`, `cache_write_contests`, `cache_clear_contests`, `cache_stats`) and **12 `cargo test` cases** (round-trip, upsert-not-duplicate, per-network partition, clear-one-leaves-other, empty stats, NULL-vs-zero for undecided rows, camelCase wire shape, reopen persistence). `src/lib/cache.ts` is pure and runs under `node --test` (**24 tests**: null timestamps stay `undefined` and never become 1970; an empty cache is never fresh; corrupt `contestants` JSON loses only tallies, not the row; string int64s become numbers). `src/lib/cache-store.ts` is the only Tauri-touching file, as `dpns-client.ts` is the only WASM-touching one.
- **Stale-while-revalidate semantics.** `CACHE_TTL_MS = 120_000`; freshness is **oldest-row-based**, so a partial write cannot read as a complete refresh; the batch timestamp is taken **once** per fetch so a slow fetch cannot make its first row look minutes older than its last. A failed network refresh **leaves cached rows on screen** (stale with a visible warning beats an empty table); a cache-write failure is **logged, not surfaced**, and never replaces the load's success status; every cache failure falls through to the network path, so the worst case is pre-cache behaviour.
- **Cache provenance is a separate line from live provenance** — sky-coloured (`data-contest-cache` family on `contested.astro`), because "this came from the network" and "this came from disk" are different claims one banner cannot honestly make. The screen carries a **"Use cache" checkbox** (default on) and a **"Clear cache" button**. Debug logging is gated behind `localStorage.contestDebug === '1'` and never logs a secret.
- **The Tauri invoke bridge is verified statically, not by execution.** All four command names match across `cache-store.ts`, `lib.rs` registration and `cache.rs`; argument names (`network`, `rows`) match; both structs carry `#[serde(rename_all = "camelCase")]` and a Rust test asserts the serialized JSON. **No click has round-tripped through the live bridge yet** — the first user "Load from Platform" is the real test.
- **The WebKit remote inspector is not drivable from this session.** `WEBKIT_INSPECTOR_SERVER=127.0.0.1:9222` opens a listening socket, but it speaks WebKit's raw protocol — no HTTP `/json` endpoint and no WebSocket handshake (python `websocket-client` fails the upgrade), so CDP tooling cannot reach it.

## Marketing copy constraints

- **Payments are DASH and Dash USDC only.** No third-party processor. Dash USDC is `available: false` until it exists.
- **Never state an unsourced number, including a rate.** An APY is not publishable as a fact: it depends on the registered-node count, which is live network state we cannot read without a node. Publish the **derivation** instead, label the node count as an assumption, and keep the fee a visibly separate product price.
- **Titan PRO is $5.00/month**, formatted through the `money()` helper so it never renders `$5.5`.
- The **rank ladder is ours**, not protocol. Requirements are consensus; names are not.
- Mock content is isolated in `packages/web/src/config/site.ts` and marked. Do not bury invented claims in components.

## Deployment

- `packages/web` and `packages/docs` are built and deployed by **Cloudflare Pages** on push to `master` (`evo-titan-web`, `evo-titan-docs`). Domains: `evotitan.app`, `www.evotitan.app`, `docs.evotitan.app`.
- The **API deploys manually** from the VM. It lives on Gitea, so Cloudflare's GitHub integration does not reach it.
- After pushing web changes, **verify the live HTML matches local `dist/index.html` byte-for-byte** before declaring success. A green build is not proof that the deploy carried the change.

## Git identity

Commit as `Sansbank contributors <hello@sansbank.org>`. This is set in **repo-local** config; do not pass inline `-c user.name`/`-c user.email` flags.
## The dev server and the WASM SDK (a failure that looks like something else)

The contested-names screen reaches `@dashevo/wasm-sdk` **only** through a dynamic `import()`. That has one consequence worth knowing before debugging it.

Vite re-optimizes dependencies whenever the lockfile changes. A re-optimization **wipes `node_modules/.vite/deps`** and re-emits entries under a new hash. If the wasm-sdk was never in the optimizer's entry set, no entry is emitted for it — while the dev-transformed `dpns-client.ts` keeps pointing at the **old** hash. The dev server then answers that URL with **504**, and the browser surfaces the whole thing as:

```
Importing a module script failed.
```

That message names neither the module nor the reason, and it looks like a network or CORS failure. It is neither. It is a stale optimizer cache.

Three rules follow:

- `optimizeDeps.include: ['@dashevo/wasm-sdk']` in `apps/desktop/astro.config.mjs` forces an entry to exist regardless of which file is requested first. **Do not remove it**; it is the fix, not a hint.
- If the symptom returns after a dependency change, `rm -rf node_modules/.vite` and restart. That is the immediate remedy.
- To confirm the diagnosis rather than assume it: resolve the URL the module actually points at and check its status code. A 504 is this bug; a CORS error is not.

**The production build is unaffected**, because Rolldown follows dynamic imports and code-splits the bundle itself. A green `pnpm build` therefore says nothing about this failure mode — it must be checked against the **dev server**.

### Clicking a freshly loaded page in a headless test

Polling for a button element is **not** sufficient before clicking it. The button is in the served HTML, so it exists before any JavaScript has run; a click at that moment is silently swallowed and the test reports a data failure that is really a race. Wait for the module to execute, then confirm the click changed something, and retry rather than reporting the first no-op as a result.
