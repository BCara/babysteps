# PitterPatter for ChatGPT and Claude

An authenticated, Streamable HTTP MCP server plus OpenAI and Claude plugin packages. It replaces the old unauthenticated, local-only BabySteps MCP prototype. The phone and watch apps keep using their existing services.

## What it does

| Tool | Behavior |
| --- | --- |
| `list_babies` | Lists active babies for the signed-in caregiver. |
| `query_baby_events` | Reads paginated records within optional timezone-aware date boundaries. Excludes deleted records. |
| `log_baby_event` | Logs completed feeds, sleeps, nappies, pumping, tummy time and baths. Retries with the same UUID return the original event. |

It does not start/stop timers, edit/delete records, add caregivers or provide medical advice. Nursing entries cover a single side. Query results can include existing activity types beyond those the write tool supports. The assistant can summarise the returned records; it must paginate before claiming a complete summary.

## Run locally

Requires Node 22+ and the intended Firebase project's Application Default Credentials. Copy `.env.example` to `.env` and supply that project's **public web Firebase configuration**. The server checks the project IDs match. Keep credentials outside the repository and plugin.

```powershell
npm ci
npm run build
node --env-file=.env build/index.js
```

Run these commands from `mcp-server`. Add the connector host to Firebase Authentication's authorized domains for Google sign-in. Use the existing Firebase `PROJECT_ID.firebaseapp.com` auth domain. Email/password sign-in is also available when enabled for the project.

`GET /health` checks process availability; it does not prove Firebase credentials or account linking work. Use `/health` on Cloud Run because its frontend intercepts `/healthz`. `POST /mcp` without authentication returns HTTP 401 with OAuth discovery metadata.

### Deployment — 10 September 2026

The dedicated `pitterpatter-mcp` Cloud Run service is deployed in `babysteps-cbert`, region `australia-southeast1`, with zero minimum instances and a service/revision maximum of two. The runtime service account is `pitterpatter-mcp@babysteps-cbert.iam.gserviceaccount.com` with Firestore data and Firebase Authentication read access.

Connector: `https://pitterpatter-mcp-942163605541.australia-southeast1.run.app/mcp`

Verified publicly: OAuth discovery, unauthenticated MCP rejection, dynamic client registration, and browser-bound consent rendering backed by Firestore. The host is in Firebase Authentication's authorised domains. Actual ChatGPT/Claude account linking and care read/write flows remain unverified. Neither directory submission is complete; the publishing browsers require sign-in. See [PUBLISHING.md](PUBLISHING.md) for listing text and review scenarios.

## Host and connect

The hosted ChatGPT and Claude clients require a publicly reachable HTTPS server. A local URL or VPN address will not work for those cloud connections. Deploy this directory's Dockerfile to a service such as Cloud Run in `australia-southeast1`, with:

- `MCP_PUBLIC_URL` set to the service's exact HTTPS origin, without a path.
- `GOOGLE_CLOUD_PROJECT` and `FIREBASE_WEB_CONFIG` for the intended PitterPatter Firebase project.
- A dedicated runtime identity with Firestore data access and Firebase Authentication user-read permission. Do not ship a service-account key in the image.
- A verified reverse-proxy configuration (`MCP_TRUST_PROXY_HOPS`), a bounded maximum instance count and the host added to Firebase's authorized domains.
- Public HTTP invocation at the infrastructure layer; the application's OAuth protects `/mcp`. Keep discovery, registration, token and consent endpoints reachable.

The connector URL is `MCP_PUBLIC_URL` followed by `/mcp`. This implementation supports dynamic client registration and S256 PKCE. Registering a custom connector does not need a client secret. Both `care:read` and optional `care:write` are consented; `offline_access` enables rotating refresh tokens for up to 30 days.

1. In ChatGPT's plugin/app developer interface, add the deployed MCP URL, select OAuth, scan the tools and connect with a PitterPatter account. Availability and labels depend on the account/workspace. Use the displayed callback URL; the server accepts ChatGPT's stable callback and callback-specific `/connector/oauth/...` URLs.
2. In Claude, add a custom connector with the same URL, then connect and sign in. The hosted callback is `https://claude.ai/api/mcp/auth_callback`.
3. Test listing babies and reading a known record. Only log an explicitly agreed test event, and confirm it appears once in the phone app after retrying the same request.

For local desktop/CLI clients that use loopback OAuth callbacks, enable `MCP_ALLOW_LOCAL_REDIRECTS=true` deliberately. This is disabled by default for the hosted connector.

Official references: [OpenAI MCP servers](https://developers.openai.com/plugins/build/mcp-server), [OpenAI authentication](https://developers.openai.com/plugins/build/auth), [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [Claude authentication](https://claude.com/docs/connectors/building/authentication).

## Plugin packages

`plugins/pitterpatter` contains both `.codex-plugin/plugin.json` and `.claude-plugin/plugin.json`, the care-records skill and branding. The checked-in configuration is for local development. Produce a ZIP for the actual deployed endpoint with:

```powershell
npm run package:plugin -- https://YOUR_DEPLOYED_HOST/mcp
```

For a clearly labelled development ZIP:

```powershell
npm run package:plugin -- http://127.0.0.1:8787/mcp --local
```

Packaging requires Python 3 to create a ZIP that includes hidden manifest directories. It creates a new timestamped artifact directory and never overwrites the source package. The package contains no customer data, credentials or backend dependencies. Public directory submission and review are separate from building or privately connecting the server. No marketplace entry or existing client configuration is changed automatically.

## Data and authentication

The authenticated UID comes from Firebase sign-in, never tool arguments. Every MCP request validates the opaque access token and checks the Firebase account is still active. Every baby query/write checks `authorizedCaregivers`; writes recheck membership within the same Firestore transaction as the event.

Server-only collections are `mcpOAuth` and `mcpEventRequests`. Existing Firestore rules deny client access to unmatched collections; do not grant mobile/web clients access to these collections. OAuth tokens and authorization codes are stored using SHA-256 keys, with enforced expiry. Consent requests are bound to a short-lived HttpOnly SameSite cookie. Codes are single-use. Refresh tokens rotate; reuse revokes the connection. `/oauth/revoke` revokes the entire grant. Access expires after an hour and grants after 30 days.

New records use the current event schema (`durationMinutes`, `metadata.diaperCondition`, timestamps, `deletedAt: null`) with `source: assistant`. The app's source type includes this value. No mobile Firestore write-rule expansion is required because authenticated backend writes enforce their own caregiver check.

OAuth records have numeric `expiresAt` values that are enforced on use. For storage housekeeping, delete expired records with a scheduled administrative job; Firestore TTL requires a timestamp field and cannot be enabled directly on these numeric values. Keep `mcpEventRequests` for durable retry protection. This connector does not yet add a connection-management screen to the phone app; revoke via the OAuth endpoint or remove the grant administratively when needed.

The OAuth HTTP limiter is per process/IP. At larger scale, enforce shared limits at the edge and monitor Firestore/authentication usage. Authentication headers, passwords, care records and token response bodies must not be logged by infrastructure. Configure request-log redaction for `/oauth/authorize` and `/connect`, which carry short-lived authorization state in query strings.

## Verification

```powershell
npm test
npm run test:firestore
```

The second command uses only `demo-pitterpatter-mcp` on the local Firestore emulator (port 8085). It does not write production data. It verifies caregiver isolation, transaction-level duplicate prevention, current event formatting, pagination across deleted records and concurrent OAuth code consumption. HTTP tests use the official MCP client against a local server with fake identity/repository adapters; they are not proof of live ChatGPT/Claude login or real inbox/account access.

Before release, verify the actual HTTPS discovery, Firebase login/consent and one read/write flow in **each** target client. Build/tests alone do not confirm deployment, installation, directory approval or physical-app synchronization.
