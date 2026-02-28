import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "./nav-links";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { first_name: string; is_super_admin: boolean } | null = null;
  let isEventAdmin = false;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, is_super_admin")
      .eq("id", user.id)
      .single();
    profile = data;

    if (!profile?.is_super_admin) {
      const { count } = await supabase
        .from("event_admins")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id);
      isEventAdmin = (count || 0) > 0;
    }
  }

  const isAdmin = profile?.is_super_admin || isEventAdmin;

  return (
    <header className="border-b border-navy-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Fairbanks Ranch Country Club"
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
          />
          <span className="hidden font-serif text-lg font-semibold tracking-wide text-navy-900 sm:inline">
            FRCC Golf Games
          </span>
        </Link>

        {user && (
          <nav className="flex items-center gap-1 text-sm font-medium sm:gap-4">
            <NavLinks isAdmin={!!isAdmin} />
          </nav>
        )}
      </div>
    </header>
  );
}
