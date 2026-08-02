import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * AUTO-WITHDRAW PROCESSOR - Real BSC Transactions
 *
 * Uses ethers.js to send real USDT (BEP20) transactions on BSC
 *
 * Required Secrets (already configured):
 * - HOT_WALLET_ADDRESS: 0x082679f6cD88A25a17b58979AC72a500b1Aa1b9c
 * - HOT_WALLET_PRIVATE_KEY: 12-word mnemonic phrase
 * - BOT_TOKEN: Telegram bot token
 */

import { ethers } from "https://esm.sh/ethers@6.9.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// BSC Configuration
const BSC_RPC_URLS = [
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://bsc-dataseed3.binance.org/",
  "https://bsc-dataseed4.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
];

// USDT BEP20 Contract Address
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

// USDT ABI (only transfer function needed)
const USDT_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Minimum gas for BSC
const MIN_BNB_FOR_GAS = ethers.parseEther("0.0005"); // 0.0005 BNB
const GAS_LIMIT = 100000n;
const MAXGas_PRICE = ethers.parseUnits("20", "gwei");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const env = Deno.env.toObject();
    const { supabaseUrl, supabaseServiceKey } = env;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Import Supabase client
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.7");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Check request body for manual trigger
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const withdrawalId = body.withdrawal_id;

    // If specific withdrawal ID provided, process just that one
    if (withdrawalId) {
      const result = await processSingleWithdrawal(supabase, withdrawalId, env, supabaseUrl, supabaseServiceKey);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Otherwise, process all pending auto-withdrawals
    const { data: pendingWithdrawals, error: fetchError } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;

    if (!pendingWithdrawals || pendingWithdrawals.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending withdrawals" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;
    let failedCount = 0;
    const results: Array<{ id: string; status: string; txid?: string; error?: string }> = [];

    for (const wd of pendingWithdrawals) {
      const result = await processSingleWithdrawal(supabase, wd.id, env, supabaseUrl, supabaseServiceKey);
      results.push(result);
      if (result.status === "success") processedCount++;
      else failedCount++;
    }

    // Notify admin
    const adminChatId = env.ADMIN_CHAT_ID || "5419054691";
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-bot-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: `💳 <b>Auto-Withdraw Batch</b>\n\n✅ Processed: ${processedCount}\n❌ Failed: ${failedCount}\n\n${results.map(r => `${r.id.slice(0, 8)}: ${r.status}${r.txid ? ` (${r.txid.slice(0, 10)}...)` : ''}`).join('\n')}`,
          include_app_button: false,
        }),
      });
    } catch (e) {
      console.error("Failed to notify admin:", e);
    }

    return new Response(
      JSON.stringify({ success: true, processed: processedCount, failed: failedCount, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-auto-withdraw:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processSingleWithdrawal(
  supabase: any,
  withdrawalId: string,
  env: Record<string, string>,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ id: string; status: string; txid?: string; error?: string }> {
  // Get withdrawal details
  const { data: wd, error: wdError } = await supabase
    .from("withdrawals")
    .select("*, user:users!user_id(id, telegram_id, first_name, username, hive_balance)")
    .eq("id", withdrawalId)
    .maybeSingle();

  if (wdError || !wd) {
    return { id: withdrawalId, status: "failed", error: "Withdrawal not found" };
  }

  if (wd.status !== "pending") {
    return { id: withdrawalId, status: "skipped", error: "Already processed" };
  }

  try {
    // Get wallet credentials from secrets
    const hotWalletAddress = env.HOT_WALLET_ADDRESS;
    const hotWalletMnemonic = env.HOT_WALLET_PRIVATE_KEY;

    if (!hotWalletAddress || !hotWalletMnemonic) {
      throw new Error("Hot wallet credentials not configured");
    }

    // Connect to BSC
    const provider = await getBSCProvider();

    // Create wallet from mnemonic
    let wallet: ethers.HDNodeWallet;
    if (hotWalletMnemonic.includes(" ")) {
      // It's a 12/24 word mnemonic
      wallet = ethers.HDNodeWallet.fromPhrase(hotWalletMnemonic, undefined, "m/44'/60'/0'/0/0");
    } else {
      // It's a private key
      wallet = new ethers.Wallet(hotWalletMnemonic.startsWith("0x") ? hotWalletMnemonic : `0x${hotWalletMnemonic}`);
    }

    const connectedWallet = wallet.connect(provider);

    // Verify wallet address matches
    if (connectedWallet.address.toLowerCase() !== hotWalletAddress.toLowerCase()) {
      console.log(`Wallet address mismatch. Expected: ${hotWalletAddress}, Got: ${connectedWallet.address}`);
      // Try alternative derivation paths
      const altWallet = ethers.HDNodeWallet.fromPhrase(hotWalletMnemonic, undefined, "m/44'/60'/0'/0/0").connect(provider);
      console.log(`Alt path address: ${altWallet.address}`);
    }

    // Check BNB balance for gas
    const bnbBalance = await provider.getBalance(connectedWallet.address);
    if (bnbBalance < MIN_BNB_FOR_GAS) {
      throw new Error(`Insufficient BNB for gas. Have: ${ethers.formatEther(bnbBalance)} BNB, Need: 0.0005 BNB`);
    }

    // Get USDT contract
    const usdtContract = new ethers.Contract(USDT_CONTRACT, USDT_ABI, connectedWallet);
    const usdtDecimals = await usdtContract.decimals();

    // Check USDT balance
    const usdtBalance = await usdtContract.balanceOf(connectedWallet.address);
    const usdtNeeded = ethers.parseUnits(wd.net_amount.toString(), usdtDecimals);

    if (usdtBalance < usdtNeeded) {
      throw new Error(`Insufficient USDT. Have: ${ethers.formatUnits(usdtBalance, usdtDecimals)} USDT, Need: ${wd.net_amount} USDT`);
    }

    console.log(`Sending ${wd.net_amount} USDT from ${connectedWallet.address} to ${wd.wallet_address}`);

    // Send USDT transaction
    const tx = await usdtContract.transfer(wd.wallet_address, usdtNeeded, {
      gasLimit: GAS_LIMIT,
      maxFeePerGas: MAXGas_PRICE,
    });

    console.log(`Transaction sent: ${tx.hash}`);

    // Wait for 1 confirmation
    const receipt = await tx.wait(1);

    if (receipt.status !== 1) {
      throw new Error(`Transaction failed. Hash: ${tx.hash}`);
    }

    const txid = tx.hash;

    // Update withdrawal status
    const { error: updateError } = await supabase
      .from("withdrawals")
      .update({
        status: "approved",
        txid: txid,
        auto_txid: txid,
        payment_method: "auto",
        processed_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString()
      })
      .eq("id", withdrawalId);

    if (updateError) throw updateError;

    // Update total paid
    const { data: totalPaidSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "total_paid_usdt")
      .maybeSingle();

    const currentPaid = parseFloat(totalPaidSetting?.value || "0");
    await supabase
      .from("app_settings")
      .upsert({ key: "total_paid_usdt", value: String(currentPaid + wd.net_amount) });

    // Log admin action
    await supabase.from("admin_logs").insert({
      action: "auto_withdraw_sent",
      target_type: "withdrawal",
      target_id: withdrawalId,
      new_data: { txid, amount: wd.net_amount, wallet: wd.wallet_address }
    });

    // Get user info
    const user = wd.user;

    // Notify user
    if (user?.telegram_id) {
      await fetch(`${supabaseUrl}/functions/v1/send-bot-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({
          chat_id: user.telegram_id,
          text: `✅ <b>Payment Sent!</b>\n\n━━━━━━━━━━━━━━━\n💵 Amount: <b>${wd.net_amount.toFixed(6)} USDT</b>\n📤 ID: <code>${wd.withdraw_id || withdrawalId.slice(0, 8)}</code>\n━━━━━━━━━━━━━━━\n\n🔗 TXID: <code>${txid}</code>\n\n<a href="https://bscscan.com/tx/${txid}">📊 View on BSCScan</a>\n\n💰 Balance: ${user.hive_balance?.toFixed(2) || 0} 🍯 Hive`,
          include_app_button: true,
        }),
      });
    }

    // Post to payment channel
    const paymentChannel = "hiveearnpayment";
    await fetch(`${supabaseUrl}/functions/v1/send-bot-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        chat_id: `@${paymentChannel}`,
        text: `✅ <b>💸 Payment Sent</b>\n\n👤 User: ${user?.first_name || 'User'}${user?.username ? ` (@${user.username})` : ''}\n🆔 Telegram ID: <code>${user?.telegram_id || 'Unknown'}</code>\n💵 Amount: <b>${wd.net_amount.toFixed(6)} USDT</b>\n\n🔗 <a href="https://bscscan.com/tx/${txid}">View Transaction</a>`,
        payment_type: "approved",
        txid: txid,
      }),
    });

    // Notify admin
    const adminChatId = env.ADMIN_CHAT_ID || "5419054691";
    await fetch(`${supabaseUrl}/functions/v1/send-bot-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: `✅ <b>Auto-Payment Successful</b>\n\n${user?.first_name || 'User'} → ${wd.net_amount.toFixed(6)} USDT\nTXID: <code>${txid}</code>\n\n<a href="https://bscscan.com/tx/${txid}">View Transaction</a>`,
        include_app_button: false,
      }),
    });

    return { id: withdrawalId, status: "success", txid };
  } catch (error) {
    console.error(`Failed to process withdrawal ${withdrawalId}:`, error);

    // Mark as needs manual review
    await supabase
      .from("withdrawals")
      .update({
        status: "processing",
        admin_note: `Auto-withdraw failed: ${error}. Manual processing required.`
      })
      .eq("id", withdrawalId);

    // Notify admin of failure
    const adminChatId = env.ADMIN_CHAT_ID || "5419054691";
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-bot-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: `❌ <b>Auto-Payment Failed</b>\n\nID: ${withdrawalId.slice(0, 8)}\nError: ${error}\n\nManual processing required.`,
          include_app_button: false,
        }),
      });
    } catch (e) {
      console.error("Failed to notify admin:", e);
    }

    return { id: withdrawalId, status: "failed", error: String(error) };
  }
}

async function getBSCProvider(): Promise<ethers.JsonRpcProvider> {
  // Try multiple RPC endpoints for reliability
  for (const rpcUrl of BSC_RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      // Quick test
      await provider.getNetwork();
      console.log(`Connected to BSC via: ${rpcUrl}`);
      return provider;
    } catch (e) {
      console.log(`Failed to connect to ${rpcUrl}:`, e);
      continue;
    }
  }
  throw new Error("Failed to connect to any BSC RPC endpoint");
}
