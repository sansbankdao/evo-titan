// apps/desktop/src/lib/rpc.ts — Evo Titan
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  THE TRANSPORT IS NOW REAL, BUT NOTHING IN THE UI CALLS IT.              ║
// ║                                                                          ║
// ║  This file adds only the environment-specific pieces: the Tauri          ║
// ║  transport (which delegates to src-tauri/src/rpc.rs because the webview  ║
// ║  cannot reach dashd — no CORS headers, 501 on OPTIONS) and a Node fetch  ║
// ║  transport for the test suite. The envelope, parsing, error mapping and  ║
// ║  the DashRpc class itself all live in rpc-core.ts, which has no Tauri    ║
// ║  or DOM dependency and so runs under `node --test`.                      ║
// ║                                                                          ║
// ║  The split is deliberate: the tested code and the shipped code are the   ║
// ║  same code, rather than a second implementation that merely resembles    ║
// ║  the first. See rpc-core.test.ts.                                        ║
// ║                                                                          ║
// ║  The UI still reads mock.ts. Every page keeps its non-dismissible        ║
// ║  "MOCK DATA — no node connected" banner, and `unconfiguredRpc` still    ║
// ║  throws, so a page accidentally wired to a live call fails visibly       ║
// ║  rather than appearing to work.                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { RpcError, type RpcHttpResponse, type RpcTransport } from './rpc-core';
import { DashRpc } from './rpc-core';

// The connection settings, the client and its error type are re-exported so
// callers can import everything from './rpc'. The test suite imports rpc-core
// directly, which is also what keeps it free of Tauri.
export { DashRpc } from './rpc-core';
export { RpcError } from './rpc-core';
export type { RpcConfig, RpcTransport, RpcHttpRequest, RpcHttpResponse } from './rpc-core';

/**
 * The transport used inside the Tauri application.
 *
 * It cannot fetch the node directly: dashd sends no Access-Control-Allow-Origin
 * header and answers an OPTIONS preflight with 501, so the webview blocks the
 * request before it leaves. This delegates to the Rust command in
 * src-tauri/src/rpc.rs, which performs the exchange and returns the raw status
 * and body. The password is passed through and never returned or logged.
 */
export const tauriTransport: RpcTransport = async (request) => {
  // Imported lazily so that rpc-core.ts and its tests never pull in Tauri,
  // which is only resolvable inside the bundled desktop app.
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<RpcHttpResponse>('rpc_call', { request });
};

/**
 * A transport backed by the host's own fetch, for `node --test` and local
 * development.
 *
 * Node has no same-origin policy, so this reaches dashd directly. That is what
 * makes the integration half of the test suite possible without a browser or a
 * running Tauri shell. It is NEVER selected inside the app: the webview cannot
 * use it, which is the whole reason the Rust proxy exists.
 */
export const nodeFetchTransport: RpcTransport = async ({ url, user, password, body }) => {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64'),
      },
      body,
    });
    return { status: response.status, body: await response.text(), elapsedMs: Date.now() - started };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      status: 0,
      body: '',
      elapsedMs: Date.now() - started,
      transportError: `could not connect to the node at ${url} — is dashd running and is RPC enabled? (${message})`,
    };
  }
};

/**
 * A client used while the UI is driven by mock data.
 *
 * Its transport always fails, so any component accidentally wired to a live
 * call fails visibly instead of appearing to work. This is the behaviour the
 * whole desktop UI/UX session depends on.
 */
export const unconfiguredRpc = new DashRpc(
  {
    host: '127.0.0.1',
    /** TODO: verify against dashd — mainnet RPC port is expected to be 9998. */
    port: 9998,
    user: '',
    password: '',
  },
  async () => {
    throw new RpcError(
      'No node is connected. This build is running on mock data; the transport is wired but ' +
        'never invoked by the UI. Configure a node to make a real call.',
      'transport',
    );
  },
);
