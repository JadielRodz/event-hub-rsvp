// Supabase Edge Function to send invitation emails via Resend.
// Deploy with JWT verification left on:
//   supabase functions deploy send-invitation-email
// Do not pass --no-verify-jwt. The anon key is itself a valid JWT, so this
// function also requires a signed-in user via auth.getUser().

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import {
  authorizeSend,
  bearerToken,
  corsHeadersFor,
  decideMethod,
  jsonResponse,
  parseJsonBody,
  rejectsCredential,
  validatePayload,
  type DbClient,
} from "./security.ts";
import { generateEmailHTML } from "./template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req.headers.get("origin"));
  const methodDecision = decideMethod(req.method);

  if (methodDecision === "preflight") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (methodDecision === "reject") {
    return jsonResponse(corsHeaders, 405, { success: false, error: "Method not allowed" }, { Allow: "POST" });
  }

  const token = bearerToken(req.headers.get("Authorization"));
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !token || rejectsCredential(token, SUPABASE_ANON_KEY)) {
    return jsonResponse(corsHeaders, 401, { success: false, error: "Unauthorized" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  let userId: string;
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.id || user.is_anonymous === true || user.role === "anon") {
      return jsonResponse(corsHeaders, 401, { success: false, error: "Unauthorized" });
    }
    userId = user.id;
  } catch {
    return jsonResponse(corsHeaders, 401, { success: false, error: "Unauthorized" });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const invitation = validatePayload(parseJsonBody(await req.text()));
    const decision = await authorizeSend(supabase as unknown as DbClient, userId, invitation);
    if (!decision.ok) {
      return jsonResponse(corsHeaders, 403, { success: false, error: decision.error });
    }

    const emailHTML = generateEmailHTML(invitation);
    const subjectTitle = invitation.eventTitle.replace(/[\r\n]+/g, " ");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("FROM_EMAIL") || "Synathrozo <invitations@synathrozo.com>",
        to: [invitation.to],
        subject: invitation.isConfirmation
          ? `RSVP Confirmed: ${subjectTitle}`
          : `You're Invited: ${subjectTitle}`,
        html: emailHTML,
      }),
    });

    const data: { id?: string; message?: string } = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to send email");
    }

    return jsonResponse(corsHeaders, 200, { success: true, id: data.id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(corsHeaders, 400, { success: false, error: errorMessage });
  }
});
