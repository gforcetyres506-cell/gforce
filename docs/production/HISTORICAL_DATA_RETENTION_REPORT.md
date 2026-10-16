# Historical Data Retention and Privacy Compliance Report

**System:** G Force Tyres Mobile (`https://www.gforcetyres-mobile.co.uk`)  
**Date:** October 2026  
**Status:** Preserved Legacy State — Read-Only Safeguard Active  
**Author:** Lead Production Engineer  
**Audience:** Business Owner, Operations Lead, Data Protection Officer  

---

## 1. Executive Summary

During the database reconciliation and production recovery (Migration 019: `live_legacy_reconciliation.sql`), all preexisting database records from the client repository and Supabase cluster were preserved intact in `legacy_backup_20261013` and reconciled into operational schemas.

To prevent accidental destruction of audit evidence, historic tax records, or ongoing customer enquiries, **no records have been automatically deleted, rewritten, cancelled, or refunded**.

Instead, database-level and application-level immutability safeguards have been established:
1. **PostgreSQL Trigger Guard (`guard_legacy_booking`):** Any attempt to execute `UPDATE` or `DELETE` on records where `booking_source IS NULL` raises SQL error code `55000` (`Legacy booking is immutable historical record`).
2. **Admin OS Visual Freeze:** All legacy bookings are clearly flagged with the `Historical — read only` badge. Unsupported mutation controls (fitter reassignment, status progression, slot reschedule, cancellation, and manual bank verification) are disabled in the user interface.

This report categorises legacy records into synthetic/test data versus legitimate operational records, reviews UK GDPR and statutory tax obligations, and proposes a safe owner-approved retention roadmap.

---

## 2. Inventory of Historical Records

### 2.1 Synthetic / Test Records (Demonstrably Non-Live)

| Record Identifier | Customer / Actor | Indicators of Synthetic Origin | Current State | Risk if Retained |
|---|---|---|---|---|
| Historical Bookings (e.g., `BK-LEGACY-001`, `BK-LEGACY-002`) | "Sarah Jenkins", "John Doe" | Placeholder customer names; sequential test timestamps; dummy vehicle registrations (`AA19AAA`, `TEST123`); `pending_payment` with expired timers. | Frozen (Read-Only) | Low. Read-only records do not impact live availability or slot holds. |
| Test Customer Profiles | `sarah.jenkins@example.com`, `john.doe@test.com` | Synthetic domains (`example.com`, `test.com`); no real phone numbers. | Active Customer Row (Historical) | Negligible. Zero GDPR exposure as synthetic entities do not represent living natural persons. |
| Test Fitters / Vans | "Test Fitter 1", "Demo Van" | Generic names used during initial schema validation. | Configured as Active/Inactive | Confusion risk if assigned to live bookings; owner should review in Admin → Fitters. |

### 2.2 Legitimate Historical Records

| Record Set | Description | Business Purpose | Statutory & Operational Context |
|---|---|---|---|
| **13 Service Zones** | Coverage zones across South London / Kent borders (`CR0`, `BR1`, `DA1`, `SM1`, `SE25`, etc.) with outward postcodes and callout fees. | Geographic boundaries for mobile fitting dispatch. | **Keep & Review.** Must remain configured so customers within valid operating radius can book. The owner can deactivate any specific zone in Admin → Zones without data loss. |
| **Product Catalogue (33 SKUs)** | Verified tyre sizes (e.g., `205/55 R16`, `225/45 R18`) with tyre specifications (brand, speed, load index, season). | Core product offering for online search. | **Keep.** Inventory quantities are linked 1:1 with tyre products. Retaining migrated SKUs ensures customers find matching tyres. |
| **Historical Invoices / Audit Logs** | Immutable transaction log (`audit_log`) and ledger rows. | Audit trail of all database actions since deployment. | **Mandatory HMRC Record.** Must be retained under UK company law. |

---

## 3. Legal and Regulatory Compliance Analysis

### 3.1 UK GDPR & Data Protection Act 2018

1. **Storage Limitation Principle (Article 5(1)(e)):**  
   Personal data must not be kept for longer than is necessary for the purposes for which it is processed. For legitimate customer bookings, retaining records during the statutory warranty and dispute period (up to 6 years) is legally permissible under lawful basis (Contractual performance & Legal obligation).
2. **Right to Erasure (Article 17):**  
   If a legitimate past customer requests data erasure ("Right to be Forgotten"), personal identifiers (name, telephone, email, delivery address) can be anonymised (e.g. replaced with `REDACTED_GDPR_XXXX`) while preserving the financial transaction reference, amounts, and VAT details required by law.
3. **Synthetic Records:**  
   Records featuring fictitious identities ("John Doe", "Sarah Jenkins") do not contain personal data relating to an identified or identifiable natural person (Recital 26 UK GDPR). They do not trigger GDPR erasure rights.

### 3.2 HMRC Statutory Accounting & Tax Requirements

Under the **Taxes Management Act 1970 (s.12B)** and **VAT Act 1994 (s.58 & Schedule 11)**:
- All business records, invoices, customer orders, payment receipts, bank credits, and credit notes must be retained for **a minimum of 6 years** from the end of the last company financial year they relate to.
- Destructive deletion of historical financial or booking entries violates HMRC compliance rules and could result in penalties during a statutory VAT audit.

---

## 4. Current Protection Mechanisms

```
+-------------------------------------------------------------+
|                     Admin OS Interface                      |
|                                                             |
|  [BK-LEGACY-001]                                            |
|  Sarah Jenkins · AA19AAA · [Historical — read only]         |
|                                                             |
|  (Operational mutation buttons DISABLED)                    |
|  "Preserved legacy record. Operational actions disabled to   |
|   maintain audit integrity."                                |
+-------------------------------------------------------------+
                              |
                              v Attempted Mutation (API)
+-------------------------------------------------------------+
|                  PostgreSQL Database Engine                 |
|                                                             |
|  TRIGGER: bookings_legacy_preservation                      |
|  FUNCTION: guard_legacy_booking()                           |
|                                                             |
|  IF OLD.booking_source IS NULL THEN                         |
|     RAISE EXCEPTION 'Legacy booking is immutable'           |
|     SQLSTATE '55000'                                        |
+-------------------------------------------------------------+
```

---

## 5. Proposed Owner Remediation Roadmap

The lead production engineer recommends the following phased actions requiring owner sign-off:

### Step 1: Owner Operational Review (Zero Database Risk)
1. **Zones:** Review all 13 service zones in Admin → Zones. Deactivate any outward postcode areas where mobile vans will not operate.
2. **Fitters:** Review Admin → Fitters. Update mobile phone numbers and van descriptions to reflect real employed or contracted technicians. Deactivate any test fitters.
3. **Products:** Review Admin → Products & Inventory. Verify that physical stock counts in your depot match the displayed stock numbers. Use the "Physical cycle count" feature to adjust stock with an audited reason.

### Step 2: Synthetic Data Archival (Optional Future Cleanup)
If the business owner wishes to hide test bookings ("Sarah Jenkins", "John Doe") from the main booking list:
- **Do NOT execute `DELETE FROM bookings`** on live tables.
- Instead, perform a schema migration that creates an archive schema (`legacy_archive.bookings`) and moves synthetic rows there, keeping foreign keys and audit logs intact.
- This requires written authorization from the business owner.

---

## 6. Owner Sign-Off Block

| Role | Name | Signature / Authorization | Date |
|---|---|---|---|
| Business Owner | ___________________________ | ___________________________ | ____________ |
| Lead Engineer | G Force Lead Production Eng | *Implemented & Verified* | 17 Oct 2026 |

*Preserved records remain safe, compliant, and non-disruptive to live operations.*
