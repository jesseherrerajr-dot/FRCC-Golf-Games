/**
 * Penalty Box Email Templates
 * Generates HTML emails for penalty box notifications.
 * All emails are attributed to the event admin.
 */

import { formatFullName } from "./format";

// ============================================================
// Template Parameter Interfaces
// ============================================================

export interface PenaltyIssuedEmailParams {
  golferName: string;
  eventName: string;
  adminName: string;
  charge: string;
  penaltyBoxUrl: string;
}

export interface WitnessRequestEmailParams {
  witnessName: string;
  golferName: string;
  eventName: string;
  charge: string;
  witnessUrl: string;
}

export interface WitnessVotedNoEmailParams {
  golferName: string;
  witnessName: string;
  comment: string;
  eventName: string;
  penaltyBoxUrl: string;
}

export interface WitnessTimedOutEmailParams {
  golferName: string;
  witnessName: string;
  eventName: string;
  penaltyBoxUrl: string;
}

export interface ApologyEmailParams {
  golferName: string;
  adminName: string;
  eventName: string;
  charge: string;
  apologyText: string;
  adminDashboardUrl: string;
}

export interface PenaltyReleasedEmailParams {
  golferName: string;
  eventName: string;
  adminName: string;
  charge: string;
  timeServed: string;
  witnesses: Array<{
    name: string;
    vote: "yes" | "no";
    testimony: string;
  }>;
  releasedByAdmin: boolean;
  penaltyBoxUrl: string;
}

// ============================================================
// Shared Styles
// ============================================================

const EMAIL_WRAPPER = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">`;

const EMAIL_FOOTER = `
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-align: center;">
    <p>This is an automated message from the Penalty Box.</p>
  </div>
</body>
</html>`;

// ============================================================
// Template Generators
// ============================================================

/**
 * Email sent to all event subscribers when a golfer is penalized.
 */
export function generatePenaltyIssuedEmail(params: PenaltyIssuedEmailParams): string {
  const { golferName, eventName, adminName, charge, penaltyBoxUrl } = params;

  const isMultiple = golferName.includes(" and ");
  const headerEmoji = isMultiple ? "🚨" : "⚠️";
  const escapeText = isMultiple
    ? "Each must independently complete the Escape Challenge and find their own character witnesses to earn release."
    : `${golferName} must complete the Escape Challenge and find character witnesses to earn release.`;

  return `${EMAIL_WRAPPER}
  <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 30px;">
    <h1 style="color: #991b1b; margin: 0 0 10px 0; font-size: 24px;">${headerEmoji} Penalty Box Alert</h1>
    <p style="margin: 0; font-size: 16px; color: #b91c1c;">${eventName}</p>
  </div>

  <div style="background: #ffffff; border: 2px solid #fecaca; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: bold; color: #991b1b;">
      ${adminName} has sent ${golferName} to the Penalty Box!
    </p>
    <div style="background: #fef2f2; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">The Charge</p>
      <p style="margin: 0; font-size: 16px; color: #1f2937; font-style: italic;">"${charge}"</p>
    </div>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      ${escapeText}
      Follow the drama on the Penalty Box page.
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${penaltyBoxUrl}" style="display: inline-block; padding: 14px 32px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
      View the Penalty Box
    </a>
  </div>
${EMAIL_FOOTER}`;
}

/**
 * Email sent to a selected character witness.
 */
export function generateWitnessRequestEmail(params: WitnessRequestEmailParams): string {
  const { witnessName, golferName, eventName, charge, witnessUrl } = params;

  return `${EMAIL_WRAPPER}
  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px;">
    <h1 style="color: #1e40af; margin: 0 0 10px 0; font-size: 24px;">🏛️ Character Witness Request</h1>
    <p style="margin: 0; font-size: 16px; color: #2563eb;">${eventName}</p>
  </div>

  <div style="background: #ffffff; border: 2px solid #bfdbfe; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">
      Hi ${witnessName},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">
      <strong>${golferName}</strong> has identified you as a character witness and needs your help
      escaping the Penalty Box.
    </p>
    <div style="background: #fef2f2; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">The Charge</p>
      <p style="margin: 0; font-size: 16px; color: #1f2937; font-style: italic;">"${charge}"</p>
    </div>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      To serve as a character witness, play a quick 3-hole mini golf challenge and then cast your vote
      on whether ${golferName} deserves release. You have <strong>24 hours</strong> to respond.
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${witnessUrl}" style="display: inline-block; padding: 14px 32px; background: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
      Begin Witness Testimony
    </a>
  </div>
${EMAIL_FOOTER}`;
}

/**
 * Email sent to the penalized golfer when a witness votes "no".
 */
export function generateWitnessVotedNoEmail(params: WitnessVotedNoEmailParams): string {
  const { golferName, witnessName, comment, eventName, penaltyBoxUrl } = params;

  return `${EMAIL_WRAPPER}
  <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 30px;">
    <h1 style="color: #991b1b; margin: 0 0 10px 0; font-size: 24px;">Witness Voted No</h1>
    <p style="margin: 0; font-size: 16px; color: #b91c1c;">${eventName} — Penalty Box</p>
  </div>

  <div style="background: #ffffff; border: 2px solid #fecaca; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">
      Hi ${golferName},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">
      <strong>${witnessName}</strong> voted to keep you in the Penalty Box.
    </p>
    <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Their Reason</p>
      <p style="margin: 0; font-size: 14px; color: #1f2937; font-style: italic;">"${comment}"</p>
    </div>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      You'll need to select a new character witness to replace this vote.
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${penaltyBoxUrl}" style="display: inline-block; padding: 14px 32px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
      Select New Witness
    </a>
  </div>
${EMAIL_FOOTER}`;
}

/**
 * Email sent to the penalized golfer when a witness request times out.
 */
export function generateWitnessTimedOutEmail(params: WitnessTimedOutEmailParams): string {
  const { golferName, witnessName, eventName, penaltyBoxUrl } = params;

  return `${EMAIL_WRAPPER}
  <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 30px;">
    <h1 style="color: #92400e; margin: 0 0 10px 0; font-size: 24px;">⏰ Witness Request Expired</h1>
    <p style="margin: 0; font-size: 16px; color: #b45309;">${eventName} — Penalty Box</p>
  </div>

  <div style="background: #ffffff; border: 2px solid #fde68a; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">
      Hi ${golferName},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">
      <strong>${witnessName}</strong> didn't respond to your character witness request within 24 hours.
    </p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      Select a new character witness to continue your escape from the Penalty Box.
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${penaltyBoxUrl}" style="display: inline-block; padding: 14px 32px; background: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
      Select New Witness
    </a>
  </div>
${EMAIL_FOOTER}`;
}

/**
 * Email sent to the event admin when a golfer submits an apology.
 */
export function generateApologyEmail(params: ApologyEmailParams): string {
  const { golferName, adminName, eventName, charge, apologyText, adminDashboardUrl } = params;

  return `${EMAIL_WRAPPER}
  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px;">
    <h1 style="color: #1e40af; margin: 0 0 10px 0; font-size: 24px;">📝 Apology from the Penalty Box</h1>
    <p style="margin: 0; font-size: 16px; color: #2563eb;">${eventName}</p>
  </div>

  <div style="background: #ffffff; border: 2px solid #bfdbfe; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">
      Hi ${adminName},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1f2937;">
      <strong>${golferName}</strong> has submitted an apology from the Penalty Box after receiving
      3 "no" votes from character witnesses.
    </p>
    <div style="background: #fef2f2; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
      <p style="margin: 0 0 4px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Original Charge</p>
      <p style="margin: 0; font-size: 14px; color: #1f2937; font-style: italic;">"${charge}"</p>
    </div>
    <div style="background: #f0fdf4; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 4px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">The Apology</p>
      <p style="margin: 0; font-size: 16px; color: #1f2937;">"${apologyText}"</p>
    </div>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      You can release ${golferName} from the Penalty Box at any time from the admin dashboard.
    </p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${adminDashboardUrl}" style="display: inline-block; padding: 14px 32px; background: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
      View in Admin Dashboard
    </a>
  </div>
${EMAIL_FOOTER}`;
}

/**
 * Email sent to all event subscribers when a golfer is released.
 */
export function generatePenaltyReleasedEmail(params: PenaltyReleasedEmailParams): string {
  const { golferName, eventName, adminName, charge, timeServed, witnesses, releasedByAdmin, penaltyBoxUrl } = params;

  const yesWitnesses = witnesses.filter((w) => w.vote === "yes");

  const witnessHtml = yesWitnesses.length > 0
    ? `
    <div style="margin-top: 20px;">
      <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #1f2937;">Character Witnesses:</p>
      ${yesWitnesses
        .map(
          (w) => `
        <div style="background: #f9fafb; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold; color: #1f2937;">
            ${w.name} — <span style="color: #16a34a;">Voted for release</span>
          </p>
          <p style="margin: 0; font-size: 13px; color: #6b7280; font-style: italic;">"${w.testimony}"</p>
        </div>`
        )
        .join("")}
    </div>`
    : "";

  const releaseMethod = releasedByAdmin
    ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">Released by ${adminName} (admin release).</p>`
    : "";

  return `${EMAIL_WRAPPER}
  <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px; margin-bottom: 30px;">
    <h1 style="color: #065f46; margin: 0 0 10px 0; font-size: 24px;">🎉 Released from the Penalty Box!</h1>
    <p style="margin: 0; font-size: 16px; color: #047857;">${eventName}</p>
  </div>

  <div style="background: #ffffff; border: 2px solid #bbf7d0; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: bold; color: #065f46;">
      ${golferName} has been released from the Penalty Box!
    </p>
    <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <div>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Original Charge</p>
          <p style="margin: 0; font-size: 14px; color: #1f2937; font-style: italic;">"${charge}"</p>
        </div>
      </div>
      <div style="margin-top: 12px;">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Time Served</p>
        <p style="margin: 0; font-size: 16px; font-weight: bold; color: #065f46;">${timeServed}</p>
      </div>
    </div>
    ${releaseMethod}
    ${witnessHtml}
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${penaltyBoxUrl}" style="display: inline-block; padding: 14px 32px; background: #16a34a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
      View the Penalty Box
    </a>
  </div>
${EMAIL_FOOTER}`;
}
