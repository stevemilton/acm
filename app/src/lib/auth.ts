import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireOperator() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: operator } = await supabase
    .from("operators")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!operator) {
    // Auto-create operator profile if user signed up as operator
    const role = user.user_metadata?.role;
    if (role === "operator") {
      const { data: newOperator } = await supabase
        .from("operators")
        .insert({ user_id: user.id, kyc_status: "none" })
        .select()
        .single();
      return { user, operator: newOperator! };
    }
    redirect("/dashboard");
  }

  return { user, operator };
}

export async function requireInvestor() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: investor } = await supabase
    .from("investors")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!investor) {
    // Auto-create investor profile
    const { data: newInvestor } = await supabase
      .from("investors")
      .insert({ user_id: user.id, kyc_status: "none" } as never)
      .select()
      .single();
    return { user, investor: newInvestor! };
  }

  return { user, investor };
}
