// apps/desktop/src/lib/rpc.ts — Evo Titan
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  NOTHING IN THIS FILE HAS BEEN VERIFIED AGAINST A RUNNING dashd.         ║
// ║                                                                          ║
// ║  No node was available when this was written: `dash-cli` and `dashd` are ║
// ║  not installed, no dashd process was running, no RPC port was listening  ║
// ║  and no dash.conf exists. Every method name, parameter shape and return  ║
// ║  field below is a PLACEHOLDER reconstructed from expectation, not from   ║
// ║  observed output.                                                        ║
// ║                                                                          ║
// ║  Each method carries `TODO: verify against dashd`. Do not remove those   ║
// ║  markers until the call has been run against a real node and its         ║
// ║  response checked. This session is UI/UX only; the UI reads `mock.ts`.   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/**
 * Connection settings for a node's JSON-RPC endpoint.
 *
 * TODO: verify against dashd — confirm the default mainnet RPC port and the
 * auth scheme (dashd accepts rpcuser/rpcpassword; newer builds also support a
 * cookie file in the data directory, which is preferable because it avoids
 * storing a password).
 */
export interface RpcConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

/** Thrown when a call cannot be made or the node returns an error. */
export class RpcError extends Error {
  constructor(
    message: string,
    readonly method: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

/**
 * A JSON-RPC client for one node.
 *
 * This is deliberately a thin, explicit shape rather than a generated client,
 * because the method set has not been confirmed. When a node is available, run
 * `dash-cli help` and reconcile every method below against that output.
 */
export class DashRpc {
  constructor(private readonly config: RpcConfig) {}

  /**
   * Perform a JSON-RPC call.
   *
   * TODO: verify against dashd — confirm the request envelope (JSON-RPC 1.0 vs
   * 2.0), the auth header format, and whether the node requires a `workqueue`
   * or `wallet` path segment for wallet-scoped calls.
   *
   * Intentionally throws. It is not wired to a transport yet, and a silently
   * fake transport would be worse than a loud failure: the UI would look like
   * it was reading a node when it was reading nothing.
   */
  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    throw new RpcError(
      `DashRpc.call is not implemented. Attempted "${method}" with ${params.length} parameter(s) ` +
        `against ${this.config.host}:${this.config.port}. No transport is wired up and no RPC ` +
        `has been verified against a running dashd.`,
      method,
    );
  }

  /**
   * Masternode list for this wallet.
   *
   * TODO: verify against dashd — `protx list` takes an optional filter
   * (`wallet`, `valid`, `registered`, `evonode`) and a boolean for detailed
   * output. The detailed shape is large and differs between regular and Evo
   * nodes. Confirm the exact field names before mapping into `FleetNode`.
   */
  async listMasternodes(): Promise<unknown> {
    return this.call('protx', ['list']);
  }

  /**
   * Status of a single masternode.
   *
   * TODO: verify against dashd — `masternode status` is wallet-scoped and takes
   * a ProTx hash. Confirm whether it reports queue position and next payment,
   * or whether those must be derived from `masternode winners`.
   */
  async masternodeStatus(proTxHash: string): Promise<unknown> {
    return this.call('masternode', ['status', proTxHash]);
  }

  /**
   * Chain tip information.
   *
   * TODO: verify against dashd — confirm field names (`blocks`, `headers`,
   * `verificationprogress`) and whether Dash adds fields beyond Bitcoin's.
   */
  async blockchainInfo(): Promise<unknown> {
    return this.call('getblockchaininfo');
  }

  /**
   * The next expected payments.
   *
   * TODO: verify against dashd — `masternode winners` signature has changed
   * across versions (it once took a count and a filter). Confirm against the
   * installed version before relying on the parameter order.
   */
  async masternodeWinners(count = 10): Promise<unknown> {
    return this.call('masternode', ['winners', count]);
  }

  /**
   * Shared masternode session handling.
   *
   * ANSWERED, from source: shared collateral is exposed over RPC, so this does
   * NOT have to be reimplemented against transaction primitives. Dash Core
   * v24.0.0-rc.1 src/rpc/evo.cpp registers these seven helpmen:
   *
   *   protx shared_register_prepare        (evo.cpp:2153)
   *   protx shared_sign                    (evo.cpp:1227)
   *   protx shared_combine                 (evo.cpp:1464)
   *   protx shared_dissolve                (evo.cpp:1322)
   *   protx shared_update_share            (evo.cpp:1366)
   *   protx shared_update_registrar_prepare (evo.cpp:1413)
   *
   * The registration flow is: shared_register_prepare returns {tx, collateralIndex,
   * consentHash}, every share owner calls shared_sign on the consent hash, then
   * shared_combine assembles the signatures. This is a MULTI-PARTY flow, not a
   * single call, because each share carries its own owner key.
   *
   * STILL UNVERIFIED: these names and signatures were read from source, but no
   * call has been executed against a running dashd. Keep the TODO below until
   * one has.
   *
   * TODO: verify against dashd — execute each `protx shared_*` against a real
   * node and reconcile the returned JSON (above all the `terms` object and the
   * base64 signature encoding) against these assumptions.
   */
  async sharedMasternodeInfo(proTxHash: string): Promise<unknown> {
    return this.call('protx', ['info', proTxHash]);
  }

  /**
   * Prepare an unsigned shared masternode registration.
   *
   * Source: evo.cpp:2153. Takes the funding transaction plus a share table and
   * returns the unsigned tx, the collateral output index and the consent hash.
   * Amounts in the share table must sum to the required collateral, and each
   * share is at least 100 DASH (CProRegTx::MIN_AMOUNT, providertx.h:58).
   *
   * TODO: verify against dashd — the share table is consensus-order
   * significant, so preserve array order exactly. Confirm the operatorReward
   * fixed-point encoding (basis points, 0..10000).
   */
  async sharedRegisterPrepare(
    fundingTx: string,
    shares: unknown[],
    coreP2PAddrs: string,
    operatorPubKey: string,
    votingAddress: string,
    operatorReward: number,
    earlyPeriodBlocks: number,
    earlyPenalty: number,
  ): Promise<unknown> {
    return this.call('protx', [
      'shared_register_prepare',
      fundingTx,
      shares,
      coreP2PAddrs,
      operatorPubKey,
      votingAddress,
      operatorReward,
      earlyPeriodBlocks,
      earlyPenalty,
    ]);
  }

  /**
   * Sign a shared masternode transaction with every share owner key held.
   *
   * Source: evo.cpp:1227. The wallet signs whatever shares it holds and returns
   * one signature per share, keyed by shareIndex. The transaction is not
   * modified, so the result is handed straight to sharedCombine.
   *
   * This is the call that makes custody a matter of who holds the keys: in a
   * custodial arrangement the operator holds them and signs on the depositor's
   * behalf, which is exactly the power the custodial screen discloses.
   *
   * TODO: verify against dashd — confirm the wallet must be unlocked and that
   * the returned entries are base64 (not hex).
   */
  async sharedSign(tx: string, allowTimeLocks = false): Promise<unknown> {
    return this.call('protx', ['shared_sign', tx, allowTimeLocks]);
  }

  /**
   * Combine collected share owner signatures into a shared masternode tx.
   *
   * Source: evo.cpp:1464. For a registration this yields the completed
   * transaction hex, which then needs its funding inputs signed and broadcast.
   *
   * TODO: verify against dashd — confirm the expected shape of the signatures
   * array ({shareIndex, signature}) and whether ordering matters.
   */
  async sharedCombine(
    tx: string,
    signatures: Array<{ shareIndex: number; signature: string }>,
  ): Promise<unknown> {
    return this.call('protx', ['shared_combine', tx, signatures]);
  }

  /**
   * Build a unilateral dissolution, optionally as an offline standby.
   *
   * Source: evo.cpp:1322. With submit=false the signed hex is returned rather
   * than broadcast. A standby dissolution is the depositor's escape hatch: it
   * is valid forever once the early period ends, so it can be stored offline
   * and broadcast without anyone's cooperation. The custodial screen promises
   * withdrawal depends on our liquidity; a real standby would weaken that
   * dependency, and whether we offer one is a product decision, not a fact.
   *
   * TODO: verify against dashd — confirm the fee ceiling (MAX_FEE 1000000
   * duffs) and the payPenalty semantics against current height.
   */
  async sharedDissolve(
    proTxHash: string,
    actorIndex: number,
    fee = 100000,
    submit = true,
    payPenalty?: boolean,
  ): Promise<unknown> {
    const params: unknown[] = ['shared_dissolve', proTxHash, actorIndex, fee, submit];
    if (payPenalty !== undefined) params.push(payPenalty);
    return this.call('protx', params);
  }

  /**
   * Point a share's rewards at a new script.
   *
   * Source: evo.cpp:1366. Each share carries its own scriptReward, so reward
   * routing is per-share. Passing the refund script resets rewards.
   *
   * TODO: verify against dashd — confirm whether this is signed by the share
   * owner key alone or also needs the registrar's cooperation.
   */
  async sharedUpdateShare(
    proTxHash: string,
    shareIndex: number,
    scriptReward: string,
  ): Promise<unknown> {
    return this.call('protx', ['shared_update_share', proTxHash, shareIndex, scriptReward]);
  }

  /**
   * Prepare an update to a shared node's operator and voting keys.
   *
   * Source: evo.cpp:1413. Produces an unsigned ProUpSharedRegTx whose
   * signatures must be collected from ALL shares, because a registrar update
   * requires unanimity (providertx.h:514-516).
   *
   * TODO: verify against dashd — confirm unanimity is enforced and what happens
   * when one share declines to sign.
   */
  async sharedUpdateRegistrarPrepare(
    proTxHash: string,
    operatorPubKey: string,
    votingAddress: string,
    feeSourceAddress: string,
  ): Promise<unknown> {
    return this.call('protx', [
      'shared_update_registrar_prepare',
      proTxHash,
      operatorPubKey,
      votingAddress,
      feeSourceAddress,
    ]);
  }
}

/**
 * A client that always fails, used while the UI is driven by mock data.
 *
 * This exists so that any component accidentally wired to a live call fails
 * visibly instead of appearing to work.
 */
export const unconfiguredRpc = new DashRpc({
  host: '127.0.0.1',
  /** TODO: verify against dashd — mainnet RPC port is expected to be 9998. */
  port: 9998,
  user: '',
  password: '',
});
