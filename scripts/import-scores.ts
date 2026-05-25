/**
 * Import weekly Stableford scores from a Golf Genius Excel export.
 *
 * Usage (from project root):
 *   npx tsx --env-file=.env.local scripts/import-scores.ts <file.xls> <game-date>
 *
 * Example:
 *   npx tsx --env-file=.env.local scripts/import-scores.ts "20260507 2026 Thursday League Leaderboard.xls" 2026-05-07
 *
 * What it does:
 *   1. Reads the "individual stableford" sheet from the Golf Genius export
 *   2. Matches player names to profiles in the database (fuzzy matching on first+last name)
 *   3. Shows a preview of all matches for confirmation
 *   4. Inserts scores into the league_scores table
 *
 * Notes:
 *   - Expects the Golf Genius XLS format with columns: Pos., Player, Club, Stableford Points, Thru
 *   - Matches are case-insensitive on first_name + last_name
 *   - If a score already exists for a golfer on that date, it will be updated (upsert)
 *   - Unmatched players are reported — you may need to check spelling or add them to the system
 *   - Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import * as path from "path";
import * as readline from "readline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Make sure .env.local is loaded.");
  console.error(
    "Run with:  npx tsx --env-file=.env.local scripts/import-scores.ts <file.xls> <game-date>"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Name Alias Map ---
// Golf Genius sometimes uses different names than what's in our database.
// Add entries here when a mismatch is discovered.
// Format: "golf genius full name (lowercase)" -> { firstName, lastName } as stored in DB.
// If only the first name differs, you can omit lastName.
const NAME_ALIASES: Record<string, { firstName: string; lastName?: string }> = {
  "douglas irwin": { firstName: "Doug" },
  "mike leiby": { firstName: "Michael" },
  "samuel dagan": { firstName: "Sam" },
  "bradley schluter": { firstName: "Brad" },
  "tony dambrosia": { firstName: "Tony", lastName: "D'Ambrosia" },
};

// --- Helpers ---

function resolveName(firstName: string, lastName: string): { firstName: string; lastName: string } {
  const key = `${firstName.trim().toLowerCase()} ${lastName.trim().toLowerCase()}`;
  const alias = NAME_ALIASES[key];
  if (alias) {
    return {
      firstName: alias.firstName,
      lastName: alias.lastName || lastName,
    };
  }
  return { firstName, lastName };
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

function normalizeNameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

interface ParsedScore {
  playerName: string;
  firstName: string;
  lastName: string;
  stablefordPoints: number;
}

function parseGolfGeniusXls(filePath: string): ParsedScore[] {
  // Try xlsx (SheetJS) first — works well with .xlsx files
  // Falls back to Python xlrd for old .xls binary files that SheetJS can't parse
  let rows: unknown[][] = [];
  let sheetName = "";

  try {
    const workbook = XLSX.readFile(filePath);

    // Find the stableford sheet (case-insensitive)
    sheetName = workbook.SheetNames.find(
      (name) => name.toLowerCase().includes("stableford")
    ) || workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // If SheetJS read the file but got no usable data, fall back to xlrd
    const dataRows = rows.filter((r) => r && (r as unknown[]).length >= 4);
    if (dataRows.length <= 1) {
      throw new Error("SheetJS returned no usable data — falling back to xlrd");
    }

    console.log(`📄 Using sheet: "${sheetName}"`);
  } catch {
    console.log("ℹ️  SheetJS couldn't parse this .xls file. Using Python xlrd...");
    rows = parseWithXlrd(filePath);
  }

  // Skip header row, parse player data
  const scores: ParsedScore[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length < 4) continue;

    const playerName = String(row[1] || "").trim();
    const points = Number(row[3]);

    if (!playerName || isNaN(points)) continue;

    // Split "First Last" name
    const nameParts = playerName.split(/\s+/);
    if (nameParts.length < 2) {
      console.warn(`  Skipping row ${i + 1}: can't parse name "${playerName}"`);
      continue;
    }

    const rawFirstName = nameParts[0];
    const rawLastName = nameParts.slice(1).join(" ");
    // Resolve aliases (e.g., "Douglas" -> "Doug", "Dambrosia" -> "D'Ambrosia")
    const { firstName, lastName } = resolveName(rawFirstName, rawLastName);

    scores.push({ playerName, firstName, lastName, stablefordPoints: points });
  }

  return scores;
}

/**
 * Fallback parser using Python's xlrd library for old .xls binary files
 * that SheetJS can't handle reliably.
 */
function parseWithXlrd(filePath: string): unknown[][] {
  const { execSync } = require("child_process");
  const helperScript = path.join(path.dirname(process.argv[1]), "parse-xls.py");

  try {
    const result = execSync(
      `python3 "${helperScript}" "${filePath}"`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );

    return JSON.parse(result.trim());
  } catch (err: unknown) {
    // Check if stderr has sheet name info
    if (err && typeof err === "object" && "stderr" in err) {
      const stderr = (err as { stderr: string }).stderr;
      const sheetLine = stderr.split("\n").find((l: string) => l.startsWith("SHEET:"));
      if (sheetLine) {
        console.log(`📄 Using sheet: "${sheetLine.replace("SHEET:", "")}"`);
      }
    }
    // If we got stdout with valid JSON, the "error" was just stderr output
    if (err && typeof err === "object" && "stdout" in err) {
      const stdout = (err as { stdout: string }).stdout.trim();
      if (stdout.startsWith("[")) {
        return JSON.parse(stdout);
      }
    }
    console.error("Python xlrd fallback failed. Make sure xlrd is installed:");
    console.error("  pip3 install xlrd");
    console.error(err);
    process.exit(1);
  }
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: npx tsx --env-file=.env.local scripts/import-scores.ts <file.xls> <game-date>");
    console.error("Example: npx tsx --env-file=.env.local scripts/import-scores.ts scores.xls 2026-05-07");
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  const gameDate = args[1];

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
    console.error(`Invalid date format: "${gameDate}". Use YYYY-MM-DD.`);
    process.exit(1);
  }

  console.log(`\n📂 Reading: ${filePath}`);
  console.log(`📅 Game date: ${gameDate}\n`);

  // 1. Parse the Excel file
  const parsedScores = parseGolfGeniusXls(filePath);
  console.log(`Found ${parsedScores.length} scores in the spreadsheet.\n`);

  // 2. Get the Thursday League event
  const { data: events, error: eventErr } = await supabase
    .from("events")
    .select("id, name, slug")
    .eq("slug", "thursday-league");

  if (eventErr || !events?.length) {
    console.error("Could not find the Thursday League event:", eventErr?.message);
    process.exit(1);
  }

  const event = events[0];
  console.log(`🏌️ Event: ${event.name} (${event.id})\n`);

  // 3. Fetch all active profiles (not just subscribed — golfers may play as guests or
  //    might have data under slightly different subscription states)
  const { data: profiles, error: profileErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("status", "active");

  if (profileErr || !profiles) {
    console.error("Could not fetch profiles:", profileErr?.message);
    process.exit(1);
  }

  // Build lookup map: "first|last" -> profile
  const profileMap = new Map<string, typeof profiles[0]>();
  for (const p of profiles) {
    const key = normalizeNameKey(p.first_name, p.last_name);
    profileMap.set(key, p);
  }

  // 4. Match scores to profiles
  const matched: { profile: typeof profiles[0]; points: number; playerName: string }[] = [];
  const unmatched: ParsedScore[] = [];

  for (const score of parsedScores) {
    const key = normalizeNameKey(score.firstName, score.lastName);
    const profile = profileMap.get(key);
    if (profile) {
      matched.push({ profile, points: score.stablefordPoints, playerName: score.playerName });
    } else {
      unmatched.push(score);
    }
  }

  // 5. Display results
  console.log(`✅ Matched: ${matched.length} / ${parsedScores.length}`);
  if (unmatched.length > 0) {
    console.log(`❌ Unmatched: ${unmatched.length}`);
  }

  console.log("\n--- Score Preview ---");
  console.log("Name                          Points   Profile Match");
  console.log("─".repeat(70));

  for (const m of matched) {
    const displayName = m.playerName.padEnd(30);
    const pts = String(m.points).padStart(4);
    console.log(`${displayName} ${pts}    ✅ ${m.profile.first_name} ${m.profile.last_name}`);
  }
  for (const u of unmatched) {
    const displayName = u.playerName.padEnd(30);
    const pts = String(u.stablefordPoints).padStart(4);
    console.log(`${displayName} ${pts}    ❌ NO MATCH`);
  }

  // 6. Check for existing scores on this date
  const { data: existing } = await supabase
    .from("league_scores")
    .select("id, profile_id")
    .eq("event_id", event.id)
    .eq("game_date", gameDate);

  if (existing && existing.length > 0) {
    console.log(`\n⚠️  ${existing.length} scores already exist for ${gameDate}. They will be updated (upserted).`);
  }

  // 7. Confirm
  if (unmatched.length > 0) {
    console.log(`\n⚠️  ${unmatched.length} player(s) could not be matched. Their scores will be skipped.`);
    console.log("   You may need to check spelling or add them to the system.\n");
  }

  const confirmed = await askConfirmation(`\nInsert ${matched.length} scores for ${gameDate}? (y/n) `);
  if (!confirmed) {
    console.log("Cancelled.");
    process.exit(0);
  }

  // 8. Upsert scores
  console.log("\nInserting scores...");

  let successCount = 0;
  let errorCount = 0;

  for (const m of matched) {
    const { error } = await supabase
      .from("league_scores")
      .upsert(
        {
          event_id: event.id,
          profile_id: m.profile.id,
          game_date: gameDate,
          stableford_points: m.points,
          metadata: { source: "golf_genius", imported_at: new Date().toISOString() },
        },
        { onConflict: "event_id,profile_id,game_date" }
      );

    if (error) {
      console.error(`  ❌ ${m.playerName}: ${error.message}`);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\n✅ Done! ${successCount} scores inserted/updated.`);
  if (errorCount > 0) {
    console.log(`❌ ${errorCount} errors.`);
  }

  // 9. Show updated totals
  const { data: allScores } = await supabase
    .from("league_scores")
    .select("profile_id, stableford_points")
    .eq("event_id", event.id);

  if (allScores) {
    const totals = new Map<string, { total: number; rounds: number }>();
    for (const s of allScores) {
      const existing = totals.get(s.profile_id) || { total: 0, rounds: 0 };
      existing.total += s.stableford_points;
      existing.rounds += 1;
      totals.set(s.profile_id, existing);
    }

    console.log(`\n📊 Season totals: ${totals.size} golfers, ${allScores.length} total score entries across all weeks.`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
