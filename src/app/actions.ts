"use server";

import { supabase } from "@/lib/supabase";

export async function getCompanies() {
  try {
    const { data, error } = await supabase
      .from("company_data")
      .select("id, username")
      .order("username");
      
    if (error) throw error;
    
    // Some usernames might be null or empty, filter them out if needed
    return data.filter((c) => c.username);
  } catch (error: any) {
    console.error("Error fetching companies:", error);
    return [];
  }
}

export async function signupSingleUser(name: string, email: string, password: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const signupEndpoint = `${baseUrl}/api/auth/signup`;

  try {
    const payload = {
      name,
      email,
      password,
      confirmPassword: password,
    };

    const response = await fetch(signupEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 201) {
      return { success: true, message: "Success" };
    } else {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // failed to parse json
      }
      return { success: false, message: errorMsg };
    }
  } catch (error: any) {
    console.error(`Signup failed for ${email}:`, error.message);
    return { success: false, message: error.message || "Connection failed" };
  }
}

export async function updateUserOnboarding(
  email: string,
  role: string,
  companyId: number,
  companyUsername: string
) {
  try {
    // Find user by email
    const { data: fetchResp, error: fetchErr } = await supabase
      .from("user_data")
      .select("id, email, onboarding, company_id")
      .ilike("email", email)
      .limit(1);

    if (fetchErr) throw fetchErr;

    if (!fetchResp || fetchResp.length === 0) {
      return { success: false, message: "User not found in user_data" };
    }

    const userId = fetchResp[0].id;

    // Update user
    const { error: updateErr } = await supabase
      .from("user_data")
      .update({
        onboarding: true,
        company_id: companyId,
        role: role,
        company_username: companyUsername,
      })
      .eq("id", userId);

    if (updateErr) throw updateErr;

    return { success: true, message: "Updated successfully" };
  } catch (error: any) {
    console.error(`Update onboarding failed for ${email}:`, error);
    return { success: false, message: error.message };
  }
}

export async function addUsersToCompany(companyId: number, usersToInvite: { email: string; role: string }[]) {
  try {
    const { data: existingData, error: fetchErr } = await supabase
      .from("company_data")
      .select("invited_users")
      .eq("id", companyId)
      .single();

    if (fetchErr) throw fetchErr;

    let existingInvitedUsers: any[] = [];
    if (existingData && Array.isArray(existingData.invited_users)) {
      existingInvitedUsers = existingData.invited_users;
    }

    const existingEmails = new Set(
      existingInvitedUsers
        .filter((u) => typeof u === "object" && u !== null)
        .map((u) => String(u.email || "").trim().toLowerCase())
    );

    const usersToAdd: any[] = [];
    const seenInBatch = new Set();
    let skippedDuplicates = 0;

    for (const user of usersToInvite) {
      const email = String(user.email || "").trim().toLowerCase();
      if (!email) continue;

      if (existingEmails.has(email) || seenInBatch.has(email)) {
        skippedDuplicates += 1;
        continue;
      }

      usersToAdd.push(user);
      seenInBatch.add(email);
    }

    if (usersToAdd.length === 0) {
      return { success: true, added: 0, skipped: skippedDuplicates, message: "No new users to add" };
    }

    const mergedInvitedUsers = [...existingInvitedUsers, ...usersToAdd];

    const { error: updateErr } = await supabase
      .from("company_data")
      .update({ invited_users: mergedInvitedUsers })
      .eq("id", companyId);

    if (updateErr) throw updateErr;

    return { success: true, added: usersToAdd.length, skipped: skippedDuplicates, message: "Success" };
  } catch (error: any) {
    console.error("Error adding invited users:", error);
    return { success: false, added: 0, skipped: 0, message: error.message };
  }
}

export async function checkUsersCreatedToday(emails: string[]) {
  try {
    const norm = emails.map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!norm.length) return {};
    
    const { data, error } = await supabase
      .from("user_data")
      .select("email, created_at")
      .in("email", norm);
      
    if (error || !data) return {};
    
    // Convert to local YYYY-MM-DD
    const todayDate = new Date().toISOString().split('T')[0];
    const resultMap: Record<string, boolean> = {};
    
    data.forEach(u => {
        if (u.created_at) {
            const uDate = new Date(u.created_at).toISOString().split('T')[0];
            resultMap[u.email.toLowerCase()] = (uDate === todayDate);
        } else {
            resultMap[u.email.toLowerCase()] = false;
        }
    });
    
    return resultMap;
  } catch (e) {
    console.error(e);
    return {};
  }
}
