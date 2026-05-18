const RESEND_API_URL = "https://api.resend.com/emails";
const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "https://rhqmzccyvfiitojeqkfr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const SUPABASE_REST_BASE = `${SUPABASE_URL}/rest/v1`;

type EmailEvent = {
  id: number;
  event_type: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  template_key: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

function textValue(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function htmlEscape(value: unknown): string {
  return textValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function corsHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-max-age": "86400",
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function customerName(event: EmailEvent): string {
  return textValue(event.recipient_name) ||
    textValue(event.payload?.name) ||
    "ban";
}

function renderTemplate(event: EmailEvent) {
  const name = htmlEscape(customerName(event));
  const siteUrl = textValue(Deno.env.get("SITE_URL"));
  const consultationUrl = siteUrl ? `${siteUrl.replace(/\/$/, "")}/#final-cta` : "";

  if (event.template_key === "lead_welcome") {
    return {
      subject: event.subject || "HungAAI da nhan thong tin cua ban",
      html: `
        <p>Chao ${name},</p>
        <p>Minh da nhan thong tin ban de lai ve coaching MQL5.</p>
        <p>Buoc tiep theo, minh se doc case cua ban theo 3 phan: rule hien tai, diem dang ket, va muc tieu ban muon xay trong 1-3 thang toi.</p>
        <p>Trong luc cho phan hoi, ban co the ghi them rule vao/thoat lenh, anh backtest hoac log neu co. Cang ro thi buoi tu van cang dung trong tam.</p>
        <p>HungAAI</p>
      `,
      text:
        `Chao ${customerName(event)},\n\nMinh da nhan thong tin ban de lai ve coaching MQL5. Minh se doc case theo rule hien tai, diem dang ket, va muc tieu ban muon xay trong 1-3 thang toi.\n\nHungAAI`,
    };
  }

  if (event.template_key === "lead_value_day_2") {
    return {
      subject: event.subject || "3 diem can ro truoc khi viet bot MQL5",
      html: `
        <p>Chao ${name},</p>
        <p>Truoc khi viet bot MQL5, co 3 diem nen lam ro:</p>
        <ol>
          <li>Dieu kien vao/thoat lenh co viet thanh checklist duoc khong.</li>
          <li>Risk moi lenh, daily loss va dieu kien dung bot da co chua.</li>
          <li>Backtest co du sach de tin, hay chi dang nhin equity dep.</li>
        </ol>
        <p>Bot khong sua mot rule mo ho. No chi thuc thi su mo ho do nhanh hon.</p>
        <p>HungAAI</p>
      `,
      text:
        `Chao ${customerName(event)},\n\nTruoc khi viet bot MQL5, hay lam ro: checklist vao/thoat lenh, risk/dieu kien dung bot, va chat luong backtest.\n\nHungAAI`,
    };
  }

  if (event.template_key === "lead_offer_day_3") {
    return {
      subject: event.subject || "Neu muon minh soi case MQL5 cua ban",
      html: `
        <p>Chao ${name},</p>
        <p>Neu ban muon di tiep, minh co the soi case that cua ban: rule, code, backtest, risk va cach van hanh.</p>
        <p>Muc tieu khong phai ban them mot file EA, ma la giup ban nhin he thong cua minh ro hon.</p>
        ${consultationUrl ? `<p><a href="${htmlEscape(consultationUrl)}">Mo lai trang dang ky tu van</a></p>` : ""}
        <p>HungAAI</p>
      `,
      text:
        `Chao ${customerName(event)},\n\nNeu ban muon di tiep, minh co the soi case that cua ban: rule, code, backtest, risk va cach van hanh.\n\n${consultationUrl}\n\nHungAAI`,
    };
  }

  if (event.template_key === "order_confirmation") {
    const orderId = htmlEscape(event.payload?.order_id);
    const paymentContent = htmlEscape(event.payload?.payment_content);
    return {
      subject: event.subject || "Xac nhan don hang MQL5 cua ban",
      html: `
        <p>Chao ${name},</p>
        <p>He thong da ghi nhan don hang MQL5 cua ban.</p>
        <p><strong>Ma don:</strong> ${orderId || String(event.id)}</p>
        ${paymentContent ? `<p><strong>Noi dung chuyen khoan:</strong> ${paymentContent}</p>` : ""}
        <p>Minh se lien he de xac nhan va chot lich tu van.</p>
        <p>HungAAI</p>
      `,
      text:
        `Chao ${customerName(event)},\n\nHe thong da ghi nhan don hang MQL5 cua ban. Ma don: ${textValue(event.payload?.order_id) || event.id}. Noi dung chuyen khoan: ${textValue(event.payload?.payment_content)}.\n\nHungAAI`,
    };
  }

  return {
    subject: event.subject || "Thong bao tu HungAAI",
    html: `<p>Chao ${name},</p><p>Cam on ban da quan tam.</p><p>HungAAI</p>`,
    text: `Chao ${customerName(event)},\n\nCam on ban da quan tam.\n\nHungAAI`,
  };
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  if (!SERVICE_ROLE_KEY) {
    throw new Error("Missing SERVICE_ROLE_KEY.");
  }

  const headers = new Headers(init.headers);
  headers.set("apikey", SERVICE_ROLE_KEY);
  headers.set("authorization", `Bearer ${SERVICE_ROLE_KEY}`);
  if (init.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(`${SUPABASE_REST_BASE}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return body;
}

async function fetchDueEvents(limit: number): Promise<EmailEvent[]> {
  const rows = await supabaseFetch("/rpc/claim_due_email_events", {
    method: "POST",
    body: JSON.stringify({ batch_limit: limit }),
  });
  return Array.isArray(rows) ? rows : [];
}

async function patchEvent(id: number, body: Record<string, unknown>) {
  await supabaseFetch(`/email_events?id=eq.${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ...body,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function sendViaResend(event: EmailEvent) {
  const resendApiKey = textValue(Deno.env.get("RESEND_API_KEY"));
  const from = textValue(Deno.env.get("EMAIL_FROM"));
  const replyTo = textValue(Deno.env.get("EMAIL_REPLY_TO"));

  if (!resendApiKey || !from) {
    throw new Error("Email service is not configured.");
  }
  if (!isValidEmail(textValue(event.recipient_email))) {
    throw new Error("Invalid recipient email.");
  }

  const rendered = renderTemplate(event);
  const resendPayload: Record<string, unknown> = {
    from,
    to: event.recipient_email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  };
  if (replyTo) resendPayload.reply_to = replyTo;

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(resendPayload),
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(
      textValue(body?.message) || textValue(body?.error) || `Resend API error ${res.status}`,
    );
  }

  return textValue(body?.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed. Use POST." }, 405);
  }

  let limit = 10;
  try {
    const payload = await req.json().catch(() => ({}));
    const requestedLimit = Number(payload?.limit);
    if (Number.isFinite(requestedLimit) && requestedLimit > 0) {
      limit = Math.min(50, Math.floor(requestedLimit));
    }
  } catch {
    limit = 10;
  }

  const result = {
    success: true,
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [] as Array<{ id: number; error: string }>,
  };

  try {
    const events = await fetchDueEvents(limit);
    for (const event of events) {
      result.processed += 1;

      try {
        const resendId = await sendViaResend(event);
        await patchEvent(event.id, {
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_id: resendId || null,
          last_error: null,
        });
        result.sent += 1;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        const attempts = Number(event.attempts || 0);
        const status = attempts >= Number(event.max_attempts || 3) ? "failed" : "queued";
        await patchEvent(event.id, {
          status,
          last_error: error,
        });
        result.failed += 1;
        result.errors.push({ id: event.id, error });
      }
    }

    return jsonResponse(result);
  } catch (err) {
    console.error("[process-email-queue] error", err);
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : "Failed to process email queue.",
    }, 500);
  }
});
