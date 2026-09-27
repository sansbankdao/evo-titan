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

- `nOperatorReward` exists **only in `CProRegTx`** and is **immutable after registration**. `shared_register_prepare` takes it as param 5 (0–10000 bp) and there is **no operator-payout-address argument**.
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
  2. **Shared pool — 15%.** Self-custodial shares; the depositor keeps their keys and each share pays its own reward script. We only coordinate. Recommended inside a 10–20% band.
  3. **Custodial — 30%.** We hold the keys. The only arrangement where we carry custody risk, which is why it is double the pool.
- **Why 15% and not 10%** for the shared pool, in order of weight: (a) the only sourced comparable for the same trustless arrangement is CrowdNode's **20%** non-custodial rate, so 15% undercuts it; (b) a 10% price is hard to raise later without penalising the early depositors who funded the pool; (c) 15% is already **half** the 30% we charge once we take custody.
- **Never present the 0% as a limited tier**, and never imply that full self-custody is a degraded mode. It is the arrangement the protocol was designed for; the paid tiers exist because we do work, not because we gate access.
- None of the three figures is a consensus constant. All three are product prices.
- On a shared node the operator cut comes off the **whole node** before the split, and the remainder is split **by collateral** (`SplitAmountByShares`). A 125 DASH deposit is 12.5% of a 1,000 DASH node's reward — not 12.5% of the post-fee remainder.
- **Competitor fees are now sourced and publishable.** CrowdNode's own knowledge-base article `knowledge.crowdnode.io/en/articles/2225953` ("How much does CrowdNode cost?"), read via pinned Wayback snapshots: `20240519054519` says *"We take 15% of the rewards being generated"*; `20250620013136` says *"We take 35% of the rewards being generated from custodial assets under management, 20% from non-custodial masternodes"*. The percentages are a cut of the **reward**, not the deposit. **Custodial (35%) is compared only to our custodial 30%; non-custodial (20%) only to our shared-pool 15%.** Never quote one against the other arrangement. **Full self-custody has no comparable line**, because we do not charge for it — do not manufacture one.
- **A fee is not a per-share charge.** `nOperatorReward` is basis points of the **whole-node** reward, taken at `src/masternode/payments.cpp:167` **before** the share split at `:175`. Every depositor therefore loses the same percentage of their own reward; a 125 DASH share and a 500 DASH share are cut identically. Never describe it as falling harder on small depositors.

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
- `apps/desktop/src/lib/rpc.ts` is the seam where real calls go. `DashRpc.call()` **throws by design.** Do not wire a fake transport that returns plausible values: the UI would appear connected while reading nothing. Every method carries `TODO: verify against dashd` and those markers stay until a call has actually been run against a real node.
- As of this writing no RPC has been verified: `dash-cli` and `dashd` are not installed, no `dashd` process runs, no RPC port is listening, and no `dash.conf` exists.

**Protocol constants in copy must be sourced.** Currently sourced from Dash Core `v24.0.0-rc.1`: Regular collateral `1000 * COIN` and Evo `4000 * COIN` (`src/evo/dmn_types.h`), `MIN_SHARES{2}`/`MAX_SHARES{8}` (`src/evo/providertx.h:134-135`), `MIN_AMOUNT{100 * COIN}` (`src/evo/providertx.h:58`), Evo voting weight 4× Regular (`src/evo/dmn_types.h`), and the `bad-protx-shares-evo` rejection (`src/evo/providertx.cpp:280`). Everything else on the marketing site is **mock** and is labelled in `packages/web/src/config/site.ts`.

"Cluster" is **not** a Dash protocol term. Marketing copy must not present invented vocabulary as protocol.

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