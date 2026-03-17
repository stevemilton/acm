import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { escrow_address, share_token_address, distributor_address, factory_offering_id } = body;

  if (!escrow_address || !share_token_address || !distributor_address) {
    return NextResponse.json(
      { error: "Missing contract addresses" },
      { status: 400 }
    );
  }

  // Validate Ethereum address format
  if (!isAddress(escrow_address) || !isAddress(share_token_address) || !isAddress(distributor_address)) {
    return NextResponse.json(
      { error: "Invalid contract address format" },
      { status: 400 }
    );
  }

  // Verify the user owns this offering via operator → agent → offering chain
  const { data: operator } = await supabase
    .from("operators")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!operator) {
    return NextResponse.json({ error: "Not an operator" }, { status: 403 });
  }

  const { data: offering } = await supabase
    .from("offerings")
    .select("id, agent_id, agents!inner(operator_id)")
    .eq("id", id)
    .single();

  if (!offering) {
    return NextResponse.json({ error: "Offering not found" }, { status: 404 });
  }

  const agentData = offering.agents as unknown as { operator_id: string };
  if (agentData.operator_id !== operator.id) {
    return NextResponse.json({ error: "Not your offering" }, { status: 403 });
  }

  // Update offering with contract addresses
  const { error: updateError } = await supabase
    .from("offerings")
    .update({
      escrow_address,
      share_token_address,
      distributor_address,
      factory_offering_id: factory_offering_id ?? null,
      escrow_status: "active",
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
