import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import JoinEventForm from "./join-event-form";
import Link from "next/link";
import Image from "next/image";

export default async function JoinEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Look up event by slug
  const { data: event } = await supabase
    .from("events")
    .select("id, name, description, day_of_week, frequency, is_active, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!event) {
    notFound();
  }

  if (!event.is_active) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="inline-block">
            <Image
              src="/logo.png"
              alt="Fairbanks Ranch Country Club"
              width={64}
              height={64}
              className="mx-auto mb-4 h-16 w-16 object-contain"
            />
            <h1 className="font-serif text-3xl font-bold uppercase tracking-wide text-navy-900">
              FRCC Golf Games
            </h1>
          </Link>
          <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 px-6 py-4 text-sm text-yellow-800">
            <p className="font-semibold">{event.name}</p>
            <p className="mt-1">This event is not currently accepting registrations.</p>
          </div>
          <Link
            href="/join"
            className="mt-4 inline-block text-sm font-medium text-teal-700 hover:text-teal-600"
          >
            Register for all events instead →
          </Link>
        </div>
      </main>
    );
  }

  return <JoinEventForm event={event} />;
}
