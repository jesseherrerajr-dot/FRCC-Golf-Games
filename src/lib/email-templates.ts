/**
 * Email Template Generators
 * Generates HTML emails with merge fields for each email type
 */

export interface InviteEmailParams {
  golferName: string;
  eventName: string;
  gameDate: string;
  rsvpToken: string;
  cutoffDay: number;
  cutoffTime: string;
  siteUrl: string;
}

export interface ReminderEmailParams {
  golferName: string;
  eventName: string;
  gameDate: string;
  rsvpToken: string;
  cutoffDay: number;
  cutoffTime: string;
  siteUrl: string;
}

export interface GolferConfirmationParams {
  eventName: string;
  gameDate: string;
  confirmedPlayers: Array<{
    first_name: string;
    last_name: string;
  }>;
  guests: Array<{
    guest_name: string;
    requested_by: string;
  }>;
}

export interface ProShopDetailParams {
  eventName: string;
  gameDate: string;
  confirmedPlayers: Array<{
    profile: {
      first_name: string;
      last_name: string;
      phone: string;
      ghin_number: string;
    };
  }>;
  guests: Array<{
    guest_name: string;
    guest_phone: string;
    guest_ghin_number: string;
    requested_by: string;
  }>;
  totalCount: number;
}

// ============================================================
// INVITE EMAIL
// ============================================================

export function generateInviteEmail(params: InviteEmailParams): string {
  const {
    golferName,
    eventName,
    gameDate,
    rsvpToken,
    cutoffDay,
    cutoffTime,
    siteUrl,
  } = params;

  const rsvpUrl = `${siteUrl}/rsvp/${rsvpToken}`;
  const cutoffDayName = getDayName(cutoffDay);
  const formattedDate = formatGameDate(gameDate);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 20px; margin-bottom: 30px;">
    <h1 style="color: #065f46; margin: 0 0 10px 0; font-size: 24px;">Hi ${golferName}!</h1>
    <p style="margin: 0; font-size: 16px; color: #047857;">The weekly game is coming up</p>
  </div>

  <div style="background: #ffffff; border: 2px solid #d1fae5; border-radius: 8px; padding: 24px; margin-bottom: 30px; text-align: center;">
    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">
      ${eventName}
    </p>
    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #065f46;">
      ${formattedDate}
    </p>
  </div>

  <div style="text-align: center; margin: 40px 0;">
    <p style="font-size: 20px; font-weight: bold; color: #065f46; margin-bottom: 24px;">
      Are you in?
    </p>
    <a href="${rsvpUrl}"
       style="display: inline-block; background: #059669; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      Yes, I'm In!
    </a>
  </div>

  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 30px 0; border-radius: 4px;">
    <p style="margin: 0; font-size: 14px; color: #92400e;">
      <strong>⏰ Please RSVP by ${cutoffDayName} at ${cutoffTime}</strong>
    </p>
  </div>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
      FRCC Golf Games<br>
      Fairbanks Ranch Country Club
    </p>
  </div>
</body>
</html>
  `.trim();
}

// ============================================================
// REMINDER EMAIL
// ============================================================

export function generateReminderEmail(params: ReminderEmailParams): string {
  const {
    golferName,
    eventName,
    gameDate,
    rsvpToken,
    cutoffDay,
    cutoffTime,
    siteUrl,
  } = params;

  const rsvpUrl = `${siteUrl}/rsvp/${rsvpToken}`;
  const cutoffDayName = getDayName(cutoffDay);
  const formattedDate = formatGameDate(gameDate);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 30px;">
    <h1 style="color: #92400e; margin: 0 0 10px 0; font-size: 24px;">Hi ${golferName},</h1>
    <p style="margin: 0; font-size: 16px; color: #b45309;">Friendly reminder to RSVP!</p>
  </div>

  <p style="font-size: 16px; margin-bottom: 20px;">
    We haven't heard from you yet for this week's game:
  </p>

  <div style="background: #ffffff; border: 2px solid #fde68a; border-radius: 8px; padding: 24px; margin-bottom: 30px; text-align: center;">
    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">
      ${eventName}
    </p>
    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #92400e;">
      ${formattedDate}
    </p>
  </div>

  <div style="text-align: center; margin: 40px 0;">
    <a href="${rsvpUrl}"
       style="display: inline-block; background: #f59e0b; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      RSVP Now
    </a>
  </div>

  <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 30px 0; border-radius: 4px;">
    <p style="margin: 0; font-size: 14px; color: #991b1b;">
      <strong>⏰ Cutoff: ${cutoffDayName} at ${cutoffTime}</strong>
    </p>
  </div>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
      FRCC Golf Games<br>
      Fairbanks Ranch Country Club
    </p>
  </div>
</body>
</html>
  `.trim();
}

// ============================================================
// GOLFER CONFIRMATION EMAIL
// ============================================================

export function generateGolferConfirmationEmail(
  params: GolferConfirmationParams
): string {
  const { eventName, gameDate, confirmedPlayers, guests } = params;

  const formattedDate = formatGameDate(gameDate);

  // Build player list HTML
  let playerListHtml = '<ul style="list-style: none; padding: 0; margin: 20px 0;">';

  confirmedPlayers.forEach((player) => {
    const initials = `${player.first_name[0]}. ${player.last_name}`;
    playerListHtml += `
      <li style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 15px;">
        ⛳ ${initials}
      </li>
    `;
  });

  if (guests && guests.length > 0) {
    playerListHtml += '<li style="padding: 12px 8px 8px 8px; font-weight: bold; color: #6b7280; font-size: 14px;">GUESTS:</li>';
    guests.forEach((guest) => {
      playerListHtml += `
        <li style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 15px; color: #6b7280;">
          👤 ${guest.guest_name} <span style="font-size: 12px;">(guest of ${guest.requested_by})</span>
        </li>
      `;
    });
  }

  playerListHtml += "</ul>";

  const totalCount = confirmedPlayers.length + (guests?.length || 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 20px; margin-bottom: 30px;">
    <h1 style="color: #065f46; margin: 0 0 10px 0; font-size: 24px;">You're Confirmed!</h1>
    <p style="margin: 0; font-size: 16px; color: #047857;">See you on the course ⛳</p>
  </div>

  <div style="background: #ffffff; border: 2px solid #d1fae5; border-radius: 8px; padding: 24px; margin-bottom: 30px; text-align: center;">
    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">
      ${eventName}
    </p>
    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #065f46;">
      ${formattedDate}
    </p>
    <p style="margin: 12px 0 0 0; font-size: 16px; color: #6b7280;">
      <strong>${totalCount} Players Confirmed</strong>
    </p>
  </div>

  <h2 style="color: #065f46; font-size: 18px; margin: 30px 0 16px 0;">
    Confirmed Roster:
  </h2>

  ${playerListHtml}

  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 30px 0; border-radius: 4px;">
    <p style="margin: 0; font-size: 14px; color: #1e40af;">
      <strong>💬 Reply to this email</strong> to coordinate with the group, share tee times, or discuss course conditions.
    </p>
  </div>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
      FRCC Golf Games<br>
      Fairbanks Ranch Country Club
    </p>
  </div>
</body>
</html>
  `.trim();
}

// ============================================================
// PRO SHOP DETAIL EMAIL
// ============================================================

export function generateProShopDetailEmail(
  params: ProShopDetailParams
): string {
  const { eventName, gameDate, confirmedPlayers, guests, totalCount } = params;

  const formattedDate = formatGameDate(gameDate);

  // Build detailed player table
  let playerTableHtml = `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #f3f4f6; border-bottom: 2px solid #d1d5db;">
          <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Name</th>
          <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Phone</th>
          <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">GHIN</th>
        </tr>
      </thead>
      <tbody>
  `;

  confirmedPlayers.forEach((rsvp, index) => {
    const player = rsvp.profile;
    const bgColor = index % 2 === 0 ? "#ffffff" : "#f9fafb";
    playerTableHtml += `
      <tr style="background: ${bgColor}; border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px; font-size: 14px;">${player.first_name} ${player.last_name}</td>
        <td style="padding: 10px; font-size: 14px;">${player.phone || "—"}</td>
        <td style="padding: 10px; font-size: 14px;">${player.ghin_number || "—"}</td>
      </tr>
    `;
  });

  if (guests && guests.length > 0) {
    playerTableHtml += `
      <tr style="background: #fef3c7; border-top: 2px solid #f59e0b;">
        <td colspan="3" style="padding: 10px; font-weight: bold; font-size: 13px; color: #92400e;">GUESTS:</td>
      </tr>
    `;

    guests.forEach((guest, index) => {
      const bgColor = index % 2 === 0 ? "#fffbeb" : "#fef3c7";
      playerTableHtml += `
        <tr style="background: ${bgColor}; border-bottom: 1px solid #fde68a;">
          <td style="padding: 10px; font-size: 14px;">${guest.guest_name} <span style="font-size: 12px; color: #6b7280;">(guest of ${guest.requested_by})</span></td>
          <td style="padding: 10px; font-size: 14px;">${guest.guest_phone || "—"}</td>
          <td style="padding: 10px; font-size: 14px;">${guest.guest_ghin_number || "—"}</td>
        </tr>
      `;
    });
  }

  playerTableHtml += `
      </tbody>
    </table>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background: #065f46; color: white; padding: 24px; margin-bottom: 30px; border-radius: 8px;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px;">Final Registration List</h1>
    <p style="margin: 0; font-size: 14px; opacity: 0.9;">FRCC Golf Games</p>
  </div>

  <div style="background: #f0fdf4; border: 2px solid #059669; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">
          ${eventName}
        </p>
        <p style="margin: 0; font-size: 24px; font-weight: bold; color: #065f46;">
          ${formattedDate}
        </p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0; font-size: 36px; font-weight: bold; color: #059669;">
          ${totalCount}
        </p>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          Total Players
        </p>
      </div>
    </div>
  </div>

  <h2 style="color: #065f46; font-size: 18px; margin: 30px 0 16px 0;">
    Player Details:
  </h2>

  ${playerTableHtml}

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">
      This is an automated message from FRCC Golf Games.<br>
      For questions, contact the event administrator.
    </p>
  </div>
</body>
</html>
  `.trim();
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getDayName(dayNumber: number): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[dayNumber] || "Friday";
}

function formatGameDate(dateString: string): string {
  const date = new Date(dateString + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}