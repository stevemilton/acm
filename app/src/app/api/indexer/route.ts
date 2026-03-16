import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { bscTestnet } from "viem/chains";
import { createClient } from "@supabase/supabase-js";
import { ESCROW_ABI, AGENT_SHARE_ABI } from "@/lib/contracts";

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

const STATUS_MAP: Record<number, string> = {
  0: "pending",
  1: "funded",
  2: "refunding",
};

function checkAuth(request: Request): boolean {
  const secret = process.env.INDEXER_SECRET;
  if (!secret) return true; // Allow in development
  const header = request.headers.get("x-indexer-key");
  return header === secret;
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getViemClient();
  const supabase = getSupabase();

  const { data: offerings, error: fetchError } = await supabase
    .from("offerings")
    .select("id, escrow_address, share_token_address, agent_id")
    .not("escrow_address", "is", null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!offerings || offerings.length === 0) {
    return NextResponse.json({ synced: 0, message: "No offerings with escrow addresses" });
  }

  const results: Array<{
    offering_id: string;
    status: string;
    shares_sold: number;
    total_raised: string;
    error?: string;
  }> = [];

  for (const offering of offerings) {
    try {
      const escrowAddress = offering.escrow_address as `0x${string}`;
      const shareTokenAddress = offering.share_token_address as `0x${string}`;

      // Read escrow state
      const [statusRaw, totalRaised] = await Promise.all([
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "status",
        }),
        client.readContract({
          address: escrowAddress,
          abi: ESCROW_ABI,
          functionName: "totalRaised",
        }),
      ]);

      const escrowStatus = STATUS_MAP[Number(statusRaw)] ?? "unknown";

      // Read share token state
      let sharesSold = 0;
      if (shareTokenAddress) {
        const [totalSupply, escrowBalance] = await Promise.all([
          client.readContract({
            address: shareTokenAddress,
            abi: AGENT_SHARE_ABI,
            functionName: "totalSupply",
          }),
          client.readContract({
            address: shareTokenAddress,
            abi: AGENT_SHARE_ABI,
            functionName: "balanceOf",
            args: [shareTokenAddress], // Shares held by the token contract itself (unsold)
          }),
        ]);

        // Shares that have left the contract = totalSupply - balanceOf(shareToken)
        sharesSold = Number((totalSupply - escrowBalance) / BigInt(1e18));
      }

      // Update offering in Supabase
      const { error: updateError } = await supabase
        .from("offerings")
        .update({
          shares_sold: sharesSold,
          escrow_status: escrowStatus,
        })
        .eq("id", offering.id);

      if (updateError) {
        results.push({
          offering_id: offering.id,
          status: "error",
          shares_sold: sharesSold,
          total_raised: totalRaised.toString(),
          error: updateError.message,
        });
      } else {
        results.push({
          offering_id: offering.id,
          status: escrowStatus,
          shares_sold: sharesSold,
          total_raised: totalRaised.toString(),
        });
      }
    } catch (err) {
      results.push({
        offering_id: offering.id,
        status: "error",
        shares_sold: 0,
        total_raised: "0",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    synced: results.filter((r) => !r.error).length,
    errors: results.filter((r) => r.error).length,
    results,
  });
}
