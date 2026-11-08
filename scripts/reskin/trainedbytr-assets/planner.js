import {
  ZONE,
  dateKey,
  addDays,
  weekDates,
  localInstant,
  cutoffTime,
  slotState,
  publicLabel,
  groupSeats,
  canJoinGroup,
  calendarFile,
  isAway,
} from "./planner-model.js";

const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (s) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        s
      ],
  );
const hours = Array.from({ length: 14 }, (_, i) => i + 6);
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const sessions = {
  hyrox: {
    title: "1:1 HYROX coaching",
    duration: 60,
    location: "In person · Widnes",
  },
  technique: {
    title: "Station technique",
    duration: 45,
    location: "In person · Widnes",
  },
  assessment: {
    title: "Initial assessment",
    duration: 60,
    location: "In person · Widnes",
  },
  intro: {
    title: "First conversation",
    duration: 30,
    location: "Online · introduction",
  },
};
const clock = (hour) =>
  `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;
const shortDate = (key, options = {}) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    day: "numeric",
    month: "short",
    ...options,
  }).format(new Date(`${key}T12:00:00Z`));
const fullTime = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
const session = () => sessions[$("#session").value];
let mode =
  new URLSearchParams(location.search).get("view") === "coach"
    ? "coach"
    : "client";
let selected = addDays(dateKey(), 1);
while ([0, 6].includes(new Date(`${selected}T12:00:00Z`).getUTCDay()))
  selected = addDays(selected, 1);
let dates = weekDates(selected);
let events = [];
let seeded = new Set();
let schedule = { days: [1, 2, 3, 4, 5], start: 6, end: 20, buffer: 0 };
let ownId = null;
let toastTimer;
const dialog = $("#planner-dialog");
const joinedClasses = new Set();
let backdrop =
  new URLSearchParams(location.search).get("backdrop") === "watermark"
    ? "watermark"
    : "subtle";
function setBackdrop(value) {
  backdrop = value;
  document.body.dataset.backdrop = value;
  document
    .querySelectorAll("[data-background]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.background === value),
      ),
    );
}
setBackdrop(backdrop);
document.querySelectorAll("[data-background]").forEach((button) =>
  button.addEventListener("click", () => {
    setBackdrop(button.dataset.background);
    const url = new URL(location.href);
    url.searchParams.set("backdrop", backdrop);
    history.replaceState(null, "", url);
  }),
);

function seedWeek() {
  if (seeded.has(dates[0])) return;
  seeded.add(dates[0]);
  const samples = [
    [0, 9, "Alex Morgan", "HYROX coaching", "confirmed"],
    [0, 14, "Sam Ellis", "Strength + running", "confirmed"],
    [1, 8, "Jordan Blake", "Station technique", "confirmed"],
    [1, 10, "Casey Rowan", "HYROX coaching", "confirmed"],
    [2, 9, "Taylor Lane", "HYROX coaching", "confirmed"],
    [2, 15, "Riley Brooks", "Station technique", "confirmed"],
    [3, 8, "Jamie Parker", "Strength + running", "confirmed"],
    [3, 11, "Charlie Reed", "HYROX coaching", "confirmed"],
    [4, 9, "Robin Hayes", "HYROX coaching", "confirmed"],
    [4, 11, "Avery Quinn", "First conversation", "pending"],
    [4, 14, "Drew Collins", "Station technique", "confirmed"],
  ];
  for (const [day, hour, name, title, status] of samples)
    events.push({
      id: crypto.randomUUID(),
      date: dates[day],
      hour,
      name,
      title,
      status,
      duration: 60,
      location: "Widnes · walkthrough session",
      note: "Walkthrough appointment only.",
    });
  for (const [day, hour, title, capacity, attendees, featured] of [
    [2, 18, "HYROX Engine Club", 8, 5, true],
    [5, 9, "Race Ready Crew", 10, 6, true],
  ]) {
    events.push({
      id: crypto.randomUUID(),
      date: dates[day],
      hour,
      name: title,
      title,
      kind: "group",
      capacity,
      attendees,
      featured,
      duration: 60,
      status: "confirmed",
      location: "TransFit Widnes · walkthrough class",
      note: "Walkthrough class — try the flow without creating real reservations.",
    });
  }
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4500);
}

function eventAt(date, hour) {
  return events.find(
    (e) =>
      e.date === date &&
      e.status !== "cancelled" &&
      e.hour < hour + 1 &&
      e.hour + e.duration / 60 > hour,
  );
}

function render() {
  seedWeek();
  const coach = mode === "coach";
  document.body.dataset.mode = mode;
  $("#headline").innerHTML = coach
    ? "Your week.<br /><em>A little more headspace.</em>"
    : "Good sessions.<br /><em>Less back-and-forth.</em>";
  $("#standfirst").textContent = coach
    ? "All your sessions, requests and breathing space. One simple diary."
    : "Find a time that works. Make room for your next step.";
  $("#perspective-note").textContent = coach
    ? "Coach view uses a simulated diary for this walkthrough."
    : "The same diary. Only the details you need to see.";
  document.querySelectorAll("[data-mode]").forEach((button) => {
    if (button.tagName === "BUTTON")
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });
  $("#coach-controls").hidden = !coach;
  $("#returning-wrap").hidden = coach;
  $("#agenda-panel").hidden = !coach;
  $("#pending-legend").hidden = !coach;
  $("#booked-legend").textContent = coach ? "Booked" : "Unavailable";
  $("#week-note").textContent = coach
    ? "Tap a booking to manage it, or a free block to add a client."
    : "Tap an available slot. New clients request; existing clients book.";
  $("#diary-eyebrow").textContent = coach
    ? "YOUR WORKING WEEK"
    : "FIND YOUR TIME";
  $("#privacy-copy").innerHTML = coach
    ? "Coach view uses a simulated diary for this walkthrough.<br /><strong>A live diary sits behind private coach access.</strong>"
    : "Your coach sees the bookings. You only see availability.<br /><strong>No client names appear in the public diary.</strong>";
  $("#duration-label").textContent = `${session().duration} minutes`;
  $("#location-label").textContent = session().location;
  $("#week-label").textContent =
    `${shortDate(dates[0])} — ${shortDate(dates[6], { year: "numeric" })}`;
  const weekEvents = events.filter(
    (e) =>
      dates.includes(e.date) && !["cancelled", "blocked"].includes(e.status),
  );
  const free = dates.reduce(
    (n, date) =>
      n +
      hours.filter(
        (hour) =>
          slotState(date, hour, session().duration, events, schedule) ===
          "free",
      ).length,
    0,
  );
  const metrics = coach
    ? [
        [weekEvents.length, "Sessions this week", "Your walkthrough diary"],
        [
          weekEvents.filter((e) => e.status === "pending").length,
          "Request to review",
          "You stay in control",
        ],
        [free, "Available starts", "Space for your clients"],
      ]
    : [
        [free, "Available starts", "Across this week"],
        [session().duration, "Minute sessions", "Time for your progress"],
        ["24h", "Change notice", "Clear from the start"],
      ];
  $("#metrics").innerHTML = metrics
    .map(
      ([n, title, note]) =>
        `<div class="metric"><strong>${n}</strong><span><b>${title}</b>${note}</span></div>`,
    )
    .join("");
  $("#day-strip").innerHTML = dates
    .map(
      (date, i) =>
        `<button type="button" data-day="${date}" aria-label="${shortDate(date, { weekday: "long" })}" aria-pressed="${date === selected}" class="${date === dateKey() ? "is-today" : ""}">${dayNames[i]}<strong>${Number(date.slice(8))}</strong></button>`,
    )
    .join("");
  let grid = '<div class="calendar-head time-head">UK<br>TIME</div>';
  grid += dates
    .map(
      (date, i) =>
        `<div class="calendar-head ${date !== selected ? "other-day" : ""} ${date === dateKey() ? "is-today" : ""}">${dayNames[i]}<strong>${Number(date.slice(8))}</strong></div>`,
    )
    .join("");
  for (const hour of hours) {
    grid += `<div class="time-label">${clock(hour)}</div>`;
    for (const date of dates) {
      const event = eventAt(date, hour);
      const state = slotState(date, hour, session().duration, events, schedule);
      const group = event?.kind === "group";
      const active =
        coach && event
          ? true
          : group
            ? canJoinGroup(event) &&
              !isAway(date, schedule) &&
              !joinedClasses.has(event.id)
            : state === "free";
      const title = event
        ? group
          ? event.title
          : coach
            ? event.name
            : publicLabel(event)
        : state === "free"
          ? coach
            ? "+ Add session"
            : "Available"
          : state === "past"
            ? "Past"
            : state === "busy"
              ? "Buffer time"
              : "—";
      const description = group
        ? `<small>${groupSeats(event)} of ${event.capacity} spaces left</small><span class="status-pill">${isAway(date, schedule) ? "Away" : event.featured ? "Featured group" : "Group class"}</span>`
        : coach && event
          ? `<small>${esc(event.title)}</small><span class="status-pill">${esc(event.status === "confirmed" ? "Booked" : event.status)}</span>`
          : state === "free"
            ? `<small>${coach ? "or block this time" : `${session().duration} min · ${$("#returning").checked ? "book" : "request"}`}</small>`
            : "";
      grid += `<button type="button" class="slot ${state} ${group ? `group-class ${event.featured ? "featured" : ""}` : ""} ${coach && event ? event.status : ""} ${date !== selected ? "other-day" : ""}" data-date="${date}" data-hour="${hour}" ${active ? "" : "disabled"} aria-label="${esc(`${shortDate(date, { weekday: "long" })}, ${clock(hour)} — ${title}`)}"><span class="slot-time">${clock(hour)}</span><strong>${esc(title)}</strong>${description}</button>`;
    }
  }
  $("#calendar").innerHTML = grid;
  const upcoming = weekEvents
    .filter((e) => localInstant(e.date, e.hour) >= new Date())
    .sort(
      (a, b) => localInstant(a.date, a.hour) - localInstant(b.date, b.hour),
    );
  $("#agenda").innerHTML = upcoming.length
    ? upcoming
        .map(
          (e) =>
            `<div class="agenda-row"><div class="agenda-date">${shortDate(e.date, { weekday: "short" }).split(",")[0].slice(0, 3)}<b>${Number(e.date.slice(8))}</b></div><div><h3>${esc(e.name)}</h3><p>${clock(e.hour)} · ${esc(e.title)} · ${e.duration} min · ${e.status === "pending" ? "Awaiting approval" : "Booked"}</p></div><button class="button secondary" data-event="${e.id}" type="button">${e.status === "pending" ? "Review" : "Manage"}</button></div>`,
        )
        .join("")
    : '<p class="empty-state">A clear week ahead. Add a session or set your working hours.</p>';
  renderGroups();
  renderAway();
  renderOwnBooking();
}

function showDialog(title, html, eyebrow = "LET’S MAKE A PLAN") {
  if (dialog.open) dialog.close();
  $("#dialog-title").textContent = title;
  $("#dialog-eyebrow").textContent = eyebrow;
  $("#dialog-body").innerHTML = html;
  dialog.showModal();
}

function policy(date, hour) {
  if (new Date() >= cutoffTime(date, hour))
    return "This session starts within 24 hours. Any cancellation or reschedule needs your coach’s agreement. No fee is charged in this walkthrough.";
  return `Cancel or reschedule by <strong>${fullTime(cutoffTime(date, hour))} (UK time)</strong>. Inside 24 hours, contact your coach. No fee is charged in this walkthrough.`;
}

function dateFields(date, hour) {
  return `<div class="field-row"><label class="field">Day<select name="date">${dates.map((d) => `<option value="${d}" ${d === date ? "selected" : ""}>${shortDate(d, { weekday: "short" })}</option>`).join("")}</select></label><label class="field">Start time<select name="hour">${hours.map((h) => `<option value="${h}" ${h === hour ? "selected" : ""}>${clock(h)}</option>`).join("")}</select></label></div>`;
}

function openBooking(date, hour, manual = false, replacing = null) {
  const returning = $("#returning").checked;
  const chosen = replacing
    ? {
        title: replacing.title,
        duration: replacing.duration,
        location: replacing.location,
      }
    : session();
  const title = replacing
    ? "Move your session"
    : manual
      ? "Add a client session"
      : returning
        ? "Make that time yours."
        : "Let’s start with a request.";
  showDialog(
    title,
    `<div class="dialog-session"><strong>${esc(chosen.title)}</strong><span>${shortDate(date, { weekday: "long" })} · ${clock(hour)} · ${chosen.duration} minutes</span><span>${esc(chosen.location)}</span></div><p>${manual ? "For bookings agreed in person, by message or over the phone." : returning ? "Existing-client walkthrough: this adds a confirmed session." : "New-client walkthrough: Tom reviews the request before it is confirmed."}</p><form id="booking-form">${manual ? dateFields(date, hour) : ""}<label class="field">${manual ? "Walkthrough client name" : "Your name"}<input name="name" required maxlength="60" value="${esc(replacing?.name || "Alex Taylor (walkthrough)")}" autocomplete="off" /></label>${manual ? '<label class="field">Private session note (walkthrough only)<textarea name="note" maxlength="200" placeholder="For example: technique focus, sled transitions"></textarea></label>' : '<label class="field">Walkthrough email — use an @example.test address<input name="email" type="email" value="alex@example.test" pattern="[^@\\s]+@example\\.test" required autocomplete="off" /></label>'}<p class="dialog-note">${policy(date, hour)}</p><label class="agreement"><input name="policy" type="checkbox" required /><span>I understand the 24-hour cancellation policy. This is a simulation and does not reserve a real session.</span></label><p class="form-error" id="booking-error" role="alert"></p><div class="dialog-actions"><button class="button secondary" type="button" data-close>Not now</button><button class="button primary" type="submit">${replacing ? "Move session" : manual ? "Add booking" : returning ? "Book session" : "Send request"}</button></div><p class="small-note">Nothing is sent or saved to a server. Changes reset when you refresh.</p></form>`,
  );
  $("#booking-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const targetDate = manual ? String(form.get("date")) : date;
    const targetHour = manual ? Number(form.get("hour")) : hour;
    const other = events.filter((e) => e.id !== replacing?.id);
    if (
      slotState(targetDate, targetHour, chosen.duration, other, schedule) !==
      "free"
    ) {
      $("#booking-error").textContent =
        "That time is not available. Choose a future free slot within working hours.";
      return;
    }
    const record = {
      id: replacing?.id || crypto.randomUUID(),
      date: targetDate,
      hour: targetHour,
      duration: chosen.duration,
      name: String(form.get("name")).trim() || "Walkthrough client",
      title: chosen.title,
      location: chosen.location,
      status: manual || returning || replacing ? "confirmed" : "pending",
      note: String(form.get("note") || "Walkthrough booking."),
    };
    if (replacing) events = events.filter((e) => e.id !== replacing.id);
    events.push(record);
    if (!manual) ownId = record.id;
    dialog.close();
    render();
    toast(
      record.status === "pending"
        ? "Request added for review. No message sent."
        : "Session added. No real appointment booked.",
    );
    if (!manual)
      $("#booking-summary").scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  });
}

function renderOwnBooking() {
  const record = events.find((e) => e.id === ownId);
  $("#booking-summary").hidden = mode === "coach" || !record;
  if (!record) return;
  if (record.kind === "group") {
    renderOwnGroup(record);
    return;
  }
  const cancelled = record.status === "cancelled";
  const late = new Date() >= cutoffTime(record.date, record.hour);
  $("#booking-summary").innerHTML =
    `<span class="eyebrow">YOUR WALKTHROUGH ${cancelled ? "CANCELLATION" : record.status === "pending" ? "REQUEST" : "BOOKING"}</span><h2>${cancelled ? "Session cancelled in this walkthrough." : record.status === "pending" ? "Your request is with the coach." : "A little time, set aside for you."}</h2><p>${esc(record.title)} · ${shortDate(record.date, { weekday: "long" })} · ${clock(record.hour)} (UK time)</p><p>${cancelled ? "The slot has been released. No messages were sent." : policy(record.date, record.hour)}</p>${cancelled ? "" : `<div class="summary-actions">${late ? '<button class="button secondary" type="button" id="contact-coach">Inside 24h — contact your coach</button>' : '<button class="button secondary" type="button" id="move-own">Reschedule session</button><button class="button secondary" type="button" id="cancel-own">Cancel session</button>'}</div>`}<p class="small-note">Walkthrough only. Switch to Coach view to see the other side of the diary.</p>`;
  $("#contact-coach")?.addEventListener("click", () =>
    showDialog(
      "A quick conversation first.",
      "<p>This session is inside the 24-hour window. Contact your coach to agree a change or exception.</p><p class='dialog-note'>This walkthrough does not send messages, apply fees or change appointments.</p>",
    ),
  );
  $("#move-own")?.addEventListener("click", () => {
    const options = dates.flatMap((date) =>
      hours
        .filter(
          (hour) =>
            slotState(
              date,
              hour,
              record.duration,
              events.filter((e) => e.id !== record.id),
              schedule,
            ) === "free" && !(record.date === date && record.hour === hour),
        )
        .map((hour) => ({ date, hour })),
    );
    showDialog(
      "Choose a new time.",
      `<p>Your existing walkthrough session stays reserved until you confirm a new slot.</p><div class="dialog-actions">${
        options
          .slice(0, 12)
          .map(
            (o) =>
              `<button type="button" class="button secondary" data-move-date="${o.date}" data-move-hour="${o.hour}">${shortDate(o.date, { weekday: "short" })} · ${clock(o.hour)}</button>`,
          )
          .join("") ||
        "No alternative slots this week. Ask your coach for another week."
      }</div>`,
    );
    document
      .querySelectorAll("[data-move-date]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          openBooking(
            button.dataset.moveDate,
            Number(button.dataset.moveHour),
            false,
            record,
          ),
        ),
      );
  });
  $("#cancel-own")?.addEventListener("click", () => {
    showDialog(
      "Cancel this session?",
      `<p>${esc(record.title)} · ${shortDate(record.date)} · ${clock(record.hour)}</p><p>${policy(record.date, record.hour)}</p><div class="dialog-actions"><button class="button secondary" data-close type="button">Keep session</button><button class="button danger" id="confirm-cancel" type="button">Cancel session</button></div>`,
    );
    $("#confirm-cancel").addEventListener("click", () => {
      record.status = "cancelled";
      dialog.close();
      render();
      toast("Session cancelled. The slot is available again.");
    });
  });
}

function openEvent(id) {
  const record = events.find((e) => e.id === id);
  if (!record || mode !== "coach") return;
  if (record.kind === "group") {
    manageGroup(record);
    return;
  }
  showDialog(
    record.status === "blocked" ? "A little breathing space." : record.name,
    `<div class="dialog-session"><strong>${esc(record.title)}</strong><span>${shortDate(record.date, { weekday: "long" })} · ${clock(record.hour)} · ${record.duration} min</span><span>${esc(record.status === "pending" ? "New-client request · awaiting approval" : record.status)}</span></div><p>${esc(record.note)}</p><p class="dialog-note">Walkthrough appointment. No emails, fees or real client records are involved.</p><div class="dialog-actions">${record.status === "pending" ? '<button class="button primary" data-status="confirmed" type="button">Approve walkthrough request</button><button class="button danger" data-status="cancelled" type="button">Decline request</button>' : record.status === "blocked" ? '<button class="button primary" data-status="cancelled" type="button">Unblock this time</button>' : '<button class="button primary" data-status="completed" type="button">Mark completed</button><button class="button secondary" data-status="no-show" type="button">Mark no-show</button><button class="button danger" data-status="cancelled" type="button">Cancel as coach</button>'}</div>`,
    "COACH VIEW · WALKTHROUGH",
  );
  if (record.status === "confirmed") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button secondary";
    button.textContent = "Add to phone calendar";
    button.addEventListener("click", () => exportCalendar([record]));
    $("#dialog-body .dialog-actions").append(button);
  }
  document.querySelectorAll("[data-status]").forEach((button) =>
    button.addEventListener("click", () => {
      record.status = button.dataset.status;
      dialog.close();
      render();
      toast(
        record.status === "cancelled"
          ? "Slot released. No fees or messages."
          : "Diary updated. No messages sent.",
      );
    }),
  );
}

function editHours() {
  showDialog(
    "A week that works for you.",
    `<p>Start with the days and times you would normally write in your phone notes.</p><form id="hours-form"><span class="field">Working days</span><div class="day-options">${dayNames.map((d, i) => `<label class="day-option"><input type="checkbox" name="days" value="${i + 1}" ${schedule.days.includes(i + 1) ? "checked" : ""} />${d}</label>`).join("")}</div><div class="field-row"><label class="field">First start<select name="start">${hours.map((h) => `<option value="${h}" ${h === schedule.start ? "selected" : ""}>${clock(h)}</option>`).join("")}</select></label><label class="field">Finish by<select name="end">${hours
      .map((h) => h + 1)
      .map(
        (h) =>
          `<option value="${h}" ${h === schedule.end ? "selected" : ""}>${clock(h)}</option>`,
      )
      .join(
        "",
      )}</select></label></div><label class="field">Breathing space between sessions<select name="buffer">${[0, 15, 30].map((m) => `<option value="${m}" ${m === schedule.buffer ? "selected" : ""}>${m ? `${m} minutes` : "No buffer"}</option>`).join("")}</select></label><p class="dialog-note">These hours repeat across the walkthrough weeks. Existing walkthrough bookings stay in place. Nothing is saved to a server.</p><p class="form-error" id="hours-error" role="alert"></p><div class="dialog-actions"><button class="button primary" type="submit">Use these hours</button></div></form>`,
    "YOUR AVAILABILITY",
  );
  $("#hours-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const start = Number(data.get("start"));
    const end = Number(data.get("end"));
    if (end <= start || !data.getAll("days").length) {
      $("#hours-error").textContent =
        "Choose at least one working day and a finish after the start.";
      return;
    }
    schedule = {
      ...schedule,
      days: data.getAll("days").map(Number),
      start,
      end,
      buffer: Number(data.get("buffer")),
    };
    dialog.close();
    render();
    toast("Working hours updated.");
  });
}

function blockTime() {
  showDialog(
    "Protect a little time.",
    `<p>Lunch, travel, training or a day off — it belongs in the same diary.</p><form id="block-form">${dateFields(selected, 13)}<label class="field">Length<select name="duration"><option value="60">1 hour</option><option value="120">2 hours</option><option value="240">4 hours</option></select></label><label class="field">Private label (walkthrough only)<input name="label" value="My training" maxlength="60" required /></label><p class="form-error" id="block-error" role="alert"></p><div class="dialog-actions"><button class="button primary" type="submit">Block time</button></div></form>`,
    "COACH PREVIEW",
  );
  $("#block-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const date = String(data.get("date"));
    const hour = Number(data.get("hour"));
    const duration = Number(data.get("duration"));
    if (
      events.some(
        (e) =>
          e.date === date &&
          e.status !== "cancelled" &&
          hour * 60 < e.hour * 60 + e.duration &&
          hour * 60 + duration > e.hour * 60,
      )
    ) {
      $("#block-error").textContent =
        "That overlaps a walkthrough booking or block. Choose another time.";
      return;
    }
    if (hour + duration / 60 > 20) {
      $("#block-error").textContent =
        "Keep this walkthrough block within the visible day (06:00–20:00).";
      return;
    }
    events.push({
      id: crypto.randomUUID(),
      date,
      hour,
      duration,
      status: "blocked",
      title: "Personal time",
      name: String(data.get("label")),
      note: "A private label. Clients only see this time as unavailable.",
    });
    dialog.close();
    render();
    toast("Time blocked in the walkthrough diary.");
  });
}

function renderGroups() {
  const classes = events.filter(
    (e) =>
      e.kind === "group" &&
      dates.includes(e.date) &&
      e.status !== "cancelled" &&
      (mode === "coach" || localInstant(e.date, e.hour) > new Date()),
  );
  $("#group-section").hidden = !classes.length;
  $("#group-cards").innerHTML = classes
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        localInstant(a.date, a.hour) - localInstant(b.date, b.hour),
    )
    .map(
      (e) =>
        `<article class="group-card ${e.featured ? "featured" : ""}"><span class="class-kicker">${e.featured ? "Featured · " : ""}Group class</span><h3>${esc(e.title)}</h3><p>${shortDate(e.date, { weekday: "long" })} · ${clock(e.hour)}–${clock(e.hour + e.duration / 60)}</p><p>${groupSeats(e)} spaces left · ${e.attendees}/${e.capacity} booked</p><button class="button" type="button" data-class="${e.id}" ${mode !== "coach" && (!canJoinGroup(e) || isAway(e.date, schedule) || joinedClasses.has(e.id)) ? "disabled" : ""}>${mode === "coach" ? "Manage class" : isAway(e.date, schedule) ? "Coach away" : joinedClasses.has(e.id) ? "Your spot is reserved" : groupSeats(e) ? "Book a class spot" : "Class full"}</button></article>`,
    )
    .join("");
}

function joinGroup(record) {
  if (
    !canJoinGroup(record) ||
    isAway(record.date, schedule) ||
    joinedClasses.has(record.id)
  )
    return;
  showDialog(
    "A spot with the crew.",
    `<div class="dialog-session"><strong>${esc(record.title)}</strong><span>${shortDate(record.date, { weekday: "long" })} · ${clock(record.hour)} · ${record.duration} minutes</span><span>${esc(record.location)} · ${groupSeats(record)} spaces left</span></div><p>Group classes welcome new and existing clients in this walkthrough.</p><form id="class-booking-form"><label class="field">Walkthrough attendee name<input value="Alex Taylor (walkthrough)" required maxlength="60" autocomplete="off" /></label><p class="dialog-note">${policy(record.date, record.hour)}</p><label class="agreement"><input name="policy" type="checkbox" required /><span>I understand the cancellation policy. This reserves a walkthrough space only.</span></label><div class="dialog-actions"><button class="button primary" type="submit">Reserve class spot</button></div><p class="form-error" id="class-error" role="alert"></p><p class="small-note">No payment, email or real reservation.</p></form>`,
    "GROUP CLASS",
  );
  $("#class-booking-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (
      !canJoinGroup(record) ||
      joinedClasses.has(record.id) ||
      isAway(record.date, schedule)
    ) {
      $("#class-error").textContent =
        "This class is no longer available in this walkthrough.";
      return;
    }
    record.attendees += 1;
    joinedClasses.add(record.id);
    ownId = record.id;
    dialog.close();
    render();
    toast("Walkthrough class spot reserved.");
    $("#booking-summary").scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });
}

function renderOwnGroup(record) {
  const cancelled =
    record.status === "cancelled" || !joinedClasses.has(record.id);
  const late = new Date() >= cutoffTime(record.date, record.hour);
  $("#booking-summary").innerHTML =
    `<span class="eyebrow">YOUR WALKTHROUGH CLASS SPOT</span><h2>${cancelled ? "Your class spot is cancelled." : "You’re in. Bring your race energy."}</h2><p>${esc(record.title)} · ${shortDate(record.date, { weekday: "long" })} · ${clock(record.hour)} (UK time)</p><p>${cancelled ? "This walkthrough sends no messages." : policy(record.date, record.hour)}</p>${cancelled ? "" : `<div class="summary-actions">${late ? '<button class="button secondary" type="button" id="group-contact">Inside 24h — contact your coach</button>' : '<button class="button secondary" type="button" id="cancel-class-spot">Cancel class spot</button>'}</div>`}`;
  $("#cancel-class-spot")?.addEventListener("click", () => {
    showDialog(
      "Release your class spot?",
      `<p>${esc(record.title)} · ${shortDate(record.date)} · ${clock(record.hour)}</p><p>${policy(record.date, record.hour)}</p><div class="dialog-actions"><button class="button secondary" data-close type="button">Keep my spot</button><button class="button danger" id="release-class" type="button">Release spot</button></div>`,
    );
    $("#release-class").addEventListener("click", () => {
      joinedClasses.delete(record.id);
      record.attendees = Math.max(0, record.attendees - 1);
      dialog.close();
      render();
      toast("Class spot released.");
    });
  });
  $("#group-contact")?.addEventListener("click", () =>
    showDialog(
      "Check with your coach.",
      "<p>This class starts within 24 hours. Agree any change with the coach. No messages or fees are processed here.</p>",
    ),
  );
}

function manageGroup(record) {
  showDialog(
    record.title,
    `<div class="dialog-session"><strong>${record.attendees} of ${record.capacity} walkthrough spaces booked</strong><span>${shortDate(record.date, { weekday: "long" })} · ${clock(record.hour)} · ${record.duration} minutes</span><span>${record.featured ? "Featured in the diary and class cards" : "Standard group-class styling"}</span></div><form id="capacity-form"><label class="field">Class capacity<input type="number" name="capacity" min="${Math.max(1, record.attendees)}" max="40" value="${record.capacity}" required /></label><button class="button secondary" type="submit">Update capacity</button></form><div class="dialog-actions"><button class="button primary" id="feature-class" type="button">${record.featured ? "Remove highlight" : "Highlight this class"}</button><button class="button secondary" id="export-class" type="button">Add to phone calendar</button><button class="button danger" id="cancel-class" type="button">Cancel class</button></div><p class="small-note">A real coach diary would require private access. This walkthrough uses a simulated diary.</p>`,
    "COACH VIEW · GROUP CLASS",
  );
  $("#feature-class").addEventListener("click", () => {
    record.featured = !record.featured;
    dialog.close();
    render();
    toast(
      record.featured
        ? "Class highlighted in the diary."
        : "Class highlight removed.",
    );
  });
  $("#capacity-form").addEventListener("submit", (event) => {
    event.preventDefault();
    record.capacity = Number(new FormData(event.target).get("capacity"));
    dialog.close();
    render();
    toast("Class capacity updated.");
  });
  $("#export-class").addEventListener("click", () => exportCalendar([record]));
  $("#cancel-class").addEventListener("click", () => {
    showDialog(
      "Cancel this class?",
      `<p>${record.attendees} walkthrough spaces are booked. On a connected diary, those athletes would need a cancellation notice.</p><p class="dialog-note">This walkthrough sends no messages, charges no fees and changes no real bookings.</p><button class="button danger" id="confirm-class-cancel" type="button">Confirm cancellation</button>`,
    );
    $("#confirm-class-cancel").addEventListener("click", () => {
      record.status = "cancelled";
      dialog.close();
      render();
      toast("Class cancelled. No messages sent.");
    });
  });
}

function addGroup() {
  showDialog(
    "Make it a crew session.",
    `<form id="group-form"><label class="field">Public class name<input name="title" required maxlength="60" value="HYROX lunchtime crew" /></label>${dateFields(selected, 12)}<div class="field-row"><label class="field">Length<select name="duration"><option value="60">60 minutes</option><option value="45">45 minutes</option><option value="30">30 minutes</option></select></label><label class="field">Spaces<input name="capacity" type="number" min="1" max="40" value="8" required /></label></div><label class="agreement"><input name="featured" type="checkbox" checked /><span>Highlight this class in the diary and featured cards.</span></label><p class="form-error" id="group-error" role="alert"></p><div class="dialog-actions"><button class="button primary" type="submit">Add group class</button></div><p class="small-note">Walkthrough details only — no real classes are published.</p></form>`,
    "COACH PREVIEW",
  );
  $("#group-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const date = String(data.get("date"));
    const hour = Number(data.get("hour"));
    const duration = Number(data.get("duration"));
    if (
      localInstant(date, hour) <= new Date() ||
      isAway(date, schedule) ||
      hour + duration / 60 > 20 ||
      events.some(
        (e) =>
          e.date === date &&
          e.status !== "cancelled" &&
          hour * 60 < e.hour * 60 + e.duration + schedule.buffer &&
          hour * 60 + duration + schedule.buffer > e.hour * 60,
      )
    ) {
      $("#group-error").textContent =
        "Choose a future time outside holidays that does not overlap a session or buffer.";
      return;
    }
    const title = String(data.get("title")).trim();
    events.push({
      id: crypto.randomUUID(),
      date,
      hour,
      duration,
      name: title,
      title,
      kind: "group",
      status: "confirmed",
      capacity: Number(data.get("capacity")),
      attendees: 0,
      featured: data.has("featured"),
      location: "Widnes · walkthrough class",
      note: "Walkthrough class created.",
    });
    dialog.close();
    render();
    toast("Group class added to the walkthrough diary.");
  });
}

function exportCalendar(records) {
  if (mode !== "coach") return;
  const confirmed = records.filter((e) => e.status === "confirmed");
  if (!confirmed.length) {
    toast("No confirmed walkthrough sessions to export.");
    return;
  }
  showDialog(
    "Take this week with you.",
    `<p>Download ${confirmed.length} walkthrough session${confirmed.length === 1 ? "" : "s"} as a calendar file, then open it in your phone calendar or import it into Google Calendar or Outlook.</p><p class="dialog-note">One-time import, not two-way sync. Later changes here will not update the imported events automatically. Walkthrough events are clearly labelled.</p><button class="button primary" id="download-calendar" type="button">Download walkthrough .ics file</button>`,
    "PHONE CALENDAR EXPORT",
  );
  $("#download-calendar").addEventListener("click", () => {
    const url = URL.createObjectURL(
      new Blob([calendarFile(confirmed)], {
        type: "text/calendar;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `trainedbytr-DEMO-${dates[0]}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function renderAway() {
  const away = schedule.away;
  $("#away-notice").hidden = !away || away.to < dateKey();
  if (!away) return;
  let back = addDays(away.to, 1);
  for (
    let i = 0;
    i < 7 &&
    !schedule.days.includes(new Date(`${back}T12:00:00Z`).getUTCDay() || 7);
    i++
  )
    back = addDays(back, 1);
  $("#away-notice").innerHTML =
    `<h3>${dateKey() >= away.from && dateKey() <= away.to ? "A little time away." : "Upcoming time away."}</h3><p>${shortDate(away.from, { year: "numeric" })}–${shortDate(away.to, { year: "numeric" })}. Working hours resume from <strong>${shortDate(back, { weekday: "long", year: "numeric" })}</strong>; available slots are shown in the diary.</p>${away.message ? `<p>${esc(away.message)}</p>` : ""}${mode === "coach" ? '<button class="button secondary" id="edit-away" type="button">Manage time away</button>' : ""}`;
  $("#edit-away")?.addEventListener("click", editHoliday);
}

function editHoliday() {
  const from =
    schedule.away?.from || (selected > dateKey() ? selected : dateKey());
  const to = schedule.away?.to || addDays(from, 6);
  showDialog(
    "Time off, properly protected.",
    `<p>Block a holiday or date range. Clients see your return-to-working-hours notice, never your private reason.</p><form id="holiday-form"><div class="field-row"><label class="field">First day away<input type="date" name="from" value="${from}" min="${dateKey()}" required /></label><label class="field">Last day away<input type="date" name="to" value="${to}" min="${dateKey()}" required /></label></div><label class="field">Optional public message<input name="message" maxlength="140" value="${esc(schedule.away?.message || "Taking a little time to recharge. See you when I’m back.")}" /></label><p class="dialog-note" id="holiday-warning"></p><label class="agreement"><input type="checkbox" required /><span>I will review any existing walkthrough bookings separately. Marking time away does not cancel them or notify anyone.</span></label><p class="form-error" id="holiday-error" role="alert"></p><div class="dialog-actions"><button class="button primary" type="submit">Block dates</button>${schedule.away ? '<button class="button danger" id="remove-away" type="button">Remove time away</button>' : ""}</div></form>`,
    "COACH VIEW · HOLIDAYS",
  );
  const form = $("#holiday-form");
  const warn = () => {
    const data = new FormData(form);
    const count = events.filter(
      (e) =>
        e.date >= String(data.get("from")) &&
        e.date <= String(data.get("to")) &&
        !["cancelled", "blocked"].includes(e.status),
    ).length;
    $("#holiday-warning").textContent =
      `${count} existing walkthrough session${count === 1 ? "" : "s"} in this range need review. No bookings are silently cancelled. New individual and group reservations will be blocked.`;
  };
  form.addEventListener("input", warn);
  warn();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const start = String(data.get("from"));
    const finish = String(data.get("to"));
    if (finish < start) {
      $("#holiday-error").textContent =
        "The last day must be on or after the first day.";
      return;
    }
    schedule.away = {
      from: start,
      to: finish,
      message: String(data.get("message")),
    };
    dialog.close();
    render();
    toast("Dates blocked. Return notice is visible to clients.");
  });
  $("#remove-away")?.addEventListener("click", () => {
    delete schedule.away;
    dialog.close();
    render();
    toast("Time away removed.");
  });
}

$("#group-cards").addEventListener("click", (event) => {
  const button = event.target.closest("[data-class]");
  if (!button || button.disabled) return;
  const record = events.find((e) => e.id === button.dataset.class);
  if (!record) return;
  if (mode === "coach") manageGroup(record);
  else joinGroup(record);
});
$("#group-button").addEventListener("click", addGroup);
$("#holiday-button").addEventListener("click", editHoliday);
$("#export-week").addEventListener("click", () =>
  exportCalendar(events.filter((e) => dates.includes(e.date))),
);
$("#calendar-connect").addEventListener("click", () =>
  showDialog(
    "Your diary, with fewer clashes.",
    "<p><strong>File export, not live sync.</strong></p><p>The live version will need your permission to read busy times from your calendar provider. Busy periods can then block matching coaching slots without showing clients your appointment names.</p><p>Google and Outlook need account authorisation. Apple Calendar support needs an appropriate calendar-account connection; a website cannot silently read a phone’s calendar.</p><p class='dialog-note'>No connection is made here. You can already block individual times or holidays manually, and export walkthrough sessions as .ics files.</p>",
    "OPTIONAL CALENDAR CONNECTION",
  ),
);
$("#close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target.closest("[data-close]")) dialog.close();
});
$("#calendar").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-date]");
  if (!button || button.disabled) return;
  const date = button.dataset.date;
  const hour = Number(button.dataset.hour);
  const record = eventAt(date, hour);
  if (mode === "coach" && record) openEvent(record.id);
  else if (record?.kind === "group") joinGroup(record);
  else openBooking(date, hour, mode === "coach");
});
$("#agenda").addEventListener("click", (event) => {
  const button = event.target.closest("[data-event]");
  if (button) openEvent(button.dataset.event);
});
$("#day-strip").addEventListener("click", (event) => {
  const button = event.target.closest("[data-day]");
  if (button) {
    selected = button.dataset.day;
    render();
  }
});
document.querySelectorAll("button[data-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    const url = new URL(location.href);
    url.searchParams.set("view", mode);
    history.replaceState(null, "", url);
    render();
  }),
);
function changeWeek(offset) {
  selected = addDays(selected, offset * 7);
  dates = weekDates(selected);
  render();
}
$("#previous-week").addEventListener("click", () => changeWeek(-1));
$("#next-week").addEventListener("click", () => changeWeek(1));
$("#today").addEventListener("click", () => {
  selected = dateKey();
  dates = weekDates(selected);
  render();
});
$("#session").addEventListener("change", render);
$("#returning").addEventListener("change", render);
$("#hours-button").addEventListener("click", editHours);
$("#block-button").addEventListener("click", blockTime);
$("#add-button").addEventListener("click", () =>
  openBooking(selected, 10, true),
);
$("#reset-demo").addEventListener("click", () => {
  events = [];
  seeded = new Set();
  joinedClasses.clear();
  ownId = null;
  schedule = { days: [1, 2, 3, 4, 5], start: 6, end: 20, buffer: 0 };
  render();
  toast("Walkthrough reset. Back to the starting diary.");
});
render();
