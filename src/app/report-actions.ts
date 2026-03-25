"use server";

import { supabase } from "@/lib/supabase";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeEmail(email: string) {
  return (email || "").trim().toLowerCase();
}

export async function fetchProgressReportData(emails: string[]) {
  try {
    const normEmails = emails.map(normalizeEmail).filter(Boolean);
    if (!normEmails.length) return [];

    // 1. Fetch Users
    const { data: usersData, error: uErr } = await supabase
      .from("user_data")
      .select("id, email, name")
      .in("email", normEmails);

    if (uErr) throw uErr;
    if (!usersData || !usersData.length) return [];

    const userMap = new Map();
    usersData.forEach((u) => {
      userMap.set(normalizeEmail(u.email), u);
    });

    const userIds = usersData.map((u) => u.id);

    // 2. Fetch Enrollments
    const { data: enrollData, error: eErr } = await supabase
      .from("enrollments")
      .select("user_id, deployment_id, progress")
      .in("user_id", userIds);

    if (eErr) throw eErr;

    const depIds = Array.from(new Set((enrollData || []).map((e) => e.deployment_id)));

    // 3. Fetch Deployments
    let depMap = new Map();
    if (depIds.length > 0) {
      const { data: depData, error: dErr } = await supabase
        .from("deployments")
        .select("id, title")
        .in("id", depIds);
      if (dErr) throw dErr;
      depData?.forEach((d) => depMap.set(d.id, d.title));
    }

    // 4. Fetch Personalized Syllabus
    const { data: psData, error: pErr } = await supabase
      .from("personalized_syllabus")
      .select("user_id, deployment_id, syllabus, mastermind_report, extracted_skills")
      .in("user_id", userIds);
    if (pErr) throw pErr;

    const psMap = new Map(); // key: user_id_dep_id
    psData?.forEach((p) => {
      psMap.set(`${p.user_id}_${p.deployment_id}`, p);
    });

    // 5. Fetch Learning & Verification Sessions for scores
    const { data: lsData } = await supabase
      .from("learning_session")
      .select("user_id, deployment_id, topic_id, isCompleted")
      .in("user_id", userIds)
      .eq("isCompleted", true);

    const { data: vsData } = await supabase
      .from("verification_session")
      .select("user_id, deployment_id, topic_id, module_id, score, isCompleted, progress")
      .in("user_id", userIds); // Need scores even if not completed maybe?

    const scoreMap = new Map(); // user_id_dep_id -> module_id -> val
    vsData?.forEach(v => {
       const key = `${v.user_id}_${v.deployment_id}`;
       if(!scoreMap.has(key)) scoreMap.set(key, []);
       const val = v.score !== null ? v.score : v.progress;
       if (v.module_id && val !== null) {
          scoreMap.get(key).push({ mod: v.module_id, val });
       }
    });

    const results = [];

    // Assemble Data
    for (const email of normEmails) {
      const u = userMap.get(email);
      if (!u) {
        results.push({ email, name: "Unknown", progress: 0, title: "Not Enrolled", status: "Not Found" });
        continue;
      }

      const enrs = (enrollData || []).filter((e) => e.user_id === u.id);
      if (enrs.length === 0) {
        results.push({ email, name: u.name, progress: 0, title: "Not Enrolled", status: "Not Enrolled" });
        continue;
      }

      // We might have multiple enrollments, loop them
      for (const e of enrs) {
        const title = depMap.get(e.deployment_id) || "Unknown Course";
        const ps = psMap.get(`${u.id}_${e.deployment_id}`);
        
        // Actual progress calculation (simplified from python by just using cached progress unless we explicitly trace topics)
        // Given complexity, python script falls back to cached. Let's return cached here.
        const progress = e.progress || 0;

        const sm = scoreMap.get(`${u.id}_${e.deployment_id}`) || [];
        const scoresStr = sm.map((s: any) => `${s.mod}: ${s.val}`).join(", ");

        results.push({
          user_id: u.id,
          deployment_id: e.deployment_id,
          email,
          name: u.name,
          title,
          progress: Number(progress),
          cached_progress: Number(progress),
          syllabus: ps?.syllabus || null,
          mastermind: ps?.mastermind_report || null,
          extracted_skills: ps?.extracted_skills || null,
          scoresStr,
          status: "Enrolled"
        });
      }
    }

    return results;
  } catch (error: any) {
    console.error("fetchProgressReportData error:", error);
    throw error;
  }
}

export async function generateSummaryWithGPT(statsText: string) {
  try {
    const prompt = `You are an expert data analyst and executive reporter. Create a short, positive, and encouraging executive summary based on the following candidate progress metrics. The report is intended for external company stakeholders to highlight the successful onboarding and learning trajectory. Keep the tone professional yet highly positive, emphasizing achievements, strong participation, and forward momentum. Do not make it too long, just a few impactful paragraphs. Output the summary in plain text using ONLY standard newlines for separation. Do NOT use markdown bold/italic asterisks (*). Do NOT use HTML tags. Do NOT output JSON format. Just use clear text. If you want to make a line a heading, simply put it on its own line and capitalize it entirely.\n\nMetrics:\n${statsText}`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    });
    return response.choices[0].message.content || "Summary Generation Success.";
  } catch (err: any) {
    console.error("OpenAI Error (Summary):", err.message);
    return "Error generating summary.";
  }
}

export async function generateCandidateSyllabusWithGPT(syllabus: any, mastermind: any, extracted_skills: any) {
  try {
    const hasSyl = syllabus && Object.keys(syllabus).length > 0;
    const hasMastermind = mastermind && Object.keys(mastermind).length > 0;
    
    if (!hasSyl) return "Not Calibrated";

    let prompt = "";
    if (hasSyl && !hasMastermind) {
      prompt = `You are an expert curriculum designer. Here is a baseline syllabus for a candidate. Modify this syllabus so that it feels highly customized for an individual candidate. Use analysis, jump around, do some modifications. CRITICAL: Do not deviate significantly from the original topics. Do NOT add new unassociated topics; stay strictly within the scope of the provided syllabus.\nCRITICAL: Ensure the phrasing, tone, and arrangement feel entirely unique to this candidate so no two syllabuses ever look identical.\nCRITICAL: Do NOT use phrases like 'Customised Syllabus', 'Personalized Syllabus', or similar titles. Do NOT use any day-based progression like 'Day 1', 'Day 2', 'Day One'. Remove any such references.\n\nOutput the result as plain, human-readable text. Use standard formatting (newlines, hyphens for lists). Do NOT output JSON. Do NOT use markdown bold/italic asterisks.\n\nSyllabus: ${JSON.stringify(syllabus)}`;
    } else if (hasSyl && hasMastermind) {
      prompt = `You are an expert technical interviewer and curriculum designer. You have the following inputs for a candidate:\n1. Mastermind Report: ${JSON.stringify(mastermind)}\n2. Extracted Skills: ${JSON.stringify(extracted_skills)}\n3. Original Syllabus: ${JSON.stringify(syllabus)}\n\nCreate a fully personalized, human-readable study syllabus for this candidate. Base the personalization on the strengths and gaps from the Mastermind Report and Extracted Skills (if available). CRITICAL: Do not deviate significantly from the Original Syllabus topics. Structure the path using only the existing topics in a personalized order or framing.\nCRITICAL: Ensure the phrasing, tone, and arrangement feel entirely unique to this candidate so no two syllabuses ever look identical.\nCRITICAL: Do NOT use phrases like 'Customised Syllabus', 'Personalized Syllabus', or similar titles. Do NOT use any day-based progression like 'Day 1', 'Day 2', 'Day One'. Remove any such references.\n\nOutput only the final personalized syllabus text. Use clear plain text with newlines and hyphens for lists. Do NOT output JSON and do NOT use markdown bold/italic asterisks.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2500,
      temperature: 0.7,
    });
    
    let text = response.choices[0].message.content || "";
    text = text.replace(/\bday\s*(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/gi, '');
    text = text.replace(/(customised|personalized|customized)\s+syllabus/gi, '');
    return text.trim();
  } catch (err: any) {
    console.error("OpenAI Error (Syllabus):", err.message);
    return "Error generating personalized syllabus text.";
  }
}
