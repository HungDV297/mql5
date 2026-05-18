const RESEND_API_URL = "https://api.resend.com/emails";

type EmailPayload = {
  to?: unknown;
  subject?: unknown;
  html?: unknown;
  text?: unknown;
};

function textValue(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  const siteUrl = textValue(Deno.env.get("SITE_URL"));
  const allowOrigin = siteUrl && origin === siteUrl ? siteUrl : siteUrl ? siteUrl : "*";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function validatePayload(payload: EmailPayload) {
  const to = textValue(payload.to);
  const subject = textValue(payload.subject);
  const html = textValue(payload.html);
  const text = textValue(payload.text);

  if (!isValidEmail(to)) {
    return { ok: false as const, error: "Invalid recipient email." };
  }
  if (!subject) {
    return { ok: false as const, error: "Subject is required." };
  }
  if (!html && !text) {
    return { ok: false as const, error: "Either html or text content is required." };
  }

  return { ok: true as const, data: { to, subject, html, text } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, {
      success: false,
      error: "Method not allowed. Use POST.",
    }, 405);
  }

  const resendApiKey = textValue(Deno.env.get("RESEND_API_KEY"));
  const from = textValue(Deno.env.get("EMAIL_FROM"));
  const replyTo = textValue(Deno.env.get("EMAIL_REPLY_TO"));

  if (!resendApiKey || !from) {
    return jsonResponse(req, {
      success: false,
      error: "Email service is not configured.",
    }, 500);
  }

  let payload: EmailPayload = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, {
      success: false,
      error: "Invalid JSON body.",
    }, 400);
  }

  const validated = validatePayload(payload);
  if (!validated.ok) {
    return jsonResponse(req, {
      success: false,
      error: validated.error,
    }, 400);
  }

  const { to, subject, html, text } = validated.data;
  const resendPayload: Record<string, unknown> = {
    from,
    to,
    subject,
  };
  if (html) resendPayload.html = html;
  if (text) resendPayload.text = text;
  if (replyTo) resendPayload.reply_to = replyTo;

  try {
    const resendRes = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendText = await resendRes.text();
    const resendBody = resendText ? JSON.parse(resendText) : {};

    if (!resendRes.ok) {
      return jsonResponse(req, {
        success: false,
        error: textValue(resendBody?.message) ||
          textValue(resendBody?.error) ||
          `Resend API error ${resendRes.status}`,
      }, 502);
    }

    return jsonResponse(req, {
      success: true,
      resendId: resendBody?.id ?? null,
    });
  } catch (err) {
    console.error("[send-email] error", err);
    return jsonResponse(req, {
      success: false,
      error: "Failed to send email.",
    }, 500);
  }
});
