export async function onRequestPost(context) {
  try {
    const { email, role } = await context.request.json();

    if (!email || !role) {
      return Response.json({ error: "Email and role are required" }, { status: 400 });
    }

    const key = email.toLowerCase().trim();
    const existing = await context.env.WAITLIST.get(key);

    if (existing) {
      return Response.json({ ok: true, message: "Already on the list" });
    }

    await context.env.WAITLIST.put(key, JSON.stringify({
      email: key,
      role,
      signed_up_at: new Date().toISOString(),
    }));

    return Response.json({ ok: true, message: "You're on the list" });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
