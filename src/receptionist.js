import crypto from "node:crypto";

// Receptionist, not expert: the bot only identifies the firm, collects the
// caller's details and promises a call-back. It never quotes or advises.
export const STEPS = ["name", "phone", "postcode", "job", "callback"];
export const MAX_ATTEMPTS = 2;

const EMERGENCY =
  /\b(emergenc|urgent|asap|leak(ing)?|flood|burst|no (heat|hot water|power)|sparks?|smoke|collapse|storm damage|roof (is )?off|water (coming|pouring)|dangerous|gas)\b/i;

export function escapeXml(s) {
  return String(s ?? "").replace(
    /[<>&'"]/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[c],
  );
}

export function normalisePhone(raw) {
  let d = String(raw || "").replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "44" + d.slice(1);
  if (/^44\d{10}$/.test(d)) return "+" + d;
  if (/^\d{11,15}$/.test(d)) return "+" + d;
  return "";
}

export function isUkMobile(e164) {
  return /^\+447\d{9}$/.test(String(e164 || ""));
}

// Speech-to-text hands back "N R 1 2 3 A B" or "nr12 3ab" — squash both.
export function normalisePostcode(raw) {
  const s = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const m = s.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  if (m) return `${m[1]} ${m[2]}`;
  if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(s)) return s;
  return "";
}

export function isEmergency(text) {
  return EMERGENCY.test(String(text || ""));
}

export function nextStep(step) {
  const i = STEPS.indexOf(step);
  return i < 0 || i === STEPS.length - 1 ? null : STEPS[i + 1];
}

export function prompt(step, client, attempt = 0) {
  const name = client?.business_name || "the office";
  const again = attempt > 0 ? "Sorry, I didn't catch that. " : "";
  switch (step) {
    case "greeting":
      return `Hi, you've reached ${name}. Everyone's out on a job right now, but I can take your details and get someone to call you straight back.`;
    case "name":
      return `${again}Can I take your name, please?`;
    case "phone":
      return `${again}Is the number you're calling from the best one to ring you back on? Press 1 for yes, or say the number you'd like us to use.`;
    case "postcode":
      return `${again}And what's the postcode of the property?`;
    case "job":
      return `${again}Briefly, what's the job you need doing?`;
    case "callback":
      return `${again}When's the best time to call you back?`;
    case "goodbye":
      return `Thanks, that's all noted. Someone from ${name} will call you back as soon as they're free. Goodbye.`;
    case "goodbye_emergency":
      return `Thanks. That sounds urgent, so I'm flagging it now and someone from ${name} will ring you as quickly as they can. Goodbye.`;
    default:
      return "";
  }
}

// Returns { value } when usable, or {} to ask again / skip.
export function interpret(step, { speech, digits, caller } = {}) {
  const s = String(speech || "").trim();
  switch (step) {
    case "phone": {
      if (String(digits || "").startsWith("1")) return { value: caller || "" };
      const spoken = normalisePhone(
        s.replace(/\b(oh|zero)\b/gi, "0").replace(/\D/g, ""),
      );
      if (spoken) return { value: spoken };
      if (
        /\b(yes|yeah|yep|this one|this number|that's fine|correct)\b/i.test(s)
      )
        return { value: caller || "" };
      return {};
    }
    case "postcode": {
      const pc = normalisePostcode(s);
      return pc ? { value: pc } : {};
    }
    default:
      return s.length >= 2 ? { value: s.slice(0, 300) } : {};
  }
}

export function advance(call, input, client) {
  const step = call.step || STEPS[0];
  const answers = { ...(call.answers || {}) };
  let attempts = Number(call.attempts || 0);
  const got = interpret(step, { ...input, caller: call.caller });
  let moveOn = false;
  if (got.value) {
    answers[step] = got.value;
    moveOn = true;
  } else {
    attempts += 1;
    if (attempts >= MAX_ATTEMPTS) {
      if (step === "phone") answers.phone = call.caller || "";
      moveOn = true;
    }
  }
  const emergency = Boolean(call.emergency) || isEmergency(answers.job);
  if (!moveOn) return { step, attempts, answers, emergency, done: false };
  const next = nextStep(step);
  return {
    step: next || "done",
    attempts: 0,
    answers,
    emergency,
    done: !next,
  };
}

export function gatherTwiml({ say, action, step }) {
  const digits = step === "phone" ? ' numDigits="1"' : "";
  const hints =
    step === "postcode"
      ? ' hints="postcode,N R,I P,P E,Norwich,Norfolk"'
      : step === "job"
        ? ' hints="roof,leak,damp,driveway,gutter,boiler,quote,fence,extension"'
        : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Gather input="speech dtmf"${digits} action="${escapeXml(action)}" method="POST" language="en-GB" speechTimeout="auto" timeout="6" actionOnEmptyResult="true"${hints}>` +
    `<Say voice="Google.en-GB-Neural2-A">${escapeXml(say)}</Say></Gather>` +
    `<Redirect method="POST">${escapeXml(action)}</Redirect></Response>`
  );
}

export function sayHangupTwiml(text) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Say voice="Google.en-GB-Neural2-A">${escapeXml(text)}</Say><Hangup/></Response>`
  );
}

export function rejectTwiml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`;
}

export function leadSms(client, call) {
  const a = call.answers || {};
  const phone = a.phone || call.caller || "unknown number";
  const lines = [
    `${call.emergency ? "URGENT " : ""}New call for ${client.business_name}`,
    `${a.name || "Caller"} — ${phone}`,
    a.postcode ? `Postcode: ${a.postcode}` : null,
    `Job: ${a.job || "not given"}`,
    `Call back: ${a.callback || "any time"}`,
  ].filter(Boolean);
  return lines.join("\n").slice(0, 600);
}

export function callerSms(client, call) {
  const site = client.website ? ` ${client.website}` : "";
  const owner = client.owner_name ? client.owner_name : client.business_name;
  return `Thanks for calling ${client.business_name}. ${owner} has your details and will call you back ${call.answers?.callback ? `(${call.answers.callback})` : "shortly"}.${site}`.slice(
    0,
    320,
  );
}

export function weeklySummarySms(client, calls, { since, until } = {}) {
  const n = calls.length;
  const urgent = calls.filter((c) => c.emergency).length;
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })
      : "";
  const range =
    since && until ? ` (${fmt(since)}–${fmt(until)})` : " this week";
  if (!n)
    return `${client.business_name}: no missed calls caught${range}. Your bot's on duty.`;
  const jobs = calls
    .slice(0, 3)
    .map(
      (c) =>
        `• ${c.answers?.name || "Caller"} – ${(c.answers?.job || "job").slice(0, 40)}`,
    );
  return [
    `${client.business_name}: ${n} missed call${n === 1 ? "" : "s"} caught${range}${urgent ? `, ${urgent} urgent` : ""}.`,
    ...jobs,
    n > 3 ? `…and ${n - 3} more on your dashboard.` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 600);
}

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function validateClient(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const business_name = String(r.business_name || "").trim();
  if (business_name.length < 2) return { error: "business_name is required" };
  const owner_mobile = normalisePhone(r.owner_mobile);
  if (!owner_mobile)
    return { error: "owner_mobile must be a valid phone number" };
  const twilio_number = normalisePhone(r.twilio_number);
  if (!twilio_number)
    return { error: "twilio_number must be a valid phone number" };
  const slug = slugify(r.slug || business_name);
  if (!slug) return { error: "slug is required" };
  const website = String(r.website || "").trim();
  if (website && !/^https?:\/\/\S+$/i.test(website))
    return { error: "website must be a full URL" };
  const options = r.options && typeof r.options === "object" ? r.options : {};
  return {
    client: {
      slug,
      business_name: business_name.slice(0, 120),
      trade:
        String(r.trade || "")
          .trim()
          .slice(0, 60) || null,
      owner_name:
        String(r.owner_name || "")
          .trim()
          .slice(0, 80) || null,
      owner_mobile,
      twilio_number,
      website: website || null,
      options: {
        callerText: Boolean(options.callerText ?? true),
        emergencyFlag: Boolean(options.emergencyFlag ?? true),
      },
      status: ["trial", "active", "paused", "cancelled"].includes(r.status)
        ? r.status
        : "trial",
    },
  };
}

// Twilio signs webhooks with HMAC-SHA1 of the full URL plus the POST params
// (sorted by key, key+value concatenated), keyed by the auth token.
export function twilioSignature(authToken, url, params = {}) {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + String(params[k]))
      .join("");
  return crypto.createHmac("sha1", authToken).update(data).digest("base64");
}

export function verifyTwilioSignature(authToken, url, params, header) {
  if (!authToken) return true;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(String(header || ""));
  return (
    expected.length === given.length && crypto.timingSafeEqual(expected, given)
  );
}

export function renderDashboard(client, calls) {
  const row = (c) => {
    const a = c.answers || {};
    const when = new Date(c.created_at).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const phone = a.phone || c.caller || "";
    return `<li class="${c.emergency ? "urgent" : ""}"><div class="when">${escapeXml(when)}${c.emergency ? ' <span class="tag">URGENT</span>' : ""}</div><div class="who"><strong>${escapeXml(a.name || "Caller")}</strong>${phone ? ` · <a href="tel:${escapeXml(phone)}">${escapeXml(phone)}</a>` : ""}${a.postcode ? ` · ${escapeXml(a.postcode)}` : ""}</div><div class="job">${escapeXml(a.job || "No job details")}</div><div class="cb">Call back: ${escapeXml(a.callback || "any time")}</div></li>`;
  };
  const n = calls.length;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeXml(client.business_name)} – calls caught</title><style>
body{font:16px/1.45 system-ui,sans-serif;margin:0;background:#f5f6f8;color:#111}header{background:#111;color:#fff;padding:18px 16px}h1{font-size:20px;margin:0}p.sub{margin:4px 0 0;opacity:.8;font-size:14px}main{padding:12px 16px 40px;max-width:720px;margin:0 auto}ul{list-style:none;padding:0;margin:0}li{background:#fff;border-radius:12px;padding:14px;margin:0 0 10px;box-shadow:0 1px 2px rgba(0,0,0,.06)}li.urgent{border-left:5px solid #d6332a}.when{font-size:13px;color:#666}.tag{background:#d6332a;color:#fff;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700;margin-left:6px}.who{margin-top:4px}.who a{color:#0a58ca;text-decoration:none;font-weight:600}.job{margin-top:6px}.cb{margin-top:4px;font-size:14px;color:#444}.empty{text-align:center;color:#666;padding:40px 0}
</style></head><body><header><h1>${escapeXml(client.business_name)}</h1><p class="sub">${n} missed call${n === 1 ? "" : "s"} caught · answered by your receptionist bot</p></header><main>${n ? `<ul>${calls.map(row).join("")}</ul>` : `<p class="empty">No calls caught yet. Your bot is on duty.</p>`}</main></body></html>`;
}
