/**
 * Export event roster to Excel (.xlsx).
 *
 * Usage (from project root):
 *   npx tsx --env-file=.env.local scripts/export-roster.ts <event-slug>
 *
 * Examples:
 *   npx tsx --env-file=.env.local scripts/export-roster.ts thursday-league
 *   npx tsx --env-file=.env.local scripts/export-roster.ts saturday-morning
 *
 * To list all available events:
 *   npx tsx --env-file=.env.local scripts/export-roster.ts --list
 *
 * Output:
 *   Creates an Excel file in the project root: <event-slug>-roster-<date>.xlsx
 *   Columns: First Name, Last Name, Email, Phone, GHIN
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Make sure .env.local is loaded.");
  console.error(
    "Run with:  npx tsx --env-file=.env.local scripts/export-roster.ts <event-slug>"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function formatPhone(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

async function listEvents() {
  const { data: events, error } = await supabase
    .from("events")
    .select("name, slug, is_active")
    .order("name");

  if (error || !events) {
    console.error("Could not fetch events:", error?.message);
    process.exit(1);
  }

  console.log("\nAvailable events:\n");
  console.log("  Slug                      Name                          Active");
  console.log("  " + "─".repeat(70));
  for (const e of events) {
    const slug = e.slug.padEnd(26);
    const name = e.name.padEnd(30);
    const active = e.is_active ? "✅" : "❌";
    console.log(`  ${slug} ${name} ${active}`);
  }
  console.log("\nUsage: npx tsx --env-file=.env.local scripts/export-roster.ts <slug>\n");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--list") {
    await listEvents();
    process.exit(0);
  }

  const slug = args[0];

  // Look up event
  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (eventErr || !event) {
    console.error(`Event with slug "${slug}" not found.`);
    console.log("Run with --list to see available events.");
    process.exit(1);
  }

  console.log(`\n🏌️ Event: ${event.name}`);

  // Get subscribed golfers
  const { data: subs, error: subErr } = await supabase
    .from("event_subscriptions")
    .select("profile_id")
    .eq("event_id", event.id)
    .eq("is_active", true);

  if (subErr || !subs || subs.length === 0) {
    console.error("No active subscriptions found for this event.");
    process.exit(1);
  }

  const profileIds = subs.map((s) => s.profile_id);

  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, phone, ghin_number")
    .in("id", profileIds)
    .eq("status", "active")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (profileErr || !profiles) {
    console.error("Could not fetch profiles:", profileErr?.message);
    process.exit(1);
  }

  console.log(`📋 Found ${profiles.length} active golfers\n`);

  // Build spreadsheet
  const rows = profiles.map((p) => ({
    "First Name": p.first_name,
    "Last Name": p.last_name,
    "Email": p.email,
    "Phone": formatPhone(p.phone),
    "GHIN": p.ghin_number || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 15 },  // First Name
    { wch: 18 },  // Last Name
    { wch: 30 },  // Email
    { wch: 16 },  // Phone
    { wch: 10 },  // GHIN
  ];

  XLSX.utils.book_append_sheet(wb, ws, event.name.substring(0, 31)); // Sheet name max 31 chars

  // Write file
  const today = new Date().toISOString().split("T")[0];
  const filename = `${slug}-roster-${today}.xlsx`;
  XLSX.writeFile(wb, filename);

  console.log(`✅ Exported to: ${filename}`);
  console.log(`   ${profiles.length} golfers | Columns: First Name, Last Name, Email, Phone, GHIN\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
