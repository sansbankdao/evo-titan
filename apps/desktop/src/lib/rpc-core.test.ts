// apps/desktop/src/lib/rpc-core.test.ts — Evo Titan
//
// The local test suite for the Dash Core RPC client. Zero new dependencies:
// it uses Node's built-in test runner and Node's native TypeScript support, so
// it runs with `node --test src/lib/rpc-core.test.ts` and no build step.
//
// Two halves:
//   (A) UNIT — a recording transport stands in for Rust and captures the exact
//       envelope every DashRpc method produces. These always run and need no
//       node. They are what pins the request SHAPE: parameter order, types and
//       defaults. A signature confirmed from `help` is not a call confirmed to
//       succeed, but a shape confirmed here is at least the shape we send.
//   (B) INTEGRATION — the same DashRpc class against a real dashd, skipped
//       automatically when no node is reachable so the suite stays green on a
//       machine without docker. Start a node with the recipe in AGENTS.md:
//
//         docker run -d --name etdashd -p 127.0.0.1:19899:19899 \
//           dashpay/dashd:24.0.0-rc.1 dashd -regtest -server -txindex \
//           -listen=0 -rpcport=19899 -rpcbind=0.0.0.0 \
//           -rpcuser=titan -rpcpassword=titanlocaldev \
//           -rpcallowip=0.0.0.0/0 -fallbackfee=0.0001

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DashRpc,
  RpcError,
  buildEnvelope,
  parseReplyBody,
  interpretReply,
  endpointFor,
  assertUsableConfig,
  type RpcConfig,
  type RpcHttpRequest,
  type RpcHttpResponse,
  type RpcTransport,
} from './rpc-core.ts';

// ---------- helpers ----------

const HOST = '127.0.0.1';
const PORT = 19899;
const USER = 'titan';
const PASS = 'titanlocaldev';

const CONFIG: RpcConfig = { host: HOST, port: PORT, user: USER, password: PASS };

/** What a transport was asked to send, for shape assertions. */
interface Captured {
  request: RpcHttpRequest;
  envelope: { jsonrpc: string; id: string; method: string; params: unknown[] };
}

/**
 * A transport that records the request and returns a canned reply.
 * Used to assert the exact envelope each method builds.
 */
function recording(reply: RpcHttpResponse = ok(0)): { transport: RpcTransport; captured: Captured[] } {
  const captured: Captured[] = [];
  const transport: RpcTransport = async (request) => {
    captured.push({ request, envelope: JSON.parse(request.body) });
    return reply;
  };
  return { transport, captured };
}

const ok = (result: unknown): RpcHttpResponse => ({
  status: 200,
  body: JSON.stringify({ result, error: null, id: 'evo-titan' }),
  elapsedMs: 1,
});

const errorOn = (status: number, code: number, message: string): RpcHttpResponse => ({
  status,
  body: JSON.stringify({ result: null, error: { code, message }, id: 'evo-titan' }),
  elapsedMs: 1,
});

/**
 * Run fn and return the error it threw, or null.
 * `assert.rejects` resolves to undefined in Node 24, so it cannot be used to
 * inspect the returned error object; `assert.throws` is synchronous only.
 */
async function capture(fn: () => Promise<unknown> | unknown): Promise<unknown> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
}

// The node itself, for the integration half.
const liveTransport: RpcTransport = async ({ url, user, password, body }) => {
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
    return { status: 0, body: '', elapsedMs: Date.now() - started, transportError: `connect failed: ${message}` };
  }
};

const liveRpc = new DashRpc(CONFIG, liveTransport);

// Probe once so the integration suite can skip when no node is running.
const nodeUp = await (async () => {
  const http = await liveTransport({
    url: endpointFor(HOST, PORT),
    user: USER,
    password: PASS,
    body: buildEnvelope('getblockcount', []),
  });
  return http.status === 200;
})();

// ---------- (A) envelope construction ----------

describe('envelope', () => {
  test('is JSON-RPC 1.0 with a string id and a params array', () => {
    const e = JSON.parse(buildEnvelope('getblockcount', []));
    assert.equal(e.jsonrpc, '1.0');
    assert.equal(e.id, 'evo-titan');
    assert.equal(e.method, 'getblockcount');
    assert.deepEqual(e.params, []);
  });

  test('preserves parameter order', () => {
    const e = JSON.parse(buildEnvelope('protx', ['shared_update_share', 'ab', 3, 'yR', 'yF', true]));
    assert.deepEqual(e.params, ['shared_update_share', 'ab', 3, 'yR', 'yF', true]);
  });

  test('passes a percent string through untouched, never converted to a number', () => {
    const e = JSON.parse(buildEnvelope('protx', ['shared_register_prepare', 'tx', [], '', 'bls', 'yV', '15.00', 0, 0]));
    assert.equal(e.params[6], '15.00');
    assert.equal(typeof e.params[6], 'string');
  });

  test('serialises an empty parameter list as [] not null', () => {
    assert.match(buildEnvelope('help', []), /"params":\[\]/);
  });

  test('escapes hostile method strings rather than producing invalid JSON', () => {
    const raw = buildEnvelope('say "hi"\n', []);
    assert.equal(JSON.parse(raw).method, 'say "hi"\n');
  });
});

// ---------- (A) config guards ----------

describe('config guards', () => {
  test('endpointFor builds a URL with a trailing slash', () => {
    assert.equal(endpointFor('127.0.0.1', 9998), 'http://127.0.0.1:9998/');
  });

  test('rejects an empty host', () => assert.throws(() => assertUsableConfig('', 9998), RpcError));
  test('rejects port 0', () => assert.throws(() => assertUsableConfig('h', 0), RpcError));
  test('rejects port 70000', () => assert.throws(() => assertUsableConfig('h', 70000), RpcError));
  test('rejects a non-integer port', () => assert.throws(() => assertUsableConfig('h', 1.5), RpcError));
  test('accepts a normal port', () => assert.doesNotThrow(() => assertUsableConfig('h', 9998)));

  test('call() refuses a bad port before opening a socket', async () => {
    const { transport, captured } = recording();
    const rpc = new DashRpc({ ...CONFIG, port: 0 }, transport);
    const err = await capture(() => rpc.call('getblockcount'));
    assert.ok(err instanceof RpcError);
    assert.equal(captured.length, 0);
  });
});

// ---------- (A) reply interpretation ----------

describe('interpretReply', () => {
  test('returns result on success', () => {
    assert.equal(interpretReply('getblockcount', ok(0)), 0);
  });

  test('returns a string result unchanged', () => {
    const txid = 'a'.repeat(64);
    assert.equal(interpretReply('sendrawtransaction', ok(txid)), txid);
  });

  test('null result is returned as null, not treated as an error', () => {
    assert.equal(interpretReply('x', ok(null)), null);
  });

  test('false result is returned as false', () => {
    assert.equal(interpretReply('x', ok(false)), false);
  });

  test('surfaces a JSON-RPC error carried on HTTP 500 (status is not the signal)', async () => {
    const err = await capture(() => interpretReply('protx', errorOn(500, -8, 'invalid height specified')));
    assert.ok(err instanceof RpcError);
    assert.equal((err as RpcError).code, -8);
    assert.match((err as RpcError).message, /invalid height/);
  });

  test('surfaces -32601 for a top-level shared_* call', async () => {
    const err = await capture(() => interpretReply('shared_sign', errorOn(404, -32601, 'Method not found')));
    assert.ok(err instanceof RpcError);
    assert.equal((err as RpcError).code, -32601);
  });

  test('reports 401 with an EMPTY body as an auth failure, not a parse failure', async () => {
    const err = await capture(() => interpretReply('getblockcount', { status: 401, body: '', elapsedMs: 3 }));
    assert.ok(err instanceof RpcError);
    assert.match((err as RpcError).message, /rejected the credentials/);
    assert.equal((err as RpcError).code, undefined);
  });

  test('reports a non-JSON 200 body with an excerpt', async () => {
    const err = await capture(() => interpretReply('getblockcount', { status: 200, body: '<html>nope</html>', elapsedMs: 1 }));
    assert.ok(err instanceof RpcError);
    assert.match((err as RpcError).message, /not JSON-RPC/);
    assert.match((err as RpcError).message, /<html>nope<\/html>/);
  });

  test('rejects a JSON body that is an array', async () => {
    const err = await capture(() => interpretReply('getblockcount', { status: 200, body: '[]', elapsedMs: 1 }));
    assert.ok(err instanceof RpcError);
  });

  test('rejects a JSON body that is null', async () => {
    const err = await capture(() => interpretReply('getblockcount', { status: 200, body: 'null', elapsedMs: 1 }));
    assert.ok(err instanceof RpcError);
  });

  test('a transport error does not need a body', async () => {
    const err = await capture(() => interpretReply('getblockcount', { status: 0, body: '', elapsedMs: 1, transportError: 'could not connect' }));
    assert.ok(err instanceof RpcError);
    assert.match((err as RpcError).message, /could not connect/);
  });

  test('an error body wins over a misleading 200 status', async () => {
    const err = await capture(() => interpretReply('protx', { status: 200, body: JSON.stringify({ error: { code: -18, message: 'No wallet is loaded' } }), elapsedMs: 1 }));
    assert.ok(err instanceof RpcError);
    assert.equal((err as RpcError).code, -18);
  });

  test('parseReplyBody refuses a truncated body', () => {
    assert.throws(() => parseReplyBody('{"result":'), /not JSON/);
  });
});

// ---------- (A) request shape per method ----------

function lastEnvelope(captured: Captured[]) {
  const last = captured[captured.length - 1];
  assert.ok(last, 'no request was sent');
  return last.envelope;
}

describe('request shape', () => {
  test('listMasternodes sends protx list registered true', async () => {
    const { transport, captured } = recording(ok([]));
    await new DashRpc(CONFIG, transport).listMasternodes();
    assert.deepEqual(lastEnvelope(captured).params, ['list', 'registered', true]);
  });

  test('listMasternodes appends a height when given one', async () => {
    const { transport, captured } = recording(ok([]));
    await new DashRpc(CONFIG, transport).listMasternodes('registered', true, 500);
    assert.deepEqual(lastEnvelope(captured).params, ['list', 'registered', true, 500]);
  });

  test('masternodeStatus takes NO arguments (corrected from the live node)', async () => {
    const { transport, captured } = recording(ok({}));
    await new DashRpc(CONFIG, transport).masternodeStatus();
    assert.equal(lastEnvelope(captured).method, 'masternode');
    assert.deepEqual(lastEnvelope(captured).params, ['status']);
  });

  test('masternodeWinners sends at most count and filter', async () => {
    const { transport, captured } = recording(ok({}));
    await new DashRpc(CONFIG, transport).masternodeWinners(5, '');
    assert.deepEqual(lastEnvelope(captured).params, ['winners', 5, '']);
  });

  test('generateOperatorKey uses bls generate, not the removed masternode genkey', async () => {
    const { transport, captured } = recording(ok({ secret: 'ab', public: 'cd', scheme: 'basic' }));
    await new DashRpc(CONFIG, transport).generateOperatorKey();
    assert.equal(lastEnvelope(captured).method, 'bls');
    assert.deepEqual(lastEnvelope(captured).params, ['generate']);
  });

  test('sharedMasternodeInfo uses protx info with the hash', async () => {
    const { transport, captured } = recording(ok({}));
    await new DashRpc(CONFIG, transport).sharedMasternodeInfo('a'.repeat(64));
    assert.deepEqual(lastEnvelope(captured).params, ['info', 'a'.repeat(64)]);
  });

  test('sharedRegisterPrepare is a protx SUBCOMMAND carrying a STRING operatorReward', async () => {
    const { transport, captured } = recording(ok({ tx: 'ab', collateralIndex: 1, consentHash: 'cd', terms: {} }));
    const shares = [{ amount: 12500000000, refundAddress: 'yR', rewardAddress: 'yW', ownerAddress: 'yO' }];
    await new DashRpc(CONFIG, transport).sharedRegisterPrepare('deadbeef', shares, '', 'blsPub', 'yV', '15.00', 0, 0);
    const e = lastEnvelope(captured);
    assert.equal(e.method, 'protx');
    assert.equal(e.params[0], 'shared_register_prepare');
    assert.equal(e.params[1], 'deadbeef');
    assert.deepEqual(e.params[2], shares);
    assert.equal(e.params[3], '');
    assert.equal(e.params[4], 'blsPub');
    assert.equal(e.params[5], 'yV');
    assert.equal(e.params[6], '15.00');
    assert.equal(typeof e.params[6], 'string');
    assert.equal(e.params[7], 0);
    assert.equal(e.params[8], 0);
    assert.equal(e.params.length, 9);
  });

  test('sharedSign sends the tx and the allowTimeLocks flag', async () => {
    const { transport, captured } = recording(ok({ signatures: [] }));
    await new DashRpc(CONFIG, transport).sharedSign('deadbeef');
    assert.deepEqual(lastEnvelope(captured).params, ['shared_sign', 'deadbeef', false]);
  });

  test('sharedCombine defaults submit to false (registrations still need input signing)', async () => {
    const { transport, captured } = recording(ok('hex'));
    const sigs = [{ shareIndex: 0, signature: 'AAAA' }];
    await new DashRpc(CONFIG, transport).sharedCombine('deadbeef', sigs);
    assert.deepEqual(lastEnvelope(captured).params, ['shared_combine', 'deadbeef', sigs, false]);
  });

  test('sharedDissolve omits payPenalty rather than defaulting it', async () => {
    const { transport, captured } = recording(ok('hex'));
    await new DashRpc(CONFIG, transport).sharedDissolve('b'.repeat(64), 0);
    assert.deepEqual(lastEnvelope(captured).params, ['shared_dissolve', 'b'.repeat(64), 0, 100000, true]);
  });

  test('sharedDissolve appends payPenalty when explicitly given', async () => {
    const { transport, captured } = recording(ok('hex'));
    await new DashRpc(CONFIG, transport).sharedDissolve('b'.repeat(64), 0, 100000, false, false);
    assert.deepEqual(lastEnvelope(captured).params, ['shared_dissolve', 'b'.repeat(64), 0, 100000, false, false]);
  });

  test('sharedUpdateShare sends feeSourceAddress as the 4th argument (the arity fix)', async () => {
    const { transport, captured } = recording(ok('hex'));
    await new DashRpc(CONFIG, transport).sharedUpdateShare('c'.repeat(64), 2, 'yR', 'yF');
    const e = lastEnvelope(captured);
    assert.deepEqual(e.params, ['shared_update_share', 'c'.repeat(64), 2, 'yR', 'yF', true]);
    assert.equal(e.params.length, 6);
  });

  test('sharedUpdateRegistrarPrepare sends all four arguments', async () => {
    const { transport, captured } = recording(ok({ tx: 'ab' }));
    await new DashRpc(CONFIG, transport).sharedUpdateRegistrarPrepare('d'.repeat(64), 'blsPub', 'yV', 'yF');
    assert.deepEqual(lastEnvelope(captured).params, ['shared_update_registrar_prepare', 'd'.repeat(64), 'blsPub', 'yV', 'yF']);
  });
});

// ---------- (B) integration against the real node ----------

describe('live regtest node', { skip: nodeUp ? false : 'dashd is not reachable at 127.0.0.1:19899' }, () => {
  test('getblockcount returns a number', async () => {
    assert.equal(typeof (await liveRpc.call('getblockcount')), 'number');
  });

  test('getbestblockhash returns a 64-char hex string', async () => {
    assert.match((await liveRpc.call<string>('getbestblockhash')), /^[0-9a-f]{64}$/);
  });

  test('getnetworkinfo reports a Dash Core subversion and version 240000', async () => {
    const info = await liveRpc.call<{ subversion: string; version: number }>('getnetworkinfo');
    assert.match(info.subversion, /Dash Core/);
    assert.equal(info.version, 240000);
  });

  test('blockchainInfo() has blocks, headers and verificationprogress', async () => {
    const b = await liveRpc.blockchainInfo() as Record<string, unknown>;
    for (const k of ['blocks', 'headers', 'verificationprogress', 'initialblockdownload']) {
      assert.ok(k in b, `missing ${k}`);
    }
    assert.equal(b.chain, 'regtest');
  });

  test('a wrong password is an auth failure', async () => {
    const wrong = new DashRpc({ ...CONFIG, password: 'wrong' }, liveTransport);
    const err = await capture(() => wrong.call('getblockcount'));
    assert.ok(err instanceof RpcError);
    assert.match((err as RpcError).message, /rejected the credentials/);
  });

  test('top-level shared_sign is NOT a method (-32601)', async () => {
    const err = await capture(() => liveRpc.call('shared_sign', ['00']));
    assert.ok(err instanceof RpcError);
    assert.equal((err as RpcError).code, -32601);
  });

  test('protx shared_sign as a subcommand exists (not -32601)', async () => {
    const err = await capture(() => liveRpc.call('protx', ['shared_sign', '00']));
    assert.ok(err instanceof RpcError);
    assert.notEqual((err as RpcError).code, -32601);
  });

  test('listMasternodes rejects an unknown type with -8', async () => {
    const err = await capture(() => liveRpc.listMasternodes('bogus'));
    assert.ok(err instanceof RpcError);
    assert.equal((err as RpcError).code, -8);
  });

  test('sharedMasternodeInfo on a short hash is a -8 length error', async () => {
    const err = await capture(() => liveRpc.sharedMasternodeInfo('00'));
    assert.ok(err instanceof RpcError);
    assert.equal((err as RpcError).code, -8);
    assert.match((err as RpcError).message, /length 64/);
  });

  test('help documents shared_update_share feeSourceAddress', async () => {
    const h = await liveRpc.call<string>('help', ['protx shared_update_share']);
    assert.match(h, /feeSourceAddress/);
  });

  test('help says operatorReward is a percentage 0.00 to 100.00', async () => {
    const h = await liveRpc.call<string>('help', ['protx shared_register_prepare']);
    assert.match(h, /fraction in %% to share with the operator \(0\.00 to 100\.00\)/);
  });

  test('help documents the 1000000 duff shared_dissolve fee ceiling', async () => {
    const h = await liveRpc.call<string>('help', ['protx shared_dissolve']);
    assert.match(h, /At most 1000000 duffs/);
  });

  test('generateOperatorKey returns a basic-scheme BLS pair', async () => {
    const k = await liveRpc.generateOperatorKey();
    assert.equal(k.scheme, 'basic');
    assert.match(k.public, /^[0-9a-f]{96}$/);
    assert.match(k.secret, /^[0-9a-f]{64}$/);
  });

  test('masternodeWinners accepts two arguments and returns a map', async () => {
    const w = await liveRpc.masternodeWinners(5, '');
    assert.equal(typeof w, 'object');
    assert.equal(Array.isArray(w), false);
  });

  test('masternodeWinners rejects a third argument with -1', async () => {
    const err = await capture(() => liveRpc.call('masternode', ['winners', 5, '', 0]));
    assert.ok(err instanceof RpcError);
    assert.equal((err as RpcError).code, -1);
  });

  test('a connection to a closed port is reported as a transport error', async () => {
    const dead = new DashRpc({ ...CONFIG, port: 19998 }, liveTransport);
    const err = await capture(() => dead.call('getblockcount'));
    assert.ok(err instanceof RpcError);
    assert.match((err as RpcError).message, /could not connect|transport|connect failed/i);
    assert.equal((err as RpcError).code, undefined);
  });
});
