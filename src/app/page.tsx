import Link from "next/link";
import { Users, FileBarChart, Settings, ArrowRight, Zap } from "lucide-react";

const tools = [
  {
    href: "/bulk-signup",
    title: "Bulk Signup",
    desc: "Create and onboard large batches of candidates from an Excel roster.",
    icon: Users,
    tag: "User Mgmt",
    color: "#6366f1",
    colorDim: "rgba(99,102,241,0.10)",
    colorBorder: "rgba(99,102,241,0.18)",
  },
  {
    href: "/progress-reports",
    title: "Progress Reports",
    desc: "Generate Excel exports, GPT-4o executive summaries, and personalised PDFs.",
    icon: FileBarChart,
    tag: "Analytics",
    color: "#10b981",
    colorDim: "rgba(16,185,129,0.10)",
    colorBorder: "rgba(16,185,129,0.18)",
  },
  {
    href: "/utilities",
    title: "Utilities",
    desc: "Group user files by password or highlight today's newly activated users.",
    icon: Settings,
    tag: "Tools",
    color: "#f59e0b",
    colorDim: "rgba(245,158,11,0.10)",
    colorBorder: "rgba(245,158,11,0.18)",
  },
];

export default function Home() {
  return (
    <div style={{ padding: "40px 36px", maxWidth: 900, margin: "0 auto" }}>
      
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 9999,
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)",
          color: "#10b981", fontSize: 11, fontWeight: 600,
          letterSpacing: "0.05em", textTransform: "uppercase",
          marginBottom: 18,
        }}>
          <Zap style={{ width: 11, height: 11 }} /> Admin Portal
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 800, background: "linear-gradient(135deg, #ffffff 0%, #a7f3d0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          Berri Tutor Operations Hub
        </h1>
        <p style={{ color: "var(--c-text-muted)", fontSize: 15, lineHeight: 1.65, maxWidth: 500, fontWeight: 400 }}>
          Manage candidates, generate progress analytics, and run bulk operational workflows — from a single interface.
        </p>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 32,
      }}>
        {[
          { label: "Modules Available", value: "3" },
          { label: "Export Formats", value: "Excel · PDF · ZIP" },
          { label: "AI Engine", value: "GPT-4o" },
        ].map(s => (
          <div key={s.label} className="card-raised" style={{
            padding: "16px 20px", display: "flex", flexDirection: "column", gap: "6px",
            transition: "all 0.3s ease"
          }}>
            <div style={{ fontSize: 11, color: "var(--c-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--c-text)", background: "linear-gradient(90deg, #fff, #a7f3d0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tool cards */}
      <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
        Modules
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {tools.map((T) => {
          const Icon = T.icon;
          return (
            <Link href={T.href} key={T.href} style={{ textDecoration: "none" }}>
              <div className="tool-row">
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: T.colorDim, border: `1px solid ${T.colorBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon style={{ width: 20, height: 20, color: T.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--c-text)", letterSpacing: "-0.01em" }}>{T.title}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 9999,
                      background: T.colorDim, border: `1px solid ${T.colorBorder}`, color: T.color,
                      lineHeight: 1.4, textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>{T.tag}</span>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--c-text-muted)", lineHeight: 1.5, fontWeight: 400 }}>{T.desc}</p>
                </div>
                <ArrowRight style={{ width: 16, height: 16, color: "#374151", flexShrink: 0 }} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
