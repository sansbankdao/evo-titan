// apps/desktop/scripts/verify-live.mjs — Evo Titan
//
// Headless verification of the Phase 1 live wiring, driven over the Chrome
// DevTools Protocol with Node's built-in WebSocket — the same pattern the
// chart verification used (see AGENTS.md, "Proving a chart renders").
//
// WHAT THIS PROVES
// ----------------
// The full UI path: localStorage config -> the page scripts -> the live client
// -> the Tauri invoke seam -> rendered DOM. The invoke seam is stubbed with a
// window.__TAURI_INTERNALS__ that replays REAL replies captured from
// dashpay/dashd:24.0.3 (src/lib/fixtures/*): the stub implements the exact
// rpc_call contract the Rust proxy ships (takes {request:{url,user,password,
// body}}, returns {status, body, elapsedMs}), so only the IPC hop itself is
// simulated — and that hop is unchanged, release-shipped Rust verified
// statically. The DAPI Testnet status card is NOT stubbed: it makes a real
// network call to seed-1.testnet.networks.dash.org from inside the browser,
// which is exactly what the shipped app does.
//
// WHAT THIS DOES NOT PROVE
// ------------------------
// The real Tauri IPC. That is the same honest position the contested-cache
// screen shipped with (AGENTS.md): static name checks plus this DOM-level
// run; the first run inside the actual webview is the end-to-end test.
//
// Usage: node scripts/verify-live.mjs   (expects the dev server on :4327)

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const APP_PORT = 4327;
const CDP_PORT = 9223;
const BASE = `http://localhost:${APP_PORT}`;

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../src/lib/fixtures/${name}.json`, import.meta.url), 'utf8'));

const FIXTURES = {
  networkinfo: fixture('networkinfo'),
  blockchaininfo: fixture('blockchaininfo'),
  deploymentinfo: fixture('deploymentinfo'),
  protx_list_wallet: fixture('protx_list_wallet'),
};

/** The pre-paint init script: stub the Tauri invoke + seed the two keys. */
const INIT = `
(() => {
  const F = ${JSON.stringify(FIXTURES)};
  const replies = {
    getnetworkinfo: F.networkinfo,
    getblockchaininfo: F.blockchaininfo,
    getdeploymentinfo: F.deploymentinfo,
    'protx list': F.protx_list_wallet,
  };
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd, args) => {
      if (cmd !== 'rpc_call') throw new Error('harness: unexpected command ' + cmd);
      const env = JSON.parse(args.request.body);
      const key = env.method === 'protx' ? 'protx ' + env.params[0] : env.method;
      const fx = replies[key];
      if (fx === undefined) {
        return {
          status: 500,
          body: JSON.stringify({ result: null, error: { code: -32601, message: 'harness: no fixture for ' + key }, id: env.id }),
          elapsedMs: 1,
        };
      }
      return { status: 200, body: JSON.stringify({ result: fx, error: null, id: env.id }), elapsedMs: 1 };
    },
  };
  try {
    localStorage.setItem('evotitan.demoMode', 'off');
    localStorage.setItem(
      'evotitan.nodeConfig',
      JSON.stringify({ host: '127.0.0.1', port: 19998, user: 'titan', password: 'titanlocaldev' }),
    );
  } catch {}
})();
`;

// ---------- minimal CDP client ----------

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }
  on(fn) {
    this.listeners.push(fn);
    return () => this.listeners = this.listeners.filter((l) => l !== fn);
  }
}

async function waitFor(url, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${url}`);
}

// ---------- assertion helpers ----------

let failures = 0;
function check(name, ok, detail = '') {
  const mark = ok ? '✔' : '✘';
  console.log(`  ${mark} ${name}${ok ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
}

async function evalIn(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

/**
 * AGENTS.md's headless-testing rule: an element can exist before the module
 * that fills it has run, so poll for the EXPECTED CONTENT, not for the
 * element, with a timeout. Also used for post-click state.
 */
async function pollEval(cdp, expression, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await evalIn(cdp, expression);
      if (last) return last;
    } catch (e) {
      last = String(e);
    }
    await sleep(250);
  }
  throw new Error(`timeout polling ${expression} — last: ${JSON.stringify(last)}`);
}

async function navigate(cdp, url) {
  const loaded = new Promise((resolve) => {
    const off = cdp.on((msg) => {
      if (msg.method === 'Page.loadEventFired') {
        off();
        resolve();
      }
    });
  });
  await cdp.send('Page.navigate', { url });
  await loaded;
}

// ---------- the run ----------

console.log('Launching headless Chrome…');
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  `--remote-debugging-port=${CDP_PORT}`,
  '--user-data-dir=/tmp/et-chrome-profile',
  'about:blank',
], { stdio: 'ignore' });

try {
  await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`);
  const targets = await waitFor(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const initScript = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT });

  // ----- / — the live fleet -----
  console.log('\n== / (fleet, live mode) ==');
  await navigate(cdp, `${BASE}/`);
  await pollEval(cdp, `document.querySelector('[data-live-total]')?.textContent === '1'`);
  check('fleet: 1 node in the wallet renders from the recorded 24.0.3 reply', true);

  const fleet = await pollEval(cdp, `(async () => ({
    total: document.querySelector('[data-live-total]')?.textContent,
    collateral: document.querySelector('[data-live-collateral]')?.textContent,
    shares: document.querySelector('[data-live-shares]')?.textContent,
    pose: document.querySelector('[data-live-pose]')?.textContent,
    version: document.querySelector('[data-node-version]')?.textContent,
    chain: document.querySelector('[data-node-chain]')?.textContent,
    height: document.querySelector('[data-node-height]')?.textContent,
    rows: document.querySelectorAll('[data-live-node]').length,
    firstRow: document.querySelector('[data-live-node]')?.textContent,
    deployV24: [...document.querySelectorAll('[data-deploy-rows] p')].map(p => p.textContent).join(' | '),
  }))()`);
  check('fleet: collateral is the consensus 1,000 DASH', fleet.collateral === '1,000 DASH', fleet.collateral);
  check('fleet: 2 shares on chain', fleet.shares === '2', fleet.shares);
  check('fleet: the unserviced node is honestly PoSe-banned (1)', fleet.pose === '1', fleet.pose);
  check('fleet: node version formatted from 240003', (fleet.version ?? '').includes('24.0.3'), fleet.version);
  check('fleet: chain regtest at the fixture height 501', fleet.chain === 'regtest' && fleet.height === '501', `${fleet.chain}/${fleet.height}`);
  check('fleet: one table row rendered', fleet.rows === 1, String(fleet.rows));
  check('fleet: row carries hash, health and the 10% operator cut', /edcd18/.test(fleet.firstRow) && /PoSe-banned/.test(fleet.firstRow) && /10%/.test(fleet.firstRow), fleet.firstRow);
  check('fleet: deployment table shows v24 active since 300', /v24/.test(fleet.deployV24) && /active since 300/.test(fleet.deployV24), fleet.deployV24);

  const banners = await evalIn(cdp, `(async () => ({
    node: document.documentElement.dataset.node,
    liveBanner: getComputedStyle(document.querySelector("[data-notice='live-node']")).display,
    mockBanner: getComputedStyle(document.querySelector("[data-notice='mock-data']")).display,
    liveSection: getComputedStyle(document.querySelector('[data-live-content]')).display,
    mockSection: getComputedStyle(document.querySelector('[data-demo-content]')).display,
    emptyState: getComputedStyle(document.querySelector('[data-when-demo="off"]')).display,
    statusBar: document.querySelector('[data-node-label]')?.textContent,
  }))()`);
  check('state: html data-node=configured', banners.node === 'configured', banners.node);
  check('state: emerald live banner visible, amber mock banner hidden', banners.liveBanner === 'flex' && banners.mockBanner === 'none', JSON.stringify(banners));
  check('state: live section visible, mock section hidden, empty state hidden', banners.liveSection !== 'none' && banners.mockSection === 'none' && banners.emptyState === 'none', JSON.stringify(banners));
  check('state: status bar names the endpoint, not "connected"', (banners.statusBar ?? '').includes('127.0.0.1:19998'), banners.statusBar);

  // The placeholder 'Reading…' is truthy, so poll until it is GONE — the
  // DAPI card makes a real network call and needs real time.
  const dapi = await pollEval(cdp, `(() => { const t = document.querySelector('[data-dapi-status]')?.textContent || ''; return t && !t.includes('Reading') ? t : null; })()`);
  check('fleet: REAL testnet DAPI read rendered', /DAPI .+ Drive .+ catching_up: false/.test(dapi), dapi);

  // ----- /shared/ — the live share table -----
  console.log('\n== /shared/ (live mode) ==');
  await navigate(cdp, `${BASE}/shared/`);
  const shared = await pollEval(cdp, `(async () => ({
    summary: document.querySelector('[data-shared-summary]')?.textContent,
    cards: document.querySelectorAll('[data-live-shared-node]').length,
    card: document.querySelector('[data-live-shared-node]')?.textContent,
    err: document.querySelector('[data-shared-error]')?.textContent,
  }))()`);
  check('shared: summary — 1 shared node, 2 shares', /1 shared node/.test(shared.summary) && /2 shares on chain/.test(shared.summary), shared.summary);
  check('shared: one node card rendered', shared.cards === 1, String(shared.cards));
  check(
    'shared: both 500 DASH shares with addresses and exit terms',
    /500 DASH/.test(shared.card) &&
      /refund y/.test(shared.card) &&
      /owner y/.test(shared.card) &&
      /10%/.test(shared.card) &&
      /Exit terms/.test(shared.card) &&
      /17\.361 days/.test(shared.card),
    JSON.stringify(shared.card),
  );
  check('shared: PoSe-banned shown, no hidden error', /PoSe-banned/.test(shared.card) && shared.err === '', shared.err);

  // ----- /settings/ — the control surface -----
  console.log('\n== /settings/ (live mode) ==');
  await navigate(cdp, `${BASE}/settings/`);
  // Wait for the module to have run before clicking anything (AGENTS.md race rule).
  await pollEval(cdp, `document.querySelector('[data-connection-status]')?.getAttribute('data-connection-status') === 'configured'`);
  const pre = await evalIn(cdp, `(async () => ({
    badge: document.querySelector('[data-connection-status]')?.textContent,
    host: document.querySelector('[data-conn-host]')?.value,
    port: document.querySelector('[data-conn-port]')?.value,
    user: document.querySelector('[data-conn-user]')?.value,
    passwordEchoed: document.querySelector('[data-conn-password]')?.value,
    remember: document.querySelector('[data-conn-remember]')?.checked,
    source: document.querySelector('[data-setting="data-source"]')?.textContent,
  }))()`);
  check('settings: badge reports the configured endpoint', (pre.badge ?? '').includes('127.0.0.1:19998'), pre.badge);
  check('settings: form populated from the store', pre.host === '127.0.0.1' && pre.port === '19998' && pre.user === 'titan', JSON.stringify(pre));
  check('settings: the password is never echoed back', pre.passwordEchoed === '', pre.passwordEchoed);
  check('settings: remember ticked only when the password was persisted', pre.remember === true, String(pre.remember));
  check('settings: About data source reads Live', pre.source === 'Live — 127.0.0.1:19998', pre.source);

  await evalIn(cdp, `document.querySelector('[data-conn-test]').click()`);
  const post = await pollEval(cdp, `(async () => ({
    badge: document.querySelector('[data-connection-status]')?.textContent,
    summary: document.querySelector('[data-test-summary]')?.textContent,
    deploys: [...document.querySelectorAll('[data-deployments] p')].map(p => p.textContent).join(' | '),
  }))()`, 10_000);
  check('settings: Test connection -> Connected — 24.0.3 at height 501', (post.badge ?? '').includes('Connected — 24.0.3 at height 501'), post.badge);
  check('settings: subversion shown verbatim', (post.summary ?? '').includes('/Dash Core:24.0.3/'), post.summary);
  check('settings: deployment panel renders evo_shares as EHF-gated and inactive', /evo_shares \(EHF\)/.test(post.deploys) && /defined/.test(post.deploys), post.deploys);

  // ----- demo-ON default (fresh storage) — the mock contract still holds -----
  console.log('\n== / (demo mode on, no node) ==');
  // The init script re-seeds the config on every navigation, so it must be
  // removed before this phase — otherwise the "no node" state can never be
  // reached. localStorage is then cleared in the live page's own origin.
  await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: initScript.identifier });
  await evalIn(cdp, `localStorage.removeItem('evotitan.nodeConfig'); localStorage.setItem('evotitan.demoMode','on')`);
  await navigate(cdp, `${BASE}/`);
  const demo = await pollEval(cdp, `(async () => ({
    node: document.documentElement.dataset.node,
    mockBanner: getComputedStyle(document.querySelector("[data-notice='mock-data']")).display,
    mockRow: !!document.querySelector('[data-node="n1"]'),
    liveSection: getComputedStyle(document.querySelector('[data-live-content]')).display,
    liveBanner: getComputedStyle(document.querySelector("[data-notice='live-node']")).display,
  }))()`);
  check('demo on: html data-node=none', demo.node === 'none', demo.node);
  check('demo on: amber banner visible, live banner hidden', demo.mockBanner === 'flex' && demo.liveBanner === 'none', JSON.stringify(demo));
  check('demo on: mock fleet renders (n1), live section hidden', demo.mockRow && demo.liveSection === 'none', JSON.stringify(demo));

  console.log(failures === 0 ? '\nPASS — all live-wiring checks green.' : `\nFAIL — ${failures} check(s) failed.`);
} finally {
  chrome.kill();
}

process.exit(failures === 0 ? 0 : 1);
