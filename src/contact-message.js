// src/contact-message.js
// Pure validation/normalisation for contact-form submissions, so the server
// route stays thin and the rules are unit-testable. Contact messages are stored
// as a funnel event (type "contact_message") rather than a new table: the same
// person's enquiry then sits alongside their captures and orders in the
// single-customer view.

const MAX_NAME = 120;
const MAX_MESSAGE = 4000;

function collapse(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

/** Same shape of check the capture endpoint uses, kept local so this file is pure. */
export function isValidContactEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

/**
 * Validate and normalise a contact submission.
 * @param {object} input { name, email, message }
 * @returns {{ ok: true, value: { name: string|null, email: string, message: string } }
 *          | { ok: false, error: string }}
 */
export function normalizeContactMessage(input = {}) {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (!email) return { ok: false, error: "Email is required" };
  if (!isValidContactEmail(email)) return { ok: false, error: "Invalid email" };

  // Newlines are meaningful in a message, so only trim the ends here.
  const message = String(input.message == null ? "" : input.message).trim();
  if (!message) return { ok: false, error: "Message is required" };

  const name = collapse(input.name).slice(0, MAX_NAME);

  return {
    ok: true,
    value: {
      name: name || null,
      email,
      message: message.slice(0, MAX_MESSAGE),
    },
  };
}
