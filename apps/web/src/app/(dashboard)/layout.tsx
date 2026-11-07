"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/home", label: "Home", icon: "⌂" },
  { href: "/purchases", label: "Purchases", icon: "▤" },
  { href: "/waiting", label: "Waiting", icon: "◷" },
  { href: "/insights", label: "Insights", icon: "◫" },
  { href: "/profile", label: "Profile", icon: "○" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] md:flex" style={{ fontFamily: "var(--font-sans)" }}>
    <nav aria-label="Dashboard" className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)] md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-r md:border-t-0 md:shadow-none">
      <div className="hidden px-6 py-8 text-xl font-bold md:block">Your money</div>
      <div className="flex justify-around px-1 py-2 md:block md:px-3">
        {tabs.map(({ href, label, icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] md:mb-1 md:min-h-11 md:flex-row md:justify-start md:gap-3 md:px-4 md:text-sm ${pathname === href ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`} style={{ borderRadius: "var(--radius-sm)" }}><span aria-hidden="true" className="text-xl leading-none md:w-6">{icon}</span>{label}</Link>)}
      </div>
    </nav>
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-7 sm:px-6 md:px-10 md:pb-12 md:pt-10">{children}</main>
  </div>;
}
