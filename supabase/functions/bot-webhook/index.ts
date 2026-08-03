import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const MINI_APP_URL = Deno.env.get("MINI_APP_URL") ?? "https://t.me/Hiveearnbot/play";
const COMMUNITY_CHANNEL = "hiveearn";
const PAYMENT_CHANNEL = "hiveearnpayment";
const ADMIN_CHAT_ID = Deno.env.get("ADMIN_CHAT_ID") ?? "5419054691";
const BANNER_PHOTO = Deno.env.get("BANNER_PHOTO") ?? "https://t.me/Hiveearnbot/play";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

function getReminderKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🐝 Open Hive Earn", web_app: { url: MINI_APP_URL } }],
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
  const photoSource = APP_URL ? `${APP_URL}/IMG-20260624-WA0001.jpg` : BANNER_PHOTO;

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

  if (!data.ok) {
    await tgSendMessage(chatId, caption, includeAppButton, customKeyboard);
  }
}

async function tgSendPhotoToChannel(channel: string, caption: string, photoUrl: string, buttonName?: string, buttonUrl?: string) {
  // Channels do NOT support web_app buttons — only url buttons
  const keyboard = buttonName && buttonUrl
    ? { inline_keyboard: [[{ text: buttonName, url: buttonUrl }]] }
    : { inline_keyboard: [[{ text: "🐝 Open Hive Earn", url: MINI_APP_URL }]] };

  const payload: Record<string, unknown> = {
    chat_id: `@${channel}`,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
    reply_markup: keyboard,
  };

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) console.error(`Channel photo send failed for @${channel}:`, data.description);
  return data;
}

async function tgSendMessageToChannel(channel: string, text: string, buttonName?: string, buttonUrl?: string) {
  // Channels do NOT support web_app buttons — only url buttons
  const keyboard = buttonName && buttonUrl
    ? { inline_keyboard: [[{ text: buttonName, url: buttonUrl }]] }
    : { inline_keyboard: [[{ text: "🐝 Open Hive Earn", url: MINI_APP_URL }]] };

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: `@${channel}`, text, parse_mode: "HTML", reply_markup: keyboard }),
  });
  const data = await res.json();
  if (!data.ok) console.error(`Channel send failed for @${channel}:`, data.description);
  return data;
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

// Fetch ALL user telegram_ids from the database, paginating through every page.
// Supabase defaults to 1000 rows per request, so we must loop until exhausted.
async function getAllUserTelegramIds(): Promise<number[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return [];
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const allIds: number[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("users")
      .select("telegram_id")
      .neq("telegram_id", 999999999) // exclude guest accounts
      .range(offset, offset + pageSize - 1);

    if (error || !data || data.length === 0) break;
    allIds.push(...data.map(u => u.telegram_id));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return allIds;
}

const reminderMessages = [
  "🐝 <b>Don't forget to earn your Hive today!</b>\n\n📺 Watch ads\n🎁 Claim daily bonus\n✅ Complete tasks\n\nYour Hive balance is waiting! Tap below to open the app.",
  "🍯 <b>Your Hive tokens are waiting!</b>\n\nCome back and earn more Hive by:\n📺 Watching ads\n👥 Referring friends\n🎁 Daily bonus\n\nKeep your streak alive!",
  "🚀 <b>Ready to earn more?</b>\n\nNew ads and tasks are available!\nDon't miss out on your daily bonus.\n\nTap to open Hive Earn now!",
  "💰 <b>Earn while you sleep? Almost!</b>\n\nJust a few taps a day keeps the Hive growing.\nWatch ads, do tasks, claim bonus.\n\nOpen the app below!",
  "🐝 <b>Hive Earn Reminder</b>\n\nYour friends are earning right now!\nDon't miss today's rewards.\n\n📺 Watch ads\n🎁 Daily bonus\n✅ Tasks\n\nTap below to start earning!",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // GET requests — allow setting webhook via URL
  if (req.method === "GET") {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action === "set_webhook") {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/bot-webhook`;
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
      });
      const data = await res.json();
      return new Response(JSON.stringify({ ok: data.ok, webhookUrl, result: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "get_webhook_info") {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, message: "Bot webhook is running. Use ?action=set_webhook to register." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        `Hive Earn is a Telegram mini app where you earn <b>🍯 Hive tokens</b> by watching ads, mining, completing tasks, claiming daily bonuses, and inviting friends. Hive tokens can be withdrawn as <b>USDT (BEP20)</b> to your wallet.\n\n` +
        `<b>How to earn Hive:</b>\n` +
        `📺 Watch ads — earn Hive per ad (Earn tab)\n` +
        `⛏️ Mining — start mining for +20 Hive/hour\n` +
        `✅ Complete tasks — social media tasks with rewards\n` +
        `🎁 Daily bonus — claim every 24 hours\n` +
        `⚡ Reward codes — redeem codes for bonus Hive\n` +
        `👥 Refer friends — earn up to 150 🍯 Hive per referral + 5% commission\n\n` +
        `<b>Baby Hive & Giveaways:</b>\n` +
        `🍼 Earn Baby Hive by watching ads in the Giveaway tab\n` +
        `🎁 Use Baby Hive to join giveaways and win real Hive tokens\n\n` +
        `<b>Withdrawal:</b>\n` +
        `Minimum: $0.08 USDT | Network: BSC (BEP20)\n\n` +
        `Tap the button below to open the mini app and start earning! 🚀`;

      await tgSendPhoto(chatId, welcomeText, true);

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
        `📺 Watching ads (Earn tab)\n⛏️ Mining — +20 Hive/hour\n✅ Completing tasks\n🎁 Daily bonus\n⚡ Reward codes\n👥 Referring friends (150 Hive + 5% commission)\n\n` +
        `<b>Baby Hive & Giveaways:</b>\n` +
        `🍼 Watch ads in Giveaway tab to earn Baby Hive\n` +
        `🎁 Use Baby Hive to join giveaways and win Hive\n\n` +
        `<b>Withdrawal:</b>\n` +
        `Minimum: $0.08 USDT | Network: BSC (BEP20)\n\n` +
        `<b>Support:</b> @hiveearnsupport\n` +
        `<b>Community:</b> @${COMMUNITY_CHANNEL}\n` +
        `<b>Payments:</b> @${PAYMENT_CHANNEL}`,
        true
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle broadcast with photo — fetch ALL users from DB (not client-supplied list)
    if (update.type === "broadcast_photo") {
      const { caption, photo_url, button_name, button_url, send_to_channel } = update;

      // Fetch all user telegram IDs directly from the database
      const allChatIds = await getAllUserTelegramIds();

      let sent = 0, failed = 0;

      const keyboard = button_name && button_url
        ? { inline_keyboard: [[{ text: button_name, url: button_url }], [{ text: "🐝 Open Hive Earn", web_app: { url: MINI_APP_URL } }]] }
        : getMainKeyboard();

      // Send in batches of 25 to respect Telegram rate limits (~30 msg/sec)
      for (let i = 0; i < allChatIds.length; i += 25) {
        const batch = allChatIds.slice(i, i + 25);
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
        // 500ms delay between batches to avoid rate limiting
        if (i + 25 < allChatIds.length) await new Promise(r => setTimeout(r, 500));
      }

      // Post to community channel if requested
      if (send_to_channel) {
        try {
          if (photo_url) {
            await tgSendPhotoToChannel(COMMUNITY_CHANNEL, caption, photo_url, button_name, button_url);
          } else {
            await tgSendMessageToChannel(COMMUNITY_CHANNEL, caption, button_name, button_url);
          }
        } catch { /* ignore channel errors */ }
      }

      return new Response(JSON.stringify({ ok: true, sent, failed, total: allChatIds.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle daily reminder
    if (update.type === "daily_reminder") {
      const { chat_id } = update;
      if (!chat_id) {
        return new Response(JSON.stringify({ error: "chat_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const msg = reminderMessages[Math.floor(Math.random() * reminderMessages.length)];
      await tgSendPhoto(chat_id, msg, true, getReminderKeyboard());

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle broadcast to community channel only
    if (update.type === "broadcast_to_channel") {
      const { caption, photo_url, button_name, button_url } = update;
      try {
        if (photo_url) {
          await tgSendPhotoToChannel(COMMUNITY_CHANNEL, caption, photo_url, button_name, button_url);
        } else {
          await tgSendMessageToChannel(COMMUNITY_CHANNEL, caption, button_name, button_url);
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch {
        return new Response(JSON.stringify({ ok: false, error: "Failed to post to channel" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Set webhook URL with Telegram
    if (update.type === "set_webhook") {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/bot-webhook`;
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
      });
      const data = await res.json();
      return new Response(JSON.stringify({ ok: data.ok, webhookUrl, result: data }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get webhook info from Telegram
    if (update.type === "get_webhook_info") {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
