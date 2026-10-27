"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMessages } from "@/i18n/language";
import { useActiveMember } from "@/lib/active-member";
import { loadMyFamily, useSession, type Role } from "@/lib/auth";
import { menuFor } from "@/lib/menu";

// Kerangka aplikasi setelah login: menu bawah di HP, sidebar di laptop (F-11).
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useMessages();
  const pathname = usePathname();
  const session = useSession();
  const active = useActiveMember();
  const [ownerRole, setOwnerRole] = useState<Role>();

  useEffect(() => {
    if (!session) return;
    loadMyFamily(session.user).then(
      (family) => setOwnerRole(family?.role),
      () => {},
    );
  }, [session]);

  // Anak atau ART yang masuk dengan PIN memakai menu sesuai perannya sendiri.
  const role = session ? (active?.role ?? ownerRole) : undefined;
  if (!role) return children;

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <nav
        aria-label={t.mainMenu}
        className="fixed inset-x-0 bottom-0 z-10 flex overflow-x-auto border-t bg-background pb-[env(safe-area-inset-bottom)] md:sticky md:top-0 md:h-dvh md:w-56 md:flex-col md:gap-1 md:border-t-0 md:border-r md:p-3"
      >
        <span className="hidden px-3 py-2 text-xl font-bold md:block">
          KITA
        </span>
        {menuFor(role).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
            className="flex min-w-18 flex-1 flex-col items-center gap-1 py-2 text-center text-xs md:text-left opacity-70 aria-[current=page]:font-semibold aria-[current=page]:opacity-100 md:flex-none md:flex-row md:gap-3 md:rounded-md md:px-3 md:text-sm md:aria-[current=page]:bg-foreground/10"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-6 fill-none stroke-current stroke-2 md:size-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.icon} />
            </svg>
            {t[item.label]}
          </Link>
        ))}
      </nav>
      <div className="flex flex-1 flex-col pb-20 md:pb-0">{children}</div>
    </div>
  );
}
