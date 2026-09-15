# PitterPatter publishing draft

Prepared 10 September 2026. This document is a submission draft, not evidence of directory approval.

## Listing

- Name: PitterPatter
- Publisher: CodeBert Creations
- Category: Productivity
- Short description: Your baby's care records in your assistant.
- Description: Connect your PitterPatter account to review care records for babies you can access. Summarise recorded feeds, sleeps and nappies, find the latest activity, and log completed feeds, sleeps, nappies, pumping, tummy time and baths. Choose a baby when more than one is available. PitterPatter records activities; it does not provide medical advice or start and stop timers.
- Website: https://babysteps-cbert.web.app
- Privacy policy: https://babysteps-cbert.web.app/privacy.html (review coverage of assistant connections before submission)
- Support URL and terms URL: confirm public destinations before submission.
- Authentication: OAuth with dynamic client registration and S256 PKCE. Read, write and offline access are separate consent scopes.
- Reviewer access: dedicated account with fictional records required; do not provide a real family's account.

## Starter prompts

1. Which babies can I access?
2. Summarise today's care records for my baby.
3. When was the last bottle?
4. Log a wet nappy for my baby at the time I specify.

## Review scenarios

Run these in both clients with fictional records. Results remain unverified until recorded from the actual client.

| Scenario | Expected result |
| --- | --- |
| List babies | Only babies authorised for the connected caregiver appear. |
| Summarise a day | Use explicit timezone boundaries and paginate all results before claiming completeness. |
| Find last bottle | Return the latest matching recorded activity or say none is available. |
| Log completed wet nappy | Confirm baby and time, create one record with assistant attribution. |
| Retry same logging request | Reuse request UUID; return original record without duplication. |
| Ask for another caregiver's baby ID | Refuse access without disclosing records. |
| Try to write on read-only connection | Reject the write; never silently expand consent. |
| Supply invalid time or request a live timer | Ask for correction or explain unsupported operation; do not create an invalid record. |

## Submission routes

- ChatGPT: https://platform.openai.com/plugins — Create plugin, With MCP, Universal URL; configure OAuth, scan tools, upload skills, complete identity/domain verification and review materials.
- Claude connector directory: https://claude.ai/admin-settings/directory/submissions — remote MCP server submission, subject to organisation access.
- Optional Claude Code/Cowork plugin directory: https://platform.claude.com/plugins/submit — separate public GitHub plugin repository required.

Official requirements: https://developers.openai.com/plugins/deploy/submission and https://claude.com/docs/connectors/building/submission.

## Release boundaries

Live MCP URL: https://pitterpatter-mcp-942163605541.australia-southeast1.run.app/mcp

Cloud Run project: `babysteps-cbert`; service: `pitterpatter-mcp`; region: `australia-southeast1`. Runtime identity has `roles/datastore.user` and `roles/firebaseauth.viewer`. Minimum instances: zero; maximum service and revision instances: two.

Verified on 10 September: 18 standard tests plus 2 Firestore emulator tests passed; public discovery returned 200; unauthenticated MCP returned 401; live client registration and Firestore-backed consent succeeded; the consent page was visually inspected. No real family records were read or written during these checks.

Publication is pending publisher sign-in, real client account-linking tests, and policy materials. The existing app privacy policy describes the in-app AI assistant's reduced data payload. It must separately describe this connector: it can return baby names, dates of birth, record identifiers, activity times, notes and event metadata to the assistant selected by the caregiver. Do not claim that the in-app AI redaction rules apply to this connector. The selected assistant provider handles returned records under its own terms and account settings. Provide a confirmed public support and terms URL before submitting.

Deployment, live OAuth verification, client tests, and directory acceptance are separate milestones. Do not mark client tests complete based on local tests or a health endpoint. Never submit the development ZIP with its loopback address. Generate the production package only with the verified live endpoint using `npm run package:plugin -- https://HOST/mcp` from this directory.
