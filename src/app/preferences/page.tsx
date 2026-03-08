import { redirect } from "next/navigation";

/**
 * Preferences page has been merged into the profile page.
 * Redirect to /profile for continuity.
 */
export default function PreferencesPage() {
  redirect("/profile");
}
