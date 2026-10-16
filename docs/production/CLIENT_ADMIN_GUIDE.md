# Owner operating guide

Release candidate, 12 October 2026. These instructions describe the implemented
screens. Hosted owner training and real business configuration are still blocked.
Start at `https://www.gforcetyres-mobile.co.uk/admin/login` after the release is
accepted. Public customer navigation deliberately has no staff-login link.

## Access

Use your individually provisioned email/password. Do not share an owner login.
An owner can change access and bank settings; an admin can operate bookings and
inventory; a viewer can inspect records but cannot save changes. Sign out using
the console's **Sign out** button. An unavailable service never means a save worked.

## Take a phone booking

1. Open **Bookings → Create phone booking**. Enter the customer's actual fitting
   postcode and the width/profile/rim from the physical sidewall. Registration
   lookup is disabled in V1. Check each axle; front and rear can differ.
2. Select an actual product, quantity and, when needed, a separate rear product.
   Confirm location/vehicle details, choose a fitting time, then enter the real
   contact and address details with the customer's permission.
3. Review the full bank-transfer total and select **Reserve for Bank Payment**.
   A fitting-time selection alone reserves nothing. A successful reservation
   persists the booking, stock/slot holds and pending payment together.
4. Open the recorded booking. Copy the displayed bank instructions/reference or
   select **Email payment instructions**. Keep its private manage link private.
   Provider acceptance does not prove the customer received the email.

## Payment and fulfilment

In **Payments**, select the booking. Check the actual business bank statement,
full amount and reference before **MARK PAYMENT RECEIVED → Yes, receipt verified**.
Customer screenshots and customer assertions are insufficient. A pending booking
is `AWAITING_BANK_PAYMENT`; receipt verification changes it to `CONFIRMED`.
In **Bookings**, select an active persisted fitter, save the assignment and move
through the permitted lifecycle as the work actually happens. Complete only after
the fitting is complete. Every accepted operation records the staff actor in Audit.

To reschedule, choose the replacement slot and review the change. Availability
is checked again at save time. To extend an unpaid deadline, enter additional
minutes and a reason in Payments, then **Check availability and extend**. Expired
resources may have been sold; extension can correctly fail. A late transfer
needs human reconciliation before any replacement booking or refund.

To cancel, use Bookings' cancellation action and enter the reason. Resource
release is handled once by the transaction. Cancellation does not send money.
For a refund, actually send the money through the business bank first; then record
the supported full refund with its bank reference, amount, time and reason.
The application records this event; it cannot execute a bank transfer.

## Maintain the business

| Screen | Owner workflow |
| --- | --- |
| Dashboard | Inspect real-time metrics and the **Launch Setup Checklist** (10 persisted criteria covering contacts, stock, zones, fitters, slots, pricing, bank details, legal policies, email, and live approval). |
| Products | Create/edit the real SKU, brand/model, dimensions, ratings, season and tier; archive discontinued products; use the validated CSV import for 1–500 rows |
| Inventory | Inspect current stock, reserved stock, and available stock. Update selling price, cost price, supplier SKU, and low-stock thresholds. Use a labelled physical cycle count after counting physical depot inventory. If an inventory row is genuinely absent, an explicit alert is displayed. |
| Slots | Save weekday rules using the Monday–Sunday dropdown, start/end times, slot duration (mins), and concurrent van capacity; generate slots over an explicit date range; add special-date hours or block dates (e.g., bank holidays). |
| Zones | Save actual outward postcode prefixes and callout fees; deactivate areas you cannot serve; no postcode wildcards. |
| Fitters | Add/update real fitter name/contact and active status; inspect workload before assignment. |
| Settings | Configure telephone, email, WhatsApp, fitting fee, standard job duration, booking horizon, VAT rate, and cancellation policy. **Bank transfer settings** (account name, bank name, sort code, account number, payment window) must be configured first. Once all mandatory fields are filled, click **Approve Pricing & Enable Live Checkout** to enable customer bookings. Click **Revoke Approval & Pause Checkout** to pause online bookings at any time. |
| Access | Invite/provision a named owner/admin/viewer; review role/active changes; self-demotion and removal of the final owner are denied |
| Customers / Audit | Inspect recorded history and changes; audit entries cannot be edited or deleted |
| Bookings | Manage live customer appointments. Pre-existing records are flagged **"Historical — read only"**; operational mutation actions are disabled to safeguard accounting history. |

Prices in admin fields labelled `pence` use integer pence: convert your approved
pound price by multiplying by 100. Do not enter fabricated test stock or prices.
Stock includes operational allocations; never subtract reservations a second time.

Public contact buttons currently use `BUSINESS_PHONE` / `BUSINESS_WHATSAPP` in
Vercel, separate from stored operational contact settings. The owner must update
both and redeploy to publish matching contact buttons. In the client-owned G Force
Vercel project, open **Settings → Environment Variables**, edit those two Production
values, save, then redeploy the accepted main deployment from **Deployments**.
These variables are deployment configuration. Confirm the resulting deployment's
SHA and check the visible telephone/WhatsApp destinations against the approved
numbers. This is a post-acceptance operating procedure, not authorization to
promote an unaccepted release. Public legal pages and
additional entity facts need the approved release content published as well;
saving an admin policy field alone does not replace those pages. This distinction
must be demonstrated during owner acceptance; it is not automatic synchronisation.

For CSV, use the exact header printed on Products, in the same order. Use real
rows only, integer pence/counts and the displayed season/tier values; review errors
before retrying. The batch commits all rows or none. Do not edit reserved stock in
an import or treat a CSV as a backup. Prefer a small reviewed batch before a large
catalogue change and confirm the resulting products/inventory and Audit entries.

If a save times out, refresh and inspect the persisted record/Audit before retrying.
Never repeat a money transfer because a web request failed. Escalate according to
[INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md). Named support contacts remain UNKNOWN.
