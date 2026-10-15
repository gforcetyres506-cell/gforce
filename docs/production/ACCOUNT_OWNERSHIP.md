# Client account ownership

Record real account identifiers and recovery contacts in the client's private
vault, not this public repository. Current ownership acceptance is BLOCKED.

| System | Known evidence | Required owner action |
| --- | --- | --- |
| GitHub | Correct public repository; branch push permission works | Confirm client organisation/recovery ownership and branch/review policy |
| Vercel | GitHub preview deployment under `g-force2/gforce` | Provide authorized project/team access; available browser account has no project access; confirm billing/recovery/domain mapping |
| Supabase staging/disposable | No configuration or authorized project ref present | Provide exact disposable authorization and ignored secure file; prove app/ref/database identity |
| Supabase production | UNKNOWN | Prove client ownership, region, project/database identity, backup plan and access |
| Resend / sender DNS | UNKNOWN | Provide scoped access, approved sender and test inbox; verify SPF/DKIM and actual inbox receipt |
| GoDaddy / domain | Public TLS works; ownership not attested | Confirm client DNS/recovery owner; no nameserver/certificate change is currently justified |
| Google Search Console | No verified property/account available | Client Domain property, Google TXT verification, then sitemap/indexing only after launch acceptance |
| Google Business Profile | No verified owner/facts available | Actual service-area facts and owner verification; hide a private base address |
| Business bank | Details/authorized operator UNKNOWN | Owner configures real destination privately and independently confirms receipts/refunds |
| Incident alerts | No named primary/backup or tested destination | Assign operators and test notifications and provider log redaction |
| OneAuto | Optional disabled account adapter | No action required for manual-entry V1; verify contract/sandbox before future enablement |

Use individual least-privilege accounts, MFA and private recovery ownership.
Offboarding removes invitations/access and revokes sessions. Never transfer
ownership by sharing a service-role key or bank password in a chat/document.
