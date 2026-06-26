import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "8969456125:AAFm5CQIhVWpTL6XQDhj-YoVDEojprQWHo4";
const MINI_APP_URL = Deno.env.get("MINI_APP_URL") ?? "https://t.me/Hiveearnbot/play";
const COMMUNITY_CHANNEL = "hiveearn";
const PAYMENT_CHANNEL = "hiveearnpayment";
const ADMIN_CHAT_ID = Deno.env.get("ADMIN_CHAT_ID") ?? "5419054691";

// Hive Earn banner photo file_id (uploaded to Telegram)
const BANNER_PHOTO_ID = "AgACAgQAAyEFAATnTbOFAANaajy2LjLlzvYEvlSUEAlUf0FyE_wAAuENaxs04i1Rt0TOjOZguwMBAAMCAAN5AAM8BA";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function tgSendMessage(chatId: string | number, text: string, includeAppButton = true) {
  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
  if (includeAppButton) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: "🐝 Open Hive Earn", web_app: { url: MINI_APP_URL } }]],
    };
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function tgSendPhoto(chatId: string | number, photoId: string, caption: string, includeAppButton = true) {
  const payload: Record<string, unknown> = { chat_id: chatId, photo: photoId, caption, parse_mode: "HTML" };
  if (includeAppButton) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: "🐝 Open Hive Earn", web_app: { url: MINI_APP_URL } }]],
    };
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
        `Minimum: 0.08 USDT | Network: BSC (BEP20)\n\n` +
        `Tap the button below to open the mini app and start earning! 🚀`;

      await tgSendPhoto(chatId, BANNER_PHOTO_ID, welcomeText, true);

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
