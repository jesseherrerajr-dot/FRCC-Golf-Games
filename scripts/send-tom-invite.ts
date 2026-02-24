import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

const TOM_GMAIL_PROFILE_ID = "0cf5bbe1-d397-4299-90d5-7f85a3f94609";
const SITE_URL = "https://frccgolfgames.com";
const GAME_DATE = "2026-02-28";

async function main() {
  // 1. Find the Saturday Morning Group event
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("is_active", true);

  const event = events?.[0];
  if (!event) {
    console.error("No active event found");
    process.exit(1);
  }
  console.log(`Event: ${event.name}`);

  // 2. Find or create the schedule for Feb 28
  let { data: schedule } = await supabase
    .from("event_schedules")
    .select("*")
    .eq("event_id", event.id)
    .eq("game_date", GAME_DATE)
    .maybeSingle();

  if (!schedule) {
    console.error("No schedule found for", GAME_DATE);
    process.exit(1);
  }
  console.log(`Schedule ID: ${schedule.id}, game_date: ${schedule.game_date}`);

  // 3. Check if Tom's Gmail already has an RSVP row for this week
  let { data: existingRsvp } = await supabase
    .from("rsvps")
    .select("*")
    .eq("schedule_id", schedule.id)
    .eq("profile_id", TOM_GMAIL_PROFILE_ID)
    .maybeSingle();

  if (!existingRsvp) {
    // Create RSVP row
    const { data: newRsvp, error } = await supabase
      .from("rsvps")
      .insert({
        schedule_id: schedule.id,
        profile_id: TOM_GMAIL_PROFILE_ID,
        status: "no_response",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create RSVP:", error);
      process.exit(1);
    }
    existingRsvp = newRsvp;
    console.log("Created new RSVP row for Tom's Gmail");
  } else {
    console.log(`Existing RSVP found, status: ${existingRsvp.status}`);
  }

  // 4. Get Tom's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", TOM_GMAIL_PROFILE_ID)
    .single();

  if (!profile) {
    console.error("Profile not found");
    process.exit(1);
  }
  console.log(`Sending invite to: ${profile.email}`);

  // 5. Format date
  const [year, month, day] = GAME_DATE.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // 6. Build RSVP URLs
  const token = existingRsvp.token;
  const rsvpBase = `${SITE_URL}/rsvp/${token}`;
  const inUrl = `${rsvpBase}?response=in`;
  const outUrl = `${rsvpBase}?response=out`;
  const notSureUrl = `${rsvpBase}?response=not_sure`;

  // 7. Generate and send invite email (using same style as the app)
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px;">
      <div style="border-bottom: 3px solid #3d7676; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="font-family: Georgia, 'Times New Roman', serif; color: #1b2a4a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; font-size: 20px;">${event.name}</h2>
        <p style="color: #6b7280; font-size: 16px; margin: 0;">${formattedDate}</p>
      </div>

      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi ${profile.first_name},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Are you in for <strong>${formattedDate}</strong>? Let us know with one tap:
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${inUrl}" style="display: inline-block; background-color: #16a34a; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600; margin: 0 8px;">I'm In</a>
        <a href="${outUrl}" style="display: inline-block; background-color: #dc2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600; margin: 0 8px;">I'm Out</a>
      </div>
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${notSureUrl}" style="display: inline-block; background-color: #d97706; color: white; padding: 10px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Not Sure Yet</a>
      </div>

      <p style="color: #6b7280; font-size: 13px; text-align: center;">
        You can change your response anytime before the RSVP cutoff.
      </p>

      <div style="border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 16px;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          FRCC Golf Games &bull; <a href="${SITE_URL}" style="color: #3d7676;">frccgolfgames.com</a>
        </p>
      </div>
    </div>`;

  const { data: emailResult, error: emailError } = await resend.emails.send({
    from: "FRCC Golf Games <happy@frccgolfgames.com>",
    to: [profile.email],
    subject: `${event.name}: ${formattedDate} — Are You In?`,
    html,
  });

  if (emailError) {
    console.error("Failed to send email:", emailError);
    process.exit(1);
  }

  console.log("Email sent successfully!", emailResult);
}

main();
