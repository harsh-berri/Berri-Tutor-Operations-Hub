"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import {
  Users, Upload, FileSpreadsheet, Key, Briefcase,
  CheckCircle2, XCircle, AlertCircle, Loader2, Download, ChevronRight,
} from "lucide-react";
import {
  getCompanies, signupSingleUser, addUsersToCompany, updateUserOnboarding
} from "@/app/actions";

type Candidate = {
  originalIndex: number;
  name: string; email: string;
  password?: string; role?: string;
  status: "pending" | "processing" | "success" | "error";
  message?: string;
};

export default function BulkSignupPortal() {
  const [file, setFile] = useState<File | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [companies, setCompanies] = useState<{ id: number; username: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [globalPassword, setGlobalPassword] = useState("");
  const [globalRole, setGlobalRole] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => { getCompanies().then(setCompanies); }, []);

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Template");
    ws.addRow(["Name", "Email", "Password", "Role"]);
    ws.addRow(["Demo User", "demo@berritutor.com", "Berri@123", "Employee"]);
    ws.getRow(1).font = { bold: true };
    saveAs(new Blob([await wb.xlsx.writeBuffer()]), "Bulk_Signup_Template.xlsx");
    toast.success("Template downloaded");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target?.result, { type: "binary" });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const parsed: Candidate[] = [];
      data.forEach((row: any, i) => {
        let name = "", email = "", password = "", role = "";
        Object.keys(row).forEach(k => {
          const lk = k.toLowerCase().trim();
          if (["name","first name","full name"].includes(lk)) name = String(row[k]);
          else if (lk.includes("email")) email = String(row[k]);
          else if (lk.includes("password")) password = String(row[k]);
          else if (lk.includes("role")) role = String(row[k]);
        });
        if (name && email) parsed.push({ originalIndex: i+1, name: name.trim(), email: email.trim().toLowerCase(), password, role, status: "pending" });
      });
      setCandidates(parsed);
      toast.success(`Loaded ${parsed.length} candidates`);
    };
    reader.readAsBinaryString(f);
  };

  const applyGlobal = (field: "password"|"role", value: string) => {
    if (!value) return;
    setCandidates(prev => prev.map(c => ({ ...c, [field]: c[field] || value })));
    toast.success(`Applied to all missing ${field}s`);
  };

  const processAll = async () => {
    if (!selectedCompanyId) return toast.error("Select a company first");
    if (candidates.find(c => !c.password)) return toast.error("Some users are missing passwords");
    if (candidates.find(c => !c.role)) return toast.error("Some users are missing roles");
    setIsProcessing(true);
    const company = companies.find(c => c.id === selectedCompanyId)!;
    for (let i = 0; i < candidates.length; i++) {
      setCandidates(prev => { const n=[...prev]; n[i].status="processing"; return n; });
      try {
        const s = await signupSingleUser(candidates[i].name, candidates[i].email, candidates[i].password!);
        if (!s.success) {
          setCandidates(prev => { const n=[...prev]; n[i].status="error"; n[i].message=s.message; return n; });
        } else {
          const o = await updateUserOnboarding(candidates[i].email, candidates[i].role!, company.id, company.username);
          setCandidates(prev => { const n=[...prev]; n[i].status=o.success?"success":"error"; n[i].message=o.success?"Onboarded":o.message; return n; });
        }
      } catch(e:any) {
        setCandidates(prev => { const n=[...prev]; n[i].status="error"; n[i].message=e.message; return n; });
      }
      setProgress(Math.round(((i+1)/candidates.length)*100));
    }
    setIsProcessing(false);
    toast.success("Processing complete");
  };

  useEffect(() => {
    if (progress === 100 && !isProcessing && selectedCompanyId) {
      const s = candidates.filter(c=>c.status==="success").map(c=>({email:c.email,role:c.role||"user"}));
      if (s.length) addUsersToCompany(selectedCompanyId as number, s).catch(console.error);
    }
  }, [progress, isProcessing]);

  const downloadReport = () => {
    const ws = XLSX.utils.json_to_sheet(candidates.map(c=>({Name:c.name,Email:c.email,Role:c.role||"",Status:c.status,Message:c.message||""})));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, "signup_results.xlsx");
    toast.success("Report downloaded");
  };

  const successCount = candidates.filter(c=>c.status==="success").length;
  const errorCount = candidates.filter(c=>c.status==="error").length;
  const missingPw   = candidates.some(c=>!c.password);
  const missingRole = candidates.some(c=>!c.role);

  const S = {
    page:        { padding: "32px 36px", maxWidth: 1060, margin: "0 auto" } as React.CSSProperties,
    heading:     { fontSize: 20, fontWeight: 600, color: "#e8eaed", marginBottom: 4 } as React.CSSProperties,
    sub:         { fontSize: 13, color: "#6b7280", marginBottom: 28 } as React.CSSProperties,
    grid:        { display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" } as React.CSSProperties,
    card:        { background: "#111114", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 } as React.CSSProperties,
    section:     { padding: "18px 20px" } as React.CSSProperties,
    divider:     { height: 1, background: "rgba(255,255,255,0.06)" } as React.CSSProperties,
    label:       { fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 8, display: "block" },
    rowBetween:  { display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
    inputWrap:   { display: "flex", gap: 8 } as React.CSSProperties,
    input:       { flex: 1, background: "#16161a", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, color: "#e8eaed", fontSize: 13, padding: "7px 11px", outline: "none" } as React.CSSProperties,
    applyBtn:    { background: "#16161a", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, color: "#d1d5db", fontSize: 12, fontWeight: 500, padding: "7px 12px", cursor: "pointer", whiteSpace: "nowrap" as const },
    primaryBtn:  { width: "100%", background: "#10b981", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 } as React.CSSProperties,
    ghostBtn:    { width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, color: "#d1d5db", fontSize: 12, fontWeight: 500, padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 } as React.CSSProperties,
    tableHead:   { padding: "10px 16px", textAlign: "left" as const, fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.06)" },
    tableCell:   { padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", verticalAlign: "middle" as const },
    empty:       { padding: "80px 20px", textAlign: "center" as const },
    smallLink:   { fontSize: 12, color: "#10b981", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" } as React.CSSProperties,
  };

  const badgeStyle = (type: "success"|"error"|"warn"|"idle"|"active") => {
    const map = {
      success: { bg: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" },
      error:   { bg: "rgba(239,68,68,0.10)",  color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" },
      warn:    { bg: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" },
      idle:    { bg: "rgba(100,116,139,0.10)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.16)" },
      active:  { bg: "rgba(139,92,246,0.10)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" },
    }[type];
    return { display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 500, background: map.bg, color: map.color, border: map.border } as React.CSSProperties;
  };

  return (
    <div style={S.page}>
      <h1 style={S.heading}>Bulk Signup</h1>
      <p style={S.sub}>Upload a roster to create and onboard candidates in bulk.</p>

      <div style={S.grid}>
        {/* Left Config Panel */}
        <div style={S.card}>
          {/* Upload */}
          <div style={S.section}>
            <div style={S.rowBetween}>
              <span style={S.label}>1. Upload Roster</span>
              <button onClick={downloadTemplate} style={S.smallLink}>
                <Download style={{ width: 11, height: 11 }} /> Template
              </button>
            </div>
            <label style={{
              position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 8, padding: "28px 16px",
              border: "1.5px dashed rgba(255,255,255,0.1)", borderRadius: 9,
              background: "rgba(255,255,255,0.015)", cursor: "pointer",
            }}>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              <Upload style={{ width: 20, height: 20, color: "#4b5563" }} />
              <span style={{ fontSize: 12, color: "#6b7280", textAlign: "center" }}>
                {file ? file.name : "Click to upload .xlsx file"}
              </span>
            </label>
            {candidates.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#34d399" }}>
                <CheckCircle2 style={{ width: 13, height: 13 }} /> {candidates.length} candidates ready
              </div>
            )}
          </div>

          <div style={S.divider} />

          {/* Company */}
          <div style={S.section}>
            <span style={S.label}>2. Company</span>
            <select value={selectedCompanyId} onChange={e => setSelectedCompanyId(Number(e.target.value))} style={{ ...S.input, width: "100%" }}>
              <option value="" disabled>Pick a company…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.username}</option>)}
            </select>
          </div>

          <div style={S.divider} />

          {/* Password */}
          <div style={S.section}>
            <div style={S.rowBetween}>
              <span style={S.label}>3. Password</span>
              {missingPw && <span style={badgeStyle("warn")}><AlertCircle style={{ width: 10, height: 10 }} /> Required</span>}
            </div>
            <div style={S.inputWrap}>
              <input type="text" value={globalPassword} onChange={e => setGlobalPassword(e.target.value)} placeholder="e.g. Berri@123" style={S.input} />
              <button onClick={() => applyGlobal("password", globalPassword)} style={S.applyBtn}>Apply all</button>
            </div>
          </div>

          <div style={S.divider} />

          {/* Role */}
          <div style={S.section}>
            <div style={S.rowBetween}>
              <span style={S.label}>4. Role</span>
              {missingRole && <span style={badgeStyle("warn")}><AlertCircle style={{ width: 10, height: 10 }} /> Required</span>}
            </div>
            <div style={S.inputWrap}>
              <input type="text" value={globalRole} onChange={e => setGlobalRole(e.target.value)} placeholder="e.g. trainee" style={S.input} />
              <button onClick={() => applyGlobal("role", globalRole)} style={S.applyBtn}>Apply all</button>
            </div>
          </div>

          <div style={S.divider} />

          {/* CTA */}
          <div style={S.section}>
            <button
              onClick={processAll}
              disabled={isProcessing || !candidates.length || !selectedCompanyId}
              style={{ ...S.primaryBtn, opacity: (isProcessing || !candidates.length || !selectedCompanyId) ? 0.45 : 1 }}
            >
              {isProcessing ? <><Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Processing…</> : <>Start Processing <ChevronRight style={{ width: 14, height: 14 }} /></>}
            </button>

            {progress > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                  <span>{successCount} ok · {errorCount} failed</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 9999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "#10b981", borderRadius: 9999, transition: "width 0.3s" }} />
                </div>
                {progress === 100 && !isProcessing && (
                  <button onClick={downloadReport} style={{ ...S.ghostBtn, marginTop: 10 }}>
                    <Download style={{ width: 13, height: 13 }} /> Download Results
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Candidates Table */}
        <div style={{ ...S.card, minHeight: 520, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
            <Users style={{ width: 15, height: 15, color: "#6b7280" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "#e8eaed" }}>Candidates</span>
            {candidates.length > 0 && <span style={{ fontSize: 12, color: "#6b7280" }}>({candidates.length})</span>}
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {candidates.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#374151", padding: 40 }}>
                <FileSpreadsheet style={{ width: 36, height: 36 }} />
                <p style={{ fontSize: 13 }}>Upload a spreadsheet to preview candidates</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Name", "Password", "Role", "Status"].map(h => (
                      <th key={h} style={S.tableHead}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, i) => (
                    <tr key={i}>
                      <td style={S.tableCell}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#e8eaed" }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{c.email}</div>
                      </td>
                      <td style={S.tableCell}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Key style={{ width: 13, height: 13, color: "#6b7280" }} />
                          <input 
                            type="text" 
                            value={c.password || ""} 
                            onChange={(e) => {
                              const n = [...candidates];
                              n[i].password = e.target.value;
                              setCandidates(n);
                            }}
                            placeholder="Missing"
                            style={{ 
                              background: "transparent", border: "none", outline: "none", 
                              color: c.password ? "#e8eaed" : "#f87171", fontSize: 13, width: 100, 
                              borderBottom: "1px dashed rgba(255,255,255,0.2)", padding: "2px 0",
                              transition: "border-color 0.2s"
                            }}
                            onFocus={(e) => e.target.style.borderBottom = "1px solid #10b981"}
                            onBlur={(e) => e.target.style.borderBottom = "1px dashed rgba(255,255,255,0.2)"}
                          />
                        </div>
                      </td>
                      <td style={S.tableCell}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Briefcase style={{ width: 13, height: 13, color: "#6b7280" }} />
                          <input 
                            type="text" 
                            value={c.role || ""} 
                            onChange={(e) => {
                              const n = [...candidates];
                              n[i].role = e.target.value;
                              setCandidates(n);
                            }}
                            placeholder="Missing"
                            style={{ 
                              background: "transparent", border: "none", outline: "none", 
                              color: c.role ? "#e8eaed" : "#f87171", fontSize: 13, width: 100, 
                              borderBottom: "1px dashed rgba(255,255,255,0.2)", padding: "2px 0",
                              transition: "border-color 0.2s"
                            }} 
                            onFocus={(e) => e.target.style.borderBottom = "1px solid #10b981"}
                            onBlur={(e) => e.target.style.borderBottom = "1px dashed rgba(255,255,255,0.2)"}
                          />
                        </div>
                      </td>
                      <td style={S.tableCell}>
                        {c.status === "pending"    && <span style={badgeStyle("idle")}>Queued</span>}
                        {c.status === "processing" && <span style={badgeStyle("active")}><Loader2 style={{ width: 10, height: 10 }} />Working</span>}
                        {c.status === "success"    && <span style={badgeStyle("success")}><CheckCircle2 style={{ width: 10, height: 10 }} />Done</span>}
                        {c.status === "error"      && <span style={badgeStyle("error")} title={c.message}><XCircle style={{ width: 10, height: 10 }} />Failed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
