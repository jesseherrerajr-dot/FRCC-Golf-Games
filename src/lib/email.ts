import { Resend } from "resend";
import type { StoredGrouping, StoredGroupGolfer } from "./grouping-db";
import { formatPhoneDisplay, formatInitialLastName, formatFullName, formatSponsorName, formatGameDate, getSiteUrl } from "./format";
import { formatCutoffDayTime } from "./timezone";
import { generateWeatherEmailHtml } from "./weather";
import type { GameWeatherForecast } from "@/types/events";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "happy@frccgolfgames.com";

import { createAdminClient as createEmailAdminClient } from "./supabase/server";

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
  weather,
}: {
  golferName: string;
  eventName: string;
  gameDate: string;
  rsvpToken: string;
  siteUrl: string;
  adminNote?: string | null;
  cutoffDay?: number;
  cutoffTime?: string;
  weather?: GameWeatherForecast | null;
}) {
  const formattedDate = formatGameDate(gameDate);
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

      ${weather ? generateWeatherEmailHtml(weather, "invite") : ""}

      <p style="color: #9ca3af; font-size: 12px;">Deadline: ${formatCutoffDayTime(cutoffDay, cutoffTime)}. After that, contact an event admin to change your RSVP.</p>
      <p style="color: #9ca3af; font-size: 12px;"><a href="${siteUrl}/home" style="color: #3d7676;">Go to FRCC Golf Games</a></p>
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
  weather,
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
  weather?: GameWeatherForecast | null;
}) {
  const formattedDate = formatGameDate(gameDate);
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
      <p style="color: #374151;">The RSVP deadline is <strong>${formatCutoffDayTime(cutoffDay, cutoffTime)}</strong>.</p>

      ${adminNote ? `<div style="background: #f0f3f7; border-left: 4px solid #3d7676; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #1b2a4a;"><strong>Note from admin:</strong> ${adminNote}</p>
      </div>` : ""}

      <div style="margin: 24px 0;">
        <a href="${rsvpBase}&action=in" style="display: block; background: #3d7676; color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-bottom: 10px;">I'm In</a>
        <a href="${rsvpBase}&action=out" style="display: block; background: white; color: #b91c1c; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; border: 2px solid #fca5a5;">I'm Out</a>
      </div>

      ${weather ? generateWeatherEmailHtml(weather, "reminder") : ""}

      <p style="color: #9ca3af; font-size: 12px;"><a href="${siteUrl}/home" style="color: #3d7676;">Go to FRCC Golf Games</a></p>
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
  weather,
}: {
  eventName: string;
  gameDate: string;
  confirmedPlayers: { first_name: string; last_name: string; is_guest?: boolean; sponsor_name?: string }[];
  adminNote?: string | null;
  siteUrl?: string;
  weather?: GameWeatherForecast | null;
}) {
  const formattedDate = formatGameDate(gameDate);

  const playerListHtml = confirmedPlayers
    .map((p) => {
      const name = formatInitialLastName(p.first_name, p.last_name);
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

      ${weather ? generateWeatherEmailHtml(weather, "confirmation") : ""}

      <p style="color: #374151; font-size: 14px;">Reply all to this email to share tee times, game format, course conditions, or other details with the group.</p>

      ${siteUrl ? `<p style="color: #9ca3af; font-size: 12px;"><a href="${siteUrl}/home" style="color: #3d7676;">Go to FRCC Golf Games</a> &middot; Need to change your RSVP? Contact a event admin.</p>` : `<p style="color: #9ca3af; font-size: 12px;">See you on the course!</p>`}
    </div>
  `;
}

/**
 * Generate the Friday pro shop detail email HTML.
 *
 * When groupings are available, renders a single consolidated list
 * organized by suggested groups. When no groupings, falls back to
 * a flat alphabetical player table.
 */
export function generateProShopEmail({
  eventName,
  gameDate,
  players,
  groupings,
  groupingMethod,
}: {
  eventName: string;
  gameDate: string;
  players: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    ghin_number: string;
    handicap_index?: number | null;
    is_guest?: boolean;
    sponsor_name?: string;
  }[];
  groupings?: StoredGrouping[];
  groupingMethod?: string;
}) {
  const formattedDate = formatGameDate(gameDate);

  const thStyle = 'padding: 8px; text-align: left; border-bottom: 2px solid #1b2a4a; color: #1b2a4a; font-family: Georgia, "Times New Roman", serif; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;';
  const tdStyle = "padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;";

  // Grouped format: single consolidated list with group headers + preference columns
  if (groupings && groupings.length > 0) {
    const totalPlayers = groupings.reduce((sum, g) => sum + g.golfers.length, 0);

    const groupRows = groupings
      .map((group) => {
        const golferRows = group.golfers
          .map((m) => {
            const guestLabel = m.isGuest && m.hostName
              ? ` <span style="color: #6b7280; font-size: 12px;">(Guest of ${m.hostName})</span>`
              : "";
            // Tee time preference column
            const teePref = !m.isGuest && m.teeTimePreference === 'early'
              ? 'Early'
              : !m.isGuest && m.teeTimePreference === 'late'
                ? 'Late'
                : '';
            // Player preference column: checkmark if this golfer has preferred partners in the group
            const playerPref = !m.isGuest && m.preferredPartnersInGroup.length > 0
              ? '&#10003;'
              : '';
            return `
            <tr>
              <td style="${tdStyle}">${m.firstName} ${m.lastName}${guestLabel}</td>
              <td style="${tdStyle}">${m.email || "—"}</td>
              <td style="${tdStyle}">${formatPhoneDisplay(m.phone)}</td>
              <td style="${tdStyle}">${m.ghinNumber || "—"}</td>
              <td style="${tdStyle} text-align: center;">${m.handicapIndex != null ? m.handicapIndex.toFixed(1) : "—"}</td>
              <td style="${tdStyle} text-align: center;">${teePref}</td>
              <td style="${tdStyle} text-align: center;">${playerPref}</td>
            </tr>`;
          })
          .join("");

        return `
          <tr>
            <td colspan="7" style="padding: 10px 8px 6px 8px; font-weight: 600; color: #1b2a4a; font-size: 14px; border-top: 2px solid #3d7676; background: #f0f3f7;">
              Group ${group.groupNumber}
            </td>
          </tr>
          ${golferRows}`;
      })
      .join("");

    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px;">
      ${emailHeader(eventName, `${formattedDate} — Confirmed Golfers`)}

      <p style="color: #374151; font-weight: 600; font-size: 15px; margin: 0 0 4px 0;">${totalPlayers} players — Suggested Groups</p>
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 12px 0;">
        ${groupingMethod && groupingMethod !== 'harmony'
          ? `Groups are based on handicap index (${groupingMethod.replace(/_/g, ' ')}). Adjust as needed.`
          : 'Groups are based on playing partner and tee time preferences. &#10003; = golfer has a preferred partner in this group. Adjust as needed.'
        }
      </p>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
        <thead>
          <tr style="background: #f0f3f7;">
            <th style="${thStyle}">Name</th>
            <th style="${thStyle}">Email</th>
            <th style="${thStyle}">Phone</th>
            <th style="${thStyle}">GHIN</th>
            <th style="${thStyle} text-align: center;">HCP</th>
            <th style="${thStyle} text-align: center;">Tee Time</th>
            <th style="${thStyle} text-align: center;">Player Pref</th>
          </tr>
        </thead>
        <tbody>
          ${groupRows}
        </tbody>
      </table>
    </div>
  `;
  }

  // Flat format (fallback when no groupings)
  const tableRows = players
    .map(
      (p) => {
        const guestLabel = p.is_guest && p.sponsor_name
          ? ` <span style="color: #6b7280; font-size: 12px;">(Guest of ${p.sponsor_name})</span>`
          : "";
        return `
      <tr>
        <td style="${tdStyle}">${p.first_name} ${p.last_name}${guestLabel}</td>
        <td style="${tdStyle}">${p.email}</td>
        <td style="${tdStyle}">${formatPhoneDisplay(p.phone)}</td>
        <td style="${tdStyle}">${p.ghin_number}</td>
        <td style="${tdStyle} text-align: center;">${p.handicap_index != null ? p.handicap_index.toFixed(1) : "—"}</td>
      </tr>`;
      }
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
      ${emailHeader(eventName, `${formattedDate} — Confirmed Golfers`)}

      <p style="color: #374151;">${players.length} confirmed players:</p>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
        <thead>
          <tr style="background: #f0f3f7;">
            <th style="${thStyle}">Name</th>
            <th style="${thStyle}">Email</th>
            <th style="${thStyle}">Phone</th>
            <th style="${thStyle}">GHIN</th>
            <th style="${thStyle} text-align: center;">HCP</th>
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
  const formattedDate = formatGameDate(gameDate);

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
  const siteUrl = getSiteUrl();
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
 * Generate a game cancellation email for all subscribed golfers.
 * Sent automatically when an admin toggles a game to "No Game."
 */
export function generateGameCancelledEmail({
  golferName,
  eventName,
  gameDate,
  nextGameDate,
  reason,
  siteUrl,
}: {
  golferName: string;
  eventName: string;
  gameDate: string;
  nextGameDate?: string | null;
  reason?: string;
  siteUrl: string;
}) {
  const formattedDate = formatGameDate(gameDate);

  const reasonHtml = reason
    ? `<div style="background: #f9fafb; border-left: 4px solid #9ca3af; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #374151;"><strong>Reason:</strong> ${reason}</p>
      </div>`
    : "";

  const nextDateHtml = nextGameDate
    ? `<p style="color: #374151;">The next scheduled game is <strong>${new Date(
        nextGameDate + "T12:00:00"
      ).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}</strong>.</p>`
    : "";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      ${emailHeader(eventName, formattedDate)}

      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 0 0 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: 600; color: #991b1b;">Game Cancelled</p>
      </div>

      <p style="color: #374151;">Hi ${golferName},</p>
      <p style="color: #374151;">The game scheduled for <strong>${formattedDate}</strong> has been cancelled. No action is needed on your part.</p>

      ${reasonHtml}

      ${nextDateHtml}

      <p style="color: #374151;">We apologize for the inconvenience.</p>

      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;"><a href="${siteUrl}/home" style="color: #3d7676;">Go to FRCC Golf Games</a></p>
    </div>
  `;
}

// formatCutoffDisplay — imported from @/lib/timezone (centralized)
