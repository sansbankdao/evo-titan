// apps/desktop/src/lib/dpns-client.ts — Evo Titan
//
// The one place that touches the Dash Platform WASM SDK.
//
// It is separate from dpns.ts so that dpns.ts stays pure and unit-testable
// without WASM: the tests inject a fake PlatformClient, and only this file
// knows how a real one is built. Same split as rpc.ts / rpc-core.ts.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  WHY THIS RUNS IN THE WEBVIEW, UNLIKE THE CORE RPC.                       ║
// ║                                                                          ║
// ║  dashd (Core RPC) sends no CORS headers and 501s an OPTIONS preflight,    ║
// ║  which is why the RPC transport had to move into Rust. DAPI is the        ║
// ║  opposite, and this was MEASURED rather than assumed:                     ║
// ║                                                                          ║
// ║    quorums.mainnet.networks.dash.org   access-control-allow-origin: *     ║
// ║    <dapi node>//…Platform/…            reflects the request Origin,       ║
// ║                                        and allows x-grpc-web             ║
// ║                                                                          ║
// ║  So the WASM SDK talks to the network directly from the page. A Rust      ║
// ║  proxy would add a moving part and a second implementation for no        ║
// ║  benefit. This was proven end to end in a headless browser: the SDK       ║
// ║  initialised, prefetched the trusted context, built, and returned real    ║
// ║  contested names. If DAPI's CORS policy ever changes, that test is the    ║
// ║  thing to re-run before assuming a proxy is needed.                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import type { PlatformClient } from './dpns';

/** The networks the SDK can be pointed at. */
export type PlatformNetwork = 'mainnet' | 'testnet';

/**
 * Build a live client for a network.
 *
 * The import is dynamic so the 27 MB WASM bundle is fetched only when a screen
 * actually asks for network data. A static import would put it in the main
 * chunk and every screen in the app would pay for it.
 *
 * The trusted context is prefetched first: it carries the quorum public keys
 * that proofs are verified against. Without it the SDK has addresses but no
 * way to know whether a reply is genuine, so skipping it would trade the whole
 * point of a proof-verified query for a slightly faster start.
 */
export async function createPlatformClient(network: PlatformNetwork = 'mainnet'): Promise<PlatformClient> {
  const sdk = await import('@dashevo/wasm-sdk');

  // `default` is the wasm-bindgen async initialiser. It must be awaited before
  // any class is constructed, or the wasm exports are undefined and the first
  // call fails with "Cannot read properties of undefined".
  await sdk.default();

  const context =
    network === 'mainnet'
      ? await sdk.WasmTrustedContext.prefetchMainnet()
      : await sdk.WasmTrustedContext.prefetchTestnet();

  const builder = network === 'mainnet' ? sdk.WasmSdkBuilder.mainnet() : sdk.WasmSdkBuilder.testnet();

  // `withTrustedContext` also substitutes the addresses the context discovered,
  // so the builder does not need a separate address list.
  return builder.withTrustedContext(context).build() as unknown as PlatformClient;
}

/**
 * A human-readable message for a failure that crossed the WASM boundary.
 *
 * WASM errors arrive as opaque values whose `message` may be empty, so a bare
 * `String(e)` can render as "[object Object]" in the UI. This always returns
 * something an operator can act on.
 */
export function describePlatformError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  try {
    const s = JSON.stringify(e);
    if (s && s !== '{}') return s;
  } catch {
    /* circular or non-serialisable */
  }
  return 'The Platform node returned an error with no message.';
}
