const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "https://vawdkvebciokqcperbtl.supabase.co";
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "sb_publishable_eHb1OZYE1-LaVrP1TctnJw_49jcuwoK";
const SUPABASE_REST_BASE = `${SUPABASE_URL}/rest/v1`;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

function ok() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: jsonHeaders,
  });
}

function textValue(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function matchText(value: unknown): string {
  return textValue(value).toLowerCase();
}

function transferAmount(payload: Record<string, unknown>): number | null {
  const n = Number(payload.transferAmount);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("apikey", SUPABASE_ANON_KEY);
  headers.set("authorization", `Bearer ${SUPABASE_ANON_KEY}`);
  if (init.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(`${SUPABASE_REST_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${body}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function insertLog(
  payload: Record<string, unknown>,
  matchedOrderId: number | null,
) {
  await supabaseFetch("/sepay_transactions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      sepay_id: textValue(payload.id) || null,
      gateway: textValue(payload.gateway),
      transaction_date: textValue(payload.transactionDate),
      account_number: textValue(payload.accountNumber),
      code: textValue(payload.code),
      content: textValue(payload.content),
      transfer_type: textValue(payload.transferType),
      transfer_amount: transferAmount(payload),
      reference_code: textValue(payload.referenceCode),
      matched_order_id: matchedOrderId,
      raw_payload: JSON.stringify(payload),
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return ok();
  if (req.method !== "POST") return ok();

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const sepayId = textValue(payload.id);
  const type = textValue(payload.transferType).toLowerCase();
  const amount = transferAmount(payload);
  console.log(`[sepay] webhook received id=${sepayId || "(missing)"}`);

  try {
    if (sepayId) {
      const existing = await supabaseFetch(
        `/sepay_transactions?sepay_id=eq.${encodeURIComponent(sepayId)}&select=id&limit=1`,
      );
      if (Array.isArray(existing) && existing.length > 0) {
        console.log(`[sepay] duplicate ignored id=${sepayId}`);
        return ok();
      }
    }

    let matchedOrderId: number | null = null;

    if (type === "in") {
      const orders = await supabaseFetch(
        "/orders?status=eq.pending&select=id,amount,payment_content&order=id.asc",
      );
      const haystack = `${matchText(payload.code)} ${matchText(payload.content)}`;
      const matched = Array.isArray(orders)
        ? orders.find((order) => {
            const memo = matchText(order.payment_content);
            return memo.length > 0 && haystack.includes(memo);
          })
        : null;

      if (matched) {
        matchedOrderId = Number(matched.id);
        const expected = Math.round(Number(matched.amount));
        if (Number.isFinite(expected) && amount === expected) {
          await supabaseFetch(`/orders?id=eq.${matchedOrderId}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              status: "success",
              updated_at: new Date().toISOString(),
            }),
          });
          console.log(`[sepay] order matched order_id=${matchedOrderId}`);
        } else {
          console.log(
            `[sepay] amount mismatch order_id=${matchedOrderId} expected=${matched.amount} actual=${amount}`,
          );
        }
      } else {
        console.log(`[sepay] no matching order id=${sepayId || "(missing)"}`);
      }
    } else {
      console.log(
        `[sepay] no matching order id=${sepayId || "(missing)"} transfer_type=${type || "(empty)"}`,
      );
    }

    await insertLog(payload, matchedOrderId);
  } catch (err) {
    console.error("[sepay] webhook error", err);
  }

  return ok();
});
