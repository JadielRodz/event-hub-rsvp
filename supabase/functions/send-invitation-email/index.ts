// Supabase Edge Function to send invitation emails via Resend
// Deploy: supabase functions deploy send-invitation-email --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  to: string;
  guestName?: string;
  eventTitle: string;
  eventDate: string;
  eventLocation?: string;
  eventDescription?: string;
  rsvpLink: string;
  templateId: string;
  customImageUrl?: string;
  hostName?: string;
}

function generateEmailHTML(data: InvitationEmailRequest): string {
  const formattedDate = new Date(data.eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Template-specific colors
  const templateStyles: Record<string, { bg: string; accent: string; text: string; button: string }> = {
    'shabby-chic': { bg: '#fef9f6', accent: '#b87878', text: '#806868', button: '#c49090' },
    'modern-dark': { bg: '#1a1a2e', accent: '#d4af37', text: '#e0e0e0', button: '#d4af37' },
    'garden-party': { bg: '#f0f7f0', accent: '#4a7c59', text: '#2d5a3d', button: '#4a7c59' },
    'classic-formal': { bg: '#ffffff', accent: '#2c2c2c', text: '#333333', button: '#2c2c2c' },
    'custom': { bg: '#ffffff', accent: '#6366f1', text: '#374151', button: '#6366f1' }
  };

  const style = templateStyles[data.templateId] || templateStyles['shabby-chic'];
  const isDark = data.templateId === 'modern-dark';

  // Custom image section if available
  const customImageSection = data.customImageUrl ? `
    <div style="margin-bottom: 24px;">
      <img src="${data.customImageUrl}" alt="Invitation" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited!</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Georgia', serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: ${style.bg}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px; text-align: center; border-bottom: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};">
              <p style="margin: 0 0 8px; font-size: 14px; color: ${style.accent}; letter-spacing: 2px; text-transform: uppercase;">You're Invited</p>
              <h1 style="margin: 0; font-size: 32px; font-weight: normal; color: ${style.accent}; font-family: 'Georgia', serif;">${data.eventTitle}</h1>
            </td>
          </tr>

          <!-- Custom Image (if provided) -->
          ${customImageSection ? `
          <tr>
            <td style="padding: 24px 30px 0;">
              ${customImageSection}
            </td>
          </tr>
          ` : ''}

          <!-- Event Details -->
          <tr>
            <td style="padding: 24px 30px;">
              ${data.guestName ? `
              <p style="margin: 0 0 20px; font-size: 18px; color: ${style.text}; text-align: center; font-style: italic;">
                Dear ${data.guestName},
              </p>
              ` : ''}

              <p style="margin: 0 0 20px; font-size: 16px; color: ${style.text}; text-align: center; line-height: 1.6;">
                ${data.hostName ? `${data.hostName} has` : 'You have been'} invited you to celebrate this special occasion!
              </p>

              <!-- Date & Location Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 12px; color: ${style.accent}; text-transform: uppercase; letter-spacing: 1px;">When</p>
                    <p style="margin: 0 0 16px; font-size: 16px; color: ${style.text}; font-weight: 500;">${formattedDate}</p>

                    ${data.eventLocation ? `
                    <p style="margin: 0 0 4px; font-size: 12px; color: ${style.accent}; text-transform: uppercase; letter-spacing: 1px;">Where</p>
                    <p style="margin: 0; font-size: 16px; color: ${style.text};">${data.eventLocation}</p>
                    ` : ''}
                  </td>
                </tr>
              </table>

              ${data.eventDescription ? `
              <p style="margin: 0 0 24px; font-size: 15px; color: ${style.text}; text-align: center; line-height: 1.7; font-style: italic;">
                "${data.eventDescription}"
              </p>
              ` : ''}

              <!-- RSVP Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${data.rsvpLink}" style="display: inline-block; padding: 14px 40px; background-color: ${style.button}; color: ${isDark ? '#1a1a2e' : '#ffffff'}; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500; letter-spacing: 1px;">
                      RSVP Now
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 13px; color: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'}; text-align: center;">
                Click the button above to let us know if you can make it!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; text-align: center; border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}; background-color: ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)'};">
              <p style="margin: 0; font-size: 12px; color: ${isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'};">
                Sent with love via Synathrozo
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const body: InvitationEmailRequest = await req.json();

    // Validate required fields
    if (!body.to || !body.eventTitle || !body.eventDate || !body.rsvpLink) {
      throw new Error("Missing required fields: to, eventTitle, eventDate, rsvpLink");
    }

    const emailHTML = generateEmailHTML(body);

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("FROM_EMAIL") || "Synathrozo <invitations@synathrozo.com>",
        to: [body.to],
        subject: `You're Invited: ${body.eventTitle}`,
        html: emailHTML,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
