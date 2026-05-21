interface Env {
  RESEND_API_KEY: string;
  NOTIFY_EMAIL: string;
  FROM_EMAIL: string;
}

interface Submission {
  url?: string;
  name?: string;
  email?: string;
  industry?: string;
  company_website?: string;
}

const INDUSTRIES = new Set([
  "Med Spa",
  "Physical Therapy",
  "Massage Therapy",
  "Mental Health Therapy",
  "Dermatology",
  "Chiropractic",
  "Acupuncture / Wellness",
  "Other",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const normalizeUrl = (raw: string): string | null => {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
};

async function sendResend(env: Env, payload: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL || !env.FROM_EMAIL) {
    return json(500, { ok: false, error: "Email service not configured." });
  }

  let body: Submission;
  try {
    body = (await request.json()) as Submission;
  } catch {
    return json(400, { ok: false, error: "Invalid request body." });
  }

  // Honeypot — bot filled the hidden field. Pretend success, send nothing.
  if (typeof body.company_website === "string" && body.company_website.trim() !== "") {
    return json(200, { ok: true });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const industry = (body.industry ?? "").trim();
  const rawUrl = (body.url ?? "").trim();

  if (!name || name.length > 200) return json(400, { ok: false, error: "Please enter your name." });
  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { ok: false, error: "Please enter a valid email." });
  if (!INDUSTRIES.has(industry)) return json(400, { ok: false, error: "Please pick an industry." });
  const url = normalizeUrl(rawUrl);
  if (!url) return json(400, { ok: false, error: "Please enter a valid website URL." });

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ua = request.headers.get("user-agent") ?? "unknown";
  const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? "??";

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeIndustry = escapeHtml(industry);
  const safeUrl = escapeHtml(url);

  const prospectText =
    `Hi ${name.split(/\s+/)[0] || "there"},\n\n` +
    `Thanks for requesting an audit for ${url}. We're on it.\n\n` +
    `You'll get your 12-page audit by email within 24 hours (Mon–Fri). It ends with a link to book a 15-min consult — totally optional.\n\n` +
    `If you have any context you want us to weigh in (target patients, current ad spend, what's been frustrating you about the site), just hit reply.\n\n` +
    `— Michael\n` +
    `Hyperworkflow`;

  const notifyText =
    `New audit request\n\n` +
    `URL:       ${url}\n` +
    `Name:      ${name}\n` +
    `Email:     ${email}\n` +
    `Industry:  ${industry}\n` +
    `\n` +
    `IP:        ${ip} (${country})\n` +
    `UA:        ${ua}\n`;

  const notifyHtml =
    `<h2 style="margin:0 0 12px;font:600 16px system-ui">New audit request</h2>` +
    `<table style="font:14px system-ui;border-collapse:collapse">` +
    `<tr><td style="padding:4px 12px 4px 0;color:#666">URL</td><td><a href="${safeUrl}">${safeUrl}</a></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td>${safeName}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#666">Industry</td><td>${safeIndustry}</td></tr>` +
    `<tr><td style="padding:4px 12px 4px 0;color:#666">IP</td><td>${escapeHtml(ip)} (${escapeHtml(country)})</td></tr>` +
    `</table>` +
    `<p style="font:12px system-ui;color:#888;margin-top:16px">Reply to this email to respond to ${safeName} directly.</p>`;

  const headers = { "X-Hyperworkflow-Source": "audit-form" };

  try {
    await Promise.all([
      sendResend(env, {
        from: env.FROM_EMAIL,
        to: email,
        reply_to: env.NOTIFY_EMAIL,
        subject: "Your Hyperworkflow audit is queued",
        text: prospectText,
        headers,
      }),
      sendResend(env, {
        from: env.FROM_EMAIL,
        to: env.NOTIFY_EMAIL,
        reply_to: email,
        subject: `New audit request: ${url}`,
        text: notifyText,
        html: notifyHtml,
        headers,
      }),
    ]);
  } catch (err) {
    console.error("audit submission send failed", err);
    return json(502, { ok: false, error: "Could not send email. Please try again or email hello@hyperworkflow.ai." });
  }

  return json(200, { ok: true });
};
