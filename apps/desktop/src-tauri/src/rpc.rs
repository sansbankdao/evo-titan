// apps/desktop/src-tauri/src/rpc.rs — Evo Titan
//
// The JSON-RPC transport for Dash Core.
//
// WHY THIS IS IN RUST AND NOT IN THE WEBVIEW
// -----------------------------------------
// dashd sends NO CORS headers and answers an OPTIONS preflight with 501 Not
// Implemented (measured against dashpay/dashd:24.0.0-rc.1 on 2026-09-27; the
// probe is recorded in AGENTS.md). A Tauri window is a browser, so a fetch()
// from the frontend to the node is blocked by the webview before it ever
// reaches dashd. The call therefore has to leave the webview, which is what
// this module is for. It is also why the RPC password never has to be exposed
// to page scripts on a remote origin: the credential is sent from here.
//
// WHAT THIS MODULE DELIBERATELY DOES NOT DO
// -----------------------------------------
// It does not build the JSON-RPC envelope and it does not interpret the
// response. It performs the request with a timeout and returns the HTTP
// status, the raw body and the elapsed time untouched. The request body
// arrives already serialised, and all JSON-RPC semantics — whether a body is a
// result or an error, what a 401 with an empty body means, what a 500 carrying
// a well-formed error means — are decided in TypeScript (src/lib/rpc.ts).
//
// That split is on purpose. The envelope and the error mapping are exactly the
// parts that need to be tested, and they can only be tested off-device if they
// live in a language the test runner can execute. Putting them here would mean
// the tests exercised a different implementation than the one that ships.
// This module is the smallest possible thing that a browser cannot do itself.
//
// The envelope was measured, not assumed: JSON-RPC 1.0 is accepted and the
// `id` is echoed back as a string.

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// One HTTP exchange to perform, fully specified by the frontend.
///
/// `password` is never logged and never returned. The struct does not derive
/// `Debug` so it cannot be printed by accident; the only thing that ever
/// escapes this function is the node's own response body.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcHttpRequest {
    /// The full endpoint URL, built by the frontend so the frontend owns the
    /// scheme, host and path.
    pub url: String,
    pub user: String,
    pub password: String,
    /// The serialised JSON-RPC envelope, byte-for-byte as it will be sent.
    pub body: String,
}

/// The raw outcome of one HTTP exchange.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcHttpResponse {
    /// The HTTP status code, or 0 when no response was received at all.
    pub status: u16,
    /// The response body exactly as the node sent it. Empty on a 401.
    pub body: String,
    /// How long the round trip took, in milliseconds. Reported so the UI can
    /// distinguish a slow node from an absent one.
    pub elapsed_ms: u64,
    /// Present only when the exchange failed before a response arrived (a
    /// refused connection, a timeout). A human-readable hint, not a code.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport_error: Option<String>,
}

/// Perform one JSON-RPC exchange against a Dash Core node.
///
/// Returns the status and body without interpreting them. Never panics: a
/// failed call is a normal state for a desktop client (the node is simply not
/// running), not a program fault.
#[tauri::command]
pub async fn rpc_call(request: RpcHttpRequest) -> Result<RpcHttpResponse, String> {
    let started = std::time::Instant::now();

    // The node is local. A long timeout would leave the UI hanging on a
    // connection that is not going to succeed; 30s is generous for a node that
    // is answering at all.
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return Ok(RpcHttpResponse {
                status: 0,
                body: String::new(),
                elapsed_ms: started.elapsed().as_millis() as u64,
                transport_error: Some(format!("could not build the HTTP client: {e}")),
            });
        }
    };

    let url = &request.url;

    let sent = client
        .post(url)
        .basic_auth(&request.user, Some(&request.password))
        // The body is sent as raw text, not via `.json()`, because the frontend
        // already serialised it and re-serialising would silently reorder keys
        // and change what is on the wire from what was tested.
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(request.body.clone())
        .send()
        .await;

    let response = match sent {
        Ok(r) => r,
        Err(e) => {
            // This is the common case: no node is running. Say so plainly
            // rather than surfacing a reqwest debug string.
            let hint = if e.is_connect() {
                format!("could not connect to the node at {url} — is dashd running and is RPC enabled?")
            } else if e.is_timeout() {
                format!("the node at {url} did not answer within 30s")
            } else {
                format!("transport error talking to {url}: {e}")
            };
            return Ok(RpcHttpResponse {
                status: 0,
                body: String::new(),
                elapsed_ms: started.elapsed().as_millis() as u64,
                transport_error: Some(hint),
            });
        }
    };

    let status = response.status().as_u16();
    let body = response.text().await.unwrap_or_default();

    Ok(RpcHttpResponse {
        status,
        body,
        elapsed_ms: started.elapsed().as_millis() as u64,
        transport_error: None,
    })
}
