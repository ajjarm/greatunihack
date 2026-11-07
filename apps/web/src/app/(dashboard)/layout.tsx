"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand";
import "@/components/dashboard/motion.css";

const icon = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const tabs = [
  { href: "/home", label: "Home", svg: <svg {...icon}><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg> },
  { href: "/purchases", label: "Purchases", svg: <svg {...icon}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg> },
  { href: "/waiting", label: "Waiting", svg: <svg {...icon}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> },
  { href: "/insights", label: "Insights", svg: <svg {...icon}><path d="M4 19V9M10 19V5M16 19v-8M22 19H2" /></svg> },
  { href: "/profile", label: "Profile", svg: <svg {...icon}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg> },
];

function Logo({ size = 30 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden="true"><circle cx="15" cy="15" r="11" stroke="currentColor" strokeWidth="3.5" strokeDasharray="52 18" strokeLinecap="round" transform="rotate(-90 15 15)" /><circle cx="15" cy="15" r="3" fill="currentColor" /></svg>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="dashboard-shell">
    <div className="ds-blobs" aria-hidden="true"><span /><span /><span /></div>
    <div className="ds-app">
      <nav aria-label="Dashboard" className="ds-rail">
        <Link href="/home" className="ds-logo" aria-label={BRAND.name}><Logo /></Link>
        {tabs.map(({ href, label, svg }) => <Link key={href} href={href} aria-label={label} aria-current={pathname === href ? "page" : undefined} className="ds-nav">{svg}<span className="ds-tip">{label}</span></Link>)}
        <div className="ds-rail-spacer flex-1" />
      </nav>
      <div className="ds-col">
        <header className="ds-top">
          <Link href="/home" className="ds-brand"><Logo size={26} /><span>{BRAND.name}</span></Link>
          <label className="ds-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg><input type="search" placeholder="Search purchases, rules, shops" aria-label="Search" /><span className="ds-kbd">⌘ F</span></label>
          <div className="flex-1" />
          <Link href="/purchases" className="ds-icon" aria-label="Notifications"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></svg></Link>
          <Link href="/profile" className="ds-who" aria-label="Profile"><span className="ds-avatar" aria-hidden="true">S</span><span className="ds-who-name"><span className="block font-semibold">Your money</span><span className="ds-label block">Profile and rules</span></span></Link>
        </header>
        <main key={pathname} className="dashboard-page ds-main flex flex-col gap-[14px]">{children}</main>
      </div>
    </div>
  </div>;
}
