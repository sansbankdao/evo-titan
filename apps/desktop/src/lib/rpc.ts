// apps/desktop/src/lib/rpc.ts — Evo Titan
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  THE TRANSPORT IS STILL NOT WIRED — `call()` throws by design, and the   ║
// ║  UI reads `mock.ts`. That has not changed.                               ║
// ║                                                                          ║
// ║  What HAS changed on 2026-09-27: a real v24.0.0-rc.1 node was started    ║
// ║  (docker, regtest) and the shared-masternode RPC surface was read from   ║
// ║  the running binary. The `protx shared_*` signatures and three facts     ║
// ║  below were CORRECTED against that node:                                 ║
// ║                                                                          ║
// ║    1. the seven commands are SUBCOMMANDS of `protx`, not top-level       ║
// ║       RPC methods. Calling `shared_sign` on its own returns -32601.      ║
// ║    2. `operatorReward` is a PERCENT STRING ("15.00"), not basis points.  ║
// ║    3. `shared_update_share` takes a 4th arg, `feeSourceAddress`; without ║
// ║       it the node rejects the call on arity (-1, usage text).            ║
// ║                                                                          ║
// ║  Methods that have NOT been exercised end-to-end against the node still  ║
// ║  carry `TODO: verify against dashd`. Do not remove those markers until   ║
// ║  the call has been RUN and its response checked. A signature confirmed   ║
// ║  from `help` is not the same as a call confirmed to succeed.            ║
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
   * VERIFIED against a running v24.0.0-rc.1 node (regtest) on 2026-09-27 via
   * `help protx shared_register_prepare`:
   *
   *   protx shared_register_prepare "fundingTx"
   *     [{"amount":n,"refundAddress":"str","rewardAddress":"str","ownerAddress":"str"},...]
   *     "coreP2PAddrs" "operatorPubKey" "votingAddress" "operatorReward"
   *     earlyPeriodBlocks earlyPenalty
   *
   * CORRECTION to the earlier reading of the source: `operatorReward` is a
   * PERCENT STRING, not basis points. The node's own help text says "The
   * fraction in %% to share with the operator (0.00 to 100.00)". So an operator
   * cut of 15% is passed as the string "15.00", NOT as the integer 1500. Do not
   * let a later refactor "simplify" this back to a number.
   *
   * The share table is consensus-order significant, so preserve array order
   * exactly. Each share's `amount` is in duffs and must be at least 100 DASH.
   */
  async sharedRegisterPrepare(
    fundingTx: string,
    shares: unknown[],
    coreP2PAddrs: string,
    operatorPubKey: string,
    votingAddress: string,
    operatorReward: string,
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
   * VERIFIED against a running v24.0.0-rc.1 node (regtest) on 2026-09-27: the
   * node's own help for this command ends with "Requires wallet passphrase to be
   * set with walletpassphrase call if wallet is encrypted", and the result's
   * `signatures` entries are documented as BASE64-encoded. A call on a node with
   * no wallet loaded returns RPC error -18 ("No wallet is loaded"), which is the
   * behaviour the transport must surface rather than swallow.
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
   * VERIFIED against a running v24.0.0-rc.1 node (regtest) on 2026-09-27:
   * `protx shared_combine "tx" [{"shareIndex":n,"signature":"str"},...] ( submit )`.
   * Signatures are BASE64-encoded (the node's help says so explicitly). There is
   * a third `submit` argument (default false) which is NOT available for
   * registrations, because their funding inputs still need signing.
   */
  async sharedCombine(
    tx: string,
    signatures: Array<{ shareIndex: number; signature: string }>,
    submit = false,
  ): Promise<unknown> {
    return this.call('protx', ['shared_combine', tx, signatures, submit]);
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
   * VERIFIED against a running v24.0.0-rc.1 node (regtest) on 2026-09-27:
   * `protx shared_dissolve "proTxHash" actorIndex ( fee submit payPenalty )`,
   * fee default 100000 duffs, "At most 1000000 duffs (consensus ceiling)". The
   * ceiling is enforced in source at src/evo/providertx_service.cpp:639 (`if
   * (fee > CProDisTx::MAX_FEE)`), against the same constant used in
   * src/evo/specialtxman.cpp:1752. `payPenalty` defaults to a value decided by
   * the current height, which is why it is left optional here rather than
   * defaulted: passing the wrong value builds a standby valid at the wrong time.
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
   * VERIFIED against a running v24.0.0-rc.1 node (regtest) on 2026-09-27:
   *
   *   protx shared_update_share "proTxHash" shareIndex "rewardAddress"
   *     "feeSourceAddress" ( submit )
   *
   * CORRECTION: the live node requires a FOURTH argument, `feeSourceAddress`, a
   * wallet address the transaction fee is paid from. The earlier call site
   * omitted it and would have been rejected on arity. Defaults are from the
   * node's help: `submit` defaults to true.
   */
  async sharedUpdateShare(
    proTxHash: string,
    shareIndex: number,
    rewardAddress: string,
    feeSourceAddress: string,
    submit = true,
  ): Promise<unknown> {
    return this.call('protx', [
      'shared_update_share',
      proTxHash,
      shareIndex,
      rewardAddress,
      feeSourceAddress,
      submit,
    ]);
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
