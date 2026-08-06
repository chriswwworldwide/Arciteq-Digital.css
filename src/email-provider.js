// src/email-provider.js
// Outbound email as a swappable provider adapter, so the funnel logic (capture,
// nudges, win-back) never talks to a specific vendor directly. Mailchimp is the
// first real target but its live API is wired later — today the default is a
// console/no-op provider, and a mock is available for tests. No network calls
// and no credentials are required to use this module.

/**
 * Every provider implements the same tiny contract:
 *   upsertContact({ tenantId, email, tags?, mergeFields? }) -> { ok, ... }
 *   sendCampaign({ tenantId, to, subject, body, tags? })   -> { ok, delivered, ... }
 * Methods never throw for expected "not configured" states — they return a
 * result object so a missing vendor key can't break a checkout or a nudge run.
 */

const PROVIDERS = ["console", "mock", "mailchimp"];

/** Decide which provider to use from env (default: console). */
export function resolveProviderName(env = {}) {
  const raw = String(env.EMAIL_PROVIDER || "")
    .trim()
    .toLowerCase();
  return PROVIDERS.includes(raw) ? raw : "console";
}

/** Logs instead of sending. Safe default until a real vendor is wired. */
export class ConsoleEmailProvider {
  constructor({ logger = console } = {}) {
    this.name = "console";
    this.logger = logger;
  }

  async upsertContact({ tenantId, email, tags = [] }) {
    this.logger.log(
      `[email:console] upsertContact ${tenantId} ${email} tags=${tags.join(",")}`,
    );
    return { ok: true, provider: this.name, delivered: false };
  }

  async sendCampaign({ tenantId, to, subject }) {
    this.logger.log(
      `[email:console] sendCampaign ${tenantId} -> ${to} :: ${subject}`,
    );
    return { ok: true, provider: this.name, delivered: false };
  }
}

/** Records calls in memory for assertions in tests. Sends nothing. */
export class MockEmailProvider {
  constructor() {
    this.name = "mock";
    this.contacts = [];
    this.campaigns = [];
  }

  async upsertContact(payload) {
    this.contacts.push(payload);
    return { ok: true, provider: this.name, delivered: false };
  }

  async sendCampaign(payload) {
    this.campaigns.push(payload);
    return { ok: true, provider: this.name, delivered: false };
  }
}

/**
 * Mailchimp adapter placeholder. It holds the config shape we'll need but does
 * NOT call the API yet — when credentials are missing (the current state) every
 * method returns { ok: false, skipped: "missing_credentials" } so the funnel
 * degrades gracefully. The real HTTP calls get filled in at the marked seams
 * once an account + API key exist.
 */
export class MailchimpEmailProvider {
  constructor({ apiKey = "", serverPrefix = "", audienceId = "" } = {}) {
    this.name = "mailchimp";
    this.apiKey = String(apiKey || "");
    this.serverPrefix = String(serverPrefix || "");
    this.audienceId = String(audienceId || "");
  }

  isConfigured() {
    return Boolean(this.apiKey && this.serverPrefix && this.audienceId);
  }

  async upsertContact(payload) {
    if (!this.isConfigured()) {
      return { ok: false, provider: this.name, skipped: "missing_credentials" };
    }
    // TODO(mailchimp): PUT /lists/{audienceId}/members/{hash} once creds exist.
    return {
      ok: false,
      provider: this.name,
      pending: "not_implemented",
      payload,
    };
  }

  async sendCampaign(payload) {
    if (!this.isConfigured()) {
      return { ok: false, provider: this.name, skipped: "missing_credentials" };
    }
    // TODO(mailchimp): create + send a campaign / transactional message here.
    return {
      ok: false,
      provider: this.name,
      pending: "not_implemented",
      payload,
    };
  }
}

/**
 * Factory: build the provider selected by env. Falls back to console for any
 * unknown value so nothing ever crashes on a typo.
 */
export function createEmailProvider(env = {}) {
  const name = resolveProviderName(env);
  if (name === "mock") return new MockEmailProvider();
  if (name === "mailchimp") {
    return new MailchimpEmailProvider({
      apiKey: env.MAILCHIMP_API_KEY,
      serverPrefix: env.MAILCHIMP_SERVER_PREFIX,
      audienceId: env.MAILCHIMP_AUDIENCE_ID,
    });
  }
  return new ConsoleEmailProvider();
}
