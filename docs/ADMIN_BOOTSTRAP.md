# Bootstrap Admin Identities

> Gate 0 update (2026-10-10): current architecture, five-role acceptance and live status are in [production/02_GATE0_ACCEPTANCE.md](production/02_GATE0_ACCEPTANCE.md). This historical checklist does not certify cloud acceptance. Use the gated runner and exact authorized disposable target; no production reset is authorized.


There is intentionally no public admin-registration page. Never share an owner
account or store its password in this repository.

## Stage A — disposable acceptance identities

Use this stage only in a disposable non-production Supabase project.

### Prerequisites

1. Apply every file in `supabase/migrations/` in numeric order.
2. Configure an isolated local/staging environment from `.env.example`; keep the
   service-role key server-only. Never overwrite an existing `.env.local`.
3. Decide the named developer/security operator who will run
   `docs/ADMIN_SECURITY_TESTS.md`.

### Procedure

1. In Supabase Dashboard, open Authentication -> Users and create three
   disposable users: normal user, inactive admin and active owner. Use unique
   test emails and private passwords.
2. Leave the normal user without any `admin_profiles` row.
3. For the inactive admin, replace the UUID below and verify it maps to the
   expected test email:

```sql
select id, email
from auth.users
where id = '00000000-0000-0000-0000-000000000000';
```

4. If the result is not exactly the intended user, stop. Otherwise replace the
   UUID and insert an inactive `admin` profile:

```sql
insert into public.admin_profiles (user_id, name, role, active)
values ('00000000-0000-0000-0000-000000000000', 'Inactive Admin Test', 'admin', false);
```

5. Repeat the UUID verification for the active-owner identity, then insert:

```sql
insert into public.admin_profiles (user_id, name, role, active)
values ('00000000-0000-0000-0000-000000000000', 'Active Owner Test', 'owner', true);
```

6. If either unique-user constraint rejects an insert, stop and inspect the
   existing profile. Do not silently overwrite, promote or reactivate it.
7. Run and sign the disposable-project record in
   `docs/ADMIN_SECURITY_TESTS.md`.

## Stage B — first production owner

Do not begin this stage until every required disposable-project test passes and
the security operator and owner have signed the acceptance record.

1. Apply the already-accepted migrations to the approved production project
   using the controlled deployment procedure.
2. Configure the production environment from `.env.example`; keep
   `SUPABASE_SERVICE_ROLE_KEY` server-only.
3. Configure and test the approved Auth invite redirect, email/SMTP delivery,
   password recovery, MFA policy, rate limits and session-revocation process.
4. In Supabase Dashboard, create or invite the named human owner using their
   individual business email and private password flow.
5. Copy the user's UUID and run the same fail-closed `select id, email` check
   shown in Stage A.
6. If it is exactly the intended user, insert the production owner without an
   upsert:

```sql
insert into public.admin_profiles (user_id, name, role, active)
values ('00000000-0000-0000-0000-000000000000', 'Owner Name', 'owner', true);
```

7. If the insert conflicts, stop and investigate. Do not overwrite, promote or
   reactivate an existing profile as part of bootstrap.
8. Confirm exactly one active owner row matches the intended Auth UUID.
9. Sign in through `/admin/login`, verify `/admin` loads, sign out and confirm
   the protected route redirects to login.

## Recovery and offboarding

- Disable `admin_profiles.active` immediately when access should stop, then
  revoke the user's Auth sessions in Supabase.
- Never solve access problems by putting `SUPABASE_SERVICE_ROLE_KEY` in a browser
  variable or client component.
- Add subsequent admins through an authenticated, audited owner-only workflow in
  a later approved phase; until then, repeat the controlled, fail-closed grant
  procedure with explicit authorization.
