import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/activity — Log a page view for the current user.
 * Called by the client-side ActivityTracker component on route changes.
 * Lightweight fire-and-forget — errors are silently ignored.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: true }); // Not logged in, skip
    }

    const body = await request.json();
    const pagePath = typeof body.path === "string" ? body.path : null;

    if (!pagePath) {
      return NextResponse.json({ ok: true });
    }

    // Skip tracking for API routes, static assets, and auth routes
    if (
      pagePath.startsWith("/api/") ||
      pagePath.startsWith("/_next/") ||
      pagePath.startsWith("/auth/")
    ) {
      return NextResponse.json({ ok: true });
    }

    await supabase.from("activity_log").insert({
      profile_id: user.id,
      activity_type: "page_view",
      page_path: pagePath,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Never fail the request — this is non-critical telemetry
    return NextResponse.json({ ok: true });
  }
}
