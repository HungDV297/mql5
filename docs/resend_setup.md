# Resend Email Setup

This project sends email through a Supabase Edge Function so the Resend API key never appears in frontend files.

## Set Supabase Secrets

Replace the example values before running:

```bash
supabase secrets set RESEND_API_KEY="re_xxx"
supabase secrets set EMAIL_FROM="HungAAI <noreply@your-domain.com>"
supabase secrets set EMAIL_REPLY_TO="support@your-domain.com"
supabase secrets set SITE_URL="https://your-site.com"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

`EMAIL_REPLY_TO` and `SITE_URL` are optional. `SITE_URL` is used for CORS; if it is not set, the function allows all origins.
`SUPABASE_SERVICE_ROLE_KEY` is required by `process-email-queue`, not by the direct `send-email` function.

## Deploy

```bash
supabase functions deploy send-email
supabase functions deploy process-email-queue
```

If deploying with the project reference explicitly:

```bash
supabase functions deploy send-email --project-ref your-project-ref
```

## Test With Curl

Replace `PROJECT_REF` with the Supabase project ref:

```bash
curl -i -X POST "https://PROJECT_REF.functions.supabase.co/send-email" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test email from Supabase Edge Function",
    "html": "<p>Hello from Resend.</p>"
  }'
```

Expected success response:

```json
{
  "success": true,
  "resendId": "..."
}
```

## Local Test

Serve the function locally:

```bash
supabase functions serve send-email --env-file ./supabase/.env.local
```

Example `supabase/.env.local`:

```bash
RESEND_API_KEY="re_xxx"
EMAIL_FROM="HungAAI <noreply@your-domain.com>"
EMAIL_REPLY_TO="support@your-domain.com"
SITE_URL="http://localhost:3000"
```

Then test:

```bash
curl -i -X POST "http://127.0.0.1:54321/functions/v1/send-email" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Local Resend test",
    "text": "Hello from local Supabase Edge Function."
  }'
```

## Security Notes

Never put `RESEND_API_KEY` in `main.js`, `admin.js`, `index.html`, or any other public file.

The current MVP config sets `send-email` as public callable. That protects the Resend key, but the endpoint can still be abused as an email relay if exposed without extra controls. Before production use, add tighter authorization, rate limiting, captcha, or move email sending behind a trusted workflow.
