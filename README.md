# Evo Titan

Monorepo for the Evo Titan application: web, docs, desktop and mobile.

- Homepage: https://evotitan.app
- App id: `app.evotitan`
- API: https://evotitan.app/v1 (separate repository: `evo-titan-api`)

## Layout

| Path              | Purpose                          | Stack                          |
| ----------------- | -------------------------------- | ------------------------------ |
| `packages/web`    | Public web application           | Astro + Tailwind CSS (static)  |
| `packages/docs`   | Documentation site               | Astro Starlight + Tailwind CSS |
| `packages/config` | Shared tsconfig/eslint/prettier  | TypeScript                     |
| `apps/desktop`    | Desktop application              | Tauri v2 + Astro + Tailwind    |
| `apps/mobile`     | Mobile application               | React Native + NativeWind      |

## Tooling

- Package manager: pnpm 11.21.0 (pinned via `packageManager`)
- Node: 24.18.1 (see `.nvmrc`)
- Task runner: Turborepo 2.11.2
- All dependency versions are pinned exactly (`.npmrc` sets `save-exact=true` and `save-prefix=""`).

## Commands

```sh
pnpm install          # install all workspace dependencies
pnpm build            # turbo run build (dependency-ordered)
pnpm dev              # turbo run dev
pnpm lint             # turbo run lint
pnpm typecheck        # turbo run typecheck
pnpm format           # prettier --write .
```

## Git

- Default branch: `master`
- GitHub: https://github.com/sansbankdao/evo-titan
