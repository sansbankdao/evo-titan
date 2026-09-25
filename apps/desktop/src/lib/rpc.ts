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
   * TODO: verify against dashd — Dash Core v24 added shared collateral and a
   * signature collector in the Qt client. Confirm whether these operations are
   * exposed over RPC at all, or whether they are Qt-only and therefore must be
   * reimplemented here against the transaction primitives.
   */
  async sharedMasternodeInfo(proTxHash: string): Promise<unknown> {
    return this.call('protx', ['info', proTxHash]);
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
