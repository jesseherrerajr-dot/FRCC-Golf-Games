/**
 * Bulk-import golfers from an Excel file.
 *
 * Usage (from project root):
 *   npx tsx --env-file=.env.local scripts/import-golfers.ts golfer-import.xlsx
 *
 * What it does:
 *   1. Reads the Excel file (expects columns: First Name, Last Name, Email)
 *   2. For each row, creates a Supabase Auth user (email pre-confirmed)
 *   3. The handle_new_user() trigger auto-creates the profile
 *   4. Updates profile status to "active"
 *   5. Auto-subscribes golfer to all active events
 *
 * Notes:
 *   - Skips rows with missing email
 *   - Skips duplicate emails (already in the system)
 *   - Phone and GHIN are left null (golfers can add later)
 *   - Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Make sure .env.local is loaded.");
  console.error(
    "Run with:  npx tsx --env-file=.env.local scripts/import-golfers.ts golfer-import.xlsx"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface GolferRow {
  "First Name"?: string;
  "Last Name"?: string;
  Email?: string;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(
      "Usage: npx tsx --env-file=.env.local scripts/import-golfers.ts <filename.xlsx>"
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  console.log(`\nReading ${resolvedPath}...\n`);

  // Read Excel file
  const workbook = XLSX.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  const rows: GolferRow[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  if (rows.length === 0) {
    console.error("No data rows found in the spreadsheet.");
    process.exit(1);
  }

  console.log(`Found ${rows.length} rows in sheet "${sheetName}"\n`);

  // Validate column headers
  const firstRow = rows[0];
  const hasHeaders =
    "First Name" in firstRow && "Last Name" in firstRow && "Email" in firstRow;
  if (!hasHeaders) {
    console.error(
      "Expected column headers: 'First Name', 'Last Name', 'Email'"
    );
    console.error("Found:", Object.keys(firstRow).join(", "));
    process.exit(1);
  }

  // Get all active events for auto-subscription
  const { data: activeEvents, error: eventsError } = await supabase
    .from("events")
    .select("id, name")
    .eq("is_active", true);

  if (eventsError) {
    console.error("Error fetching events:", eventsError.message);
    process.exit(1);
  }

  console.log(
    `Will auto-subscribe to ${activeEvents?.length || 0} active event(s):`,
    activeEvents?.map((e) => e.name).join(", ") || "none"
  );
  console.log("");

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstName = row["First Name"]?.toString().trim();
    const lastName = row["Last Name"]?.toString().trim();
    const email = row["Email"]?.toString().trim().toLowerCase();

    if (!email) {
      console.log(`  Row ${i + 2}: SKIP — no email`);
      skipped++;
      continue;
    }

    if (!firstName || !lastName) {
      console.log(`  Row ${i + 2}: SKIP — missing name (${email})`);
      skipped++;
      continue;
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      console.log(
        `  Row ${i + 2}: SKIP — ${firstName} ${lastName} (${email}) already exists`
      );
      skipped++;
      continue;
    }

    // Create Supabase Auth user (email pre-confirmed, no password)
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        email_confirm: true, // skip email verification
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          phone: null,
          ghin_number: null,
          role: "golfer",
        },
      });

    if (authError) {
      console.error(
        `  Row ${i + 2}: ERROR creating auth user for ${email}: ${authError.message}`
      );
      errors++;
      continue;
    }

    const userId = authUser.user.id;

    // The handle_new_user() trigger creates the profile automatically.
    // Now update status to active (trigger sets it to pending_approval since email is confirmed).
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ status: "active" })
      .eq("id", userId);

    if (updateError) {
      console.error(
        `  Row ${i + 2}: ERROR updating profile for ${email}: ${updateError.message}`
      );
      errors++;
      continue;
    }

    // Auto-subscribe to all active events
    if (activeEvents && activeEvents.length > 0) {
      const subscriptions = activeEvents.map((event) => ({
        event_id: event.id,
        profile_id: userId,
        is_active: true,
      }));

      const { error: subError } = await supabase
        .from("event_subscriptions")
        .upsert(subscriptions, {
          onConflict: "event_id,profile_id",
          ignoreDuplicates: true,
        });

      if (subError) {
        console.error(
          `  Row ${i + 2}: WARNING — profile created but subscription failed for ${email}: ${subError.message}`
        );
      }
    }

    console.log(`  Row ${i + 2}: OK — ${firstName} ${lastName} (${email})`);
    created++;
  }

  console.log("\n========================================");
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);
  console.log(`  Total:   ${rows.length}`);
  console.log("========================================\n");

  if (created > 0) {
    console.log(
      `${created} golfer(s) are now active and subscribed. They will receive the next scheduled invite email.`
    );
    console.log(
      "They can log in anytime via magic link to update their phone and GHIN."
    );
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
