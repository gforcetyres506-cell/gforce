# Incident response

Primary operator, backup operator, bank owner and hosting/database owner:
**UNKNOWN — assignment and private contact method required before launch**.

1. Record UTC time, accepted deployment SHA, affected public route category and
   stable error code/count. Exclude request bodies, query strings, cookies, bank
   details, customer content and private capability links.
2. Independently reproduce read-only. Establish whether checkout persistence,
   bank verification, Auth, email or the entire site is affected. Customer payment
   screenshots do not establish receipt; do not bypass payment checks.
3. Escalate to the assigned owner. For unsafe booking behaviour, stop new customer
   bookings using an approved operator/hosting action and reconcile existing
   reservations. Never clear inventory or mass-change statuses as a workaround.
4. Compare application/provider errors with deployment and migration history.
   Restore service by an approved compatible application rollback or forward fix.
   Never reset production, disable RLS/Auth/CSP or alter DNS based on guesswork.
5. Verify public health, owner login, existing booking access and a controlled
   operation after recovery. Reconcile email outbox and bank events before retry.
   Preserve immutable audit and write a sanitized cause/action record.

For leaked credentials, contain access and rotate through the client-owned
provider; update secure deployment settings and redeploy. Revoke affected sessions
and private capabilities as appropriate through reviewed operations. Do not print
old/new secrets. Suspected customer-data exposure requires owner/legal assessment
and any necessary notifications; no fabricated legal deadline is supplied here.

Database recovery follows [BACKUP_RESTORE_RUNBOOK.md](BACKUP_RESTORE_RUNBOOK.md).
Application rollback follows [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md).
Real bank transfers and refunds remain human actions throughout an incident.
