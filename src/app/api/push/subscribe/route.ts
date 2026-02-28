import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint, keys, userAgent } = body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: "Missing subscription data" },
      { status: 400 }
    );
  }

  // Upsert the push subscription (update if same profile + endpoint)
  const { error: subError } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        profile_id: user.id,
        endpoint,
        p256dh_key: keys.p256dh,
        auth_key: keys.auth,
        user_agent: userAgent || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,endpoint" }
    );

  if (subError) {
    console.error("Push subscribe error:", subError);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }

  // Set push_enabled = true on profile
  await supabase
    .from("profiles")
    .update({ push_enabled: true })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
