import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "8969456125:AAFm5CQIhVWpTL6XQDhj-YoVDEojprQWHo4";
const MINI_APP_URL = Deno.env.get("MINI_APP_URL") ?? "https://t.me/Hiveearnbot/play";
const COMMUNITY_CHANNEL = Deno.env.get("COMMUNITY_CHANNEL") ?? "hiveearn";
const PAYMENT_CHANNEL = Deno.env.get("PAYMENT_CHANNEL") ?? "hiveearnpayment";
const ADMIN_CHAT_ID = Deno.env.get("ADMIN_CHAT_ID") ?? "5419054691";
// New banner: either a Telegram file_id or a public URL to the image
const BANNER_PHOTO = Deno.env.get("BANNER_PHOTO") ?? "https://t.me/Hiveearnbot/play"; // set to file_id or URL of new banner
const APP_URL = Deno.env.get("APP_URL") ?? "";

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

async function tgSendMessage(chatId: string | number, text: string, includeAppButton = true, customKeyboard?: unknown) {
  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
  if (includeAppButton) {
    payload.reply_markup = customKeyboard ?? getMainKeyboard();
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function tgSendPhoto(chatId: string | number, caption: string, includeAppButton = true, customKeyboard?: unknown) {
  // Use banner photo: if APP_URL is set, use the image from public folder, else use BANNER_PHOTO (file_id or URL)
  const photoSource = APP_URL
    ? `${APP_URL}/IMG-20260624-WA0001.jpg`
    : BANNER_PHOTO;

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoSource,
    caption,
    parse_mode: "HTML",
  };

  if (includeAppButton) {
    payload.reply_markup = customKeyboard ?? getMainKeyboard();
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  // If photo fails, fall back to text message
  if (!data.ok) {
    await tgSendMessage(chatId, caption, includeAppButton, customKeyboard);
  }
}

async function tgSendPhotoToChannel(channel: string, caption: string, photoUrl: string, buttonName?: string, buttonUrl?: string) {
  const keyboard = buttonName && buttonUrl
    ? { inline_keyboard: [[{ text: buttonName, url: buttonUrl }]] }
    : undefined;

  const payload: Record<string, unknown> = {
    chat_id: `@${channel}`,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
  };
  if (keyboard) payload.reply_markup = keyboard;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function tgSendMessageToChannel(channel: string, text: string, buttonName?: string, buttonUrl?: string) {
  const keyboard = buttonName && buttonUrl
    ? { inline_keyboard: [[{ text: buttonName, url: buttonUrl }]] }
    : { inline_keyboard: [[{ text: "🐝 Open Hive Earn", web_app: { url: MINI_APP_URL } }]] };

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: `@${channel}`, text, parse_mode: "HTML", reply_markup: keyboard }),
  });
}

async function checkChannelMembership(userId: number, channel: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=@${channel}&user_id=${userId}`);
    const data = await res.json();
    if (!data.ok) return false;
    const status = data.result.status;
    return status === "member" || status === "administrator" || status === "creator";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const update = await req.json();

    // Handle /start command
    if (update.message?.text?.startsWith("/start")) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const firstName = update.message.from.first_name ?? "Friend";
      const username = update.message.from.username;
      const startPayload = update.message.text.replace("/start", "").trim();

      const welcomeText =
        `🐝 <b>Welcome to Hive Earn, ${firstName}!</b>\n\n` +
        `<b>What is Hive Earn?</b>\n` +
        `Hive Earn is a Telegram mini app where you earn <b>🍯 Hive tokens</b> by watching ads, completing tasks, claiming daily bonuses, and inviting friends. Hive tokens can be withdrawn as <b>USDT (BEP20)</b> to your wallet.\n\n` +
        `<b>How to earn:</b>\n` +
        `📺 Watch ads — earn Hive per ad\n` +
        `✅ Complete tasks — social media tasks with rewards\n` +
        `🎁 Daily bonus — claim every 24 hours\n` +
        `⚡ Reward codes — redeem codes for bonus Hive\n` +
        `👥 Refer friends — earn up to 150 🍯 Hive per referral + 5% commission\n\n` +
        `<b>Withdrawal:</b>\n` +
        `Minimum: $0.08 USDT | Network: BSC (BEP20)\n\n` +
        `Tap the button below to open the mini app and start earning! 🚀`;

      await tgSendPhoto(chatId, welcomeText, true);

      // Notify admin
      await tgSendMessage(
        ADMIN_CHAT_ID,
        `👤 <b>New User Started Bot</b>\n\nName: ${firstName}${username ? ` (@${username})` : ""}\nTelegram ID: <code>${userId}</code>${startPayload ? `\nReferral code: <code>${startPayload}</code>` : ""}`,
        false
      );

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle /help command
    if (update.message?.text === "/help") {
      const chatId = update.message.chat.id;
      await tgSendMessage(
        chatId,
        `🐝 <b>Hive Earn Help</b>\n\n` +
        `<b>Commands:</b>\n` +
        `/start — Open Hive Earn mini app\n` +
        `/help — Show this help message\n\n` +
        `<b>Earn Hive by:</b>\n` +
        `📺 Watching ads\n✅ Completing tasks\n🎁 Daily bonus\n⚡ Reward codes\n👥 Referring friends\n\n` +
        `<b>Support:</b> @hiveearn\n` +
        `<b>Community:</b> @${COMMUNITY_CHANNEL}\n` +
        `<b>Payments:</b> @${PAYMENT_CHANNEL}`,
        true
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle broadcast with photo (called from admin panel via edge function invoke)
    if (update.type === "broadcast_photo") {
      const { chat_ids, caption, photo_url, button_name, button_url, send_to_channel } = update;
      let sent = 0, failed = 0;

      const keyboard = button_name && button_url
        ? { inline_keyboard: [[{ text: button_name, url: button_url }], [{ text: "🐝 Open Hive Earn", web_app: { url: MINI_APP_URL } }]] }
        : getMainKeyboard();

      for (let i = 0; i < (chat_ids ?? []).length; i += 25) {
        const batch = chat_ids.slice(i, i + 25);
        await Promise.all(batch.map(async (cid: number) => {
          try {
            const p: Record<string, unknown> = { chat_id: cid, caption, parse_mode: "HTML", reply_markup: keyboard };
            if (photo_url) p.photo = photo_url;
            const endpoint = photo_url ? "sendPhoto" : "sendMessage";
            if (!photo_url) {
              p.text = caption;
              delete p.caption;
            }
            const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(p),
            });
            const d = await r.json();
            if (d.ok) sent++; else failed++;
          } catch { failed++; }
        }));
        if (i + 25 < (chat_ids ?? []).length) await new Promise(r => setTimeout(r, 500));
      }

      // Send to community channel if requested
      if (send_to_channel) {
        try {
          if (photo_url) {
            await tgSendPhotoToChannel(COMMUNITY_CHANNEL, caption, photo_url, button_name, button_url);
          } else {
            await tgSendMessageToChannel(COMMUNITY_CHANNEL, caption, button_name, button_url);
          }
        } catch { /* ignore channel errors */ }
      }

      return new Response(JSON.stringify({ ok: true, sent, failed }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle callback queries
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;

      if (callbackData === "check_membership") {
        const userId = update.callback_query.from.id;
        const isMember = await checkChannelMembership(userId, COMMUNITY_CHANNEL);
        if (isMember) {
          await tgSendMessage(chatId, "✅ <b>Membership confirmed!</b>\n\nYou have joined the community channel. Go back to the mini app to verify your task.", true);
        } else {
          await tgSendMessage(chatId, `❌ <b>Not joined yet</b>\n\nPlease join our community channel first:\n\n👉 https://t.me/${COMMUNITY_CHANNEL}\n\nThen click the button below to check again.`, true);
        }
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
