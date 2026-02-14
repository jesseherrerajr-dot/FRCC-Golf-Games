import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/format";
import Header from "@/components/header";

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
    <>
      <Header />
      <main className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Welcome */}
          <div className="rounded-lg border border-navy-200 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-xl font-semibold uppercase tracking-wide text-navy-900">
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
              <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
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
                <h3 className="font-serif text-lg font-semibold uppercase tracking-wide text-navy-900">
                  Your Profile
                </h3>
                <Link
                  href="/profile"
                  className="text-sm font-medium text-teal-700 hover:text-teal-600"
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
              className="mt-4 flex items-center justify-between rounded-lg border border-navy-200 bg-navy-50 p-4 shadow-sm transition-colors hover:bg-navy-100"
            >
              <div>
                <h3 className="font-semibold text-navy-900">Admin Dashboard</h3>
                <p className="text-sm text-navy-600">
                  Manage members, events, and approvals
                </p>
              </div>
              <svg className="h-5 w-5 text-navy-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          )}

          {/* Quick links */}
          <div className="mt-4 space-y-3">
            <Link
              href="/preferences"
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:bg-gray-50"
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
    </>
  );
}
