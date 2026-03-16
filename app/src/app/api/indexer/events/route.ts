import { NextResponse } from "next/server";
import { createPublicClient, http, type PublicClient } from "viem";
import { bscTestnet } from "viem/chains";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ESCROW_EVENTS_ABI, REVENUE_EVENTS_ABI } from "@/lib/contracts";

// Combined ABIs for log parsing
const ESCROW_FULL_ABI = [...ESCROW_EVENTS_ABI] as const;
const REVENUE_FULL_ABI = [...REVENUE_EVENTS_ABI] as const;

function checkAuth(request: Request): boolean {
  const secret = process.env.INDEXER_SECRET;
  if (!secret) return true;
  const header = request.headers.get("x-indexer-key");
  return header === secret;
}

async function getLastIndexedBlock(supabase: SupabaseClient, contractAddress: string): Promise<bigint> {
  const { data } = await supabase
    .from("indexer_state")
    .select("last_indexed_block")
    .eq("contract_address", contractAddress.toLowerCase())
    .single();

  return BigInt(data?.last_indexed_block ?? 0);
}

async function updateIndexerState(
  supabase: SupabaseClient,
  contractAddress: string,
  blockNumber: bigint,
  newEventCount: number
): Promise<void> {
  const address = contractAddress.toLowerCase();

  const { data: existing } = await supabase
    .from("indexer_state")
    .select("id, event_count")
    .eq("contract_address", address)
    .single();

  if (existing) {
    await supabase
      .from("indexer_state")
      .update({
        last_indexed_block: Number(blockNumber),
        last_indexed_at: new Date().toISOString(),
        event_count: existing.event_count + newEventCount,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("indexer_state").insert({
      contract_address: address,
      last_indexed_block: Number(blockNumber),
      last_indexed_at: new Date().toISOString(),
      event_count: newEventCount,
    });
  }
}

async function storeEvent(supabase: SupabaseClient, event: {
  contract_address: string;
  event_name: string;
  block_number: bigint;
  tx_hash: string;
  log_index: number;
  args: Record<string, unknown>;
}): Promise<boolean> {
  const { error } = await supabase.from("on_chain_events").insert({
    contract_address: event.contract_address.toLowerCase(),
    event_name: event.event_name,
    block_number: Number(event.block_number),
    tx_hash: event.tx_hash,
    log_index: event.log_index,
    args: serializeArgs(event.args),
    processed: false,
  });

  // Ignore unique constraint violations (duplicate tx_hash)
  if (error && error.code !== "23505") {
    console.error("Failed to store event:", error.message);
    return false;
  }
  return true;
}

/** Convert BigInt values to strings for JSON storage */
function serializeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    serialized[key] = typeof value === "bigint" ? value.toString() : value;
  }
  return serialized;
}

async function processEscrowEvents(
  viemClient: PublicClient,
  supabase: SupabaseClient,
  escrowAddress: `0x${string}`,
  offeringId: string
): Promise<{ indexed: number; highestBlock: bigint }> {
  const fromBlock = (await getLastIndexedBlock(supabase, escrowAddress)) + BigInt(1);
  const latestBlock = await viemClient.getBlockNumber();

  if (fromBlock > latestBlock) {
    return { indexed: 0, highestBlock: latestBlock };
  }

  const logs = await viemClient.getContractEvents({
    address: escrowAddress,
    abi: ESCROW_FULL_ABI,
    fromBlock,
    toBlock: latestBlock,
  });

  let indexed = 0;
  let highestBlock = fromBlock - BigInt(1);

  for (const log of logs) {
    if (log.blockNumber && log.blockNumber > highestBlock) {
      highestBlock = log.blockNumber;
    }

    const stored = await storeEvent(supabase, {
      contract_address: escrowAddress,
      event_name: log.eventName,
      block_number: log.blockNumber ?? BigInt(0),
      tx_hash: log.transactionHash ?? "0x",
      log_index: log.logIndex ?? 0,
      args: (log.args ?? {}) as Record<string, unknown>,
    });

    if (stored) indexed++;

    // Process side effects
    if (log.eventName === "Deposited") {
      const args = log.args as { investor: string; amount: bigint; shares: bigint };
      await supabase.from("shares").upsert(
        {
          offering_id: offeringId,
          investor_address: args.investor.toLowerCase(),
          quantity: Number(args.shares / BigInt(1e18)),
          purchase_amount: Number(args.amount / BigInt(1e18)),
          rail: "crypto",
          tx_hash: log.transactionHash,
        },
        { onConflict: "offering_id,investor_address" }
      );
    } else if (log.eventName === "Released") {
      await supabase
        .from("offerings")
        .update({ escrow_status: "funded" })
        .eq("id", offeringId);
    }
  }

  if (indexed > 0) {
    await updateIndexerState(supabase, escrowAddress, highestBlock, indexed);
  }

  return { indexed, highestBlock };
}

async function processRevenueEvents(
  viemClient: PublicClient,
  supabase: SupabaseClient,
  distributorAddress: `0x${string}`,
  agentId: string
): Promise<{ indexed: number; highestBlock: bigint }> {
  const fromBlock = (await getLastIndexedBlock(supabase, distributorAddress)) + BigInt(1);
  const latestBlock = await viemClient.getBlockNumber();

  if (fromBlock > latestBlock) {
    return { indexed: 0, highestBlock: latestBlock };
  }

  const logs = await viemClient.getContractEvents({
    address: distributorAddress,
    abi: REVENUE_FULL_ABI,
    fromBlock,
    toBlock: latestBlock,
  });

  let indexed = 0;
  let highestBlock = fromBlock - BigInt(1);

  for (const log of logs) {
    if (log.blockNumber && log.blockNumber > highestBlock) {
      highestBlock = log.blockNumber;
    }

    const stored = await storeEvent(supabase, {
      contract_address: distributorAddress,
      event_name: log.eventName,
      block_number: log.blockNumber ?? BigInt(0),
      tx_hash: log.transactionHash ?? "0x",
      log_index: log.logIndex ?? 0,
      args: (log.args ?? {}) as Record<string, unknown>,
    });

    if (stored) indexed++;

    // Process side effects
    if (log.eventName === "RevenueReceived") {
      const args = log.args as {
        gross: bigint;
        platformFee: bigint;
        operatorAmount: bigint;
        investorAmount: bigint;
      };
      await supabase.from("distributions").insert({
        agent_id: agentId,
        gross_revenue: Number(args.gross / BigInt(1e18)),
        platform_fee: Number(args.platformFee / BigInt(1e18)),
        operator_amount: Number(args.operatorAmount / BigInt(1e18)),
        investor_amount: Number(args.investorAmount / BigInt(1e18)),
        tx_hash: log.transactionHash,
        rail: "crypto",
      });
    }
  }

  if (indexed > 0) {
    await updateIndexerState(supabase, distributorAddress, highestBlock, indexed);
  }

  return { indexed, highestBlock };
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viemClient = createPublicClient({
    chain: bscTestnet,
    transport: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: offerings, error: fetchError } = await supabase
    .from("offerings")
    .select("id, agent_id, escrow_address, share_token_address, distributor_address")
    .not("escrow_address", "is", null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!offerings || offerings.length === 0) {
    return NextResponse.json({
      indexed: 0,
      message: "No offerings with contract addresses",
    });
  }

  const summary: Array<{
    offering_id: string;
    escrow_events: number;
    revenue_events: number;
    error?: string;
  }> = [];

  for (const offering of offerings) {
    try {
      let escrowEvents = 0;
      let revenueEvents = 0;

      if (offering.escrow_address) {
        const result = await processEscrowEvents(
          viemClient,
          supabase,
          offering.escrow_address as `0x${string}`,
          offering.id
        );
        escrowEvents = result.indexed;
      }

      if (offering.distributor_address) {
        const result = await processRevenueEvents(
          viemClient,
          supabase,
          offering.distributor_address as `0x${string}`,
          offering.agent_id
        );
        revenueEvents = result.indexed;
      }

      summary.push({
        offering_id: offering.id,
        escrow_events: escrowEvents,
        revenue_events: revenueEvents,
      });
    } catch (err) {
      summary.push({
        offering_id: offering.id,
        escrow_events: 0,
        revenue_events: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const totalIndexed = summary.reduce(
    (acc, s) => acc + s.escrow_events + s.revenue_events,
    0
  );

  return NextResponse.json({
    indexed: totalIndexed,
    offerings_processed: summary.length,
    errors: summary.filter((s) => s.error).length,
    summary,
  });
}
