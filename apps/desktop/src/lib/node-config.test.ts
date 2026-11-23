// apps/desktop/src/lib/node-config.test.ts — Evo Titan
//
// Unit tests for the persisted connection settings. Pure: the storage is an
// in-memory fake, so this runs under `node --test` with no DOM, matching the
// rpc-core suite's philosophy — the tested code is the shipped code.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NODE_CONFIG_KEY,
  TESTNET_DEFAULT_PORT,
  MAINNET_DEFAULT_PORT,
  isConfigured,
  parseNodeConfig,
  loadNodeConfig,
  saveNodeConfig,
  clearNodeConfig,
  setSessionPassword,
  clearSessionPassword,
  effectiveConfig,
  type ConfigStorage,
} from './node-config.ts';

/** An in-memory localStorage stand-in. */
function fakeStorage(initial: Record<string, string> = {}): ConfigStorage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

const GOOD = { host: '127.0.0.1', port: 19998, user: 'titan', password: 'pw' };

test('sourced port defaults', () => {
  // chainparamsbase.cpp:42-45 @ v24.0.3, re-verified 2026-11-23.
  assert.equal(TESTNET_DEFAULT_PORT, 19998);
  assert.equal(MAINNET_DEFAULT_PORT, 9998);
});

test('isConfigured requires host, integer port and user; an empty password is allowed', () => {
  assert.ok(isConfigured(GOOD));
  assert.ok(isConfigured({ ...GOOD, password: '' }));
  assert.ok(!isConfigured({ ...GOOD, host: '' }));
  assert.ok(!isConfigured({ ...GOOD, user: '' }));
  assert.ok(!isConfigured({ ...GOOD, port: 0 }));
  assert.ok(!isConfigured({ ...GOOD, port: 65536 }));
  assert.ok(!isConfigured({ ...GOOD, port: 19998.5 }));
  assert.ok(!isConfigured(null));
  assert.ok(!isConfigured(undefined));
});

test('save then load round-trips', () => {
  const s = fakeStorage();
  assert.ok(saveNodeConfig(s, GOOD));
  assert.deepEqual(loadNodeConfig(s), GOOD);
  assert.equal(s.getItem(NODE_CONFIG_KEY), JSON.stringify(GOOD));
});

test('save rejects an unusable config rather than persisting garbage', () => {
  const s = fakeStorage();
  assert.ok(!saveNodeConfig(s, { ...GOOD, port: 'x' as unknown as number }));
  assert.equal(s.getItem(NODE_CONFIG_KEY), null);
});

test('parseNodeConfig: absent, corrupt and incomplete values yield null, never a throw', () => {
  assert.equal(parseNodeConfig(null), null);
  assert.equal(parseNodeConfig(''), null);
  assert.equal(parseNodeConfig('{not json'), null);
  assert.equal(parseNodeConfig('{"host":"h","port":19998}'), null); // missing user/password
  assert.equal(parseNodeConfig('{"host":"h","port":"19998","user":"u","password":""}'), null);
  assert.deepEqual(
    parseNodeConfig('{"host":"h","port":19998,"user":"u","password":""}'),
    { host: 'h', port: 19998, user: 'u', password: '' },
  );
});

test('clear removes the key', () => {
  const s = fakeStorage({ [NODE_CONFIG_KEY]: JSON.stringify(GOOD) });
  clearNodeConfig(s);
  assert.equal(s.getItem(NODE_CONFIG_KEY), null);
});

test('a storage that throws is survived: load yields null, save returns false', () => {
  const broken: ConfigStorage = {
    getItem: () => {
      throw new Error('private mode');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(loadNodeConfig(broken), null);
  assert.equal(saveNodeConfig(broken, GOOD), false);
  assert.doesNotThrow(() => clearNodeConfig(broken));
});

test('effectiveConfig fills a deliberately-unpersisted password from the session', () => {
  clearSessionPassword();
  const stored = { host: '127.0.0.1', port: 19998, user: 'titan', password: '' };
  const s = fakeStorage({ [NODE_CONFIG_KEY]: JSON.stringify(stored) });
  // Configured endpoint, no password anywhere: the persisted form is returned.
  assert.deepEqual(effectiveConfig(s), stored);
  // Session password takes over without being written to storage.
  setSessionPassword('session-only');
  assert.equal(effectiveConfig(s)?.password, 'session-only');
  assert.ok(!s.getItem(NODE_CONFIG_KEY)!.includes('session-only'));
  clearSessionPassword();
  assert.equal(effectiveConfig(s)?.password, '');
});

test('effectiveConfig prefers the persisted password over the session one', () => {
  setSessionPassword('session-only');
  const s = fakeStorage({ [NODE_CONFIG_KEY]: JSON.stringify(GOOD) });
  assert.equal(effectiveConfig(s)?.password, GOOD.password);
  clearSessionPassword();
});

test('effectiveConfig is null with nothing configured', () => {
  clearSessionPassword();
  assert.equal(effectiveConfig(fakeStorage()), null);
});
