import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "happy@frccgolfgames.com";

function createEmailAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Delay helper to stay under Resend's 2 req/s rate limit.
 * Call between consecutive sendEmail() calls in loops.
 */
export const rateLimitDelay = () =>
  new Promise((resolve) => setTimeout(resolve, 600));

type SendEmailParams = {
  to: string | string[];
  cc?: string | string[];
  replyTo?: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, cc, replyTo, subject, html }: SendEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: `FRCC Golf Games <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
      replyTo: replyTo || undefined,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err };
  }
}

/** Shared email header with FRCC branding */
function emailHeader(title: string, subtitle?: string) {
  return `
    <div style="border-bottom: 3px solid #3d7676; padding-bottom: 16px; margin-bottom: 20px;">
      <h2 style="font-family: Georgia, 'Times New Roman', serif; color: #1b2a4a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px; font-size: 20px;">${title}</h2>
      ${subtitle ? `<p style="color: #6b7280; font-size: 16px; margin: 0;">${subtitle}</p>` : ""}
    </div>`;
}

/**
 * Generate the Monday invite email HTML
 */
export function generateInviteEmail({
  golferName,
  eventName,
  gameDate,
  rsvpToken,
  siteUrl,
  adminNote,
  cutoffDay,
  cutoffTime,
}: {
  golferName: string;
  eventName: string;
  gameDate: string;
  rsvpToken: string;
  siteUrl: string;
  adminNote?: string | null;
  cutoffDay?: number;
  cutoffTime?: string;
}) {
  const formattedDate = new Date(gameDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
  const rsvpBase = `${siteUrl}/api/rsvp?token=${rsvpToken}`;

  const adminNoteHtml = adminNote
    ? `<div style="background: #f0f3f7; border-left: 4px solid #3d7676; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #1b2a4a;"><strong>Note from admin:</strong> ${adminNote}</p>
      </div>`
    : "";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      ${emailHeader(eventName, formattedDate)}

      <p style="color: #374151;">Hey ${golferName},</p>
      <p style="color: #374151;">Are you playing this Saturday? Tap one of the buttons below to let us know.</p>

      ${adminNoteHtml}

      <div style="margin: 24px 0;">
        <a href="${rsvpBase}&action=in" style="display: block; background: #3d7676; color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-bottom: 10px;">I'm In</a>
        <a href="${rsvpBase}&action=out" style="display: block; background: white; color: #b91c1c; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; border: 2px solid #fca5a5; margin-bottom: 10px;">I'm Out</a>
        <a href="${rsvpBase}&action=not_sure" style="display: block; background: white; color: #a16207; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; border: 2px solid #fcd34d;">Not Sure Yet (ask me again later)</a>
      </div>

      <p style="color: #9ca3af; font-size: 12px;">Deadline: ${formatCutoffDisplay(cutoffDay, cutoffTime)}. After that, contact an event admin to change your RSVP.</p>
      <p style="color: #9ca3af; font-size: 12px;"><a href="${siteUrl}/dashboard" style="color: #3d7676;">Go to Dashboard</a></p>
    </div>
  `;
}

/**
 * Generate the Thursday reminder email HTML
 */
export function generateReminderEmail({
  golferName,
  eventName,
  gameDate,
  rsvpToken,
  siteUrl,
  spotsRemaining,
  adminNote,
  cutoffDay,
  cutoffTime,
}: {
  golferName: string;
  eventName: string;
  gameDate: string;
  rsvpToken: string;
  siteUrl: string;
  spotsRemaining: number;
  adminNote?: string | null;
  cutoffDay?: number;
  cutoffTime?: string;
}) {
  const formattedDate = new Date(gameDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
  const rsvpBase = `${siteUrl}/api/rsvp?token=${rsvpToken}`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      ${emailHeader(eventName, formattedDate)}

      <p style="color: #374151;">Hey ${golferName},</p>
      <p style="color: #374151;">We haven't heard from you yet for this Saturday's game. ${
        spotsRemaining > 0
          ? `There are still <strong>${spotsRemaining} spots</strong> available.`
          : "The game is currently full, but you can join the waitlist."
      }</p>
      <p style="color: #374151;">The RSVP deadline is <strong>${formatCutoffDisplay(cutoffDay, cutoffTime)}</strong>.</p>

      ${adminNote ? `<div style="background: #f0f3f7; border-left: 4px solid #3d7676; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #1b2a4a;"><strong>Note from admin:</strong> ${adminNote}</p>
      </div>` : ""}

      <div style="margin: 24px 0;">
        <a href="${rsvpBase}&action=in" style="display: block; background: #3d7676; color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-bottom: 10px;">I'm In</a>
        <a href="${rsvpBase}&action=out" style="display: block; background: white; color: #b91c1c; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; border: 2px solid #fca5a5;">I'm Out</a>
      </div>

      <p style="color: #9ca3af; font-size: 12px;"><a href="${siteUrl}/dashboard" style="color: #3d7676;">Go to Dashboard</a></p>
    </div>
  `;
}

/**
 * Generate the Friday golfer confirmation email HTML
 */
export function generateConfirmationEmail({
  eventName,
  gameDate,
  confirmedPlayers,
  adminNote,
  siteUrl,
}: {
  eventName: string;
  gameDate: string;
  confirmedPlayers: { first_name: string; last_name: string; is_guest?: boolean; sponsor_name?: string }[];
  adminNote?: string | null;
  siteUrl?: string;
}) {
  const formattedDate = new Date(gameDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

  const playerListHtml = confirmedPlayers
    .map((p) => {
      const name = `${p.first_name.charAt(0)}. ${p.last_name}`;
      const guestTag = p.is_guest ? ` <span style="color: #9ca3af;">(Guest of ${p.sponsor_name})</span>` : "";
      return `<li style="padding: 4px 0; color: #374151;">${name}${guestTag}</li>`;
    })
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      ${emailHeader(eventName, `${formattedDate} — Registration Confirmation`)}

      <p style="color: #374151;">The following ${confirmedPlayers.length} players are confirmed for this Saturday:</p>

      ${adminNote ? `<div style="background: #f0f3f7; border-left: 4px solid #3d7676; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #1b2a4a;"><strong>Note from admin:</strong> ${adminNote}</p>
      </div>` : ""}

      <ol style="padding-left: 20px; margin: 16px 0;">
        ${playerListHtml}
      </ol>

      <p style="color: #374151; font-size: 14px;">Reply all to this email to share tee times, game format, course conditions, or other details with the group.</p>

      ${siteUrl ? `<p style="color: #9ca3af; font-size: 12px;"><a href="${siteUrl}/dashboard" style="color: #3d7676;">View Dashboard</a> &middot; Need to change your RSVP? Contact a event admin.</p>` : `<p style="color: #9ca3af; font-size: 12px;">See you on the course!</p>`}
    </div>
  `;
}

/**
 * Generate the Friday pro shop detail email HTML
 */
export function generateProShopEmail({
  eventName,
  gameDate,
  players,
}: {
  eventName: string;
  gameDate: string;
  players: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    ghin_number: string;
    is_guest?: boolean;
    sponsor_name?: string;
  }[];
}) {
  const formattedDate = new Date(gameDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

  const tableRows = players
    .map(
      (p) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${p.first_name} ${p.last_name}${p.is_guest ? " (Guest)" : ""}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${p.email}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${p.phone}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${p.ghin_number}</td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
      ${emailHeader(eventName, `${formattedDate} — Player Details`)}

      <p style="color: #374151;">${players.length} confirmed players:</p>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
        <thead>
          <tr style="background: #f0f3f7;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #1b2a4a; color: #1b2a4a; font-family: Georgia, 'Times New Roman', serif; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Name</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #1b2a4a; color: #1b2a4a; font-family: Georgia, 'Times New Roman', serif; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Email</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #1b2a4a; color: #1b2a4a; font-family: Georgia, 'Times New Roman', serif; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Phone</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #1b2a4a; color: #1b2a4a; font-family: Georgia, 'Times New Roman', serif; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">GHIN</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Generate an admin summary email after automated emails are sent.
 * Gives admins visibility into who received what and when.
 */
export function generateAdminSummaryEmail({
  eventName,
  gameDate,
  emailType,
  recipientNames,
  totalSent,
  additionalInfo,
  siteUrl,
}: {
  eventName: string;
  gameDate: string;
  emailType: "invite" | "reminder" | "confirmation";
  recipientNames: string[];
  totalSent: number;
  additionalInfo?: string;
  siteUrl: string;
}) {
  const formattedDate = new Date(gameDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );

  const typeLabels: Record<string, { title: string; color: string; borderColor: string }> = {
    invite: { title: "Weekly Invite Sent", color: "#065f46", borderColor: "#3d7676" },
    reminder: { title: "Reminder Sent", color: "#92400e", borderColor: "#f59e0b" },
    confirmation: { title: "Confirmation Sent", color: "#1e40af", borderColor: "#3b82f6" },
  };

  const { title, color, borderColor } = typeLabels[emailType] || typeLabels.invite;

  const recipientListHtml = recipientNames.length > 0
    ? recipientNames.map((name) => `<li style="padding: 2px 0; color: #374151; font-size: 14px;">${name}</li>`).join("")
    : `<li style="padding: 2px 0; color: #9ca3af; font-size: 14px;">No recipients</li>`;

  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      ${emailHeader(eventName, `${formattedDate} — ${title}`)}

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 4px 0; color: ${color}; font-weight: 600;">${title}</p>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Sent at ${now}</p>
        <p style="margin: 8px 0 0 0; color: #374151; font-size: 14px;"><strong>${totalSent}</strong> email${totalSent !== 1 ? "s" : ""} delivered</p>
      </div>

      ${additionalInfo ? `<p style="color: #374151; font-size: 14px;">${additionalInfo}</p>` : ""}

      <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 16px 0 8px 0;">Recipients:</p>
      <ol style="padding-left: 20px; margin: 0;">
        ${recipientListHtml}
      </ol>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;"><a href="${siteUrl}/admin" style="color: #3d7676;">View Admin Dashboard</a></p>
    </div>
  `;
}

/**
 * Send admin summary email after an automated email batch completes.
 * Fetches admin emails for the event and sends the summary to all admins.
 */
export async function sendAdminSummaryEmail({
  eventId,
  eventName,
  gameDate,
  emailType,
  recipientNames,
  totalSent,
  additionalInfo,
}: {
  eventId: string;
  eventName: string;
  gameDate: string;
  emailType: "invite" | "reminder" | "confirmation";
  recipientNames: string[];
  totalSent: number;
  additionalInfo?: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const supabase = createEmailAdminClient();

  // Get admin emails
  const { data: eventAdmins } = await supabase
    .from("event_admins")
    .select("role, profile:profiles(email)")
    .eq("event_id", eventId);

  const { data: superAdmins } = await supabase
    .from("profiles")
    .select("email")
    .eq("is_super_admin", true);

  const adminEmails = [
    ...(superAdmins || []).map((a: { email: string }) => a.email),
    ...(eventAdmins || []).map(
      (a: Record<string, unknown>) =>
        (a.profile as unknown as { email: string })?.email
    ),
  ].filter((e): e is string => !!e);

  const uniqueAdminEmails = [...new Set(adminEmails)];

  if (uniqueAdminEmails.length === 0) return;

  const typeSubjects: Record<string, string> = {
    invite: "Weekly Invites Sent",
    reminder: "Reminders Sent",
    confirmation: "Confirmations Sent",
  };

  const html = generateAdminSummaryEmail({
    eventName,
    gameDate,
    emailType,
    recipientNames,
    totalSent,
    additionalInfo,
    siteUrl,
  });

  const formattedDate = new Date(gameDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric" }
  );

  try {
    await rateLimitDelay();
    await sendEmail({
      to: uniqueAdminEmails,
      subject: `[Admin] ${eventName}: ${formattedDate} — ${typeSubjects[emailType]}`,
      html,
    });
  } catch (err) {
    console.error("Failed to send admin summary email:", err);
  }
}

/**
 * Format cutoff day/time for display in emails.
 * Falls back to "Friday at 10:00 AM PT" if not provided.
 */
function formatCutoffDisplay(cutoffDay?: number, cutoffTime?: string): string {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = cutoffDay !== undefined ? dayNames[cutoffDay] : "Friday";
  const time = cutoffTime || "10:00";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayMinute = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${dayName} at ${displayHour}${displayMinute} ${period} PT`;
}
