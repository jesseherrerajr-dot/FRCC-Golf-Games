"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function createGuestRequest(formData: FormData) {
  const token = formData.get("token") as string;
  const guestFirstName = formData.get("guest_first_name") as string;
  const guestLastName = formData.get("guest_last_name") as string;
  const guestEmail = formData.get("guest_email") as string;
  const guestPhone = formData.get("guest_phone") as string;
  const guestGhin = (formData.get("guest_ghin") as string) || ""; // Allow empty GHIN

  if (
    !token ||
    !guestFirstName ||
    !guestLastName ||
    !guestEmail ||
    !guestPhone
  ) {
    return { error: "Name, email, and phone are required" };
  }

  const supabase = createAdminClient();

  // Look up the RSVP by token to get profile_id and schedule_id
  const { data: rsvp, error: rsvpError } = await supabase
    .from("rsvps")
    .select("id, profile_id, schedule_id, status")
    .eq("token", token)
    .single();

  if (rsvpError || !rsvp) {
    return { error: "Invalid RSVP token" };
  }

  // Verify the member is "in" (only "in" members can request guests)
  if (rsvp.status !== "in") {
    return {
      error: "You must be confirmed to play before requesting a guest",
    };
  }

  // Check how many guest requests this member already has for this week
  const { count: existingCount } = await supabase
    .from("guest_requests")
    .select("*", { count: "exact", head: true })
    .eq("schedule_id", rsvp.schedule_id)
    .eq("requested_by", rsvp.profile_id)
    .in("status", ["pending", "approved"]);

  const MAX_GUESTS_PER_MEMBER = 3;

  if ((existingCount || 0) >= MAX_GUESTS_PER_MEMBER) {
    return {
      error: `You can only request up to ${MAX_GUESTS_PER_MEMBER} guests per week. You currently have ${existingCount} guest${existingCount !== 1 ? "s" : ""} requested.`,
    };
  }

  // Create the guest request
  const { error: insertError } = await supabase.from("guest_requests").insert({
    schedule_id: rsvp.schedule_id,
    requested_by: rsvp.profile_id,
    guest_first_name: guestFirstName,
    guest_last_name: guestLastName,
    guest_email: guestEmail,
    guest_phone: guestPhone,
    guest_ghin_number: guestGhin,
    status: "pending",
  });

  if (insertError) {
    console.error("Error creating guest request:", insertError);
    return { error: "Failed to create guest request" };
  }

  revalidatePath(`/rsvp/${token}`);
  return { success: true };
}

export async function getGuestRequests(token: string) {
  const supabase = createAdminClient();

  // Look up the RSVP by token
  const { data: rsvp } = await supabase
    .from("rsvps")
    .select("id, profile_id, schedule_id, status")
    .eq("token", token)
    .single();

  if (!rsvp) {
    return [];
  }

  // Fetch all guest requests for this member for this week
  const { data: guestRequests } = await supabase
    .from("guest_requests")
    .select("*")
    .eq("schedule_id", rsvp.schedule_id)
    .eq("requested_by", rsvp.profile_id)
    .order("created_at", { ascending: true });

  return guestRequests || [];
}

export async function getPastGuests(token: string) {
  const supabase = createAdminClient();

  // Look up the RSVP by token to get the member's profile_id
  const { data: rsvp } = await supabase
    .from("rsvps")
    .select("profile_id")
    .eq("token", token)
    .single();

  if (!rsvp) {
    return [];
  }

  // Fetch all unique past guests for this member
  // Group by guest email to get unique guests (most recent request per guest)
  const { data: pastGuests } = await supabase
    .from("guest_requests")
    .select("guest_first_name, guest_last_name, guest_email, guest_phone, guest_ghin_number")
    .eq("requested_by", rsvp.profile_id)
    .order("created_at", { ascending: false });

  if (!pastGuests) {
    return [];
  }

  // Deduplicate by email (keep most recent)
  const uniqueGuests = pastGuests.reduce((acc, guest) => {
    if (!acc.find((g: { guest_email: string }) => g.guest_email === guest.guest_email)) {
      acc.push(guest);
    }
    return acc;
  }, [] as typeof pastGuests);

  return uniqueGuests;
}
