import { describe, it, expect } from "vitest";
import {
  normalisePhone,
  normalisePostcode,
  isEmergency,
  interpret,
  advance,
  gatherTwiml,
  sayHangupTwiml,
  leadSms,
  callerSms,
  weeklySummarySms,
  validateClient,
  twilioSignature,
  verifyTwilioSignature,
  renderDashboard,
  prompt,
  STEPS,
} from "../src/receptionist.js";

const client = {
  business_name: "Norfolk Flat Roofing",
  owner_name: "Dave",
  owner_mobile: "+447700900123",
  twilio_number: "+441603000000",
  website: "https://norfolkflatroofing.co.uk",
};

describe("receptionist", () => {
  it("normalises UK phone numbers", () => {
    expect(normalisePhone("07700 900123")).toBe("+447700900123");
    expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("0044 1603 123456")).toBe("+441603123456");
    expect(normalisePhone("12345")).toBe("");
  });

  it("normalises spoken postcodes", () => {
    expect(normalisePostcode("N R 1 2 3 A B")).toBe("NR12 3AB");
    expect(normalisePostcode("nr28 9pq")).toBe("NR28 9PQ");
    expect(normalisePostcode("PE30")).toBe("PE30");
    expect(normalisePostcode("hello")).toBe("");
  });

  it("flags emergencies from job description", () => {
    expect(isEmergency("water coming through the ceiling")).toBe(true);
    expect(isEmergency("burst pipe under the sink")).toBe(true);
    expect(isEmergency("quote for a new driveway")).toBe(false);
  });

  it("interprets the phone step from digits or speech", () => {
    const caller = "+447700900999";
    expect(interpret("phone", { digits: "1", caller })).toEqual({
      value: caller,
    });
    expect(interpret("phone", { speech: "yes that's fine", caller })).toEqual({
      value: caller,
    });
    expect(
      interpret("phone", { speech: "oh seven seven oh oh", caller }),
    ).toEqual({});
    expect(interpret("phone", { speech: "07700 900 123", caller })).toEqual({
      value: "+447700900123",
    });
  });

  it("walks the full call and finishes", () => {
    let call = {
      step: "name",
      attempts: 0,
      answers: {},
      caller: "+447700900999",
    };
    const inputs = {
      name: { speech: "John Smith" },
      phone: { digits: "1" },
      postcode: { speech: "N R 2 8 9 P Q" },
      job: { speech: "roof is leaking badly" },
      callback: { speech: "after five" },
    };
    for (const s of STEPS) {
      expect(call.step).toBe(s);
      call = { ...call, ...advance(call, inputs[s], client) };
    }
    expect(call.done).toBe(true);
    expect(call.emergency).toBe(true);
    expect(call.answers).toEqual({
      name: "John Smith",
      phone: "+447700900999",
      postcode: "NR28 9PQ",
      job: "roof is leaking badly",
      callback: "after five",
    });
  });

  it("retries once then skips a step, defaulting phone to caller id", () => {
    let call = {
      step: "phone",
      attempts: 0,
      answers: {},
      caller: "+447700900999",
    };
    call = { ...call, ...advance(call, { speech: "" }, client) };
    expect(call.step).toBe("phone");
    expect(call.attempts).toBe(1);
    call = { ...call, ...advance(call, { speech: "" }, client) };
    expect(call.step).toBe("postcode");
    expect(call.answers.phone).toBe("+447700900999");
  });

  it("builds valid TwiML with escaped text", () => {
    const xml = gatherTwiml({
      say: `Hi, you've reached Smith & Sons`,
      action: "https://x.test/voice/step?a=1&b=2",
      step: "name",
    });
    expect(xml).toContain("&apos;");
    expect(xml).toContain("Smith &amp; Sons");
    expect(xml).toContain('action="https://x.test/voice/step?a=1&amp;b=2"');
    expect(xml).toContain('input="speech dtmf"');
    expect(xml).toContain('language="en-GB"');
    expect(gatherTwiml({ say: "x", action: "/a", step: "phone" })).toContain(
      'numDigits="1"',
    );
    expect(sayHangupTwiml("Bye")).toContain("<Hangup/>");
    expect(prompt("greeting", client)).toContain("Norfolk Flat Roofing");
  });

  it("writes owner and caller texts", () => {
    const call = {
      caller: "+447700900999",
      emergency: true,
      answers: {
        name: "John",
        phone: "+447700900999",
        postcode: "NR28 9PQ",
        job: "roof leaking",
        callback: "after five",
      },
    };
    const sms = leadSms(client, call);
    expect(sms.startsWith("URGENT New call for Norfolk Flat Roofing")).toBe(
      true,
    );
    expect(sms).toContain("+447700900999");
    expect(sms).toContain("NR28 9PQ");
    expect(callerSms(client, call)).toContain("Dave has your details");
    expect(callerSms(client, call)).toContain(client.website);
  });

  it("writes the weekly summary", () => {
    expect(weeklySummarySms(client, [])).toContain("no missed calls");
    const calls = Array.from({ length: 5 }, (_, i) => ({
      emergency: i === 0,
      answers: { name: `C${i}`, job: "job" },
    }));
    const s = weeklySummarySms(client, calls);
    expect(s).toContain("5 missed calls caught");
    expect(s).toContain("1 urgent");
    expect(s).toContain("2 more");
  });

  it("validates client records", () => {
    expect(validateClient({}).error).toBeTruthy();
    expect(
      validateClient({
        business_name: "X Ltd",
        owner_mobile: "nope",
        twilio_number: "01603000000",
      }).error,
    ).toMatch(/owner_mobile/);
    const r = validateClient({
      business_name: "Smith & Sons Roofing",
      owner_mobile: "07700900123",
      twilio_number: "01603000000",
      website: "https://smith.co.uk",
    });
    expect(r.error).toBeUndefined();
    expect(r.client.slug).toBe("smith-and-sons-roofing");
    expect(r.client.owner_mobile).toBe("+447700900123");
    expect(r.client.options).toEqual({ callerText: true, emergencyFlag: true });
    expect(r.client.status).toBe("trial");
  });

  it("verifies Twilio signatures", () => {
    const url = "https://example.com/voice/incoming";
    const params = {
      CallSid: "CA1",
      From: "+447700900999",
      To: "+441603000000",
    };
    const sig = twilioSignature("tok", url, params);
    expect(verifyTwilioSignature("tok", url, params, sig)).toBe(true);
    expect(
      verifyTwilioSignature("tok", url, { ...params, From: "+4400" }, sig),
    ).toBe(false);
    expect(verifyTwilioSignature("", url, params, "")).toBe(true);
  });

  it("renders a dashboard", () => {
    const html = renderDashboard(client, [
      {
        created_at: new Date().toISOString(),
        emergency: true,
        answers: { name: "<John>", phone: "+447700900999", job: "leak" },
      },
    ]);
    expect(html).toContain("&lt;John&gt;");
    expect(html).toContain("URGENT");
    expect(html).toContain('href="tel:+447700900999"');
    expect(renderDashboard(client, [])).toContain("No calls caught yet");
  });
});
