// apps/desktop/src/lib/rpc-core.ts — Evo Titan
//
// The pure core of the Dash Core RPC client: envelope, reply parsing and error
// interpretation. NOTHING here imports Tauri, the DOM or any runtime, which is
// what makes it runnable under `node --test` and against a real regtest node.
//
// The split between this file and rpc.ts is deliberate. Everything that can be
// wrong about talking to dashd lives here, and everything here is covered by
// src/lib/rpc-core.test.ts. rpc.ts adds only the one thing this layer cannot
// provide — a transport that can leave a browser sandbox.
//
// WHY THE TRANSPORT CANNOT LIVE IN THE WEBVIEW
// --------------------------------------------
// dashd sends NO CORS headers and answers an OPTIONS preflight with 501 Not
// Implemented. Measured against dashpay/dashd:24.0.0-rc.1 on 2026-09-27:
//
//   HTTP/1.1 200 OK          <- a normal call, no Access-Control-* headers
//   HTTP/1.1 501 Not         <- OPTIONS preflight
//
// A Tauri window is a browser, so a fetch() from the frontend is blocked before
// it reaches the node. The request has to be made from Rust (src-tauri/src/
// rpc.rs), which is why rpc.ts delegates to an `invoke('rpc_call', ...)`.
//
// THE ENVELOPE IS MEASURED, NOT ASSUMED
// -------------------------------------
// JSON-RPC 1.0 is accepted and the `id` is echoed back as a string. A JSON-RPC
// error arrives with a NON-200 HTTP status: -32601 with 404, and -1 / -8 / -18
// with 500. A wrong password returns 401 with an EMPTY body. The status code is
// therefore not the error signal — the body is. Treating a 500 as a transport
// failure would report a real node error as a connection problem.

/** A request for one HTTP exchange, fully specified so it can be transported. */
export interface RpcHttpRequest {
  url: string;
  user: string;
  password: string;
  /** The serialised JSON-RPC envelope, byte-for-byte as it will be sent. */
  body: string;
}

/** The raw outcome of one HTTP exchange. */
export interface RpcHttpResponse {
  /** The HTTP status, or 0 when no response arrived at all. */
  status: number;
  /** The response body exactly as the node sent it. Empty on a 401. */
  body: string;
  elapsedMs: number;
  /** Present only when the exchange failed before a response arrived. */
  transportError?: string;
}

/** Anything that can carry an RpcHttpRequest to a node and return the raw reply. */
export type RpcTransport = (request: RpcHttpRequest) => Promise<RpcHttpResponse>;

/**
 * Thrown when a call cannot be made or the node returns an error.
 *
 * The fields are declared and assigned explicitly rather than using TypeScript
 * parameter properties, because Node's built-in type stripping rejects those
 * (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX). Keeping this file runnable by bare
 * `node --test` is what lets the suite run with no build step and no test
 * framework dependency.
 */
export class RpcError extends Error {
  readonly method: string;
  readonly code?: number;

  constructor(message: string, method: string, code?: number) {
    super(message);
    this.name = 'RpcError';
    this.method = method;
    this.code = code;
  }
}

/** The JSON-RPC 1.0 envelope, matching what the node accepted in testing. */
export interface RpcEnvelope {
  jsonrpc: '1.0';
  id: string;
  method: string;
  params: unknown[];
}

/**
 * Serialise a JSON-RPC 1.0 envelope.
 *
 * Parameter ORDER is preserved exactly. The shared-collateral share table is
 * consensus-order significant, so a reordering here would produce a valid-looking
 * transaction with the wrong consent digest.
 *
 * A value that arrives as a string leaves as a string. `operatorReward` in
 * particular must NOT be coerced: the node parses it as a fixed-point percent,
 * and sending 1500 instead of "15.00" would set a 1500% operator cut.
 */
export function buildEnvelope(method: string, params: unknown[], id = 'evo-titan'): string {
  const envelope: RpcEnvelope = { jsonrpc: '1.0', id, method, params };
  return JSON.stringify(envelope);
}

/** The node's reply, before interpretation. */
export interface RpcReply {
  jsonrpc?: string;
  result?: unknown;
  error?: { code: number; message: string };
  id?: string;
}

/** Parse a reply body, rejecting anything that is not a JSON-RPC object. */
export function parseReplyBody(raw: string): RpcReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('the response body is not JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('the response body is not a JSON-RPC object');
  }
  return parsed as RpcReply;
}

/**
 * Turn one raw HTTP exchange into either a result or an RpcError.
 *
 * The order of the checks matters. A transport error is reported as-is before
 * the body is touched, and a 401 is reported as an auth failure before the body
 * is parsed — because dashd sends an empty body with a 401, and parsing it
 * would produce "the response body is not JSON", sending the user to the wrong
 * problem. Only after those two does the body become the authority.
 */
export function interpretReply<T>(method: string, http: RpcHttpResponse): T {
  if (http.transportError) {
    throw new RpcError(http.transportError, method);
  }
  if (http.status === 401) {
    throw new RpcError(
      'the node rejected the credentials (HTTP 401). Check the RPC user and password.',
      method,
    );
  }
  let reply: RpcReply;
  try {
    reply = parseReplyBody(http.body);
  } catch (e) {
    const excerpt = http.body.slice(0, 200);
    throw new RpcError(
      `the node returned HTTP ${http.status} with a body that is not JSON-RPC (${(e as Error).message}). ` +
        `First 200 characters: ${excerpt}`,
      method,
    );
  }
  if (reply.error) {
    throw new RpcError(reply.error.message, method, reply.error.code);
  }
  return reply.result as T;
}

/** Build the endpoint URL from a host and port. */
export function endpointFor(host: string, port: number): string {
  return `http://${host}:${port}/`;
}

/** Connection settings for a node's JSON-RPC endpoint. */
export interface RpcConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

/**
 * A JSON-RPC client for one node.
 *
 * The transport is REQUIRED rather than defaulted, so this class carries no
 * dependency on Tauri or on the DOM. That is what allows the test suite to
 * exercise this exact class — the one the app ships — under `node --test`,
 * with a canned or fetch-backed transport standing in for the Rust proxy.
 * The environment-specific transports live in rpc.ts.
 */
export class DashRpc {
  // Declared and assigned explicitly rather than as constructor parameter
  // properties, which Node's type stripping rejects (see RpcError above).
  private readonly config: RpcConfig;
  private readonly transport: RpcTransport;

  constructor(config: RpcConfig, transport: RpcTransport) {
    this.config = config;
    this.transport = transport;
  }

  /**
   * Perform a JSON-RPC call: build the envelope, transport it, interpret the
   * reply. Every JSON-RPC semantic lives in this file so that the tested code
   * and the shipped code are the same code.
   */
  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    assertUsableConfig(this.config.host, this.config.port);
    const body = buildEnvelope(method, params);
    const http = await this.transport({
      url: endpointFor(this.config.host, this.config.port),
      user: this.config.user,
      password: this.config.password,
      body,
    });
    return interpretReply<T>(method, http);
  }

  /**
   * `protx list` with an optional filter (`wallet`, `valid`, `registered`,
   * `evonode`), detailed flag and height.
   *
   * VERIFIED against a running 24.0.0-rc.1 node (regtest):
   * `protx list registered true <height>` requires a height GREATER THAN ZERO —
   * passing 0 returns -8 "invalid height specified". `protx list wallet`
   * returns -1 when the wallet is disabled, because the filter is wallet-scoped.
   */
  async listMasternodes(filter = 'registered', detailed = true, height?: number): Promise<unknown> {
    const params: unknown[] = ['list', filter, detailed];
    if (height !== undefined) params.push(height);
    return this.call('protx', params);
  }

  /**
   * Status of the masternode running on THIS node.
   *
   * CORRECTED: `masternode status` takes NO arguments. The earlier version
   * passed a ProTx hash, which the node rejects as a usage error (-1). It
   * reports the masternode the local node is operating; on a node not running
   * one it returns -32603 "This node does not run an active masternode".
   * For an arbitrary ProTx hash use `protx info` (sharedMasternodeInfo).
   */
  async masternodeStatus(): Promise<unknown> {
    return this.call('masternode', ['status']);
  }

  /**
   * Chain tip information.
   *
   * VERIFIED against a running 24.0.0-rc.1 node (regtest): returns `chain`,
   * `blocks`, `headers`, `verificationprogress` and `initialblockdownload`.
   * Dash 24 dropped the `softforks` array, so a UI reading it renders blanks.
   */
  async blockchainInfo(): Promise<unknown> {
    return this.call('getblockchaininfo');
  }

  /**
   * The next expected masternode payments.
   *
   * VERIFIED against a running 24.0.0-rc.1 node (regtest):
   * `masternode winners ( count "filter" )` takes at most TWO arguments and
   * returns an OBJECT keyed by height (a map), NOT an array. A caller that
   * treats the result as an array will silently iterate nothing.
   */
  async masternodeWinners(count = 10, filter = ''): Promise<unknown> {
    return this.call('masternode', ['winners', count, filter]);
  }

  /**
   * Generate a BLS operator keypair.
   *
   * CORRECTED: `masternode genkey` does NOT exist in v24 (-8 "Must be a valid
   * command"). Operator keys are BLS and `bls generate` returns
   * `{secret, public, scheme: "basic"}` with a 64-hex secret and 96-hex public.
   */
  async generateOperatorKey(): Promise<{ secret: string; public: string; scheme: string }> {
    return this.call('bls', ['generate']);
  }

  /**
   * Status of a single masternode by ProTx hash.
   *
   * VERIFIED against a running 24.0.0-rc.1 node (regtest):
   * `protx info ( "proTxHash" ( "blockHash" ) )`. A hash that is not 64 hex
   * characters is rejected with -8 and a message naming the expected length.
   * This works for an arbitrary hash (unlike masternodeStatus) and its result
   * carries the `shares` table for a version 3 (shared) node.
   */
  async sharedMasternodeInfo(proTxHash: string): Promise<unknown> {
    return this.call('protx', ['info', proTxHash]);
  }

  /**
   * Prepare an unsigned shared masternode registration.
   *
   * EVALUATED END-TO-END against a running 24.0.0-rc.1 node (regtest): this
   * prepared and registered a real shared masternode of eight shares (125 DASH
   * each, summing to the 1000 DASH collateral) at height 502.
   *
   * `operatorReward` is a PERCENT STRING, not basis points: "The fraction in %%"
   * "to share with the operator (0.00 to 100.00)". A 15% cut is "15.00", NOT
   * 1500. Source: evo.cpp:2216 parses with ParseFixedPoint(..., 2) and stores
   * 1500; evo.cpp:83 serialises back as 1500/100 = 15.
   *
   * The share table is consensus-order significant: preserve order exactly.
   * Each `amount` is in duffs and must be at least 100 DASH (MIN_AMOUNT).
   */
  async sharedRegisterPrepare(
    fundingTx: string,
    shares: Array<{ amount: number; refundAddress: string; rewardAddress: string; ownerAddress: string }>,
    coreP2PAddrs: string,
    operatorPubKey: string,
    votingAddress: string,
    operatorReward: string,
    earlyPeriodBlocks: number,
    earlyPenalty: number,
  ): Promise<{ tx: string; collateralIndex: number; consentHash: string; terms: unknown; warning?: string }> {
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
   * EVALUATED END-TO-END against a running 24.0.0-rc.1 node (regtest): eight
   * calls produced eight base64 signatures (~88 characters) keyed by shareIndex,
   * which sharedCombine accepted and assembled. On a node with no wallet it
   * returns -18 "No wallet is loaded", which the transport surfaces rather than
   * swallows.
   */
  async sharedSign(
    tx: string,
    allowTimeLocks = false,
  ): Promise<{ signatures: Array<{ shareIndex: number; signature: string }> }> {
    return this.call('protx', ['shared_sign', tx, allowTimeLocks]);
  }

  /**
   * Combine collected share owner signatures into a shared masternode tx.
   *
   * EVALUATED END-TO-END against a running 24.0.0-rc.1 node (regtest):
   * `shared_combine(tx, signatures, false)` returned the completed transaction
   * hex, which was then signed and broadcast. Signatures are BASE64, not hex.
   * For a registration `submit` is NOT available, because the funding inputs
   * still need signing.
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
   * VERIFIED against a running 24.0.0-rc.1 node (regtest):
   * `protx shared_dissolve "proTxHash" actorIndex ( fee submit payPenalty )`,
   * fee default 100000 duffs, ceiling 1000000 duffs (CProDisTx::MAX_FEE,
   * src/evo/providertx_service.cpp:639).
   *
   * With submit=false the signed hex is returned rather than broadcast. A
   * standby dissolution is valid forever once the early period ends, so it can
   * be stored offline and broadcast without cooperation. Whether we offer one
   * to custodial depositors is a product decision, not a fact. `payPenalty`
   * defaults, when omitted, to a value decided by the current height, which is
   * why it is left optional rather than defaulted here.
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
   * VERIFIED against a running 24.0.0-rc.1 node (regtest): the live node
   * requires a FOURTH argument, `feeSourceAddress`, a wallet address the fee is
   * paid from; omitting it is rejected on arity (-1, usage text). `submit`
   * defaults to true. A share's reward/refund address must not equal its owner
   * address nor the node's voting address (bad-protx-shares-payee-reuse).
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
   * TODO: verify against dashd — execute shared_update_registrar_prepare and
   * confirm the signature and that unanimity is enforced.
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

/** Reject settings that cannot produce a usable request, before a socket is opened. */
export function assertUsableConfig(host: string, port: number): void {
  if (!host) {
    throw new RpcError('no host is configured', 'config');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RpcError(`port ${port} is not a valid TCP port`, 'config');
  }
}
