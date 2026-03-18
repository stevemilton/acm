import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFiservProvider } from "@/lib/fiserv";

export async function POST(request: Request) {
  const supabase = await createClient();
  const service = createServiceClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { offeringId, quantity } = body as {
    offeringId: string;
    quantity: number;
  };

  if (!offeringId || !quantity || quantity < 1) {
    return NextResponse.json(
      { error: "offeringId and quantity required" },
      { status: 400 }
    );
  }

  // Validate offering
  const { data: offering } = await supabase
    .from("offerings")
    .select("*")
    .eq("id", offeringId)
    .single();

  if (!offering) {
    return NextResponse.json(
      { error: "Offering not found" },
      { status: 404 }
    );
  }

  if (
    offering.escrow_status !== "pending" &&
    offering.escrow_status !== "funded"
  ) {
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

  const amount = quantity * Number(offering.price_per_share);

  // Initiate Fiserv tokenization
  try {
    const fiserv = getFiservProvider();
    const { setupUrl, sessionId } = await fiserv.tokenizeCard();

    // Create payment record via service role (RLS blocks client inserts)
    const { data: payment, error: paymentError } = await service
      .from("payments")
      .insert({
        offering_id: offeringId,
        investor_id: investor!.id,
        quantity,
        amount,
        currency: "USD",
        status: "pending",
        fiserv_session_id: sessionId,
      })
      .select("id")
      .single();

    if (paymentError) {
      return NextResponse.json(
        { error: paymentError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      paymentId: payment!.id,
      setupUrl,
      sessionId,
    });
  } catch (err) {
    console.error("[payments/tokenize] Fiserv error:", err);
    return NextResponse.json(
      { error: "Failed to initiate card entry" },
      { status: 502 }
    );
  }
}
