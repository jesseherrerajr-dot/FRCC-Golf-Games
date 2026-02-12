import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

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

/**
 * Generate the Monday invite email HTML
 */
export function generateInviteEmail({
  golferName,
  eventName,
  gameDate,
  rsvpToken,
  siteUrl,
}: {
  golferName: string;
  eventName: string;
  gameDate: string;
  rsvpToken: string;
  siteUrl: string;
}) {
  const formattedDate = new Date(gameDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
  const rsvpBase = `${siteUrl}/api/rsvp?token=${rsvpToken}`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #15803d; margin-bottom: 4px;">${eventName}</h2>
      <p style="color: #6b7280; font-size: 16px; margin-top: 0;">${formattedDate}</p>

      <p style="color: #374151;">Hey ${golferName},</p>
      <p style="color: #374151;">Are you playing this Saturday? Tap one of the buttons below to let us know.</p>

      <div style="margin: 24px 0;">
        <a href="${rsvpBase}&action=in" style="display: block; background: #15803d; color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-bottom: 10px;">I'm In</a>
        <a href="${rsvpBase}&action=out" style="display: block; background: white; color: #b91c1c; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; border: 2px solid #fca5a5; margin-bottom: 10px;">I'm Out</a>
        <a href="${rsvpBase}&action=not_sure" style="display: block; background: white; color: #a16207; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; border: 2px solid #fcd34d;">Not Sure Yet (ask me Thursday)</a>
      </div>

      <p style="color: #9ca3af; font-size: 12px;">Deadline: Friday at 10:00 AM PT. After that, contact a event admin to change your RSVP.</p>
      <p style="color: #9ca3af; font-size: 12px;"><a href="${siteUrl}/dashboard" style="color: #15803d;">Go to Dashboard</a></p>
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
}: {
  golferName: string;
  eventName: string;
  gameDate: string;
  rsvpToken: string;
  siteUrl: string;
  spotsRemaining: number;
}) {
  const formattedDate = new Date(gameDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
  const rsvpBase = `${siteUrl}/api/rsvp?token=${rsvpToken}`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #15803d; margin-bottom: 4px;">${eventName}</h2>
      <p style="color: #6b7280; font-size: 16px; margin-top: 0;">${formattedDate}</p>

      <p style="color: #374151;">Hey ${golferName},</p>
      <p style="color: #374151;">We haven't heard from you yet for this Saturday's game. ${
        spotsRemaining > 0
          ? `There are still <strong>${spotsRemaining} spots</strong> available.`
          : "The game is currently full, but you can join the waitlist."
      }</p>
      <p style="color: #374151;">The RSVP deadline is <strong>tomorrow (Friday) at 10:00 AM PT</strong>.</p>

      <div style="margin: 24px 0;">
        <a href="${rsvpBase}&action=in" style="display: block; background: #15803d; color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-bottom: 10px;">I'm In</a>
        <a href="${rsvpBase}&action=out" style="display: block; background: white; color: #b91c1c; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; border: 2px solid #fca5a5;">I'm Out</a>
      </div>

      <p style="color: #9ca3af; font-size: 12px;"><a href="${siteUrl}/dashboard" style="color: #15803d;">Go to Dashboard</a></p>
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
}: {
  eventName: string;
  gameDate: string;
  confirmedPlayers: { first_name: string; last_name: string; is_guest?: boolean; sponsor_name?: string }[];
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
      <h2 style="color: #15803d; margin-bottom: 4px;">${eventName}</h2>
      <p style="color: #6b7280; font-size: 16px; margin-top: 0;">${formattedDate} — Registration Confirmation</p>

      <p style="color: #374151;">The following ${confirmedPlayers.length} players are confirmed for this Saturday:</p>

      <ol style="padding-left: 20px; margin: 16px 0;">
        ${playerListHtml}
      </ol>

      <p style="color: #374151; font-size: 14px;">Reply all to this email to share tee times, game format, course conditions, or other details with the group.</p>

      <p style="color: #9ca3af; font-size: 12px;">See you on the course!</p>
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
      <h2 style="color: #15803d; margin-bottom: 4px;">${eventName}</h2>
      <p style="color: #6b7280; font-size: 16px; margin-top: 0;">${formattedDate} — Player Details</p>

      <p style="color: #374151;">${players.length} confirmed players:</p>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #d1d5db;">Name</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #d1d5db;">Email</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #d1d5db;">Phone</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #d1d5db;">GHIN</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
}
