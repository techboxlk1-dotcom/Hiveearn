import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "8969456125:AAFm5CQIhVWpTL6XQDhj-YoVDEojprQWHo4";
const MINI_APP_URL = Deno.env.get("MINI_APP_URL") ?? "https://t.me/Hiveearnbot/play";
const ADMIN_CHAT_ID = Deno.env.get("ADMIN_CHAT_ID") ?? "5419054691";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const COMMUNITY_CHANNEL = Deno.env.get("COMMUNITY_CHANNEL") ?? "hiveearn";
const PAYMENT_CHANNEL = Deno.env.get("PAYMENT_CHANNEL") ?? "hiveearnpayment";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Inline keyboard with 3 buttons: Open App, Community, Payment
function getMainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🐝 Open Hive Earn", web_app: { url: MINI_APP_URL } }],
      [
        { text: "👥 Community", url: `https://t.me/${COMMUNITY_CHANNEL}` },
        { text: "💳 Payments", url: `https://t.me/${PAYMENT_CHANNEL}` },
      ],
    ],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { chat_id, text, include_app_button = true, parse_mode = "HTML", include_banner = false } = await req.json();

    if (!chat_id || !text) {
      return new Response(JSON.stringify({ error: "chat_id and text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If include_banner is true, send photo with banner image
    if (include_banner && APP_URL) {
      const photoUrl = `${APP_URL}/IMG-20260624-WA0001.jpg`;
      const payload: Record<string, unknown> = {
        chat_id,
        photo: photoUrl,
        caption: text,
        parse_mode,
      };

      if (include_app_button) {
        payload.reply_markup = getMainKeyboard();
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const tgData = await tgRes.json();

      // If photo fails, fall back to text message
      if (!tgData.ok) {
        const fallbackPayload: Record<string, unknown> = {
          chat_id,
          text,
          parse_mode,
        };
        if (include_app_button) {
          fallbackPayload.reply_markup = getMainKeyboard();
        }
        const fallbackRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fallbackPayload),
        });
        const fallbackData = await fallbackRes.json();
        return new Response(JSON.stringify({ ok: fallbackData.ok, result: fallbackData.result, error: fallbackData.description }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: tgData.ok, result: tgData.result, error: tgData.description }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Regular text message
    const payload: Record<string, unknown> = {
      chat_id,
      text,
      parse_mode,
    };

    if (include_app_button) {
      payload.reply_markup = getMainKeyboard();
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const tgData = await tgRes.json();

    return new Response(JSON.stringify({ ok: tgData.ok, result: tgData.result, error: tgData.description }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
