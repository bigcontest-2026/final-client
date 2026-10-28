# TypeScript client ↔ FastAPI IPC integration evidence

The controller ran the actual TypeScript `reportJobs` and `ReportJobController` against the actual isolated server's FastAPI app and `TestClient`. A Node `fetch` adapter exchanged request/response JSON with a Python child process over stdin/stdout. It did not bind a TCP socket or use a browser. The summary provider was `SlowProvider(.05)`, a deterministic mock with a 50 ms delay; no real model or external provider ran.

The supplied `hermes-ipc-integration.json` records seven named integration checks and nine traced HTTP-equivalent requests. The controller reported the run passed with empty stderr. Checks cover queued 202 acknowledgement, polling to a report-matched summary, completed-request reuse, list restoration, queued cancellation, retry, and rejecting another report's ownership with 404. The trace includes POST/GET/cancel/retry traffic. Report creation and two manual worker-drain setup commands are outside the nine-request fetch trace.

The recorded 1.467–5.467 ms per-request elapsed values measure local IPC/TestClient exchanges, not network latency or model execution speed. The controller test used a 100 ms polling interval and 5-second observation budget for the initial job. The FastAPI worker was disabled for automatic execution, then explicitly drained after the queued assertions. A temporary directory supplied the database/settings fixture.

## Reproduction in the shared workspace

The original runner sources remain controller-owned at `.coordination/hermes_ipc_client.ts` and `.coordination/hermes_ipc_server.py` in the shared `agent-projects` root. They are not portable artifacts in this client repository. The TypeScript runner imports this isolated client through `.workspaces/hermes-client/frontend/src`; the Python runner imports the isolated server under `.workspaces/hermes-server` and existing test/benchmark fixtures. Its Python executable is the existing `/Users/yunjongseo/Downloads/bigcontest-2026/final/final-server/.venv/bin/python`. Reproducing elsewhere requires adapting those checkout/interpreter paths and supplying the server test dependencies.

From that shared root, compile and execute the controller-owned runner:

```sh
.workspaces/hermes-client/frontend/node_modules/.bin/esbuild .coordination/hermes_ipc_client.ts --bundle --platform=node --format=esm --define:import.meta.env.VITE_MODEL_API_BASE_URL='""' --outfile=.coordination/hermes_ipc_client.mjs
node .coordination/hermes_ipc_client.mjs
```

Successful output:

```json
{"assertions":7,"requests":9,"status":"passed"}
```

The runner writes a fresh `.coordination/hermes-ipc-integration.json`; the committed JSON preserves the supplied successful run. This confirms actual client/server job contract integration under the mock provider. Browser layout, DOM interaction, real-provider behavior, deployment and network transport remain unverified.
