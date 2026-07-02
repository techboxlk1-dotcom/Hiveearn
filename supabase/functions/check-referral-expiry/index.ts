import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { supabaseUrl, supabaseServiceKey } = Deno.env.toObject();

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find all pending referrals past their deadline (48 hours)
    const now = new Date().toISOString();
    const { data: expiredReferrals, error: fetchError } = await supabase
      .from("referrals")
      .select("id, referrer_id, referred_id, deadline_at, status, created_at")
      .eq("status", "pending")
      .lt("deadline_at", now);

    if (fetchError) throw fetchError;

    if (!expiredReferrals || expiredReferrals.length === 0) {
      return new Response(
        JSON.stringify({ success: true, expired: 0, message: "No expired referrals" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each expired referral
    let deactivatedCount = 0;
    let rewardsRemovedCount = 0;

    for (const ref of expiredReferrals) {
      // Mark referral as expired/not completed
      const { error: updateError } = await supabase
        .from("referrals")
        .update({
          status: "expired",
          expired_at: now,
          fake_reason: "Did not complete milestones within 48 hours"
        })
        .eq("id", ref.id);

      if (updateError) {
        console.error(`Failed to update referral ${ref.id}:`, updateError);
        continue;
      }

      deactivatedCount++;

      // Check if referrer had already received the initial 25 Hive reward
      // If so, we need to remove it from their unclaimed_referral_hive
      const { data: referrer } = await supabase
        .from("users")
        .select("unclaimed_referral_hive, telegram_id, first_name")
        .eq("id", ref.referrer_id)
        .maybeSingle();

      if (referrer && referrer.unclaimed_referral_hive > 0) {
        // Remove the 25 Hive initial reward (since referral didn't complete)
        // Only remove up to 25 Hive (the initial reward amount)
        const newUnclaimed = Math.max(0, referrer.unclaimed_referral_hive - 25);

        const { error: deductError } = await supabase
          .from("users")
          .update({ unclaimed_referral_hive: newUnclaimed })
          .eq("id", ref.referrer_id);

        if (!deductError) {
          rewardsRemovedCount++;

          // Try to send notification to referrer
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-bot-message`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                chat_id: referrer.telegram_id,
                text: `⚠️ <b>Referral Expired</b>\n\nYour referral did not complete the required milestones within 48 hours. The initial 25 Hive reward has been removed from your pending rewards.\n\nKeep sharing your referral link to earn more!`,
                include_app_button: true,
              }),
            });
          } catch (e) {
            console.error("Failed to send notification:", e);
          }
        }
      }
    }

    // Notify admin
    const ADMIN_CHAT_ID = "5419054691";
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-bot-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: `⏰ <b>Referral Expiry Check</b>\n\n${deactivatedCount} referrals marked as expired\n${rewardsRemovedCount} rewards removed\n\nCompleted at: ${new Date().toISOString()}`,
          include_app_button: false,
        }),
      });
    } catch (e) {
      console.error("Failed to notify admin:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired: deactivatedCount,
        rewardsRemoved: rewardsRemovedCount,
        message: `Deactivated ${deactivatedCount} expired referrals, removed ${rewardsRemovedCount} rewards`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-referral-expiry:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Inline Supabase client for edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
