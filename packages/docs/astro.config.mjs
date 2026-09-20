// packages/docs/astro.config.mjs — Evo Titan
// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://evotitan.app',
  output: 'static',
  integrations: [
    starlight({
      title: 'Evo Titan',
      description: 'Documentation for Evo Titan.',
      customCss: ['./src/styles/tailwind.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/sansbankdao/evo-titan',
        },
      ],
      sidebar: [
        {
          label: 'Guides',
          items: [{ label: 'Getting started', slug: 'guides/getting-started' }],
        },
        {
          label: 'Reference',
          items: [{ autogenerate: { directory: 'reference' } }],
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
