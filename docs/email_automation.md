# Email Automation Queue

This project uses `email_events` as the source of truth for automated email.

Flow:

1. A visitor submits the landing form.
2. Supabase inserts a row into `leads`.
3. A database trigger creates 3 rows in `email_events`:
   - `lead_welcome`: scheduled immediately.
   - `lead_value_day_2`: scheduled 2 days later.
   - `lead_offer_day_3`: scheduled 3 days later.
4. If an order is created, a database trigger creates `order_confirmation` immediately.
5. The `process-email-queue` Edge Function sends due queued emails through Resend and updates each row to `sent` or retries later.

Test mode:

- If the submitted email contains `+test`, for example `yourname+test@gmail.com`, all 3 lead emails are scheduled immediately instead of waiting 2 and 3 days.
- The queue sends to the normalized inbox email, for example `yourname@gmail.com`, so Resend test sender `onboarding@resend.dev` can still deliver to your verified account email.

To repair older failed test rows that still include `+test`, run:

```sql
update public.email_events
set
  recipient_email = regexp_replace(recipient_email, '\+test(?=@)', '', 'i'),
  status = 'queued',
  attempts = 0,
  last_error = null,
  updated_at = now()
where recipient_email ilike '%+test@%';
```

## Run SQL

Run the lead/customer migrations first if they have not been run yet:

```text
supabase/mvp_schema.sql
database/migration_leads_intent_flags.sql
```

Then run this file in Supabase SQL Editor:

```text
database/migration_email_events.sql
```

It creates:

- `public.email_events`
- trigger `trg_queue_lead_email_sequence`
- trigger `trg_queue_order_confirmation_email`

The order confirmation trigger queues only after `payment_content` is no longer `MQL5CocTMP`, so customers receive the final transfer memo such as `MQL5Coc17`.
The order confirmation payload includes product name, amount, order id, payment memo, and customer info.

To schedule follow-up sending every 15 minutes, run this after deploying `process-email-queue`:

```text
database/migration_email_cron.sql
```

## Required Supabase Secrets

```bash
supabase secrets set RESEND_API_KEY="re_xxx"
supabase secrets set EMAIL_FROM="HungAAI <noreply@your-domain.com>"
supabase secrets set EMAIL_REPLY_TO="support@your-domain.com"
supabase secrets set SITE_URL="https://your-site.com"
supabase secrets set SERVICE_ROLE_KEY="your-service-role-key"
```

`EMAIL_FROM` must use a domain verified in Resend. Gmail/Yahoo sender addresses will be rejected because you cannot verify their DNS records in your Resend account.
`EMAIL_REPLY_TO` and `SITE_URL` are optional. `SERVICE_ROLE_KEY` is required by `process-email-queue` so it can read and update `email_events` without exposing table permissions to the frontend. Supabase does not allow custom secret names that start with `SUPABASE_`, so use `SERVICE_ROLE_KEY`.

## Deploy Functions

```bash
supabase functions deploy send-email
supabase functions deploy process-email-queue
```

## Test Processor

Replace `PROJECT_REF`:

```bash
curl -i -X POST "https://PROJECT_REF.functions.supabase.co/process-email-queue" \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
```

Expected response:

```json
{
  "success": true,
  "processed": 1,
  "sent": 1,
  "failed": 0,
  "errors": []
}
```

## Production Schedule

The landing page pings `process-email-queue` after a successful submit so the welcome email can go out quickly.

For the 2-day and 3-day follow-up emails, add a scheduled trigger outside the frontend. Options:

- Run `database/migration_email_cron.sql` to create a Supabase `pg_cron` job every 15 minutes.
- Supabase Scheduled Functions / Cron if enabled in your project.
- An external cron service calling `process-email-queue` every 5-15 minutes.
- GitHub Actions cron calling the Edge Function.

Recommended interval:

```text
Every 5 or 15 minutes: POST /process-email-queue {"limit": 20}
```

## Security Notes

Do not give anon users direct insert/update policies on `email_events`.

Current MVP note: the admin CRM reads `email_events` from the browser, so `database/migration_email_events.sql` grants anon `select` on `email_events`. This matches the existing unauthenticated admin model but should be tightened before production.

The public frontend never sees `RESEND_API_KEY` or `SERVICE_ROLE_KEY`. It only inserts normal `leads` and `orders`; database triggers create the queue rows.

The current MVP allows public calls to `process-email-queue`. It does not accept arbitrary email content, but it can still be triggered repeatedly. Before production, add a shared cron secret header or require JWT/service calls for scheduled processing.
