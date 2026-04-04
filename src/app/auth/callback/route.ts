import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAdminAlert } from "@/lib/admin-alerts";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Log login event and check for new registrations
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Log the login
        if (user) {
          await supabase.from("activity_log").insert({
            profile_id: user.id,
            activity_type: "login",
            metadata: { method: "magic_link" },
          }); // Best-effort — don't block auth for logging failures
        }
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, status, registration_event_id")
            .eq("id", user.id)
            .single();

          if (profile?.status === "pending_approval") {
            if (profile.registration_event_id) {
              // Event-specific registration — notify that event's admins only
              const { data: event } = await supabase
                .from("events")
                .select("id, name")
                .eq("id", profile.registration_event_id)
                .single();

              if (event) {
                sendAdminAlert("new_registration", {
                  eventId: event.id,
                  eventName: event.name,
                  golferName: `${profile.first_name} ${profile.last_name}`,
                  golferEmail: profile.email,
                }).catch((err) =>
                  console.error("New registration alert error:", err)
                );
              }
            } else {
              // Generic registration — notify all active events
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
