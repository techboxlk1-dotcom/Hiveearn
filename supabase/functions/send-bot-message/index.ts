import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const MINI_APP_URL = Deno.env.get("MINI_APP_URL") ?? "https://t.me/Hiveearnbot/play";
const MINI_APP_STARTAPP_URL = "https://t.me/Hiveearnbot/play?startapp";
const ADMIN_CHAT_ID = Deno.env.get("ADMIN_CHAT_ID") ?? "5419054691";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const BANNER_PHOTO = Deno.env.get("BANNER_PHOTO") ?? "";
const COMMUNITY_CHANNEL = "hiveearn";
const PAYMENT_CHANNEL = "hiveearnpayment";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Keyboard for private chats — web_app buttons are allowed here
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

// Keyboard for payment approval to private chat (user)
function getUserPaymentKeyboard(txid: string) {
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

// Keyboard for CHANNEL posts — NO web_app buttons (Telegram rejects them in channels)
function getChannelPaymentKeyboard(txid: string) {
  return {
    inline_keyboard: [
      [{ text: "🐝 Open Mini App", url: MINI_APP_STARTAPP_URL }],
      [{ text: "View Transaction", url: `https://bscscan.com/tx/${txid}` }],
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
  const data = await res.json();
  if (!data.ok) console.error(`sendMessage failed for ${chatId}:`, data.description);
  return data;
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
    console.error(`sendPhoto failed for ${chatId}:`, data.description);
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

    const isChannel = String(chat_id).startsWith("@");

    // Handle payment approval messages with special keyboards
    if (payment_type === "approved" && txid) {
      if (!isChannel) {
        // Private chat — web_app buttons OK
        await sendMessage(chat_id, text, getUserPaymentKeyboard(txid), parse_mode);
      } else {
        // Channel — URL buttons only, no web_app
        await sendMessage(chat_id, text, getChannelPaymentKeyboard(txid), parse_mode);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle custom buttons
    let customKeyboard: unknown = undefined;
    if (button_name && button_url) {
      if (isChannel) {
        // Channel — no web_app button
        customKeyboard = {
          inline_keyboard: [
            [{ text: button_name, url: button_url }],
            [{ text: "🐝 Open Hive Earn", url: MINI_APP_STARTAPP_URL }],
          ],
        };
      } else {
        customKeyboard = {
          inline_keyboard: [
            [{ text: button_name, url: button_url }],
            [{ text: "🐝 Open Hive Earn", web_app: { url: MINI_APP_URL } }],
          ],
        };
      }
    }

    // If include_banner is true, send photo with banner
    if (include_banner) {
      const photo = photo_url || BANNER_PHOTO || (APP_URL ? `${APP_URL}/IMG-20260624-WA0001.jpg` : "");
      if (photo) {
        let keyboard = customKeyboard;
        if (!keyboard && include_app_button) {
          keyboard = isChannel
            ? { inline_keyboard: [[{ text: "🐝 Open Hive Earn", url: MINI_APP_STARTAPP_URL }]] }
            : getMainKeyboard();
        }
        await sendPhoto(chat_id, photo, text, keyboard);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Regular text message
    let keyboard = customKeyboard;
    if (!keyboard && include_app_button) {
      keyboard = isChannel
        ? { inline_keyboard: [[{ text: "🐝 Open Hive Earn", url: MINI_APP_STARTAPP_URL }]] }
        : getMainKeyboard();
    }
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
