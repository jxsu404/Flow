"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/app", label: "Hoy" },
  { href: "/app/tareas", label: "Tareas" },
  { href: "/app/horario", label: "Horario" },
];

export function AppHeader({ name }: { name?: string | null }) {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3 md:px-8">
      <div className="flex items-center gap-6">
        <Link href="/app" className="font-semibold tracking-tight">
          Flow
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "text-foreground" : "hover:text-foreground"}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">{name ?? "Cuenta"}</span>
        <Button variant="ghost" size="sm" type="button" onClick={() => void signOut({ callbackUrl: "/" })}>
          Salir
        </Button>
      </div>
    </header>
  );
}
