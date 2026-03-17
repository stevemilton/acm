import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem, formatEther } from "viem";
import { bscTestnet } from "viem/chains";
import { createClient } from "@supabase/supabase-js";

/**
 * On-chain revenue monitor — watches FDUSD Transfer events to agent wallets.
 * Records incoming transfers as revenue_events in the database.
 *
 * POST /api/monitor/revenue  (called by cron or manually)
 */

const FDUSD_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

// How many blocks to scan per call (BSC testnet ~3s blocks, 1000 blocks ≈ 50 min)
const BLOCK_RANGE = BigInt(1000);

function checkAuth(request: Request): boolean {
  const secret = process.env.INDEXER_SECRET;
  if (!secret) return true;
  return request.headers.get("x-indexer-key") === secret;
}

function getViemClient() {
  return createPublicClient({
    chain: bscTestnet,
    transport: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
  });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getViemClient();
  const supabase = getSupabase();

  // Get FDUSD address from chain config
  const fdusdAddress = (
    process.env.NEXT_PUBLIC_CHAIN_ID === "56"
      ? "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409"
      : "0xAceB12E8E2F7126657E290BE382dA2926C1926FA"
  ) as `0x${string}`;

  // Get all agents with wallet addresses (operators who have wallets)
  const { data: agents, error: agentError } = await supabase
    .from("agents")
    .select("id, name, operator_id, operators!inner(wallet_address)")
    .not("operators.wallet_address", "is", null);

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  if (!agents || agents.length === 0) {
    return NextResponse.json({
      monitored: 0,
      message: "No agents with operator wallets",
    });
  }

  // Build a map of wallet → agent IDs (lowercase)
  const walletToAgents = new Map<string, string[]>();
  for (const agent of agents) {
    const op = agent.operators as unknown as { wallet_address: string };
    if (!op?.wallet_address) continue;
    const addr = op.wallet_address.toLowerCase();
    const existing = walletToAgents.get(addr) ?? [];
    existing.push(agent.id);
    walletToAgents.set(addr, existing);
  }

  const walletAddresses = [...walletToAgents.keys()];
  if (walletAddresses.length === 0) {
    return NextResponse.json({
      monitored: 0,
      message: "No operator wallets found",
    });
  }

  // Get last monitored block from indexer_state
  const monitorKey = "revenue_monitor_fdusd";
  const { data: state } = await supabase
    .from("indexer_state")
    .select("last_indexed_block")
    .eq("contract_address", monitorKey)
    .single();

  const latestBlock = await client.getBlockNumber();
  const fromBlock = state
    ? BigInt(state.last_indexed_block) + BigInt(1)
    : latestBlock - BLOCK_RANGE;

  // Cap scan range
  const toBlock =
    latestBlock - fromBlock > BLOCK_RANGE
      ? fromBlock + BLOCK_RANGE
      : latestBlock;

  if (fromBlock > latestBlock) {
    return NextResponse.json({ monitored: 0, message: "Already up to date" });
  }

  // Scan for FDUSD Transfer events TO any agent operator wallet
  let totalEvents = 0;
  const results: Array<{
    agent_id: string;
    from: string;
    amount: string;
    tx_hash: string;
  }> = [];

  try {
    const logs = await client.getLogs({
      address: fdusdAddress,
      event: FDUSD_TRANSFER_EVENT,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      const to = (log.args.to as string).toLowerCase();
      const agentIds = walletToAgents.get(to);
      if (!agentIds) continue;

      const amount = log.args.value as bigint;
      const from = log.args.from as string;

      // Skip zero-value transfers and self-transfers
      if (amount === BigInt(0)) continue;
      if (from.toLowerCase() === to) continue;

      // Skip known contract addresses (escrow deposits aren't revenue)
      // We check if the transfer is from an escrow contract
      const { data: isEscrow } = await supabase
        .from("offerings")
        .select("id")
        .eq("escrow_address", from.toLowerCase())
        .limit(1);

      if (isEscrow && isEscrow.length > 0) continue;

      for (const agentId of agentIds) {
        const { error: insertError } = await supabase
          .from("revenue_events")
          .insert({
            agent_id: agentId,
            source: "on_chain",
            amount: Number(formatEther(amount)),
            currency: "FDUSD",
            source_tx_id: log.transactionHash,
            verified: true,
            event_at: new Date().toISOString(),
          });

        if (insertError && insertError.code !== "23505") {
          console.error("Failed to insert revenue event:", insertError.message);
        } else {
          totalEvents++;
          results.push({
            agent_id: agentId,
            from,
            amount: formatEther(amount),
            tx_hash: log.transactionHash ?? "0x",
          });
        }
      }
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to scan logs",
        scanned_to: Number(toBlock),
      },
      { status: 500 }
    );
  }

  // Update indexer state
  const { data: existing } = await supabase
    .from("indexer_state")
    .select("id, event_count")
    .eq("contract_address", monitorKey)
    .single();

  if (existing) {
    await supabase
      .from("indexer_state")
      .update({
        last_indexed_block: Number(toBlock),
        last_indexed_at: new Date().toISOString(),
        event_count: existing.event_count + totalEvents,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("indexer_state").insert({
      contract_address: monitorKey,
      last_indexed_block: Number(toBlock),
      last_indexed_at: new Date().toISOString(),
      event_count: totalEvents,
    });
  }

  return NextResponse.json({
    monitored: totalEvents,
    wallets_watched: walletAddresses.length,
    block_range: { from: Number(fromBlock), to: Number(toBlock) },
    results,
  });
}
