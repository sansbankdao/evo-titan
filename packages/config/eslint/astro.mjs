// packages/config/eslint/astro.mjs — Evo Titan
// Shared flat ESLint config for Astro workspaces.
import astro from 'eslint-plugin-astro';
import base from './base.mjs';

export default [
  ...base,
  ...astro.configs.recommended,
];
