# PitterPatter plugin

Use your existing PitterPatter account to read baby care records and log completed care activities.

This source package points at the local development endpoint `http://127.0.0.1:8787/mcp`. It is not a live cloud connector. Use the server's `package:plugin` command with the deployed HTTPS `/mcp` URL before distributing or submitting it.

The package contains OpenAI and Claude plugin manifests, the shared care-records skill and MCP connection metadata. ChatGPT and Claude's hosted connectors use the deployed MCP URL and their own OAuth account-linking flow. Local desktop clients need `MCP_ALLOW_LOCAL_REDIRECTS=true` on the server to accept loopback OAuth callbacks.

Supported tools: `list_babies`, `query_baby_events`, `log_baby_event`.

Writes cover completed bottles, one-sided nursing sessions, sleeps, nappies, pumping, tummy time and baths. This release does not control running timers or edit/delete existing records.

See the server README for hosting, configuration and test instructions. No passwords, private keys or customer records are bundled here.
