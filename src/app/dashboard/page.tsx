import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/format";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not logged in, redirect to home
  if (!user) {
    redirect("/");
  }

  // Fetch the user's profile from the profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-green-800">
            FRCC Golf Games
          </h1>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign Out
            </button>
          </form>
        </div>

        {/* Welcome */}
        <div className="mt-6 rounded-lg border border-green-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Welcome, {profile?.first_name || user.user_metadata?.first_name || "Golfer"}!
          </h2>

          {/* Status badge */}
          {profile?.status === "pending_approval" && (
            <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              Your registration is pending admin approval. You&apos;ll receive
              weekly invites once an administrator confirms your membership.
            </div>
          )}

          {profile?.status === "active" && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Your account is active. You&apos;ll receive weekly invites for
              your subscribed events.
            </div>
          )}

          {profile?.status === "deactivated" && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Your account has been deactivated. Please contact an
              administrator if you believe this is an error.
            </div>
          )}
        </div>

        {/* Profile summary */}
        {profile && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Your Profile
              </h3>
              <Link
                href="/profile"
                className="text-sm font-medium text-green-700 hover:text-green-600"
              >
                Edit
              </Link>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">
                  {profile.first_name} {profile.last_name}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{profile.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">
                  {formatPhoneDisplay(profile.phone) || "Not set"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">GHIN</dt>
                <dd className="font-medium text-gray-900">
                  {profile.ghin_number || "Not set"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium text-gray-900 capitalize">
                  {profile.status?.replace(/_/g, " ")}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Admin link */}
        {profile?.is_super_admin && (
          <Link
            href="/admin"
            className="mt-4 flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-4 shadow-sm hover:bg-purple-100"
          >
            <div>
              <h3 className="font-semibold text-purple-800">Admin Dashboard</h3>
              <p className="text-sm text-purple-600">
                Manage members, events, and approvals
              </p>
            </div>
            <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        )}

        {/* Quick links */}
        <div className="mt-4 space-y-3">
          <Link
            href="/preferences"
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:bg-gray-50"
          >
            <div>
              <h3 className="font-semibold text-gray-900">Playing Partner Preferences</h3>
              <p className="text-sm text-gray-600">
                Manage your preferred playing partners
              </p>
            </div>
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      </div>
    </main>
  );
}
