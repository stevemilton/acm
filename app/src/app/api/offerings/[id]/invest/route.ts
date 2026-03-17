import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: offeringId } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { quantity, rail } = body as {
    quantity: number;
    rail: "fiat" | "crypto";
  };

  if (!quantity || quantity < 1) {
    return NextResponse.json(
      { error: "Invalid quantity" },
      { status: 400 }
    );
  }

  if (!["fiat", "crypto"].includes(rail)) {
    return NextResponse.json({ error: "Invalid rail" }, { status: 400 });
  }

  // Get offering
  const { data: offering, error: offeringError } = await supabase
    .from("offerings")
    .select("*")
    .eq("id", offeringId)
    .single();

  if (offeringError || !offering) {
    return NextResponse.json(
      { error: "Offering not found" },
      { status: 404 }
    );
  }

  // Validate offering is open
  if (offering.escrow_status !== "pending" && offering.escrow_status !== "funded") {
    return NextResponse.json(
      { error: "Offering is not accepting investments" },
      { status: 400 }
    );
  }

  const sharesRemaining = offering.total_shares - offering.shares_sold;
  if (quantity > sharesRemaining) {
    return NextResponse.json(
      { error: `Only ${sharesRemaining} shares available` },
      { status: 400 }
    );
  }

  // Check deadline
  if (new Date(offering.ends_at) < new Date()) {
    return NextResponse.json(
      { error: "Offering has ended" },
      { status: 400 }
    );
  }

  // Get or create investor profile
  let { data: investor } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!investor) {
    const { data: newInvestor, error: invError } = await supabase
      .from("investors")
      .insert({ user_id: user.id, kyc_status: "none" })
      .select("id")
      .single();

    if (invError) {
      return NextResponse.json(
        { error: invError.message },
        { status: 500 }
      );
    }
    investor = newInvestor;
  }

  // Create share record
  const { data: share, error: shareError } = await supabase
    .from("shares")
    .insert({
      offering_id: offeringId,
      investor_id: investor!.id,
      quantity,
      purchase_price: offering.price_per_share,
      rail,
    })
    .select()
    .single();

  if (shareError) {
    return NextResponse.json(
      { error: shareError.message },
      { status: 500 }
    );
  }

  // Update shares_sold on offering (uses security definer to bypass RLS —
  // the authenticated user is the investor, not the operator who owns the offering)
  await supabase.rpc("increment_shares_sold", {
    offering_id: offeringId,
    quantity,
  });

  // Update investor total_invested
  const investedAmount = quantity * Number(offering.price_per_share);
  await supabase.rpc("increment_investor_invested", {
    investor_id: investor!.id,
    amount: investedAmount,
  });

  return NextResponse.json({ share, total_cost: investedAmount });
}
