"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PushToggle } from "@/components/push-toggle";

interface NavLinksProps {
  isAdmin: boolean;
}

export function NavLinks({ isAdmin }: NavLinksProps) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/profile", label: "Profile" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <>
      {links.map((link) => {
        // Match /dashboard, /profile exactly; /admin matches /admin and /admin/*
        const isActive =
          link.href === "/admin"
            ? pathname.startsWith("/admin")
            : pathname === link.href ||
              (link.href === "/dashboard" && pathname === "/preferences");

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-2.5 transition-colors ${
              isActive
                ? "bg-navy-50 font-semibold text-navy-900"
                : "text-navy-700 hover:bg-navy-50 hover:text-navy-900"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <PushToggle />
      <form action="/auth/signout" method="POST">
        <button
          type="submit"
          className="rounded-md px-3 py-2.5 text-navy-400 transition-colors hover:bg-navy-50 hover:text-navy-700"
        >
          Sign Out
        </button>
      </form>
    </>
  );
}
