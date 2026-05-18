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
      subject: event.subject || "HungAAI đã nhận thông tin của bạn",
      html: `
        <p>Chào ${name},</p>
        <p>Mình đã nhận thông tin bạn để lại về coaching MQL5.</p>
        <p>Bước tiếp theo, mình sẽ đọc case của bạn theo 3 phần: rule hiện tại, điểm đang kẹt, và mục tiêu bạn muốn xây trong 1-3 tháng tới.</p>
        <p>Trong lúc chờ phản hồi, bạn có thể ghi thêm rule vào/thoát lệnh, ảnh backtest hoặc log nếu có. Càng rõ thì buổi tư vấn càng đúng trọng tâm.</p>
        <p>HungAAI</p>
      `,
      text:
        `Chào ${customerName(event)},\n\nMình đã nhận thông tin bạn để lại về coaching MQL5. Mình sẽ đọc case theo rule hiện tại, điểm đang kẹt, và mục tiêu bạn muốn xây trong 1-3 tháng tới.\n\nHungAAI`,
    };
  }

  if (event.template_key === "lead_value_day_2") {
    return {
      subject: event.subject || "3 điểm cần rõ trước khi viết bot MQL5",
      html: `
        <p>Chào ${name},</p>
        <p>Trước khi viết bot MQL5, có 3 điểm nên làm rõ:</p>
        <ol>
          <li>Điều kiện vào/thoát lệnh có viết thành checklist được không.</li>
          <li>Risk mỗi lệnh, daily loss và điều kiện dừng bot đã có chưa.</li>
          <li>Backtest có đủ sạch để tin, hay chỉ đang nhìn equity đẹp.</li>
        </ol>
        <p>Bot không sửa một rule mơ hồ. Nó chỉ thực thi sự mơ hồ đó nhanh hơn.</p>
        <p>HungAAI</p>
      `,
      text:
        `Chào ${customerName(event)},\n\nTrước khi viết bot MQL5, hãy làm rõ: checklist vào/thoát lệnh, risk/điều kiện dừng bot, và chất lượng backtest.\n\nHungAAI`,
    };
  }

  if (event.template_key === "lead_offer_day_3") {
    return {
      subject: event.subject || "Nếu muốn mình soi case MQL5 của bạn",
      html: `
        <p>Chào ${name},</p>
        <p>Nếu bạn muốn đi tiếp, mình có thể soi case thật của bạn: rule, code, backtest, risk và cách vận hành.</p>
        <p>Mục tiêu không phải bán thêm một file EA, mà là giúp bạn nhìn hệ thống của mình rõ hơn.</p>
        ${consultationUrl ? `<p><a href="${htmlEscape(consultationUrl)}">Mở lại trang đăng ký tư vấn</a></p>` : ""}
        <p>HungAAI</p>
      `,
      text:
        `Chào ${customerName(event)},\n\nNếu bạn muốn đi tiếp, mình có thể soi case thật của bạn: rule, code, backtest, risk và cách vận hành.\n\n${consultationUrl}\n\nHungAAI`,
    };
  }

  if (event.template_key === "order_confirmation") {
    const orderId = htmlEscape(event.payload?.order_id);
    const paymentContent = htmlEscape(event.payload?.payment_content);
    return {
      subject: event.subject || "Xác nhận đơn hàng MQL5 của bạn",
      html: `
        <p>Chào ${name},</p>
        <p>Hệ thống đã ghi nhận đơn hàng MQL5 của bạn.</p>
        <p><strong>Mã đơn:</strong> ${orderId || String(event.id)}</p>
        ${paymentContent ? `<p><strong>Nội dung chuyển khoản:</strong> ${paymentContent}</p>` : ""}
        <p>Mình sẽ liên hệ để xác nhận và chốt lịch tư vấn.</p>
        <p>HungAAI</p>
      `,
      text:
        `Chào ${customerName(event)},\n\nHệ thống đã ghi nhận đơn hàng MQL5 của bạn. Mã đơn: ${textValue(event.payload?.order_id) || event.id}. Nội dung chuyển khoản: ${textValue(event.payload?.payment_content)}.\n\nHungAAI`,
    };
  }

  return {
    subject: event.subject || "Thông báo từ HungAAI",
    html: `<p>Chào ${name},</p><p>Cảm ơn bạn đã quan tâm.</p><p>HungAAI</p>`,
    text: `Chào ${customerName(event)},\n\nCảm ơn bạn đã quan tâm.\n\nHungAAI`,
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
