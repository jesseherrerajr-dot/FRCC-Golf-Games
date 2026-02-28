import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint } = body as { endpoint: string };

  if (!endpoint) {
    return NextResponse.json(
      { error: "Missing endpoint" },
      { status: 400 }
    );
  }

  // Remove the specific subscription
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("profile_id", user.id)
    .eq("endpoint", endpoint);

  // Check if user has any remaining subscriptions
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  // If no subs remain, set push_enabled = false
  if (!count || count === 0) {
    await supabase
      .from("profiles")
      .update({ push_enabled: false })
      .eq("id", user.id);
  }

  return NextResponse.json({ ok: true });
}
