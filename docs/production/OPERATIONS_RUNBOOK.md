# Daily operations

Status: prepared; real operators and hosted acceptance UNKNOWN.

At opening, sign in, check upcoming bookings, unpaid deadlines, verified receipts,
fitter assignments, available stock and generated slots. Reconcile the business
bank against payment records and inspect failed/unacknowledged instruction emails.
Resolve mismatches privately. Do not expose customer links in team/public logs.

During the day, follow [CLIENT_ADMIN_GUIDE.md](CLIENT_ADMIN_GUIDE.md). A booking
is reserved only after persisted checkout success; payment is verified only after
an operator confirms actual receipt. Expiry releases temporary availability;
late transfers require reconciliation. Out-of-stock/capacity conflicts are normal
business outcomes. Repeated service-unavailable responses require incident triage.

At closing, reconcile completed/cancelled/refunded work, count changed inventory,
review tomorrow's slots and fitter workload, investigate outstanding outbox items,
and sign out. Review Audit for unexpected settings/access/price changes. Owners
review active staff access regularly and remove access when a person leaves.

Every week verify backup completion, a sampled restore record, alert delivery and
certificate/uptime checks. Maintain approved facts/policies and actual service
coverage; never add an area solely for search traffic. Review real field performance
when enough samples exist. Thresholds are in `../launch/MONITORING_AND_INCIDENTS.md`.

Monitoring workflow `.github/workflows/public-health.yml` is prepared with a
15-minute schedule and explicit `GFORCE_MONITORING_ENABLED=true` opt-in. It will
run from the default branch only after merge/activation. Run it manually after
production acceptance and test owner notifications before relying on it. It checks
public HTTP/TLS/SEO only; it does not inspect private booking/payment/email state.
Those signals need authenticated provider/admin monitoring and a named incident owner.
