import { describe, it, expect } from "vitest";
import {
  addDays,
  weekDates,
  localInstant,
  cutoffTime,
  slotState,
  publicLabel,
  isAway,
  groupSeats,
  canJoinGroup,
  calendarFile,
} from "../scripts/reskin/booking-template/booking-model.js";

const schedule = { days: [1, 2, 3, 4, 5], start: 7, end: 19, buffer: 15 };
const now = new Date("2026-10-19T06:00:00Z");
const events = [
  {
    date: "2026-10-20",
    hour: 9,
    duration: 60,
    status: "confirmed",
    name: "Fictional client",
  },
];

describe("Shared booking planner preview", () => {
  it("uses Monday to Sunday including month boundaries", () => {
    expect(weekDates("2026-11-01")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("resolves London local sessions in summer and winter", () => {
    expect(localInstant("2026-07-20", 9).toISOString()).toBe(
      "2026-07-20T08:00:00.000Z",
    );
    expect(localInstant("2026-12-20", 9).toISOString()).toBe(
      "2026-12-20T09:00:00.000Z",
    );
  });
  it("calculates a real 24-hour cancellation window across DST", () => {
    expect(cutoffTime("2026-03-29", 9).toISOString()).toBe(
      "2026-03-28T08:00:00.000Z",
    );
  });
  it("does not offer past, non-working or overlapping slots", () => {
    expect(slotState("2026-10-18", 9, 60, events, schedule, now)).toBe("past");
    expect(slotState("2026-10-25", 9, 60, events, schedule, now)).toBe(
      "closed",
    );
    expect(slotState("2026-10-20", 9, 60, events, schedule, now)).toBe("busy");
    expect(slotState("2026-10-20", 10, 60, events, schedule, now)).toBe("busy");
    expect(slotState("2026-10-20", 11, 60, events, schedule, now)).toBe("free");
  });
  it("holds pending requests and releases cancelled appointments", () => {
    expect(
      slotState(
        "2026-10-20",
        9,
        60,
        [{ ...events[0], status: "pending" }],
        schedule,
        now,
      ),
    ).toBe("busy");
    expect(
      slotState(
        "2026-10-20",
        9,
        60,
        [{ ...events[0], status: "cancelled" }],
        schedule,
        now,
      ),
    ).toBe("free");
  });
  it("checks session duration against the working-day boundary", () => {
    expect(slotState("2026-10-20", 18.5, 60, [], schedule, now)).toBe("closed");
  });
  it("never puts sample client names in public calendar labels", () => {
    expect(publicLabel(events[0])).toBe("Unavailable");
    expect(publicLabel({ ...events[0], status: "pending" })).toBe(
      "Unavailable",
    );
  });
  it("offers lunch and the full 6am to 8pm day", () => {
    const extended = { days: [1, 2, 3, 4, 5], start: 6, end: 20, buffer: 0 };
    for (const hour of [6, 12, 19])
      expect(slotState("2026-10-20", hour, 60, [], extended, now)).toBe("free");
    expect(slotState("2026-10-20", 20, 60, [], extended, now)).toBe("closed");
  });
  it("counts group spaces and blocks full, past or cancelled classes", () => {
    const group = { ...events[0], kind: "group", capacity: 8, attendees: 5 };
    expect(groupSeats(group)).toBe(3);
    expect(canJoinGroup(group, now)).toBe(true);
    expect(canJoinGroup({ ...group, attendees: 8 }, now)).toBe(false);
    expect(canJoinGroup({ ...group, status: "cancelled" }, now)).toBe(false);
    expect(canJoinGroup(group, new Date("2027-01-01"))).toBe(false);
  });
  it("blocks inclusive holiday dates without changing existing bookings", () => {
    const away = {
      ...schedule,
      away: { from: "2026-10-20", to: "2026-10-22" },
    };
    expect(isAway("2026-10-22", away)).toBe(true);
    expect(isAway("2026-10-23", away)).toBe(false);
    expect(slotState("2026-10-20", 11, 60, events, away, now)).toBe("closed");
    expect(events[0].status).toBe("confirmed");
  });
  it("exports confirmed demo events in UTC with escaped, folded calendar text", () => {
    const source = {
      ...events[0],
      id: "sample-123",
      date: "2026-07-20",
      title: "HYROX, technique; intro\nSecond line",
      location: "Widnes",
    };
    const content = calendarFile(
      [source, { ...source, id: "pending", status: "pending" }],
      now,
    );
    expect(content).toContain("BEGIN:VCALENDAR\r\n");
    expect(content).toContain("DTSTART:20260720T080000Z");
    expect(content).toContain("DTEND:20260720T090000Z");
    expect(content).toContain("HYROX\\, technique\\; intro\\nSecond line");
    expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(content).not.toContain("UID:demo-pending");
    for (const line of content.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(73);
  });
});
