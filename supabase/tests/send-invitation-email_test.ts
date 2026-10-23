// Run: deno test --allow-read supabase/tests/send-invitation-email_test.ts
import { generateEmailHTML } from "../functions/send-invitation-email/template.ts";
import {
  authorizeSend,
  bearerToken,
  corsHeadersFor,
  decideMethod,
  escapeHtml,
  parseJsonBody,
  parseRsvpLink,
  rejectsCredential,
  validatePayload,
  type DbClient,
  type ValidatedInvitation,
} from "../functions/send-invitation-email/security.ts";

const TOKEN = "550e8400-e29b-41d4-a716-446655440000";
const RSVP = `https://synathrozo.com/rsvp.html?token=${TOKEN}`;

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected && JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}\nActual ${JSON.stringify(actual)}`);
  }
}

function assertThrows(fn: () => unknown, includes: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(includes)) {
      throw new Error(`Expected error containing ${JSON.stringify(includes)}, got ${JSON.stringify(message)}`);
    }
    return;
  }
  throw new Error(`Expected function to throw ${JSON.stringify(includes)}`);
}

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.sig`;
}

function emailJsPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  // Same fields js/email.js sends. hostName is optional and currently omitted.
  return {
    to: "guest@example.com",
    guestName: "Ada Lovelace",
    eventTitle: "Garden Party",
    eventDate: "2026-06-15T14:00:00-04:00",
    formattedEventDate: "Saturday, June 15, 2026 at 2:00 PM",
    eventLocation: "The Park",
    eventDescription: "Bring a dish",
    rsvpLink: RSVP,
    templateId: "garden-party",
    customImageUrl: "https://dhzabegjcdzxgtguisuc.supabase.co/storage/v1/object/public/invitation-images/u/1.jpg",
    isConfirmation: false,
    registryLinks: [{ name: "Amazon", url: "https://www.amazon.com/registries/example" }],
    specialMessage: "Cake at 4",
    ...overrides,
  };
}

function fakeDb(handlers: {
  invitation?: { data: Record<string, unknown> | null; error: { message: string } | null };
  event?: { data: Record<string, unknown> | null; error: { message: string } | null };
}): DbClient {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  if (table === "invitations") {
                    return Promise.resolve(handlers.invitation ?? { data: null, error: null });
                  }
                  if (table === "events") return Promise.resolve(handlers.event ?? { data: null, error: null });
                  return Promise.resolve({ data: null, error: { message: "unknown table" } });
                },
              };
            },
          };
        },
      };
    },
  };
}

Deno.test("escapeHtml encodes HTML metacharacters", () => {
  assertEquals(escapeHtml(`Tom & <Jane> "O'Hara"`), "Tom &amp; &lt;Jane&gt; &quot;O&#x27;Hara&quot;");
});

Deno.test("CORS preflight stays open and other methods are rejected", () => {
  assertEquals(decideMethod("OPTIONS"), "preflight");
  assertEquals(decideMethod("POST"), "allow");
  assertEquals(decideMethod("GET"), "reject");
  assertEquals(decideMethod("PUT"), "reject");
  assertEquals(corsHeadersFor("https://www.synathrozo.com")["Access-Control-Allow-Origin"], "https://www.synathrozo.com");
  assertEquals(corsHeadersFor("https://evil.example")["Access-Control-Allow-Origin"], "https://synathrozo.com");
  assertEquals(corsHeadersFor("https://synathrozo.com")["Access-Control-Allow-Methods"], "POST, OPTIONS");
});

Deno.test("anon key and non-user JWTs are rejected before getUser", () => {
  assertEquals(bearerToken("Bearer user-token"), "user-token");
  assertEquals(bearerToken("bearer user-token"), "user-token");
  assertEquals(bearerToken("Basic abc"), null);
  assert(rejectsCredential("anon-key-value", "anon-key-value"));
  assert(rejectsCredential(jwt({ role: "anon", iss: "supabase" }), "other"));
  assert(rejectsCredential(jwt({ role: "service_role", sub: "root" }), "other"));
  assert(rejectsCredential(jwt({ role: "authenticated" }), "other"));
  assert(rejectsCredential("not-a-jwt", "other"));
  assert(!rejectsCredential(jwt({ role: "authenticated", sub: "user-1" }), "anon-key-value"));
});

Deno.test("rsvp links are limited to the Synathrozo RSVP page", () => {
  assertEquals(parseRsvpLink(RSVP).token, TOKEN);
  assertEquals(parseRsvpLink(`https://www.synathrozo.com/rsvp.html?token=${TOKEN}`).href, `https://www.synathrozo.com/rsvp.html?token=${TOKEN}`);
  assertEquals(
    parseRsvpLink(`https://synathrozo.com/app/rsvp.html?token=${TOKEN}&next=https://evil.example`).href,
    `https://synathrozo.com/app/rsvp.html?token=${TOKEN}`,
  );

  for (const link of [
    `http://synathrozo.com/rsvp.html?token=${TOKEN}`,
    `http://localhost:8000/rsvp.html?token=${TOKEN}`,
    `https://127.0.0.1/rsvp.html?token=${TOKEN}`,
    `https://synathrozo.com.evil.example/rsvp.html?token=${TOKEN}`,
    `https://evil.example/rsvp.html?token=${TOKEN}`,
    `https://evil.synathrozo.com/rsvp.html?token=${TOKEN}`,
    `https://user:pass@synathrozo.com/rsvp.html?token=${TOKEN}`,
    `https://synathrozo.com@evil.example/rsvp.html?token=${TOKEN}`,
    `https://synathrozo.com:444/rsvp.html?token=${TOKEN}`,
    `https://synathrozo.com/rsvp.html`,
    `https://synathrozo.com/other.html?token=${TOKEN}`,
    `javascript:https://synathrozo.com/rsvp.html?token=${TOKEN}`,
    `https://synathrozo.com/rsvp.html?token=${TOKEN}\\@evil.example`,
  ]) {
    assertThrows(() => parseRsvpLink(link), "Invalid rsvpLink");
  }
});

Deno.test("email.js payload passes validation", () => {
  const validated = validatePayload(emailJsPayload());
  assertEquals(validated.to, "guest@example.com");
  assertEquals(validated.rsvpToken, TOKEN);
  assertEquals(validated.isConfirmation, false);
  assertEquals(validated.templateId, "garden-party");
  assertEquals(validated.customImageUrl?.startsWith("https://dhzabegjcdzxgtguisuc.supabase.co/"), true);

  const confirmation = validatePayload(emailJsPayload({ isConfirmation: true, guestName: null, customImageUrl: null }));
  assertEquals(confirmation.isConfirmation, true);
  assertEquals(confirmation.guestName, undefined);
  assertEquals(confirmation.customImageUrl, undefined);
});

Deno.test("unsafe links, markup, and oversized fields are rejected", () => {
  assertThrows(() => validatePayload(emailJsPayload({ rsvpLink: "http://localhost:8000/rsvp.html?token=" + TOKEN })), "Invalid rsvpLink");
  assertThrows(() => validatePayload(emailJsPayload({ customImageUrl: "javascript:alert(1)" })), "Invalid customImageUrl");
  assertThrows(() => validatePayload(emailJsPayload({ customImageUrl: "http://cdn.example/a.png" })), "Invalid customImageUrl");
  assertThrows(() => validatePayload(emailJsPayload({ hostName: "h".repeat(101) })), "hostName too long");
  assertThrows(() => validatePayload(emailJsPayload({ formattedEventDate: "d".repeat(101) })), "formattedEventDate too long");
  assertThrows(() => validatePayload(emailJsPayload({ eventTitle: "t".repeat(101) })), "eventTitle too long");
  assertThrows(() => validatePayload(emailJsPayload({ to: "not-an-email" })), "Invalid recipient email address");
  assertThrows(() => validatePayload(emailJsPayload({ registryLinks: [{ name: "Shop", url: "javascript:alert(1)" }] })), "Invalid registry link URL");
  assertThrows(() => parseJsonBody("x".repeat(32_769)), "Payload too large");
});

Deno.test("user-supplied values are escaped in both email layouts", () => {
  const invitation = validatePayload(emailJsPayload({
    eventTitle: "TITLE<",
    guestName: "GUEST<",
    hostName: `HOST< & "x"`,
    formattedEventDate: "DATE<",
    eventLocation: "LOC<",
    eventDescription: "DESC<",
    specialMessage: "SPECIAL<",
    customImageUrl: "https://cdn.example.com/img.png?q=1&x=2",
    isConfirmation: false,
  }));
  const html = generateEmailHTML(invitation);
  for (const raw of ["TITLE<", "GUEST<", "HOST<", "DATE<", "LOC<", "DESC<", "SPECIAL<"]) {
    assert(!html.includes(raw), `raw marker leaked: ${raw}`);
  }
  assert(html.includes("TITLE&lt;"));
  assert(html.includes("GUEST&lt;"));
  assert(html.includes("HOST&lt; &amp; &quot;x&quot;"));
  assert(html.includes("DATE&lt;"));
  assert(html.includes("LOC&lt;"));
  assert(html.includes("DESC&lt;"));
  assert(html.includes("SPECIAL&lt;"));
  assert(html.includes("q=1&amp;x=2"));
  assert(!html.includes("q=1&x=2"));
  assert(html.includes(`href="${escapeHtml(invitation.rsvpLink)}"`));
  assert(!html.includes("<script"));

  const confirmation = validatePayload(emailJsPayload({
    isConfirmation: true,
    registryLinks: [{ name: "REG<", url: "https://shop.example.com/r?id=1&ref=2" }],
  }));
  const confirmationHtml = generateEmailHTML(confirmation);
  assert(confirmationHtml.includes("REG&lt;"));
  assert(confirmationHtml.includes("id=1&amp;ref=2"));
  assert(!confirmationHtml.includes("REG<"));
  assert(!confirmationHtml.includes("id=1&ref=2"));
});

Deno.test("only the event owner can email that invitation's guest", async () => {
  const invitation = validatePayload(emailJsPayload()) as ValidatedInvitation;
  const owned = await authorizeSend(fakeDb({
    invitation: { data: { email: "Guest@Example.com", event_id: "event-1" }, error: null },
    event: { data: { id: "event-1", user_id: "user-1" }, error: null },
  }), "user-1", invitation);
  assertEquals(owned, { ok: true });

  const stranger = await authorizeSend(fakeDb({
    invitation: { data: { email: "guest@example.com", event_id: "event-1" }, error: null },
    event: { data: { id: "event-1", user_id: "owner" }, error: null },
  }), "user-1", invitation);
  assertEquals(stranger.ok, false);

  const hiddenEvent = await authorizeSend(fakeDb({
    invitation: { data: { email: "guest@example.com", event_id: "event-1" }, error: null },
    event: { data: null, error: null },
  }), "user-1", invitation);
  assertEquals(hiddenEvent.ok, false);

  const wrongRecipient = await authorizeSend(fakeDb({
    invitation: { data: { email: "other@example.com", event_id: "event-1" }, error: null },
    event: { data: { id: "event-1", user_id: "user-1" }, error: null },
  }), "user-1", invitation);
  assertEquals(wrongRecipient, { ok: false, error: "Recipient does not match this invitation" });
});

Deno.test("js/email.js still posts the user access token", async () => {
  const emailJs = await Deno.readTextFile(new URL("../../js/email.js", import.meta.url));
  const handler = await Deno.readTextFile(new URL("../functions/send-invitation-email/index.ts", import.meta.url));
  const deploy = await Deno.readTextFile(new URL("../deploy-email-function.sh", import.meta.url));
  const readme = await Deno.readTextFile(new URL("../../README.md", import.meta.url));

  assert(emailJs.includes("method: 'POST'"));
  assert(emailJs.includes("window.supabaseClient.auth.getSession()"));
  assert(emailJs.includes("`Bearer ${session.access_token}`"));
  assert(emailJs.includes("rsvpLink: rsvpLink"));
  assert(emailJs.includes("to: invitation.email"));
  assert(!emailJs.includes("SUPABASE_ANON_KEY"));

  assert(handler.includes("supabase.auth.getUser(token)"));
  assert(handler.includes("rejectsCredential(token, SUPABASE_ANON_KEY)"));
  assert(!handler.split("\n").some((line) => /functions deploy .*--no-verify-jwt/.test(line)));

  const deployCommands = deploy.split("\n").filter((line) => /^\s*supabase functions deploy /.test(line));
  assertEquals(deployCommands, ["supabase functions deploy send-invitation-email"]);

  const readmeCommands = readme.split("\n").filter((line) => line.trim() === "supabase functions deploy send-invitation-email --no-verify-jwt");
  assertEquals(readmeCommands, []);
  assert(readme.includes("supabase functions deploy send-invitation-email"));
});
