---
title: Getting started
description: Install and run the Evo Titan monorepo.
---

Evo Titan is a pnpm monorepo containing the web app, the documentation site, the
desktop app and the mobile app.

## Requirements

- Node `24.18.1` (see `.nvmrc`)
- pnpm `11.21.0`

## Install

```sh
pnpm install
```

## Develop

```sh
pnpm dev
```

Turborepo runs each workspace's `dev` task. Run a single workspace with a filter:

```sh
pnpm --filter @evotitan/web dev
```
