import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const MINI_APP_URL = Deno.env.get("MINI_APP_URL") ?? "https://t.me/Hiveearnbot/play";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function getReminderKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🐝 Open Hive Earn", web_app: { url: MINI_APP_URL } }],
    ],
  };
}

const reminderMessages = [
  "🐝 <b>Don't forget to earn your Hive today!</b>\n\n📺 Watch ads\n🎁 Claim daily bonus\n✅ Complete tasks\n\nYour Hive balance is waiting! Tap below to open the app.",
  "🍯 <b>Your Hive tokens are waiting!</b>\n\nCome back and earn more Hive by:\n📺 Watching ads\n👥 Referring friends\n🎁 Daily bonus\n\nKeep your streak alive!",
  "🚀 <b>Ready to earn more?</b>\n\nNew ads and tasks are available!\nDon't miss out on your daily bonus.\n\nOpen the app below!",
  "💰 <b>Earn while you sleep? Almost!</b>\n\nJust a few taps a day keeps the Hive growing.\nWatch ads, do tasks, claim bonus.\n\nOpen the app below!",
  "🐝 <b>Hive Earn Reminder</b>\n\nYour friends are earning right now!\nDon't miss today's rewards.\n\n📺 Watch ads\n🎁 Daily bonus\n✅ Tasks\n\nTap below to start earning!",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Check if daily reminders are enabled
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "daily_reminder_enabled")
      .maybeSingle();

    if (setting?.value !== "true") {
      return new Response(JSON.stringify({ ok: true, message: "Daily reminders disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get reminder interval (default 4 hours)
    const { data: intervalSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "daily_reminder_interval_hours")
      .maybeSingle();

    const intervalHours = parseInt(intervalSetting?.value ?? "4");
    const cutoff = new Date(Date.now() - intervalHours * 60 * 60 * 1000).toISOString();

    // Get users who haven't received a reminder in the last interval hours
    // Send to ALL users including suspended (user requested this)
    const { data: users, error } = await supabase
      .from("users")
      .select("id, telegram_id, last_reminder_at, is_suspended, is_admin")
      .or(`last_reminder_at.is.null,last_reminder_at.lt.${cutoff}`)
      .limit(100);

    if (error || !users || users.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No users to remind" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    // Send reminders in batches of 25
    for (let i = 0; i < users.length; i += 25) {
      const batch = users.slice(i, i + 25);
      await Promise.all(batch.map(async (u) => {
        try {
          const msg = reminderMessages[Math.floor(Math.random() * reminderMessages.length)];
          const payload = {
            chat_id: u.telegram_id,
            text: msg,
            parse_mode: "HTML",
            reply_markup: getReminderKeyboard(),
          };

          const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (data.ok) {
            sent++;
            // Update last_reminder_at
            await supabase
              .from("users")
              .update({ last_reminder_at: new Date().toISOString() })
              .eq("id", u.id);
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }));

      if (i + 25 < users.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
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
