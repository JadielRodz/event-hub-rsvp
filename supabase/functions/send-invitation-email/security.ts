// Request checks for the invitation email function.
// Platform JWT verification is not enough on its own: the public anon key is also a signed JWT.

export const ALLOWED_ORIGINS = ["https://synathrozo.com", "https://www.synathrozo.com"];
export const RSVP_HOSTS = new Set(["synathrozo.com", "www.synathrozo.com"]);
export const MAX_BODY_BYTES = 32_768;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIMITS = {
  to: 254,
  guestName: 100,
  eventTitle: 100,
  eventDate: 80,
  formattedEventDate: 100,
  eventLocation: 200,
  eventDescription: 1000,
  rsvpLink: 500,
  templateId: 32,
  customImageUrl: 2000,
  hostName: 100,
  specialMessage: 1000,
  registryLinks: 10,
  registryName: 50,
  registryUrl: 500,
} as const;

export interface RegistryLink {
  name: string;
  url: string;
}

export interface ValidatedInvitation {
  to: string;
  guestName?: string;
  eventTitle: string;
  eventDate: string;
  formattedEventDate?: string;
  eventLocation?: string;
  eventDescription?: string;
  rsvpLink: string;
  rsvpToken: string;
  templateId: string;
  customImageUrl?: string;
  hostName?: string;
  isConfirmation: boolean;
  registryLinks?: RegistryLink[];
  specialMessage?: string;
}

export interface DbClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function decideMethod(method: string): "preflight" | "allow" | "reject" {
  if (method === "OPTIONS") return "preflight";
  if (method === "POST") return "allow";
  return "reject";
}

export function jsonResponse(
  corsHeaders: Record<string, string>,
  status: number,
  body: { success: boolean; error?: string; id?: string },
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = JSON.parse(atob(padded));
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    return json as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Fast reject for the anon key and other non-user tokens. getUser() still has to verify the signature.
export function rejectsCredential(token: string, anonKey: string): boolean {
  if (token === anonKey) return true;
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  if (payload.role === "anon" || payload.role === "service_role") return true;
  if (typeof payload.sub !== "string" || payload.sub.length === 0) return true;
  return false;
}

export function parseJsonBody(raw: string): unknown {
  if (raw.length > MAX_BODY_BYTES) throw new Error("Payload too large");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON");
  }
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Missing required fields: to, eventTitle, eventDate, rsvpLink");
  }
  if (value.length > max) throw new Error(`${field} too long`);
  return value;
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`Invalid ${field}`);
  if (value.length > max) throw new Error(`${field} too long`);
  return value;
}

function parseHttpsUrl(raw: string, max: number, field: string): string {
  if (raw.length > max) throw new Error(`${field} too long`);
  if (!/^https:\/\/\S+$/i.test(raw) || raw.includes("\\")) throw new Error(`Invalid ${field}`);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid ${field}`);
  }
  if (url.protocol !== "https:") throw new Error(`Invalid ${field}`);
  if (url.username || url.password || url.port || !url.hostname) throw new Error(`Invalid ${field}`);
  url.hash = "";
  return url.href;
}

export function parseRsvpLink(link: string): { href: string; token: string } {
  if (typeof link !== "string" || link.length === 0) throw new Error("Invalid rsvpLink");
  if (link.length > LIMITS.rsvpLink) throw new Error("rsvpLink too long");
  if (!/^https:\/\/\S+$/i.test(link) || link.includes("\\")) throw new Error("Invalid rsvpLink");

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new Error("Invalid rsvpLink");
  }

  const pathname = url.pathname;
  const token = url.searchParams.get("token");
  const hostOk = RSVP_HOSTS.has(url.hostname.toLowerCase());
  const pathOk = pathname === "/rsvp.html" || pathname.endsWith("/rsvp.html");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !hostOk ||
    !pathOk ||
    !token ||
    !UUID_RE.test(token)
  ) {
    throw new Error("Invalid rsvpLink");
  }

  const canonical = new URL(`${url.origin}${pathname}`);
  canonical.searchParams.set("token", token);
  return { href: canonical.href, token };
}

function parseRegistryLinks(value: unknown): RegistryLink[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid registry link URL");
  if (value.length > LIMITS.registryLinks) throw new Error("Too many registry links");

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid registry link URL");
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== "string" || record.name.length > LIMITS.registryName) {
      throw new Error(typeof record.name === "string" ? "Registry link name too long" : "Invalid registry link URL");
    }
    if (typeof record.url !== "string" || record.url.length === 0) throw new Error("Invalid registry link URL");
    if (record.url.length > LIMITS.registryUrl) throw new Error("Registry link URL too long");
    if (!/^https?:\/\/\S+$/i.test(record.url) || record.url.includes("\\")) {
      throw new Error("Invalid registry link URL");
    }
    let url: URL;
    try {
      url = new URL(record.url);
    } catch {
      throw new Error("Invalid registry link URL");
    }
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || !url.hostname) {
      throw new Error("Invalid registry link URL");
    }
    url.hash = "";
    return { name: record.name, url: url.href };
  });
}

export function validatePayload(body: unknown): ValidatedInvitation {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Missing required fields: to, eventTitle, eventDate, rsvpLink");
  }
  const record = body as Record<string, unknown>;

  const to = requiredString(record.to, "to", LIMITS.to);
  if (!EMAIL_RE.test(to)) throw new Error("Invalid recipient email address");

  const eventTitle = requiredString(record.eventTitle, "eventTitle", LIMITS.eventTitle);
  const eventDate = requiredString(record.eventDate, "eventDate", LIMITS.eventDate);
  const rsvp = parseRsvpLink(typeof record.rsvpLink === "string" ? record.rsvpLink : "");

  const customImageRaw = optionalString(record.customImageUrl, "customImageUrl", LIMITS.customImageUrl);
  const customImageUrl = customImageRaw
    ? parseHttpsUrl(customImageRaw, LIMITS.customImageUrl, "customImageUrl")
    : undefined;

  const templateId = optionalString(record.templateId, "templateId", LIMITS.templateId) ?? "shabby-chic";

  return {
    to,
    guestName: optionalString(record.guestName, "guestName", LIMITS.guestName),
    eventTitle,
    eventDate,
    formattedEventDate: optionalString(record.formattedEventDate, "formattedEventDate", LIMITS.formattedEventDate),
    eventLocation: optionalString(record.eventLocation, "eventLocation", LIMITS.eventLocation),
    eventDescription: optionalString(record.eventDescription, "eventDescription", LIMITS.eventDescription),
    rsvpLink: rsvp.href,
    rsvpToken: rsvp.token,
    templateId,
    customImageUrl,
    hostName: optionalString(record.hostName, "hostName", LIMITS.hostName),
    isConfirmation: record.isConfirmation === true,
    registryLinks: parseRegistryLinks(record.registryLinks),
    specialMessage: optionalString(record.specialMessage, "specialMessage", LIMITS.specialMessage),
  };
}

function emailsMatch(stored: string, requested: string): boolean {
  return stored.trim().toLowerCase() === requested.trim().toLowerCase();
}

export async function authorizeSend(
  db: DbClient,
  userId: string,
  invitation: ValidatedInvitation,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const invitationResult = await db
      .from("invitations")
      .select("email, event_id")
      .eq("token", invitation.rsvpToken)
      .maybeSingle();

    if (invitationResult.error) {
      console.error("invitation lookup failed", invitationResult.error.message);
      return { ok: false, error: "Could not verify invitation ownership" };
    }

    const row = invitationResult.data;
    const eventId = typeof row?.event_id === "string" ? row.event_id : null;
    const storedEmail = typeof row?.email === "string" ? row.email : null;
    if (!eventId) {
      return { ok: false, error: "You do not have permission to email this invitation" };
    }

    const eventResult = await db
      .from("events")
      .select("id, user_id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventResult.error) {
      console.error("event lookup failed", eventResult.error.message);
      return { ok: false, error: "Could not verify invitation ownership" };
    }

    const event = eventResult.data;
    if (!event || event.user_id !== userId) {
      return { ok: false, error: "You do not have permission to email this invitation" };
    }
    if (!storedEmail || !emailsMatch(storedEmail, invitation.to)) {
      return { ok: false, error: "Recipient does not match this invitation" };
    }
    return { ok: true };
  } catch (error) {
    console.error("invitation ownership check failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "Could not verify invitation ownership" };
  }
}
