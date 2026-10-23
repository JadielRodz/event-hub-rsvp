import { escapeHtml, type ValidatedInvitation } from "./security.ts";

export function generateEmailHTML(data: ValidatedInvitation): string {
  // Use the pre-formatted date from the browser if available.
  // This keeps the email on the time the creator intended.
  let formattedDate: string;

  if (data.formattedEventDate) {
    formattedDate = data.formattedEventDate;
  } else {
    const date = new Date(data.eventDate);
    formattedDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  const safeDate = escapeHtml(formattedDate);

  const templateStyles: Record<string, { bg: string; accent: string; text: string; button: string }> = {
    "shabby-chic": { bg: "#fef9f6", accent: "#b87878", text: "#806868", button: "#c49090" },
    "modern-dark": { bg: "#1a1a2e", accent: "#d4af37", text: "#e0e0e0", button: "#d4af37" },
    "garden-party": { bg: "#f0f7f0", accent: "#4a7c59", text: "#2d5a3d", button: "#4a7c59" },
    "classic-formal": { bg: "#ffffff", accent: "#2c2c2c", text: "#333333", button: "#2c2c2c" },
    "custom": { bg: "#ffffff", accent: "#6366f1", text: "#374151", button: "#6366f1" },
  };

  const style = templateStyles[data.templateId] || templateStyles["shabby-chic"];
  const isDark = data.templateId === "modern-dark";

  const customImageSection = data.customImageUrl
    ? `
    <div style="margin-bottom: 24px;">
      <img src="${escapeHtml(data.customImageUrl)}" alt="Invitation" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
    </div>
  `
    : "";

  const safeRsvpLink = escapeHtml(data.rsvpLink);

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
            <td style="padding: 30px 30px 20px; text-align: center; border-bottom: 1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"};">
              <p style="margin: 0 0 8px; font-size: 14px; color: ${style.accent}; letter-spacing: 2px; text-transform: uppercase;">${data.isConfirmation ? "You're Attending!" : "You're Invited"}</p>
              <h1 style="margin: 0; font-size: 32px; font-weight: normal; color: ${style.accent}; font-family: 'Georgia', serif;">${escapeHtml(data.eventTitle)}</h1>
            </td>
          </tr>

          <!-- Custom Image (if provided) -->
          ${customImageSection
            ? `
          <tr>
            <td style="padding: 24px 30px 0;">
              ${customImageSection}
            </td>
          </tr>
          `
            : ""}

          <!-- Event Details -->
          <tr>
            <td style="padding: 24px 30px;">
              ${data.guestName
                ? `
              <p style="margin: 0 0 20px; font-size: 18px; color: ${style.text}; text-align: center; font-style: italic;">
                Dear ${escapeHtml(data.guestName)},
              </p>
              `
                : ""}

              <p style="margin: 0 0 20px; font-size: 16px; color: ${style.text}; text-align: center; line-height: 1.6;">
                ${data.isConfirmation
                  ? "Thank you for your RSVP! We're excited to celebrate with you."
                  : `${data.hostName ? `${escapeHtml(data.hostName)} has` : "You have been"} invited you to celebrate this special occasion!`}
              </p>

              <!-- Date & Location Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"}; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 12px; color: ${style.accent}; text-transform: uppercase; letter-spacing: 1px;">When</p>
                    <p style="margin: 0 0 16px; font-size: 16px; color: ${style.text}; font-weight: 500;">${safeDate}</p>

                    ${data.eventLocation
                      ? `
                    <p style="margin: 0 0 4px; font-size: 12px; color: ${style.accent}; text-transform: uppercase; letter-spacing: 1px;">Where</p>
                    <p style="margin: 0; font-size: 16px; color: ${style.text};">${escapeHtml(data.eventLocation)}</p>
                    `
                      : ""}
                  </td>
                </tr>
              </table>

              ${data.eventDescription
                ? `
              <p style="margin: 0 0 24px; font-size: 15px; color: ${style.text}; text-align: center; line-height: 1.7; font-style: italic;">
                "${escapeHtml(data.eventDescription)}"
              </p>
              `
                : ""}

              ${data.specialMessage
                ? `
              <!-- Special Activities / Schedule -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${isDark ? "rgba(212,175,55,0.1)" : "rgba(99,102,241,0.08)"}; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${style.accent};">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: ${style.accent}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">✨ Special Activities</p>
                    <p style="margin: 0; font-size: 15px; color: ${style.text}; line-height: 1.8; white-space: pre-line;">${escapeHtml(data.specialMessage)}</p>
                  </td>
                </tr>
              </table>
              `
                : ""}

              <!-- RSVP Button or Registry Links -->
              ${data.isConfirmation && data.registryLinks && data.registryLinks.length > 0
                ? `
              <p style="margin: 0 0 12px; font-size: 14px; color: ${style.text}; text-align: center; font-style: italic;">
                The hosts have shared their gift registry:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    ${data.registryLinks.map((link) => `
                      <a href="${escapeHtml(link.url)}" style="display: inline-block; padding: 12px 24px; background-color: ${style.button}; color: ${isDark ? "#1a1a2e" : "#ffffff"}; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; margin: 4px;">
                        🎁 ${escapeHtml(link.name)}
                      </a>
                    `).join("")}
                  </td>
                </tr>
              </table>
              `
                : data.isConfirmation
                ? `
              <p style="margin: 0; font-size: 14px; color: ${isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}; text-align: center;">
                We look forward to seeing you there!
              </p>
              `
                : `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${safeRsvpLink}" style="display: inline-block; padding: 14px 40px; background-color: ${style.button}; color: ${isDark ? "#1a1a2e" : "#ffffff"}; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500; letter-spacing: 1px;">
                      RSVP Now
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 13px; color: ${isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}; text-align: center;">
                Click the button above to let us know if you can make it!
              </p>
              `}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; text-align: center; border-top: 1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}; background-color: ${isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)"};">
              <p style="margin: 0; font-size: 12px; color: ${isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"};">
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
