import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAdminAlert } from "@/lib/admin-alerts";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if this is a new registration (pending_approval status)
      // and send admin alert if so
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, status")
            .eq("id", user.id)
            .single();

          if (profile?.status === "pending_approval") {
            // Get all active events to notify their admins
            const { data: events } = await supabase
              .from("events")
              .select("id, name")
              .eq("is_active", true);

            for (const event of events || []) {
              sendAdminAlert("new_registration", {
                eventId: event.id,
                eventName: event.name,
                golferName: `${profile.first_name} ${profile.last_name}`,
                golferEmail: profile.email,
              }).catch((err) =>
                console.error("New registration alert error:", err)
              );
            }
          }
        }
      } catch (alertErr) {
        // Don't block auth flow for alert failures
        console.error("Alert check error:", alertErr);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    // Code exchange failed — most likely the magic link was opened
    // in a different browser (e.g., email app's in-app browser)
    console.error("Code exchange failed:", error);
    return NextResponse.redirect(
      `${origin}/auth/link-error`
    );
  }

  // No code parameter at all
  return NextResponse.redirect(`${origin}/?error=auth`);
}
