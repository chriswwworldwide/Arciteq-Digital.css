export const PROFILE =
  typeof document === "undefined"
    ? {
        slug: "chassis",
        brand: "Your coaching platform",
        coachFull: "Your coach",
        coachFirst: "Your coach",
        city: "Your training venue",
        timeZone: "Europe/London",
        accent: "#8b5cf6",
        tagline: "Your training. Your time.",
        portrait: "",
        watermark: "",
      }
    : JSON.parse(
        document.getElementById("booking-profile")?.textContent ||
          '{"slug":"chassis","brand":"Your coaching platform","coachFull":"Your coach","coachFirst":"Your coach","city":"Your training venue","timeZone":"Europe/London","accent":"#8b5cf6","tagline":"Your training. Your time.","portrait":"","watermark":""}',
      );
export const ZONE = PROFILE.timeZone;

export function dateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (key) => parts.find((p) => p.type === key).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(key, count) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function weekDates(key) {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay() || 7;
  return Array.from({ length: 7 }, (_, i) => addDays(key, i + 1 - day));
}

export function localInstant(key, hour) {
  const target = Date.parse(`${key}T00:00:00Z`) + hour * 3600000;
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    const represented = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    guess += target - represented;
  }
  return new Date(guess);
}

export function cutoffTime(key, hour) {
  return new Date(localInstant(key, hour).getTime() - 24 * 3600000);
}

export function slotState(
  key,
  hour,
  duration,
  events,
  schedule,
  now = new Date(),
) {
  if (localInstant(key, hour).getTime() <= now.getTime()) return "past";
  const day = new Date(`${key}T12:00:00Z`).getUTCDay() || 7;
  if (
    isAway(key, schedule) ||
    !schedule.days.includes(day) ||
    hour < schedule.start ||
    hour + duration / 60 > schedule.end
  )
    return "closed";
  const start = hour * 60;
  const end = start + duration;
  const conflict = events.some(
    (e) =>
      e.date === key &&
      e.status !== "cancelled" &&
      start < e.hour * 60 + e.duration + schedule.buffer &&
      end + schedule.buffer > e.hour * 60,
  );
  return conflict ? "busy" : "free";
}

export function publicLabel() {
  return "Unavailable";
}

export function isAway(key, schedule) {
  return Boolean(
    schedule.away && key >= schedule.away.from && key <= schedule.away.to,
  );
}

export function groupSeats(event) {
  return Math.max(
    0,
    Number(event.capacity || 0) - Number(event.attendees || 0),
  );
}

export function canJoinGroup(event, now = new Date()) {
  return (
    event.kind === "group" &&
    event.status === "confirmed" &&
    groupSeats(event) > 0 &&
    localInstant(event.date, event.hour) > now
  );
}

export function calendarFile(events, stamp = new Date()) {
  const utc = (value) =>
    value
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const text = (value) =>
    String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Station 9//Coach Planner Preview//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${text(PROFILE.brand)} - DEMO sessions`,
  ];
  for (const event of events.filter((e) => e.status === "confirmed")) {
    const start = localInstant(event.date, event.hour);
    lines.push(
      "BEGIN:VEVENT",
      `UID:demo-${event.id}@station9studio.co.uk`,
      `DTSTAMP:${utc(stamp)}`,
      `DTSTART:${utc(start)}`,
      `DTEND:${utc(new Date(start.getTime() + event.duration * 60000))}`,
      `SUMMARY:${text(`DEMO - ${event.title}${event.kind === "group" ? "" : ` - ${event.name}`}`)}`,
      `LOCATION:${text(event.location)}`,
      "DESCRIPTION:Fictional preview appointment. Not a real booking. Calendar export only - not automatic sync.",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  const fold = (line) => {
    const encoder = new TextEncoder();
    let result = "";
    let length = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      if (length + size > 73) {
        result += "\r\n ";
        length = 1;
      }
      result += char;
      length += size;
    }
    return result;
  };
  return lines.map(fold).join("\r\n") + "\r\n";
}
