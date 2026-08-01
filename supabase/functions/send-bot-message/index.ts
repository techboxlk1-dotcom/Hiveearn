import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const MINI_APP_URL = Deno.env.get("MINI_APP_URL") ?? "https://t.me/Hiveearnbot/play";
const ADMIN_CHAT_ID = Deno.env.get("ADMIN_CHAT_ID") ?? "5419054691";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const BANNER_PHOTO = Deno.env.get("BANNER_PHOTO") ?? "";
const COMMUNITY_CHANNEL = Deno.env.get("COMMUNITY_CHANNEL") ?? "hiveearn";
const PAYMENT_CHANNEL = Deno.env.get("PAYMENT_CHANNEL") ?? "hiveearnpayment";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

function getPaymentKeyboard(txid: string) {
  return {
    inline_keyboard: [
      [{ text: "🐝 Open Mini App", web_app: { url: MINI_APP_URL } }],
      [
        { text: "View Transaction", url: `https://bscscan.com/tx/${txid}` },
        { text: "Payment Channel", url: `https://t.me/${PAYMENT_CHANNEL}` },
      ],
    ],
  };
}

function getPaymentChannelKeyboard(txid: string) {
  return {
    inline_keyboard: [
      [{ text: "🐝 Open Mini App", web_app: { url: MINI_APP_URL } }],
      [{ text: "View Transaction", url: `https://bscscan.com/tx/${txid}` }],
    ],
  };
}

function getUserPaymentKeyboard(txid: string) {
  return {
    inline_keyboard: [
      [{ text: "View Transaction", url: `https://bscscan.com/tx/${txid}` }],
      [{ text: "Payment Channel", url: `https://t.me/${PAYMENT_CHANNEL}` }],
      [{ text: "Open Mini App", web_app: { url: MINI_APP_URL } }],
    ],
  };
}

async function sendMessage(chatId: string | number, text: string, keyboard?: unknown, parseMode = "HTML") {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  };
  if (keyboard) payload.reply_markup = keyboard;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function sendPhoto(chatId: string | number, photo: string, caption: string, keyboard?: unknown) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
  };
  if (keyboard) payload.reply_markup = keyboard;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!data.ok) {
    return sendMessage(chatId, caption, keyboard);
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      chat_id,
      text,
      include_app_button = true,
      parse_mode = "HTML",
      include_banner = false,
      photo_url,
      payment_type,
      txid,
      button_name,
      button_url,
    } = body;

    if (!chat_id || !text) {
      return new Response(JSON.stringify({ error: "chat_id and text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle payment approval messages with special keyboards
    if (payment_type === "approved" && txid) {
      if (!String(chat_id).startsWith("@")) {
        await sendMessage(chat_id, text, getUserPaymentKeyboard(txid), parse_mode);
      } else {
        await sendMessage(chat_id, text, getPaymentChannelKeyboard(txid), parse_mode);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle custom buttons
    let customKeyboard: unknown = undefined;
    if (button_name && button_url) {
      customKeyboard = {
        inline_keyboard: [
          [{ text: button_name, url: button_url }],
          [{ text: "🐝 Open Hive Earn", web_app: { url: MINI_APP_URL } }],
        ],
      };
    }

    // If include_banner is true, send photo with banner
    if (include_banner) {
      const photo = photo_url || BANNER_PHOTO || (APP_URL ? `${APP_URL}/IMG-20260624-WA0001.jpg` : "");
      if (photo) {
        const keyboard = customKeyboard || (include_app_button ? getMainKeyboard() : undefined);
        await sendPhoto(chat_id, photo, text, keyboard);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Regular text message
    const keyboard = customKeyboard || (include_app_button ? getMainKeyboard() : undefined);
    const result = await sendMessage(chat_id, text, keyboard, parse_mode);

    return new Response(JSON.stringify({ ok: result.ok, result: result.result, error: result.description }), {
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
