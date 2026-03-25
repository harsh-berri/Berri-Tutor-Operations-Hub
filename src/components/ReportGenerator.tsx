"use client";
import { toast } from "sonner";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import { FileBarChart, UploadCloud, CheckCircle2, ChevronRight, Settings, Download } from "lucide-react";
import { cn } from "@/lib/utils";

import { fetchProgressReportData, generateSummaryWithGPT, generateCandidateSyllabusWithGPT } from "@/app/report-actions";

ChartJS.register(ArcElement, Tooltip, Legend);

type ActionConfig = {
  genProgress: boolean;
  genSummary: boolean;
  genIndividual: boolean;
  genPersonalizedExcel: boolean;
  individualFormat: "pdf" | "excel" | "both";
  individualCondition: "all" | "progress>";
  progressThreshold: number;
};

export default function ReportGenerator() {
  const [files, setFiles] = useState<File[]>([]);
  const [candidates, setCandidates] = useState<{name: string, email: string}[]>([]);
  const [config, setConfig] = useState<ActionConfig>({
    genProgress: true, genSummary: false, genIndividual: false, genPersonalizedExcel: false,
    individualFormat: "pdf", individualCondition: "all", progressThreshold: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [pieData1, setPieData1] = useState<any>(null);
  const [pieData2, setPieData2] = useState<any>(null);
  const chartRef1 = useRef<any>(null);
  const chartRef2 = useRef<any>(null);

  const updateConfig = (key: keyof ActionConfig, value: any) => {
      setConfig(prev => {
          const next = { ...prev, [key]: value };
          if (key === "genProgress" && !value) {
              next.genSummary = false;
              next.genIndividual = false;
              next.genPersonalizedExcel = false;
          }
          // Keep genPersonalizedExcel in sync with genIndividual format
          if (key === "genIndividual" || key === "genPersonalizedExcel") {
              if (next.genIndividual && next.genPersonalizedExcel) next.individualFormat = "both";
              else if (next.genIndividual) next.individualFormat = "pdf";
              else if (next.genPersonalizedExcel) next.individualFormat = "excel";
          }
          return next;
      });
  };

  const addLog = (msg: string) => setLogs(p => [...p, msg]);

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Progress_Template");
    ws.addRow(["Name", "Email"]);
    ws.addRow(["Demo User", "demo@berritutor.com"]);
    ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "Progress_Report_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []);
    if (!uploadedFiles.length) return;
    setFiles(prev => [...prev, ...uploadedFiles]);

    let allParsed: {name: string, email: string}[] = [];
    
    for (const f of uploadedFiles) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const bstr = event.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            data.forEach((row: any) => {
              let name = "Unknown", email = "";
              Object.keys(row).forEach(k => {
                const lk = k.toLowerCase().trim();
                if (lk.includes("name")) name = String(row[k]);
                else if (lk.includes("email")) email = String(row[k]);
              });
              if (email) allParsed.push({ name: name.trim(), email: email.trim().toLowerCase() });
            });
          } catch (e) { console.error(e); }
          resolve();
        };
        reader.readAsBinaryString(f);
      });
    }

    setCandidates(prev => {
      const combined = [...prev, ...allParsed];
      const unique = combined.filter((v, i, a) => a.findIndex(t => (t.email === v.email)) === i);
      addLog(`Added ${unique.length - prev.length} new entries (Total: ${unique.length}).`);
      return unique;
    });
  };

  const getChartImage = (chartRef: any) => chartRef.current?.toBase64Image() || null;

  const drawProgressBar = (doc: jsPDF, y: number, progress: number) => {
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(224, 224, 224);
      doc.roundedRect(doc.internal.pageSize.getWidth() / 2 - 90, y, 180, 8, 2, 2, "FD");
      if (progress > 0) {
          doc.setFillColor(76, 175, 80);
          doc.roundedRect(doc.internal.pageSize.getWidth() / 2 - 90, y, Math.min((progress / 100) * 180, 180), 8, 2, 2, "F");
      }
      doc.setFontSize(10);
      doc.text(`Progress: ${progress.toFixed(1)}%`, doc.internal.pageSize.getWidth() / 2, y + 6, { align: "center" });
  };

  const generateReport = async () => {
    if (!candidates.length) return toast.error("Upload Excel with valid emails.");
    setIsProcessing(true);
    setLogs(["Loading visual assets (logos)..."]);

    let berriBase64 = "", wiproBase64 = "";
    try {
       const fetchB64 = async (url: string) => new Promise<string>(async (res) => {
          const blob = await (await fetch(url)).blob();
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result as string);
          reader.readAsDataURL(blob);
       });
       berriBase64 = await fetchB64('/berri_logo.png');
       wiproBase64 = await fetchB64('/wipro_logo.png');
    } catch { addLog("Could not load logo assets. Continuing without them."); }

    const drawPdfHeader = (doc: jsPDF) => {
       if (berriBase64) doc.addImage(berriBase64, 'PNG', 14, 10, 40, 11);
       if (wiproBase64) doc.addImage(wiproBase64, 'PNG', doc.internal.pageSize.getWidth() - 44, 10, 30, 11);
       doc.setFontSize(22);
       doc.setTextColor(34, 197, 94);
       doc.text("Progress Report", doc.internal.pageSize.getWidth() / 2, 18, { align: "center" });
       doc.setTextColor(0, 0, 0);
    };

    addLog("Fetching database progress metrics...");
    try {
      const allEmails = candidates.map(c => c.email);
      let masterData: any[] = [];
      for (let i=0; i < allEmails.length; i+=50) {
          masterData = masterData.concat(await fetchProgressReportData(allEmails.slice(i, i+50)));
      }
      addLog(`Fetched ${masterData.length} total metric records.`);

      if (config.genProgress || config.genSummary) {
          addLog("Building Progress Metrics Excel...");
          const sorted = [...masterData].sort((a, b) => b.progress - a.progress);
          
          if (config.genProgress) {
             const wb = new ExcelJS.Workbook();
             const ws = wb.addWorksheet("Progress Report");
             if (berriBase64) ws.addImage(wb.addImage({ base64: berriBase64, extension: 'png' }), { tl: { col: 0, row: 1 }, ext: { width: 150, height: 40 } });
             if (wiproBase64) ws.addImage(wb.addImage({ base64: wiproBase64, extension: 'png' }), { tl: { col: 4, row: 1 }, ext: { width: 100, height: 40 } });

             ws.getRow(6).values = ["S.No", "Name", "Email : ID", "Skill Title", "Progress"];
             ws.getRow(6).font = { bold: true, color: { argb: 'FFFF8C00' }, size: 11 };
             ws.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6FB2' } };
             ws.getRow(6).alignment = { horizontal: 'center', vertical: 'middle' };

             sorted.forEach((r, i) => {
                 const row = ws.addRow([i + 1, r.name, r.email, r.title, r.progress]);
                 row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (i + 1) % 2 === 0 ? 'FFFFFFFF' : 'FFD9E8F5' } };
                 row.getCell(1).alignment = { horizontal: 'center' };
                 row.getCell(5).alignment = { horizontal: 'center' };
             });

             ws.getColumn(1).width = 8; ws.getColumn(2).width = 25; ws.getColumn(3).width = 30; ws.getColumn(4).width = 30; ws.getColumn(5).width = 12;
             ws.eachRow((r, i) => { if (i >= 6) r.eachCell(c => c.border = { top: { style: 'thin', color: { argb: 'FFBBBBBB' } }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }); });

             saveAs(new Blob([await wb.xlsx.writeBuffer()]), `progress_report_${new Date().toISOString().replace(/:/g, '-')}.xlsx`);
          }
          
          if (config.genSummary) {
             addLog("Generating Analytics for Summary PDF...");
             const completed = sorted.filter(r => r.progress >= 100).length;
             const inProgress = sorted.filter(r => r.progress > 0 && r.progress < 100).length;
             const notStarted = sorted.filter(r => r.progress === 0 && r.title && r.title !== "Not Enrolled").length;
             const notEnrolled = sorted.filter(r => r.title === "Not Enrolled").length;
             const avgProgress = sorted.length ? sorted.reduce((sum, r) => sum + r.progress, 0) / sorted.length : 0;
             
             const courseTitles: Record<string, number> = {};
             sorted.forEach(r => { if(r.title && r.title !== "Not Enrolled") courseTitles[r.title] = (courseTitles[r.title] || 0) + 1; });

             const statsText = `Total Candidates: ${sorted.length}\nCompleted: ${completed}\nIn Progress: ${inProgress}\nNot Started: ${notStarted}\nNot Enrolled: ${notEnrolled}\nAverage Progress: ${avgProgress.toFixed(1)}%\n\nEnrollments by Course:\n${Object.entries(courseTitles).map(([k,v]) => `- ${k}: ${v}`).join("\n")}`;

             addLog("Requesting GPT-4o Executive Summary...");
             const aiSummary = await generateSummaryWithGPT(statsText);
             
             setPieData1({ labels: ['Completed', 'In Progress', 'Not Started', 'Not Enrolled'], datasets: [{ data: [completed, inProgress, notStarted, notEnrolled], backgroundColor: ['#4CAF50', '#FFC107', '#F44336', '#9E9E9E'] }] });
             setPieData2({ labels: Object.keys(courseTitles).map(k => k.slice(0, 30)), datasets: [{ data: Object.values(courseTitles), backgroundColor: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'] }] });
             
             await new Promise(r => setTimeout(r, 1000));
             const doc = new jsPDF();
             drawPdfHeader(doc);
             doc.setFontSize(12);
             const lines = doc.splitTextToSize(aiSummary, 180);
             doc.text(lines, 14, 30);
             
             let currentY = 30 + lines.length * 5;
             const img1 = getChartImage(chartRef1);
             if (img1) {
                 if (currentY > 200) { doc.addPage(); currentY = 20; }
                 doc.setFontSize(16); doc.setTextColor(34, 197, 94); doc.text("Overall Completion Status", 14, currentY + 10); doc.setTextColor(0, 0, 0);
                 doc.addImage(img1, 'PNG', 40, currentY + 15, 120, 120);
                 currentY += 140;
             }
             const img2 = getChartImage(chartRef2);
             if (img2 && Object.keys(courseTitles).length > 0) {
                 if (currentY > 150) { doc.addPage(); currentY = 20; }
                 doc.setFontSize(16); doc.setTextColor(34, 197, 94); doc.text("Course Enrollments", 14, currentY + 10); doc.setTextColor(0, 0, 0);
                 autoTable(doc, { startY: currentY + 15, head: [['Course Title', 'Enrollments ']], body: Object.entries(courseTitles) });
                 doc.addImage(img2, 'PNG', 40, (doc as any).lastAutoTable.finalY + 10, 120, 120);
             }
             // Add page numbers
             const totalPages = (doc as any).internal.getNumberOfPages();
             for (let p = 1; p <= totalPages; p++) {
               doc.setPage(p);
               doc.setFontSize(9);
               doc.setTextColor(150, 150, 150);
               doc.text(`Page ${p} of ${totalPages}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
             }
             doc.save("Summary_Report.pdf");
             addLog("Summary Report downloaded!");
          }
      }

      if (config.genIndividual) {
         addLog("Starting Individual Personalised PDFs...");
         const zip = new JSZip();
         const toProcess = masterData.filter(m => config.individualCondition === "all" || m.progress >= config.progressThreshold);
         addLog(`Generating PDFs for ${toProcess.length} candidates...`);

         for (let i = 0; i < toProcess.length; i++) {
             const m = toProcess[i];
             addLog(`Processing ${m.email} (${i+1}/${toProcess.length})...`);
             const sylText = m.syllabus ? await generateCandidateSyllabusWithGPT(m.syllabus, m.mastermind, m.extracted_skills) : "No personalized syllabus available.";
             
             const idoc = new jsPDF();
             drawPdfHeader(idoc);
             idoc.setFontSize(11); idoc.setFont("helvetica", "bold");
             idoc.text("Candidate Name:", 14, 35); idoc.text("Email Address:", 14, 42); idoc.text("Enrolled Course:", 14, 49);
             idoc.setFont("helvetica", "normal");
             idoc.text(m.name, 60, 35); idoc.text(m.email, 60, 42); idoc.text(m.title, 60, 49);
             drawProgressBar(idoc, 55, m.progress);
             
             let lastY = 75;
             if (m.scoresStr) {
                 idoc.setFontSize(14); idoc.setFont("helvetica", "bold"); idoc.text("Module Assessment Scores", 14, lastY); idoc.setFont("helvetica", "normal");
                 autoTable(idoc, { startY: lastY + 5, head: [['Module', 'Score']], body: m.scoresStr.split(',').map((s: string) => [s.split(':')[0].trim(), (s.split(':')[1]||"").trim()]) });
                 lastY = (idoc as any).lastAutoTable.finalY + 10;
             }
             idoc.setFontSize(14); idoc.setFont("helvetica", "bold"); idoc.setTextColor(34, 197, 94); idoc.text("Personalized Study Plan", 14, lastY);
             idoc.setTextColor(0, 0, 0); idoc.setFont("helvetica", "normal"); idoc.setFontSize(10);
             idoc.text(idoc.splitTextToSize(sylText, idoc.internal.pageSize.getWidth() - 28), 14, lastY + 8);
             zip.file(`${m.name.replace(/\s+/g,'_')}_${m.email.split('@')[0]}_Report.pdf`, idoc.output('blob'));
         }
          saveAs(await zip.generateAsync({type:"blob"}), "Individual_Progress_Reports_PDF.zip");
          addLog("PDF Zip Downloaded!");
       }

       // Personalised Excel generation
       if (config.genPersonalizedExcel) {
          addLog("Building Personalised Excel reports...");
          const toProcess = masterData.filter(m => config.individualCondition === "all" || m.progress >= config.progressThreshold);
          addLog(`Generating Excel for ${toProcess.length} candidates...`);
          
          const excelZip = new JSZip();
          for (let i = 0; i < toProcess.length; i++) {
              const m = toProcess[i];
              addLog(`Excel: ${m.email} (${i+1}/${toProcess.length})...`);
              const sylText = !config.genIndividual // only call GPT if PDF hasn't already done it
                ? (m.syllabus ? await generateCandidateSyllabusWithGPT(m.syllabus, m.mastermind, m.extracted_skills) : "No personalized syllabus available.")
                : (m.syllabus ? await generateCandidateSyllabusWithGPT(m.syllabus, m.mastermind, m.extracted_skills) : "No personalized syllabus available.");

              const ewb = new ExcelJS.Workbook();
              const ews = ewb.addWorksheet("Personalised Report");
              
              // Header info rows
              ews.mergeCells("A1:C1");
              ews.getCell("A1").value = "Personalised Progress Report";
              ews.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF10b981" } };
              ews.getCell("A1").alignment = { horizontal: "center" };

              ews.addRow(["Candidate Name", m.name]);
              ews.addRow(["Email", m.email]);
              ews.addRow(["Course", m.title]);
              ews.addRow(["Progress", `${m.progress.toFixed(1)}%`]);
              ews.addRow([]);

              if (m.scoresStr) {
                ews.addRow(["Module Assessment Scores"]);
                ews.getRow(ews.rowCount).font = { bold: true };
                m.scoresStr.split(",").forEach((s: string) => {
                  const [mod, score] = s.split(":");
                  ews.addRow([mod?.trim(), score?.trim()]);
                });
                ews.addRow([]);
              }

              ews.addRow(["Personalised Study Plan"]);
              ews.getRow(ews.rowCount).font = { bold: true, color: { argb: "FF10b981" } };
              sylText.split("\n").forEach((line: string) => { if (line.trim()) ews.addRow([line.trim()]); });

              ews.columns.forEach(col => { col.width = 80; });
              
              const buf = await ewb.xlsx.writeBuffer();
              excelZip.file(`${m.name.replace(/\s+/g,'_')}_${m.email.split('@')[0]}_Report.xlsx`, buf);
          }
          saveAs(await excelZip.generateAsync({type:"blob"}), "Individual_Progress_Reports_Excel.zip");
          addLog("Excel Zip Downloaded!");
       }

    } catch (e: any) { addLog(`Error: ${e.message}`); }
    setIsProcessing(false);
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: 720, margin: "0 auto" }}>

      {/* Hidden chart canvases for PDF export */}
      <div style={{ position: "absolute", opacity: 0, pointerEvents: "none", zIndex: -100 }}>
        <div style={{ width: 400, height: 400 }}>{pieData1 && <Pie ref={chartRef1} data={pieData1} options={{ animation: { duration: 0 } }} />}</div>
        <div style={{ width: 400, height: 400 }}>{pieData2 && <Pie ref={chartRef2} data={pieData2} options={{ animation: { duration: 0 } }} />}</div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 9999, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)", color: "#10b981", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>
          <FileBarChart style={{ width: 11, height: 11 }} /> Reports
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, background: "linear-gradient(135deg, #ffffff 0%, #a7f3d0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: 10 }}>
          Progress Analytics Engine
        </h1>
        <p style={{ color: "var(--c-text-muted)", fontSize: 14, maxWidth: 420, margin: "0 auto", lineHeight: 1.6 }}>
          Sync database records and autonomously generate PDF and Excel visual payloads.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Step 1 — Upload */}
        <div style={{ background: "rgba(17,17,20,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>① Connect Data Sheet(s)</span>
            <button onClick={downloadTemplate} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#10b981", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
              <Download style={{ width: 12, height: 12 }} /> Demo Template
            </button>
          </div>
          <label style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 20px", border: "1.5px dashed rgba(255,255,255,0.12)", borderRadius: 12, background: "rgba(255,255,255,0.02)", cursor: "pointer" }}>
            <input type="file" multiple accept=".xlsx, .xls" onChange={handleFileUpload} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            <UploadCloud style={{ width: 32, height: 32, color: files.length > 0 ? "#10b981" : "#4b5563" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: files.length > 0 ? "#10b981" : "var(--c-text-muted)", marginBottom: 4 }}>
                {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Click or drag files here"}
              </div>
              <div style={{ fontSize: 11, color: "var(--c-text-faint)", maxWidth: 280 }}>
                {files.length > 0 ? files.map(f => f.name).join(", ") : "Accepts .xlsx or .xls with 'email' and 'name' columns"}
              </div>
            </div>
          </label>
          {candidates.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399", fontSize: 12, fontWeight: 500 }}>
              <CheckCircle2 style={{ width: 14, height: 14 }} /> {candidates.length} unique candidates loaded and ready
            </div>
          )}
        </div>

        {/* Step 2 — Pipelines */}
        <div style={{ background: "rgba(17,17,20,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "22px 24px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--c-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 14 }}>② Select Job Pipelines</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Progress Report */}
            <label onClick={() => updateConfig("genProgress", !config.genProgress)} style={{ cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 10, background: config.genProgress ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.02)", border: `1px solid ${config.genProgress ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.07)"}`, transition: "all 0.2s" }}>
              <div style={{ marginTop: 2, width: 17, height: 17, borderRadius: 5, border: `2px solid ${config.genProgress ? "#10b981" : "rgba(255,255,255,0.18)"}`, background: config.genProgress ? "#10b981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                {config.genProgress && <CheckCircle2 style={{ width: 11, height: 11, color: "#fff" }} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)", marginBottom: 3 }}>Progress Report</div>
                <div style={{ fontSize: 12, color: "var(--c-text-muted)", lineHeight: 1.5 }}>Excel spreadsheet with candidate metrics, sorting and styling</div>
              </div>
            </label>

            {/* Summary Report — gated on Progress Report */}
            <label onClick={() => config.genProgress && updateConfig("genSummary", !config.genSummary)} style={{ cursor: config.genProgress ? "pointer" : "not-allowed", opacity: config.genProgress ? 1 : 0.38, display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 10, background: config.genSummary ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.02)", border: `1px solid ${config.genSummary ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.07)"}`, transition: "all 0.2s" }}>
              <div style={{ marginTop: 2, width: 17, height: 17, borderRadius: 5, border: `2px solid ${config.genSummary ? "#10b981" : "rgba(255,255,255,0.18)"}`, background: config.genSummary ? "#10b981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                {config.genSummary && <CheckCircle2 style={{ width: 11, height: 11, color: "#fff" }} />}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>Summary Report</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 9999, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}>GPT-4o</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--c-text-muted)", lineHeight: 1.5 }}>AI-generated executive overview with pie charts and analytics PDF</div>
              </div>
            </label>

          </div>
        </div>

        {/* Execute Button */}
        <button
          onClick={generateReport}
          disabled={isProcessing || !candidates.length || (!config.genProgress && !config.genSummary)}
          style={{
            width: "100%", padding: "14px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
            background: (isProcessing || !candidates.length || (!config.genProgress && !config.genSummary))
              ? "rgba(16,185,129,0.25)" : "linear-gradient(135deg, #10b981, #059669)",
            color: "#fff", border: "none",
            cursor: (isProcessing || !candidates.length || (!config.genProgress && !config.genSummary)) ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: isProcessing ? "none" : "0 8px 24px rgba(16,185,129,0.25)",
            transition: "all 0.2s",
          }}
        >
          {isProcessing ? <><Settings className="w-5 h-5 animate-spin" /> Compiling Outputs…</> : <>Execute Analytics <ChevronRight className="w-5 h-5"/></>}
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
