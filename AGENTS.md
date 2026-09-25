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

`custodial` in `packages/web/src/config/site.ts` is a placeholder for a future custodial entry point at **1 DASH**, waitlisted at launch, gated behind `available: false`.

Rules:

- **It is Rank 0, not a new Rank I.** The numbered ladder describes collateral the operator actually holds; the custodial layer is the opposite arrangement. Presenting it as a rung would imply the same ownership.
- **Do not flip `available` to `true`** until a licensed arrangement exists. No deposit address is published and none should be.
- **Do not invent a date.** `waitingOn` lists conditions (a licence, 1,000 DASH of pooled deposits), not a schedule.
- **Custody is stated, never implied.** The trade-off list says we hold the collateral, the user does not hold the keys, and withdrawal depends on our liquidity. Keep that list; a page that hides the trade-off misleads.
- **The waitlist is the only affordance**, and it is disabled with an empty `endpoint`. A placeholder URL that appears to accept a signup is worse than a disabled button, because the user believes they joined.
- **Do not describe this as "licensing a masternode."** Dash has no masternode licensing. The mechanic is pooling deposits and operating a node on depositors' behalf. Write that, not a protocol claim.

## Verifying UI work

The session runs on **Wayland**. `import` is X11-only and `grim`, `slurp`, `xdotool`, and `wmctrl` are not installed, so **a screenshot of the running window is not possible.** Do not claim a window "looks right" — that cannot be verified here.

Verify UI by:
- The dev log, which records each route Tauri fetched (`[200] /`, `[200] /shared`, …).
- `curl` against the dev server, checking for expected markers in the returned HTML.
- Process state (`ps -o stat,nlwp,rss`) to confirm the webview initialized rather than crash-looping.

## Mock data

All desktop data is mock and lives in `apps/desktop/src/lib/mock.ts`, behind a file header stating so.

- A **non-dismissible** banner renders on every desktop screen: `MOCK DATA — no node connected`. Keep it. It exists so a screenshot can never be mistaken for real fleet data.
- `apps/desktop/src/lib/rpc.ts` is the seam where real calls go. `DashRpc.call()` **throws by design.** Do not wire a fake transport that returns plausible values: the UI would appear connected while reading nothing. Every method carries `TODO: verify against dashd` and those markers stay until a call has actually been run against a real node.
- As of this writing no RPC has been verified: `dash-cli` and `dashd` are not installed, no `dashd` process runs, no RPC port is listening, and no `dash.conf` exists.

**Protocol constants in copy must be sourced.** Currently sourced from Dash Core `v24.0.0-rc.1`: Regular collateral `1000 * COIN` and Evo `4000 * COIN` (`src/evo/dmn_types.h`), `MIN_SHARES{2}`/`MAX_SHARES{8}` (`src/evo/providertx.h:134-135`), `MIN_AMOUNT{100 * COIN}` (`src/evo/providertx.h:58`), Evo voting weight 4× Regular (`src/evo/dmn_types.h`), and the `bad-protx-shares-evo` rejection (`src/evo/providertx.cpp:280`). Everything else on the marketing site is **mock** and is labelled in `packages/web/src/config/site.ts`.

"Cluster" is **not** a Dash protocol term. Marketing copy must not present invented vocabulary as protocol.

## Marketing copy constraints

- **Payments are DASH and Dash USDC only.** No third-party processor. Dash USDC is `available: false` until it exists.
- **Titan PRO is $5.00/month**, formatted through the `money()` helper so it never renders `$5.5`.
- The **rank ladder is ours**, not protocol. Requirements are consensus; names are not.
- Mock content is isolated in `packages/web/src/config/site.ts` and marked. Do not bury invented claims in components.

## Deployment

- `packages/web` and `packages/docs` are built and deployed by **Cloudflare Pages** on push to `master` (`evo-titan-web`, `evo-titan-docs`). Domains: `evotitan.app`, `www.evotitan.app`, `docs.evotitan.app`.
- The **API deploys manually** from the VM. It lives on Gitea, so Cloudflare's GitHub integration does not reach it.
- After pushing web changes, **verify the live HTML matches local `dist/index.html` byte-for-byte** before declaring success. A green build is not proof that the deploy carried the change.

## Git identity

Commit as `Sansbank contributors <hello@sansbank.org>`. This is set in **repo-local** config; do not pass inline `-c user.name`/`-c user.email` flags.