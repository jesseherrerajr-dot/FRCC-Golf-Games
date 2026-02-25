/**
 * Delete a user from Supabase Auth + all cascading data.
 *
 * Usage (from project root):
 *   npx tsx scripts/delete-user.ts "Jasmine" "Herrera"
 *
 * What it does:
 *   1. Looks up the profile by first_name + last_name
 *   2. Shows you the match and asks for confirmation
 *   3. Deletes the user from auth.users (cascade removes profile + all related rows)
 *
 * Cascaded tables: profiles, event_admins, event_subscriptions, rsvps,
 *   rsvp_history, guest_requests, playing_partner_preferences, tee_time_preferences
 */

import { createClient } from "@supabase/supabase-js";
import * as readline from "readline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Make sure .env.local is loaded.");
  console.error("Run with:  npx tsx --env-file=.env.local scripts/delete-user.ts \"Jasmine\" \"Herrera\"");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const firstName = process.argv[2];
  const lastName = process.argv[3];

  if (!firstName || !lastName) {
    console.error("Usage: npx tsx scripts/delete-user.ts <FirstName> <LastName>");
    process.exit(1);
  }

  console.log(`\nSearching for "${firstName} ${lastName}"...\n`);

  // 1. Find the profile
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, ghin_number, status, is_super_admin, is_guest, created_at")
    .ilike("first_name", firstName)
    .ilike("last_name", lastName);

  if (profileError) {
    console.error("Error querying profiles:", profileError.message);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.log("No matching profile found.");
    process.exit(0);
  }

  if (profiles.length > 1) {
    console.log("Multiple matches found:");
    profiles.forEach((p, i) => {
      console.log(`  [${i}] ${p.first_name} ${p.last_name} (${p.email}) — status: ${p.status}, id: ${p.id}`);
    });
    console.log("\nPlease narrow your search or modify the script to target a specific ID.");
    process.exit(1);
  }

  const profile = profiles[0];
  console.log("Found profile:");
  console.log(`  Name:    ${profile.first_name} ${profile.last_name}`);
  console.log(`  Email:   ${profile.email}`);
  console.log(`  Phone:   ${profile.phone}`);
  console.log(`  GHIN:    ${profile.ghin_number}`);
  console.log(`  Status:  ${profile.status}`);
  console.log(`  Admin:   ${profile.is_super_admin ? "Yes" : "No"}`);
  console.log(`  Guest:   ${profile.is_guest ? "Yes" : "No"}`);
  console.log(`  Created: ${profile.created_at}`);
  console.log(`  ID:      ${profile.id}`);

  // 2. Check related data counts
  const [subs, rsvps, rsvpHistory, guestReqs] = await Promise.all([
    supabase.from("event_subscriptions").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
    supabase.from("rsvps").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
    supabase.from("rsvp_history").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
    supabase.from("guest_requests").select("id", { count: "exact", head: true }).eq("requested_by", profile.id),
  ]);

  console.log(`\nRelated data that will be deleted:`);
  console.log(`  Event subscriptions: ${subs.count ?? 0}`);
  console.log(`  RSVPs:               ${rsvps.count ?? 0}`);
  console.log(`  RSVP history:        ${rsvpHistory.count ?? 0}`);
  console.log(`  Guest requests:      ${guestReqs.count ?? 0}`);

  // 3. Confirm
  const answer = await ask("\n⚠️  Permanently delete this user and ALL related data? (yes/no): ");
  if (answer.toLowerCase() !== "yes") {
    console.log("Cancelled.");
    process.exit(0);
  }

  // 4. Delete from auth.users (cascades to profiles and all FK tables)
  console.log("\nDeleting from Supabase Auth...");
  const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id);

  if (deleteError) {
    console.error("Error deleting user:", deleteError.message);
    process.exit(1);
  }

  // 5. Verify
  const { data: verify } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profile.id);

  if (verify && verify.length === 0) {
    console.log(`\n✅ ${profile.first_name} ${profile.last_name} has been permanently deleted.`);
    console.log("   All cascading data (subscriptions, RSVPs, history, etc.) has been removed.");
  } else {
    console.warn("\n⚠️  Profile row still exists — cascade may not have fired. Check Supabase manually.");
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
