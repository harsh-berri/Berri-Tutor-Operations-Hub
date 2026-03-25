"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, FileBarChart, Settings, LayoutDashboard } from "lucide-react";

const links = [
  { href: "/",                 label: "Dashboard",       icon: LayoutDashboard },
  { href: "/bulk-signup",      label: "Bulk Signup",     icon: Users },
  { href: "/progress-reports", label: "Reports",         icon: FileBarChart },
  { href: "/utilities",        label: "Utilities",       icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: "#0d0d0f",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
      zIndex: 20,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(16,185,129,0.14)",
            border: "1px solid rgba(16,185,129,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#10b981", fontWeight: 700, fontSize: 13, flexShrink: 0,
          }}>BT</div>
          <div>
            <div style={{ color: "#e8eaed", fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>Berri Tutor</div>
            <div style={{ color: "#4b5563", fontSize: 11, marginTop: 2 }}>Admin Portal</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px", marginBottom: 8 }}>
          Menu
        </div>
        {links.map((L) => {
          const Icon = L.icon;
          const active = pathname === L.href;
          return (
            <Link
              key={L.href}
              href={L.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                color: active ? "#10b981" : "#6b7280",
                background: active ? "rgba(16,185,129,0.08)" : "transparent",
                border: active ? "1px solid rgba(16,185,129,0.14)" : "1px solid transparent",
                transition: "all 0.12s ease",
              }}
            >
              <Icon style={{ width: 15, height: 15, flexShrink: 0, color: active ? "#10b981" : "#4b5563" }} />
              {L.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 11, color: "#374151" }}>© 2026 Berri Tutor</div>
      </div>
    </aside>
  );
}
