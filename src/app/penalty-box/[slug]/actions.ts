"use server";

import {
  completeEscape,
  selectWitnesses,
  recordWitnessVote,
  submitApology,
  adminReleasePenalty,
  createPenalty,
  getEventAdmin,
  getEventSubscribers,
  getPenaltyById,
  expireOverdueWitnesses,
  formatTimeServed,
} from "@/lib/penalty-box";
import { sendEmail } from "@/lib/email";
import {
  generatePenaltyIssuedEmail,
  generateWitnessRequestEmail,
  generateWitnessVotedNoEmail,
  generateApologyEmail,
  generatePenaltyReleasedEmail,
} from "@/lib/penalty-box-emails";
import { formatFullName } from "@/lib/format";
import { getSiteUrl } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// Server Actions
// ============================================================

/**
 * Admin sends one or more golfers to the Penalty Box under a single charge.
 * Creates individual penalty records per golfer but sends one combined email blast.
 */
export async function sendToPenaltyBox(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  const chargedBy = formData.get("chargedBy") as string;
  const charge = formData.get("charge") as string;
  const slug = formData.get("slug") as string;

  // Support both single profileId (legacy) and multiple profileIds
  const profileIds = formData.getAll("profileIds") as string[];
  const singleId = formData.get("profileId") as string;
  const allProfileIds = profileIds.length > 0 ? profileIds : singleId ? [singleId] : [];

  if (!eventId || allProfileIds.length === 0 || !chargedBy || !charge) {
    return { error: "Missing required fields" };
  }

  try {
    const supabase = createAdminClient();

    // Create a penalty for each golfer
    const penalties = await Promise.all(
      allProfileIds.map((profileId) =>
        createPenalty({ eventId, profileId, chargedBy, charge })
      )
    );

    // Get event admin for email attribution
    const eventAdmin = await getEventAdmin(eventId);
    const adminName = eventAdmin
      ? formatFullName(eventAdmin.first_name, eventAdmin.last_name)
      : "The Admin";

    // Get all penalized golfer names
    const { data: golfers } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", allProfileIds);

    const golferNames = (golfers || []).map((g) =>
      formatFullName(g.first_name, g.last_name)
    );
    const golferName = golferNames.length === 1
      ? golferNames[0]
      : golferNames.length === 2
        ? `${golferNames[0]} and ${golferNames[1]}`
        : `${golferNames.slice(0, -1).join(", ")}, and ${golferNames[golferNames.length - 1]}`;

    const siteUrl = getSiteUrl();
    const penaltyBoxUrl = `${siteUrl}/penalty-box/${slug}`;

    // Get event info for email
    const { data: event } = await supabase
      .from("events")
      .select("name")
      .eq("id", eventId)
      .single();

    const eventName = event?.name || "Golf Group";

    // Send one combined email blast to all event subscribers
    const subscribers = await getEventSubscribers(eventId);
    const subjectPrefix = allProfileIds.length > 1 ? "🚨" : "⚠️";
    const subjectVerb = allProfileIds.length > 1 ? "sent" : "sent";

    for (const subscriber of subscribers) {
      await sendEmail({
        to: subscriber.email,
        subject: `${subjectPrefix} ${eventName}: ${golferName} ${subjectVerb} to the Penalty Box!`,
        html: generatePenaltyIssuedEmail({
          golferName,
          eventName,
          adminName,
          charge,
          penaltyBoxUrl,
        }),
        replyTo: eventAdmin?.email,
      });
    }

    revalidatePath(`/penalty-box/${slug}`);
    return { success: true, penaltyIds: penalties.map((p) => p.id) };
  } catch (error) {
    console.error("Failed to send to penalty box:", error);
    return { error: "Failed to create penalty" };
  }
}

/**
 * Penalized golfer completes the escape game.
 */
export async function completeEscapeGame(penaltyId: string, slug: string) {
  try {
    await completeEscape(penaltyId);
    revalidatePath(`/penalty-box/${slug}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to complete escape:", error);
    return { error: "Failed to complete escape" };
  }
}

/**
 * Penalized golfer selects character witnesses.
 */
export async function selectCharacterWitnesses(
  penaltyId: string,
  witnessProfileIds: string[],
  slug: string
) {
  try {
    const witnesses = await selectWitnesses(penaltyId, witnessProfileIds);

    // Get penalty details for email
    const penalty = await getPenaltyById(penaltyId);
    if (!penalty) throw new Error("Penalty not found");

    const supabase = createAdminClient();
    const { data: event } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", penalty.event_id)
      .single();

    const eventAdmin = await getEventAdmin(penalty.event_id);
    const siteUrl = getSiteUrl();
    const golferName = formatFullName(
      penalty.profile.first_name,
      penalty.profile.last_name
    );

    // Send emails to each witness
    for (const witness of witnesses) {
      const { data: witnessProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", witness.witness_profile_id)
        .single();

      if (witnessProfile) {
        const witnessUrl = `${siteUrl}/penalty-box/${slug}/witness/${witness.token}`;

        await sendEmail({
          to: witnessProfile.email,
          subject: `🏛️ ${event?.name || "Golf Group"}: You've been called as a character witness`,
          html: generateWitnessRequestEmail({
            witnessName: witnessProfile.first_name,
            golferName,
            eventName: event?.name || "Golf Group",
            charge: penalty.charge,
            witnessUrl,
          }),
          replyTo: eventAdmin?.email,
        });
      }
    }

    revalidatePath(`/penalty-box/${slug}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to select witnesses:", error);
    return { error: "Failed to select witnesses" };
  }
}

/**
 * Character witness casts their vote.
 */
export async function castWitnessVote(
  witnessId: string,
  vote: "yes" | "no",
  testimony: string,
  slug: string
) {
  try {
    const { penalty, triggered } = await recordWitnessVote({
      witnessId,
      vote,
      testimony,
    });

    const siteUrl = getSiteUrl();
    const penaltyBoxUrl = `${siteUrl}/penalty-box/${slug}`;
    const golferName = formatFullName(
      penalty.profile.first_name,
      penalty.profile.last_name
    );

    const supabase = createAdminClient();
    const { data: event } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", penalty.event_id)
      .single();
    const eventName = event?.name || "Golf Group";

    // Get the witness's name for notifications
    const { data: witnessProfile } = await supabase
      .from("penalty_witnesses")
      .select("witness_profile:profiles!penalty_witnesses_witness_profile_id_fkey(first_name, last_name)")
      .eq("id", witnessId)
      .single();

    const witnessName = witnessProfile?.witness_profile
      ? formatFullName(
          (witnessProfile.witness_profile as unknown as { first_name: string }).first_name,
          (witnessProfile.witness_profile as unknown as { last_name: string }).last_name
        )
      : "A witness";

    if (vote === "no") {
      // Notify the penalized golfer
      const { data: golferProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", penalty.profile_id)
        .single();

      if (golferProfile) {
        await sendEmail({
          to: golferProfile.email,
          subject: `${eventName} Penalty Box: ${witnessName} voted NO`,
          html: generateWitnessVotedNoEmail({
            golferName: penalty.profile.first_name,
            witnessName,
            comment: testimony,
            eventName,
            penaltyBoxUrl,
          }),
        });
      }
    }

    if (triggered === "released") {
      // Send release email blast to all subscribers
      const eventAdmin = await getEventAdmin(penalty.event_id);
      const adminName = eventAdmin
        ? formatFullName(eventAdmin.first_name, eventAdmin.last_name)
        : "The Admin";

      const subscribers = await getEventSubscribers(penalty.event_id);
      const timeServed = formatTimeServed(penalty.created_at, new Date().toISOString());

      const witnesses = penalty.witnesses
        .filter((w) => w.status === "completed" && w.testimony)
        .map((w) => ({
          name: formatFullName(w.witness_profile.first_name, w.witness_profile.last_name),
          vote: w.vote as "yes" | "no",
          testimony: w.testimony || "",
        }));

      for (const subscriber of subscribers) {
        await sendEmail({
          to: subscriber.email,
          subject: `🎉 ${eventName}: ${golferName} released from the Penalty Box!`,
          html: generatePenaltyReleasedEmail({
            golferName,
            eventName,
            adminName,
            charge: penalty.charge,
            timeServed,
            witnesses,
            releasedByAdmin: false,
            penaltyBoxUrl,
          }),
          replyTo: eventAdmin?.email,
        });
      }
    }

    if (triggered === "apology_required") {
      // Notify the golfer that they need to apologize
      const { data: golferProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", penalty.profile_id)
        .single();

      if (golferProfile) {
        await sendEmail({
          to: golferProfile.email,
          subject: `${eventName} Penalty Box: 3 witnesses voted NO — apology required`,
          html: generateWitnessVotedNoEmail({
            golferName: penalty.profile.first_name,
            witnessName,
            comment: `This was your 3rd "no" vote. You must now submit an apology to the event admin to request release.`,
            eventName,
            penaltyBoxUrl,
          }),
        });
      }
    }

    revalidatePath(`/penalty-box/${slug}`);
    return { success: true, triggered };
  } catch (error) {
    console.error("Failed to cast witness vote:", error);
    return { error: "Failed to record vote" };
  }
}

/**
 * Penalized golfer submits an apology.
 */
export async function submitPenaltyApology(
  penaltyId: string,
  apologyText: string,
  slug: string
) {
  try {
    await submitApology(penaltyId, apologyText);

    // Send apology email to event admin
    const penalty = await getPenaltyById(penaltyId);
    if (!penalty) throw new Error("Penalty not found");

    const eventAdmin = await getEventAdmin(penalty.event_id);
    if (!eventAdmin) throw new Error("Event admin not found");

    const supabase = createAdminClient();
    const { data: event } = await supabase
      .from("events")
      .select("name")
      .eq("id", penalty.event_id)
      .single();

    const golferName = formatFullName(
      penalty.profile.first_name,
      penalty.profile.last_name
    );

    const siteUrl = getSiteUrl();

    await sendEmail({
      to: eventAdmin.email,
      subject: `📝 ${event?.name || "Golf Group"}: ${golferName} has submitted a Penalty Box apology`,
      html: generateApologyEmail({
        golferName,
        adminName: formatFullName(eventAdmin.first_name, eventAdmin.last_name),
        eventName: event?.name || "Golf Group",
        charge: penalty.charge,
        apologyText,
        adminDashboardUrl: `${siteUrl}/admin/events/${penalty.event_id}`,
      }),
    });

    revalidatePath(`/penalty-box/${slug}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to submit apology:", error);
    return { error: "Failed to submit apology" };
  }
}

/**
 * Admin releases a golfer from the Penalty Box.
 */
export async function adminRelease(
  penaltyId: string,
  releasedBy: string,
  slug: string
) {
  try {
    await adminReleasePenalty(penaltyId, releasedBy);

    // Send release email blast
    const penalty = await getPenaltyById(penaltyId);
    if (!penalty) throw new Error("Penalty not found");

    const eventAdmin = await getEventAdmin(penalty.event_id);
    const adminName = eventAdmin
      ? formatFullName(eventAdmin.first_name, eventAdmin.last_name)
      : "The Admin";

    const golferName = formatFullName(
      penalty.profile.first_name,
      penalty.profile.last_name
    );

    const supabase = createAdminClient();
    const { data: event } = await supabase
      .from("events")
      .select("name")
      .eq("id", penalty.event_id)
      .single();
    const eventName = event?.name || "Golf Group";

    const siteUrl = getSiteUrl();
    const penaltyBoxUrl = `${siteUrl}/penalty-box/${slug}`;
    const timeServed = formatTimeServed(penalty.created_at, new Date().toISOString());

    const subscribers = await getEventSubscribers(penalty.event_id);

    const witnesses = penalty.witnesses
      .filter((w) => w.status === "completed" && w.testimony)
      .map((w) => ({
        name: formatFullName(w.witness_profile.first_name, w.witness_profile.last_name),
        vote: w.vote as "yes" | "no",
        testimony: w.testimony || "",
      }));

    for (const subscriber of subscribers) {
      await sendEmail({
        to: subscriber.email,
        subject: `🎉 ${eventName}: ${golferName} released from the Penalty Box!`,
        html: generatePenaltyReleasedEmail({
          golferName,
          eventName,
          adminName,
          charge: penalty.charge,
          timeServed,
          witnesses,
          releasedByAdmin: true,
          penaltyBoxUrl,
        }),
        replyTo: eventAdmin?.email,
      });
    }

    revalidatePath(`/penalty-box/${slug}`);
    revalidatePath(`/admin/events/${penalty.event_id}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to release from penalty box:", error);
    return { error: "Failed to release" };
  }
}

/**
 * Check and expire overdue witnesses (called on page load).
 */
export async function checkExpiredWitnesses(penaltyId: string, slug: string) {
  try {
    const expired = await expireOverdueWitnesses(penaltyId);
    if (expired.length > 0) {
      revalidatePath(`/penalty-box/${slug}`);
    }
    return { expired };
  } catch (error) {
    console.error("Failed to check expired witnesses:", error);
    return { expired: [] };
  }
}
