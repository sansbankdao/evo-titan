// packages/web/src/config/downloads.ts — Evo Titan
//
// Single source of truth for the "Download" section.
//
// IMPORTANT: every `href` below points at infrastructure that does NOT exist
// yet. The binaries are not built and no release artifacts are published, so
// each entry is marked `available: false`:
//
//   * No GitHub release exists on sansbankdao/evo-titan (0 releases), and the
//     repo reports `has_downloads: false`.
//   * `apk.evotitan.app`, `dl.evotitan.app` and `downloads.evotitan.app` do not
//     resolve (DNS NXDOMAIN).
//   * The sibling project serves APKs from R2 bucket `releases` behind
//     `apk.evonext.app`; that Worker/bucket layout is not wired up for Evo Titan.
//
// While `available` is false the UI renders the button in a disabled state with
// a "coming soon" label and `aria-disabled`, so the page never ships a link that
// 404s. Flip the flag and set the real `href` as each channel goes live.

export type Platform = {
  /** Stable identifier, also used as the CSS/test hook. */
  id: 'desktop' | 'android' | 'ios';
  /** Human-readable platform name shown as the card title. */
  name: string;
  /** One-line description of what the user gets. */
  description: string;
  /** Supported targets / requirement note. */
  meta: string;
  /** Label for the primary action button. */
  action: string;
  /** Destination once the artifact exists. */
  href: string;
  /** Whether the artifact is actually downloadable today. */
  available: boolean;
};

export const platforms: Platform[] = [
  {
    id: 'desktop',
    name: 'Desktop',
    description: 'Native desktop application for Windows, macOS and Linux.',
    meta: 'Windows · macOS · Linux',
    action: 'Download for desktop',
    href: 'https://github.com/sansbankdao/evo-titan/releases/latest',
    available: false,
  },
  {
    id: 'android',
    name: 'Android',
    description: 'Install the APK directly — no Play Store account required.',
    meta: 'Android 8.0 or later',
    action: 'Download APK',
    href: 'https://apk.evotitan.app/evotitan.apk',
    available: false,
  },
  {
    id: 'ios',
    name: 'iOS',
    description: 'iPhone and iPad build distributed through TestFlight.',
    meta: 'iOS 16 or later',
    action: 'Join TestFlight',
    href: 'https://testflight.apple.com/join/evotitan',
    available: false,
  },
];

/**
 * The web application, promoted with a header CTA rather than a download card
 * because it needs no artifact. It is not deployed yet, so the flag is false and
 * the button renders disabled instead of pointing at a non-existent route.
 */
export const webApp = {
  name: 'Web app',
  description: 'Run the full application in your browser — no installation.',
  action: 'Connect',
  href: 'https://app.evotitan.app/',
  available: false,
};

/** True when at least one channel can actually be downloaded right now. */
export const anyPlatformAvailable = platforms.some((platform) => platform.available);
