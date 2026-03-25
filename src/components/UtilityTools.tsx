"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Download, UploadCloud, FileSpreadsheet, Key, Calendar, CheckCircle2, ChevronRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkUsersCreatedToday } from "@/app/actions";

export default function UtilityTools() {
  const [activeTab, setActiveTab] = useState<"passwords" | "highlight">("passwords");
  
  const [file, setFile] = useState<File | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(p => [...p, msg]);

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Template");
    if (activeTab === "passwords") {
       ws.addRow(["Name", "Email", "Password", "Role"]);
       ws.addRow(["John Doe", "john.doe@example.com", "Wipro@123", "Employee"]);
       ws.addRow(["Jane Smith", "jane.smith@example.com", "Berri@2026", "Manager"]);
    } else {
       ws.addRow(["Name", "Email"]);
       ws.addRow(["Alice Lee", "alice@example.com"]);
       ws.addRow(["Bob Ray", "bob@example.com"]);
    }
    
    ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${activeTab}_template.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const parsed: any[] = [];
      data.forEach((row: any) => {
        let name = "Unknown", email = "", password = "", role = "";
        Object.keys(row).forEach(k => {
          const lk = k.toLowerCase().trim();
          if (lk.includes("name")) name = String(row[k]);
          else if (lk.includes("email")) email = String(row[k]);
          else if (lk.includes("password")) password = String(row[k]);
          else if (lk.includes("role")) role = String(row[k]);
        });
        if (email) parsed.push({ name: name.trim(), email: email.trim().toLowerCase(), password, role, _sourceRow: row });
      });
      setCandidates(parsed);
      addLog(`Loaded ${parsed.length} entries from ${uploadedFile.name}`);
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const processPasswords = async () => {
      setIsProcessing(true);
      setLogs([]);
      addLog("Grouping candidates by password...");

      const grouped: Record<string, any[]> = {};
      const uniqueObj: Record<string, boolean> = {};

      candidates.forEach(c => {
          if (!uniqueObj[c.email]) {
              uniqueObj[c.email] = true;
              const pw = c.password ? String(c.password).trim() : "Blank_Password";
              if (!grouped[pw]) grouped[pw] = [];
              grouped[pw].push(c);
          }
      });

      addLog(`Found ${Object.keys(grouped).length} unique passwords.`);

      const wb = new ExcelJS.Workbook();
      
      Object.entries(grouped).forEach(([pw, groupUsers], i) => {
          let safeSheetName = pw.replace(/[\[\]\:\*\?\/\\\']/g, "").substring(0, 31) || `Sheet_${i+1}`;
          let ws = wb.addWorksheet(safeSheetName);
          ws.addRow(["Name", "Email", "Password", "Role"]);
          ws.getRow(1).font = { bold: true };
          
          groupUsers.forEach(u => ws.addRow([u.name, u.email, u.password, u.role]));
      });

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `grouped_by_passwords.xlsx`);
      addLog("Downloaded Grouped Excel File!");
      setIsProcessing(false);
  };

  const processHighlighting = async () => {
      setIsProcessing(true);
      setLogs([]);
      addLog("Checking user creation dates against Supabase...");

      const emails = candidates.map(c => c.email);
      let resultMap: Record<string, boolean> = {};

      for(let i=0; i<emails.length; i+=50) {
          const chunk = emails.slice(i, i+50);
          const chunkRes = await checkUsersCreatedToday(chunk);
          resultMap = { ...resultMap, ...chunkRes };
      }

      addLog("Generating Highlighted Excel file...");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Highlighted Users");
      
      const cols = file ? Object.keys(candidates[0]?._sourceRow || { Name:1, Email:1 }) : ["Name", "Email"];
      ws.addRow(cols);
      ws.getRow(1).font = { bold: true };

      let highlightedCount = 0;
      candidates.forEach((c) => {
          const vals = cols.map(col => c._sourceRow?.[col] || c[col.toLowerCase()] || "");
          const row = ws.addRow(vals);
          
          if (resultMap[c.email]) {
              row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow highlighting natively!
              highlightedCount++;
          }
      });

      addLog(`Highlighted ${highlightedCount} out of ${candidates.length} users registered today.`);

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `highlighted_today.xlsx`);
      addLog("Downloaded Highlighted Excel File!");
      setIsProcessing(false);
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: 720, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 9999, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)", color: "#10b981", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>
          <Settings style={{ width: 11, height: 11 }} /> Utilities
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, background: "linear-gradient(135deg, #ffffff 0%, #a7f3d0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: 10 }}>
          Miscellaneous Utilities
        </h1>
        <p style={{ color: "var(--c-text-muted)", fontSize: 14, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>
          Group user sheets by designated passwords or highlight brand new operational activations.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Tab Selector */}
        <div style={{ background: "rgba(17,17,20,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "8px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {([
              { key: "passwords", icon: <Key style={{ width: 13, height: 13 }} />, label: "Group By Password" },
              { key: "highlight", icon: <Calendar style={{ width: 13, height: 13 }} />, label: "Highlight Today's Users" },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setFile(null); setCandidates([]); setLogs([]); }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${activeTab === tab.key ? "rgba(16,185,129,0.3)" : "transparent"}`,
                  background: activeTab === tab.key ? "rgba(16,185,129,0.12)" : "transparent",
                  color: activeTab === tab.key ? "#10b981" : "var(--c-text-muted)",
                  transition: "all 0.2s",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Section */}
        <div style={{ background: "rgba(17,17,20,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              ① Upload Source File
            </span>
            <button onClick={downloadTemplate} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#10b981", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
              <Download style={{ width: 12, height: 12 }} /> Demo Template
            </button>
          </div>

          <label style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 20px", border: "1.5px dashed rgba(255,255,255,0.12)", borderRadius: 12, background: "rgba(255,255,255,0.02)", cursor: "pointer" }}>
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            <UploadCloud style={{ width: 32, height: 32, color: file ? "#10b981" : "#4b5563" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: file ? "#10b981" : "var(--c-text-muted)", marginBottom: 4 }}>
                {file ? file.name : "Click or drag target file here"}
              </div>
              <div style={{ fontSize: 11, color: "var(--c-text-faint)" }}>
                {activeTab === "passwords" ? "Needs: Name, Email, Password, Role columns" : "Needs: Name, Email columns"}
              </div>
            </div>
          </label>

          {candidates.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399", fontSize: 12, fontWeight: 500 }}>
              <CheckCircle2 style={{ width: 14, height: 14 }} /> {candidates.length} candidate rows loaded and ready
            </div>
          )}
        </div>

        {/* Execute Button */}
        <button
          onClick={activeTab === "passwords" ? processPasswords : processHighlighting}
          disabled={isProcessing || !candidates.length}
          style={{
            width: "100%", padding: "14px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
            background: (isProcessing || !candidates.length) ? "rgba(16,185,129,0.25)" : "linear-gradient(135deg, #10b981, #059669)",
            color: "#fff", border: "none",
            cursor: (isProcessing || !candidates.length) ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: isProcessing ? "none" : "0 8px 24px rgba(16,185,129,0.25)",
            transition: "all 0.2s",
          }}
        >
          {isProcessing
            ? <><Settings className="w-5 h-5 animate-spin" /> Processing Data…</>
            : <>Execute {activeTab === "passwords" ? "Grouper File Structure" : "Live Highlighter"} <ChevronRight className="w-5 h-5" /></>
          }
        </button>

        {/* Log Console */}
        {logs.length > 0 && (
          <div style={{ background: "#08080a", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {logs.map((L, i) => <span key={i} style={{ color: "#4ade80", opacity: 0.85 }}>&gt; {L}</span>)}
          </div>
        )}

      </div>
    </div>
  );
}


