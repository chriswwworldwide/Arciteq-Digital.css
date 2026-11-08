(async () => {
  if (window.DeskConfig) await DeskConfig.ready;
  const cfgProgrammes = (window.DeskConfig && DeskConfig.get("programmes")) || {};
  const cfgSettings = (window.DeskConfig && DeskConfig.get("settings")) || {};
  const cfgTemplates = (window.DeskConfig && DeskConfig.get("templates")) || {};
  const key = "trainedbytr-client-desk-v2";
  const settingsKey = "trainedbytr-client-desk-settings";
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char]));
  const defaultSettings = {
    sessionThreshold: 2,
    dayThreshold: 7,
    finalMoment: "After the final session",
    followupTiming: "Next morning",
    blockSize: 8,
    monthLength: 30,
    floorDays: 3,
    monthlyFloorTotal: 2,
    onlineTotal: 8,
    quietHours: "21:00–07:00",
    stopOnPaymentIssue: true,
    hybridCheckins: true,
    progressionMonths: 3,
    ...cfgSettings,
    earlyTemplate: "Hi {name}, just a heads-up that you have {remaining} left on your current plan. If you want to keep the momentum going, renew by {due} and we’ll keep the next block ready.",
    finalTemplate: "Hi {name}, brilliant work today — that was the last one in this block. If you want to keep going, renew today and we’ll roll straight into the next step.",
    followupTemplate: "Hi {name}, following up in case yesterday got busy — your next block/month is ready when you are. Renew today and we’ll keep the plan moving.",
    floorTemplate: "Hi {name}, your next gym-floor session is due around {floorDue}. Book your slot when you’re ready and we’ll keep the online plan moving around it.",
    ...cfgTemplates
  };
  const programmeAssets = cfgProgrammes.contentSets || {
    "1-1 Private Coaching": ["Foundations: stations 1–4", "Engine + confidence set", "Race rehearsal basics"],
    "Monthly coaching": ["Base engine + technique", "Strength endurance + compromised runs", "Race-specific sets + pacing"],
    "Race Ready · 8 sessions": ["Race pacing + transitions", "Weak-station sharpening", "Simulation + taper prep"]
  };
  const nextProgramme = cfgProgrammes.progressionMap || {
    "Self-led programme · intro package": "Monthly coaching",
    "Monthly coaching": "Race Ready · 8 sessions"
  };
  const defaultStations = (cfgProgrammes.defaultStations || [
    { name: "Sled push", state: "watch", latest: "Baseline set", note: "Keep under review" },
    { name: "Wall balls", state: "good", latest: "Technique improving", note: "Maintain" },
    { name: "Compromised running", state: "watch", latest: "Post-station pacing", note: "Key limiter" },
    { name: "Roxzone", state: "good", latest: "Transitions tidy", note: "Keep fast" }
  ]);
  const coreClients = [
    {
      id: "amelia", name: "Amelia R.", plan: "1-1 Private Coaching", type: "sessions",
      sessionsUsed: 6, sessionsTotal: 8, nextSession: "Friday · 07:00",
      floorUsed: 6, floorTotal: 8, floorDue: "Friday · 07:00", floorPrompt: "Auto-updates from bookings", floorState: "booked",
      onlineDone: 3, onlineTotal: 4, checkIn: "Due tomorrow",
      lastMessage: "Stations feel less scary now — should I practise sled before Friday?",
      unread: true, status: "Renewal soon", value: "£240 block", attendance: 92, health: "high", renewalStage: "early", renewalDue: "Wednesday",
      note: "First race client; responds well to small wins.", joined: "14 weeks ago", packagesBought: 2,
      packagePath: "Intro block → 1-1 Private Coaching", gap: "No gap between packages",
      assetBlock: 2, assetSource: "Tom video library", programmeMonths: 2,
      eventGoal: { event: "HYROX London", date: "2 May", target: "1:38:00", sim: "1:44:20", status: "On track", adaptation: "Keep confidence first; add sled rehearsal in the final block." },
      stations: [
        { name: "Sled push", state: "watch", latest: "Technique improving", note: "Still the confidence station" },
        { name: "Wall balls", state: "good", latest: "Consistent sets", note: "Keep volume steady" },
        { name: "Compromised running", state: "watch", latest: "Settles after 200m", note: "Practise post-station pace" },
        { name: "Roxzone", state: "good", latest: "Tidy transitions", note: "No major issue" }
      ],
      history: [
        { date: "14 weeks ago", title: "Signed up", detail: "Started with a four-session intro block." },
        { date: "10 weeks ago", title: "Bought package 2", detail: "Moved into 1-1 Private Coaching after the intro block." },
        { date: "2 weeks ago", title: "Progressed", detail: "Reached 6/8 sessions with online work on track." }
      ],
      sent: { early: false, final: false, followup: false }
    },
    {
      id: "marcus", name: "Marcus T.", plan: "Monthly coaching", type: "monthly",
      daysRemaining: 9, nextSession: "Tuesday · 18:30", onlineDone: 5, onlineTotal: 8,
      floorUsed: 1, floorTotal: 2, floorDue: "Tuesday · 18:30", floorPrompt: "Due · auto-send Sunday 09:00", floorState: "due",
      checkIn: "Overdue", lastMessage: "Which session should I swap if work runs late?",
      unread: true, status: "Needs check-in", value: "£320/mo", attendance: 63, health: "risk", renewalStage: "early", renewalDue: "7 days",
      note: "Two floor sessions monthly; the online plan carries the rest.", joined: "7 months ago", packagesBought: 5,
      packagePath: "Intro block → Self-led programme → Monthly coaching", gap: "18-day gap before moving onto monthly",
      assetBlock: 3, assetSource: "Trainerize + Tom library", programmeMonths: 7, progressionReview: "Needs review",
      eventGoal: { event: "HYROX Korea", date: "14 March", target: "1:30:00", sim: "1:37:40", status: "Behind target", adaptation: "Protect work schedule; bias compromised running and low-impact engine work." },
      stations: [
        { name: "Sled push", state: "risk", latest: "Pace drops after halfway", note: "Primary limiter" },
        { name: "Wall balls", state: "watch", latest: "Breaks at 25+", note: "Build unbroken sets" },
        { name: "Compromised running", state: "risk", latest: "1:24/km slower post-station", note: "Priority adaptation" },
        { name: "Roxzone", state: "watch", latest: "Transitions okay", note: "Needs rehearsal under fatigue" }
      ],
      history: [
        { date: "7 months ago", title: "Signed up", detail: "Started on a short confidence block." },
        { date: "6 months ago", title: "Bought package 2", detail: "Moved into Self-led programme after an 18-day gap." },
        { date: "4 months ago", title: "Progressed", detail: "Moved up to Monthly coaching monthly." },
        { date: "This month", title: "Watch point", detail: "Check-in is overdue and the next floor session is due." }
      ],
      sent: { early: false, final: false, followup: false }
    },
    {
      id: "priya", name: "Priya S.", plan: "Self-led programme · intro package", type: "sessions",
      sessionsUsed: 3, sessionsTotal: 4, nextSession: "Today · 12:30",
      floorUsed: 3, floorTotal: 4, floorDue: "Today · 12:30", floorPrompt: "Auto-updates from bookings", floorState: "booked",
      onlineDone: 2, onlineTotal: 2, checkIn: "Received",
      lastMessage: "Feeling better about the rig — could we talk about the next block?",
      unread: false, status: "Final session today", value: "£180 block", attendance: 100, health: "high", renewalStage: "final", renewalDue: "today",
      note: "Good candidate for hybrid monthly once the intro block finishes.", joined: "4 weeks ago", packagesBought: 1,
      packagePath: "Self-led programme intro", gap: "No previous gap",
      assetBlock: 1, assetSource: "Trainerize", programmeMonths: 1,
      eventGoal: { event: "First HYROX — not booked", date: "TBC", target: "Finish confidently", sim: "No simulation yet", status: "Building base", adaptation: "Finish intro block, then discuss Monthly coaching." },
      history: [
        { date: "4 weeks ago", title: "Signed up", detail: "Started the four-session intro package." },
        { date: "Today", title: "Final session", detail: "Ready for a recommendation into hybrid monthly." }
      ],
      sent: { early: true, final: false, followup: false }
    },
    {
      id: "nadia", name: "Nadia K.", plan: "Monthly coaching", type: "monthly",
      daysRemaining: 0, nextSession: "Completed yesterday", onlineDone: 7, onlineTotal: 8,
      floorUsed: 2, floorTotal: 2, floorDue: "Next booking after renewal", floorPrompt: "Stopped", floorState: "stopped",
      checkIn: "Received", lastMessage: "Thanks — I’ll sort the next month today.",
      unread: false, status: "Follow-up due", value: "£320/mo", attendance: 88, health: "high", paymentStatus: "Renewal pending", renewalStage: "followup", renewalDue: "today",
      note: "Renewal prompt sent after the final session; follow-up window is now.", joined: "9 months ago", packagesBought: 6,
      packagePath: "Strength block → Monthly coaching → Race Ready", gap: "No gap in the last four months",
      assetBlock: 3, assetSource: "Tom video library", programmeMonths: 9, progressionReview: "Review after renewal",
      eventGoal: { event: "HYROX Manchester", date: "21 June", target: "1:26:00", sim: "1:29:10", status: "On track", adaptation: "Move towards Race Ready once renewal is confirmed." },
      stations: [
        { name: "Sled push", state: "good", latest: "Strong last test", note: "Maintain" },
        { name: "Wall balls", state: "watch", latest: "Needs pacing discipline", note: "Race-specific set" },
        { name: "Compromised running", state: "good", latest: "Within target range", note: "Keep progression" },
        { name: "Roxzone", state: "good", latest: "Fast transitions", note: "Keep sharp" }
      ],
      history: [
        { date: "9 months ago", title: "Signed up", detail: "Started on a strength block." },
        { date: "7 months ago", title: "Bought package 3", detail: "Moved onto Monthly coaching monthly." },
        { date: "2 months ago", title: "Progressed", detail: "Added Race Ready work alongside monthly coaching." },
        { date: "Today", title: "Renewal window", detail: "Automated prompts have gone out; coach follow-up is next if they do not renew." }
      ],
      sent: { early: true, final: true, followup: false }
    }
  ];

  const extraClients = [
    ["owen", "Owen B.", "Monthly coaching", "monthly", { daysRemaining: 14, lifecycle: "Paused", pauseAutomation: true, floorUsed: 0, floorTotal: 2, floorDue: "Thu · 18:00", floorPrompt: "Scheduled · Mon 09:00", floorState: "scheduled", onlineDone: 3, onlineTotal: 8, checkIn: "Received", unread: false, status: "On track", value: "£320/mo", attendance: 74, health: "watch", renewalStage: "none" }],
    ["chloe", "Chloe M.", "Strength Foundations · 8 sessions", "sessions", { sessionsUsed: 4, sessionsTotal: 8, floorUsed: 4, floorTotal: 8, floorDue: "Sat · 10:00", floorPrompt: "Booked · updates from session completion", floorState: "booked", onlineDone: 2, onlineTotal: 4, checkIn: "Received", unread: false, status: "On track", value: "£240 block", attendance: 91, health: "high", renewalStage: "none" }],
    ["dani", "Dani W.", "Monthly coaching", "monthly", { daysRemaining: 3, floorUsed: 1, floorTotal: 2, floorDue: "Wed · 07:30", floorPrompt: "Scheduled · Sun 09:00", floorState: "scheduled", onlineDone: 6, onlineTotal: 8, checkIn: "Due tomorrow", unread: false, status: "Renewal soon", value: "£320/mo", attendance: 82, health: "watch", renewalStage: "early", renewalDue: "3 days" }],
    ["sofia", "Sofia L.", "1-1 Private Coaching", "sessions", { sessionsUsed: 7, sessionsTotal: 8, floorUsed: 7, floorTotal: 8, floorDue: "Fri · 12:30", floorPrompt: "Booked · updates from session completion", floorState: "booked", onlineDone: 4, onlineTotal: 4, checkIn: "Received", unread: false, status: "Renewal soon", value: "£240 block", attendance: 96, health: "high", renewalStage: "early", renewalDue: "1 session" }],
    ["ethan", "Ethan C.", "Monthly coaching", "monthly", { daysRemaining: 22, floorUsed: 2, floorTotal: 2, floorDue: "Next month", floorPrompt: "Booked · updates from session completion", floorState: "booked", onlineDone: 4, onlineTotal: 8, checkIn: "Received", unread: false, status: "On track", value: "£320/mo", attendance: 85, health: "high", renewalStage: "none" }],
    ["ruby", "Ruby H.", "Self-led programme · intro package", "sessions", { sessionsUsed: 1, sessionsTotal: 4, floorUsed: 1, floorTotal: 4, floorDue: "Tue · 08:00", floorPrompt: "Scheduled · Sat 09:00", floorState: "scheduled", onlineDone: 1, onlineTotal: 2, checkIn: "Received", unread: true, status: "Question waiting", value: "£180 block", attendance: 70, health: "watch", renewalStage: "none", lastMessage: "Should I repeat the ski intervals or move on?" }],
    ["mason", "Mason G.", "Monthly coaching", "monthly", { daysRemaining: 5, paymentStatus: "Payment issue", floorUsed: 1, floorTotal: 2, floorDue: "Tomorrow · 19:00", floorPrompt: "Due · auto-send today", floorState: "due", onlineDone: 5, onlineTotal: 8, checkIn: "Overdue", unread: false, status: "Needs check-in", value: "£320/mo", attendance: 58, health: "risk", renewalStage: "early", renewalDue: "5 days" }],
    ["ella", "Ella P.", "Self-led programme · 8 sessions", "sessions", { sessionsUsed: 5, sessionsTotal: 8, floorUsed: 5, floorTotal: 8, floorDue: "Sun · 09:30", floorPrompt: "Booked · updates from session completion", floorState: "booked", onlineDone: 3, onlineTotal: 4, checkIn: "Received", unread: false, status: "On track", value: "£240 block", attendance: 89, health: "high", renewalStage: "none" }],
    ["theo", "Theo J.", "Monthly coaching", "monthly", { daysRemaining: 18, floorUsed: 1, floorTotal: 2, floorDue: "Thu · 17:30", floorPrompt: "Scheduled · Mon 09:00", floorState: "scheduled", onlineDone: 7, onlineTotal: 8, checkIn: "Received", unread: false, status: "On track", value: "£320/mo", attendance: 94, health: "high", renewalStage: "none", assetBlock: 3, assetSource: "Trainerize + Tom library", programmeMonths: 18, progressionReview: "Review due", eventGoal: { event: "HYROX London", date: "2 May", target: "1:22:00", sim: "1:25:30", status: "On track", adaptation: "Ready for a sharper race-specific block if the next checkpoint holds." }, stations: [
      { name: "Sled push", state: "good", latest: "Race pace held", note: "Maintain" },
      { name: "Wall balls", state: "watch", latest: "Small fade late", note: "Second block focus" },
      { name: "Compromised running", state: "good", latest: "Within 5% of target", note: "Keep progression" },
      { name: "Roxzone", state: "good", latest: "Fastest group", note: "Keep sharp" }
    ], joined: "18 months ago", packagesBought: 9, packagePath: "Intro block → Self-led programme → Monthly coaching → Performance", gap: "Two gaps: six weeks after the first block, four weeks last winter", history: [
      { date: "18 months ago", title: "Signed up", detail: "Started on a four-session intro block." },
      { date: "16 months ago", title: "Bought package 2", detail: "Moved into Self-led programme after a six-week gap." },
      { date: "12 months ago", title: "Progressed", detail: "Moved up to Monthly coaching monthly." },
      { date: "7 months ago", title: "Returned after gap", detail: "Restarted monthly coaching after four weeks away." },
      { date: "Now", title: "Current position", detail: "Strong attendance on Monthly coaching monthly." }
    ] }],
    ["isla", "Isla F.", "Race Ready · 8 sessions", "sessions", { sessionsUsed: 8, sessionsTotal: 8, floorUsed: 8, floorTotal: 8, floorDue: "Completed today", floorPrompt: "Completed", floorState: "booked", onlineDone: 4, onlineTotal: 4, checkIn: "Received", unread: false, status: "Final session today", value: "£260 block", attendance: 100, health: "high", renewalStage: "final", renewalDue: "today" }],
    ["jack", "Jack D.", "Monthly coaching", "monthly", { daysRemaining: 1, floorUsed: 2, floorTotal: 2, floorDue: "Completed yesterday", floorPrompt: "Booked · updates from session completion", floorState: "booked", onlineDone: 8, onlineTotal: 8, checkIn: "Received", unread: false, status: "Renewal tomorrow", value: "£320/mo", attendance: 93, health: "high", renewalStage: "final", renewalDue: "tomorrow" }],
    ["freya", "Freya S.", "Monthly coaching", "monthly", { daysRemaining: 11, floorUsed: 0, floorTotal: 2, floorDue: "Wed · 18:30", floorPrompt: "Scheduled · Sun 09:00", floorState: "scheduled", onlineDone: 2, onlineTotal: 8, checkIn: "Overdue", unread: true, status: "Needs attention", value: "£320/mo", attendance: 44, health: "risk", renewalStage: "none", lastMessage: "Can I swap Thursday because of a late shift?" }],
    ["oscar", "Oscar W.", "Performance · 8 sessions", "sessions", { sessionsUsed: 2, sessionsTotal: 8, floorUsed: 2, floorTotal: 8, floorDue: "Fri · 07:00", floorPrompt: "Scheduled · Tue 09:00", floorState: "scheduled", onlineDone: 1, onlineTotal: 4, checkIn: "Received", unread: false, status: "On track", value: "£280 block", attendance: 76, health: "watch", renewalStage: "none" }],
    ["lily", "Lily V.", "Monthly coaching", "monthly", { daysRemaining: 28, floorUsed: 1, floorTotal: 2, floorDue: "Tue · 12:30", floorPrompt: "Booked · updates from session completion", floorState: "booked", onlineDone: 6, onlineTotal: 8, checkIn: "Received", unread: false, status: "On track", value: "£320/mo", attendance: 97, health: "high", renewalStage: "none" }],
    ["noah", "Noah K.", "Self-led programme · intro package", "sessions", { sessionsUsed: 0, sessionsTotal: 4, floorUsed: 0, floorTotal: 4, floorDue: "Mon · 08:00", floorPrompt: "Scheduled · Fri 09:00", floorState: "scheduled", onlineDone: 0, onlineTotal: 2, checkIn: "Due tomorrow", unread: false, status: "New client", value: "£180 block", attendance: 0, health: "watch", renewalStage: "none", lastMessage: "Looking forward to starting Monday." }],
    ["mia", "Mia A.", "Monthly coaching", "monthly", { daysRemaining: 7, floorUsed: 1, floorTotal: 2, floorDue: "Thu · 07:30", floorPrompt: "Sent automatically", floorState: "sent", onlineDone: 7, onlineTotal: 8, checkIn: "Received", unread: false, status: "Renewal soon", value: "£320/mo", attendance: 90, health: "high", renewalStage: "early", renewalDue: "7 days" }]
  ].map(([id, name, plan, type, data]) => ({
    id, name, plan, type,
    sessionsUsed: 0, sessionsTotal: 0, daysRemaining: 0, nextSession: data.floorDue,
    lastMessage: `Keeping ${plan.toLowerCase()} moving this week.`,
    note: "Client state comes from bookings, programme progress and message activity.",
    joined: data.attendance > 85 ? "6 months ago" : "10 weeks ago",
    packagesBought: type === "monthly" ? 3 : 1,
    packagePath: type === "monthly" ? `Intro block → ${plan.replace(" · monthly", "")}` : plan,
    gap: type === "monthly" ? "One 10-day gap before monthly coaching" : "No package gap yet",
    history: [
      { date: data.attendance > 85 ? "6 months ago" : "10 weeks ago", title: "Signed up", detail: `Started on ${plan}.` },
      { date: "Last month", title: type === "monthly" ? "Continued monthly coaching" : "Package in progress", detail: `${data.onlineDone || 0}/${data.onlineTotal || 1} online sessions completed.` },
      { date: "Now", title: "Current position", detail: data.status }
    ],
    sent: { early: false, final: false, followup: false },
    ...data
  }));

  const seedClients = [...coreClients, ...extraClients];

  const load = (storageKey, fallback) => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) return saved;
    } catch { /* noop */ }
    return fallback;
  };
  const settings = { ...defaultSettings, ...load(settingsKey, {}) };
  const savedClients = load(key, []);
  const seedIds = new Set(seedClients.map(client => client.id));
  const clients = [
    ...seedClients.map(seed => {
      const saved = savedClients.find(client => client.id === seed.id) || {};
      return {
        floorUsed: seed.sessionsUsed || 0,
        floorTotal: seed.sessionsTotal || 2,
        floorDue: seed.nextSession,
        floorPrompt: "Auto-updates from bookings",
        floorState: "booked",
        value: "—",
        attendance: 0,
        health: "watch",
        onlineDone: 0,
        onlineTotal: 1,
        ...seed,
        ...saved
      };
    }),
    ...savedClients.filter(client => !seedIds.has(client.id))
  ].map(client => ({
    lifecycle: "Active",
    paymentStatus: client.type === "monthly" ? "Paid" : "Package paid",
    autoRenew: client.type === "monthly",
    nextBilling: client.type === "monthly" ? "Next month" : "Package balance",
    email: `${client.id.split("-")[0]}@example.co.uk`,
    phone: "4475550100",
    preferredContact: "Desk message",
    source: "Website booking",
    lastContact: "Yesterday",
    nextContact: client.floorPrompt || "Next check-in",
    bookingState: "Booked",
    bookingCounted: false,
    pauseAutomation: false,
    assetBlock: client.type === "monthly" ? 2 : 1,
    assetSource: "Tom video library",
    renewalCount: client.type === "monthly" ? Math.max(0, (client.packagesBought || 1) - 1) : 0,
    programmeMonths: client.type === "monthly" ? 3 : 0,
    progressionReview: client.type === "monthly" && (client.packagesBought || 1) >= 3 ? "Review due" : "Not due",
    eventGoal: {
      event: "No event booked",
      date: "TBC",
      target: "Set target",
      sim: "No simulation yet",
      status: "Building base",
      adaptation: "Keep the base programme steady until a race target is set."
    },
    stations: defaultStations.map(station => ({ ...station })),
    coachNotes: [],
    ...client
  }));
  const save = () => {
    localStorage.setItem(key, JSON.stringify(clients));
    localStorage.setItem(settingsKey, JSON.stringify(settings));
    if (window.ContactStore) ContactStore.importClients(clients);
  };
  let activeId = clients[0].id;
  let filter = "all";
  let query = "";
  let sortBy = "attention";
  let toastTimer;
  const active = () => clients.find(client => client.id === activeId) || clients[0];
  const remaining = client => client.type === "sessions" ? client.sessionsTotal - client.sessionsUsed : client.daysRemaining;
  const archived = client => client.lifecycle === "Archived";
  const manuallyPaused = client => client.pauseAutomation || client.lifecycle === "Paused";
  const paused = client => archived(client) || manuallyPaused(client) || (settings.stopOnPaymentIssue && /issue|failed/i.test(client.paymentStatus || ""));
  const paymentIssue = client => /issue|failed|pending/i.test(client.paymentStatus || "") && client.paymentStatus !== "Renewal pending";
  const needsRenewal = client => !paused(client) && (["early","final","followup"].includes(client.renewalStage) || client.status === "Follow-up sent");
  const overdue = client => !paused(client) && settings.hybridCheckins && /overdue/i.test(client.checkIn);
  const replaceTokens = (template, client) => String(template || "")
    .replaceAll("{name}", client.name.split(" ")[0])
    .replaceAll("{remaining}", client.type === "monthly" ? `${client.daysRemaining} days` : `${remaining(client)} sessions`)
    .replaceAll("{due}", client.renewalDue || "today")
    .replaceAll("{floorDue}", client.floorDue || client.nextSession || "the next available slot");
  const exactPrompt = client => {
    const template = client.renewalStage === "early" ? settings.earlyTemplate : client.renewalStage === "final" ? settings.finalTemplate : settings.followupTemplate;
    return replaceTokens(template, client);
  };
  const exactFloorPrompt = client => replaceTokens(settings.floorTemplate, client);
  const floorNeedsAction = client => !paused(client) && (client.floorState === "due" || client.floorState === "scheduled");
  const floorSummary = client => `${client.floorUsed}/${client.floorTotal} · ${client.floorState}`;
  const assetList = client => programmeAssets[client.plan] || ["Base programme set", "Progression set", "Event-specific set"];
  const currentAsset = client => assetList(client)[Math.max(0, Math.min((client.assetBlock || 1) - 1, assetList(client).length - 1))];
  const nextAsset = client => assetList(client)[Math.min(client.assetBlock || 1, assetList(client).length - 1)] || currentAsset(client);
  const recommendedProgramme = client => nextProgramme[client.plan] || "Monthly coaching";
  const progressionDue = client => !paused(client) && /review/i.test(client.progressionReview || "") && client.progressionReview !== "Reviewed";
  const progressionChecklist = client => [
    { label: "Attendance at least 85%", pass: (client.attendance || 0) >= 85 },
    { label: "Online programme at least 75% complete", pass: (client.onlineDone || 0) / Math.max(1, client.onlineTotal || 1) >= .75 },
    { label: "Check-in received or coach contacted", pass: !/overdue/i.test(client.checkIn || "") },
    { label: "Payment is clean", pass: !paymentIssue(client) },
    { label: `Has been on this programme for ${settings.progressionMonths || 3}+ months`, pass: (client.programmeMonths || 0) >= (settings.progressionMonths || 3) || (client.packagesBought || 0) >= (settings.progressionMonths || 3) }
  ];
  const attentionPlan = client => {
    if (archived(client)) return {
      flag: "Archived", kind: "archived",
      title: "Client is archived",
      copy: `${client.name} is kept for history only. Restore the record if they return to coaching.`,
      owner: "Record only"
    };
    if (client.unread) return {
      flag: "Message", kind: "message",
      title: "Client needs a personal reply",
      copy: `${client.name} asked a programme question. The next action is a coach reply in The Desk — not another automated notice.`,
      owner: "Coach action"
    };
    if (paymentIssue(client)) return {
      flag: "Payment issue", kind: "payment",
      title: "Payment needs attention",
      copy: `${client.name}'s ${client.paymentStatus.toLowerCase()} needs resolving before more coaching or automated renewal prompts go out.`,
      owner: "Coach action"
    };
    if (paused(client)) return {
      flag: "Paused", kind: "paused",
      title: "Client automation is paused",
      copy: `${client.name} is marked ${client.lifecycle.toLowerCase()}. No automated booking or renewal prompts should run until this is resumed.`,
      owner: "Paused"
    };
    if (overdue(client)) return {
      flag: "Check-in", kind: "checkin",
      title: "Check-in needs a human nudge",
      copy: `${client.name} has missed an online check-in. Automation can remind them, but this is better handled personally in chat or WhatsApp.`,
      owner: "Coach action"
    };
    if (needsRenewal(client)) return {
      flag: "Renewal", kind: "renewal",
      title: "Renewal cadence is running",
      copy: `${client.name} is in the ${client.renewalStage} stage. The Desk handles the timed prompt; the coach steps in if the follow-up is ignored.${client.floorState === "stopped" ? " Their floor reminder is also stopped." : ""}`,
      owner: "Desk + coach"
    };
    if (client.floorState === "stopped") return {
      flag: "Floor stopped", kind: "floorStopped",
      title: "Automatic floor reminder is stopped",
      copy: `${client.name}'s reminder was paused. If they still need to book, the next step is a personal booking conversation.`,
      owner: "Coach action"
    };
    if (progressionDue(client)) return {
      flag: "Progression", kind: "progression",
      title: "Programme progression review",
      copy: `${client.name} has been on ${client.plan} long enough to review the next step. Check the readiness list before recommending ${recommendedProgramme(client)}.`,
      owner: "Coach action"
    };
    if (client.floorState === "sent") return {
      flag: "Floor sent", kind: "floorSent",
      title: "Floor reminder sent automatically",
      copy: `The Desk has sent the booking reminder for ${client.floorDue}. No coach action is needed unless the client does not book.`,
      owner: "Automated"
    };
    if (floorNeedsAction(client)) return {
      flag: "Floor prompt", kind: "floorPrompt",
      title: "Floor reminder is scheduled",
      copy: `The Desk will send the booking reminder for ${client.floorDue} unless the coach stops it.`,
      owner: "Automated"
    };
    return { flag: "On track", kind: "none", title: "No action needed", copy: "Bookings, online progress and messages are up to date.", owner: "Up to date" };
  };
  const clientFlag = client => attentionPlan(client).flag;
  const attentionTone = flag => flag === "On track" || flag === "Floor sent" || flag === "Archived" ? "good" : flag === "Floor prompt" || flag === "Renewal" || flag === "Paused" || flag === "Progression" ? "watch" : "risk";
  const matchesFilter = client => (filter === "archived" ? archived(client) : !archived(client) && (filter === "all"
    || (filter === "top" && client.health === "high")
    || (filter === "renewal" && needsRenewal(client))
    || (filter === "floor" && client.floorState !== "booked")
    || (filter === "checkin" && overdue(client))
    || (filter === "message" && client.unread)
    || (filter === "paused" && manuallyPaused(client))
    || (filter === "payment" && paymentIssue(client))
    || (filter === "progression" && progressionDue(client))))
    && (!query || `${client.name} ${client.plan} ${client.status}`.toLowerCase().includes(query));
  const sortClients = list => [...list].sort((a, b) => {
    if (sortBy === "attendance") return (b.attendance || 0) - (a.attendance || 0);
    if (sortBy === "renewal") return (a.daysRemaining ?? 99) - (b.daysRemaining ?? 99) || remaining(a) - remaining(b);
    if (sortBy === "value") return (Number(String(b.value).replace(/[^0-9]/g, "")) || 0) - (Number(String(a.value).replace(/[^0-9]/g, "")) || 0);
    if (sortBy === "last") return String(a.lastContact).localeCompare(String(b.lastContact));
    const rank = { risk: 0, watch: 1, good: 2 };
    return (rank[attentionTone(clientFlag(a))] ?? 1) - (rank[attentionTone(clientFlag(b))] ?? 1);
  });

  function processAutoFloorPrompts() {
    clients.forEach(client => {
      if (client.floorState !== "due" || paused(client)) return;
      client.messages = client.messages || [];
      const prompt = exactFloorPrompt(client);
      if (!client.messages.some(message => message.text === prompt)) client.messages.push({ direction: "out", text: prompt });
      client.floorState = "sent";
      client.floorPrompt = "Sent automatically";
    });
  }

  function renewalGuidance(client) {
    if (client.renewalStage === "early") {
      return client.type === "monthly"
        ? `Warm-up reminder due: ${client.name} has ${client.daysRemaining} days left. Recommended threshold: ${settings.dayThreshold} days before renewal.`
        : `Warm-up reminder due: ${client.name} has ${remaining(client)} sessions left. Recommended threshold: ${settings.sessionThreshold} sessions before the block ends.`;
    }
    if (client.renewalStage === "final") return `Renew-today window: ${settings.finalMoment.toLowerCase()} — send while the result and momentum are fresh.`;
    if (client.renewalStage === "followup") return `Follow-up window: ${settings.followupTiming.toLowerCase()} — one clear nudge, then let the client decide.`;
    return `No renewal prompt due right now. The next soft reminder starts at ${settings.sessionThreshold} sessions or ${settings.dayThreshold} days remaining.`;
  }

  window.ClientDeskStore = {
    clients, settings, save, esc, remaining, needsRenewal, overdue,
    exactPrompt, exactFloorPrompt, floorNeedsAction, floorSummary,
    attentionPlan, renewalGuidance, processAutoFloorPrompts,
    assetList, currentAsset, nextAsset, recommendedProgramme,
    progressionDue, progressionChecklist
  };
  processAutoFloorPrompts();
  save();
  if (!$("client-list")) return;

  const list = $("client-list"), title = $("client-title"), subtitle = $("client-subtitle"), detail = $("client-detail");
  const renewalTitle = $("renewal-title"), renewalCopy = $("renewal-copy"), promptPreview = $("prompt-preview"), thread = $("thread"), reply = $("client-reply");
  const toast = $("client-toast"), attentionList = $("attention-list"), attentionTitle = $("attention-title");
  const buttons = { early: $("send-early"), final: $("send-final"), followup: $("send-followup") };

  function renderStats() {
    $("stat-active").textContent = clients.filter(client => !archived(client)).length;
    $("stat-renewals").textContent = clients.filter(needsRenewal).length;
    $("stat-checkins").textContent = clients.filter(floorNeedsAction).length;
    $("stat-messages").textContent = clients.filter(client => client.unread).length;
    $("stat-payments").textContent = clients.filter(paymentIssue).length;
    $("stat-paused").textContent = clients.filter(paused).length;
    const digest = [
      clients.filter(client => client.unread).length && `${clients.filter(client => client.unread).length} unread question${clients.filter(client => client.unread).length === 1 ? "" : "s"}`,
      clients.filter(overdue).length && `${clients.filter(overdue).length} overdue check-in${clients.filter(overdue).length === 1 ? "" : "s"}`,
      clients.filter(needsRenewal).length && `${clients.filter(needsRenewal).length} renewal${clients.filter(needsRenewal).length === 1 ? "" : "s"} to watch`,
      clients.filter(floorNeedsAction).length && `${clients.filter(floorNeedsAction).length} floor prompt${clients.filter(floorNeedsAction).length === 1 ? "" : "s"} active`,
      clients.filter(paymentIssue).length && `${clients.filter(paymentIssue).length} payment issue${clients.filter(paymentIssue).length === 1 ? "" : "s"}`
    ].filter(Boolean);
    $("daily-digest").textContent = digest.length ? `Today: ${digest.join(" · ")}.` : "Today: no unread questions, overdue check-ins or payment issues.";
  }

  function renderAttention() {
    const items = [];
    clients.forEach(client => {
      if (needsRenewal(client)) items.push(`${client.name} · ${client.renewalDue ? `renew by ${client.renewalDue}` : "renewal prompt due"}`);
      if (floorNeedsAction(client)) items.push(`${client.name} · floor-session reminder ${client.floorState === "due" ? "ready to send" : "scheduled"}`);
      if (overdue(client)) items.push(`${client.name} · check-in overdue`);
      if (client.unread) items.push(`${client.name} · unanswered programme question`);
    });
    attentionTitle.textContent = items.length ? `Client register · ${items.length} need attention` : "Client register · everything up to date";
    attentionList.innerHTML = items.map(item => `<li>${esc(item)}</li>`).join("");
  }

  function renderButtons(client) {
    const sent = client.sent || {};
    const states = [
      [buttons.early, "early", "Send early reminder"],
      [buttons.final, "final", "Send renew-today prompt"],
      [buttons.followup, "followup", "Send follow-up"]
    ];
    states.forEach(([button, stage, label]) => {
      const wasSent = Boolean(sent[stage]);
      button.textContent = wasSent ? "Sent" : label;
      button.disabled = wasSent || client.renewalStage === "none" || client.renewalStage === "renewed";
      button.classList.toggle("sent-action", wasSent);
    });
    if (client.renewalStage === "early") {
      buttons.final.disabled = !sent.early;
      buttons.followup.disabled = true;
    } else if (client.renewalStage === "final") {
      buttons.final.disabled = Boolean(sent.final);
      buttons.followup.disabled = !sent.final;
    } else if (client.renewalStage === "followup") {
      buttons.followup.disabled = Boolean(sent.followup);
    }
  }

  function render() {
    const current = active();
    current.sent = { early: false, final: false, followup: false, ...(current.sent || {}) };
    const visibleClients = sortClients(clients.filter(matchesFilter));
    list.innerHTML = visibleClients.length ? visibleClients.map(client => `
      <a class="client-card health-${esc(client.health || "watch")}" href="/trainedbytr/client.html?audience=coach&amp;client=${encodeURIComponent(client.id)}" aria-label="Open ${esc(client.name)} client record">
        <div class="client-cell"><span>Client</span><strong>${esc(client.name)}</strong></div>
        <div class="client-cell"><span>Programme</span><strong>${esc(client.plan)}</strong></div>
        <div class="client-cell"><span>${client.type === "monthly" ? "Month" : "Package"}</span><strong>${esc(client.type === "monthly" ? `${client.daysRemaining}d left` : `${client.sessionsUsed}/${client.sessionsTotal} used`)}</strong></div>
        <div class="client-cell"><span>Value / attend.</span><strong>${esc(`${client.value} · ${client.attendance}%`)}</strong></div>
        <div class="client-cell"><span>Floor</span><strong>${esc(floorSummary(client))}</strong></div>
        <div class="client-cell"><span>Online</span><strong>${esc(`${client.onlineDone}/${client.onlineTotal}`)}</strong></div>
        <div class="client-cell"><span>Status</span><strong>${esc(client.lifecycle)} · ${esc(client.paymentStatus)}</strong></div>
        <div class="client-cell"><span>Attention</span><strong class="client-status attention-${attentionTone(clientFlag(client))}">${esc(clientFlag(client))}</strong></div>
      </a>
    `).join("") : `<p class="client-note">No clients match this filter.</p>`;
    window.deskCap?.(list, { noun: "clients", limit: 8 });
    document.querySelectorAll("[data-filter]").forEach(button => button.classList.toggle("is-active", button.dataset.filter === filter));
    title.textContent = `${current.name} · ${current.status}`;
    subtitle.textContent = `${current.plan} · ${current.note}`;
    const usage = current.type === "monthly" ? `${current.daysRemaining} days` : `${current.sessionsUsed}/${current.sessionsTotal} used`;
    detail.innerHTML = `
      <div><span>Package / subscription</span><strong>${esc(usage)}</strong></div>
      <div><span>Floor sessions</span><strong>${esc(`${current.floorUsed}/${current.floorTotal} this month`)}</strong></div>
      <div><span>Next floor session</span><strong>${esc(current.nextSession)}</strong></div>
      <div><span>Online programme</span><strong>${esc(`${current.onlineDone}/${current.onlineTotal} done`)}</strong></div>
      <div><span>Check-in</span><strong>${esc(current.checkIn)}</strong></div>
      <div><span>Joined</span><strong>${esc(current.joined || "Recently")}</strong></div>
      <div><span>Packages bought</span><strong>${esc(String(current.packagesBought || 1))}</strong></div>
      <div><span>Package path</span><strong>${esc(current.packagePath || current.plan)}</strong></div>
      <div><span>Package gap</span><strong>${esc(current.gap || "No recorded gap")}</strong></div>
    `;
    const attention = attentionPlan(current);
    $("attention-action-title").textContent = attention.title;
    $("attention-action-copy").textContent = attention.copy;
    $("attention-owner").textContent = attention.owner;
    $("client-timeline").innerHTML = (current.history || []).map(item => `
      <div class="timeline-item">
        <time>${esc(item.date)}</time>
        <div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div>
      </div>
    `).join("");
    window.deskCap?.($("client-timeline"), { noun: "entries", limit: 5 });
    $("floor-title").textContent = `Floor-session reminder · ${current.floorPrompt}`;
    $("floor-copy").textContent = current.floorState === "stopped"
      ? "Automatic booking reminders are paused for this client. Resume them when the client is ready to book again."
      : current.floorState === "sent"
        ? "The automatic booking reminder has gone out. Package and monthly session totals update from completed bookings — no manual ledger needed."
        : current.floorState === "booked"
          ? "The next gym-floor session is already booked. Completed bookings update the client’s usage automatically."
          : `Automatic reminder runs ${settings.floorDays} days before the next floor session unless you stop it.`;
    $("floor-preview").innerHTML = `<strong>Client receives:</strong><br>${esc(exactFloorPrompt(current))}`;
    $("stop-floor").textContent = current.floorState === "stopped" ? "Resume auto reminder" : "Stop auto reminder";
    $("stop-floor").disabled = current.floorState === "booked";
    $("mark-floor-booked").disabled = current.floorState === "booked";
    renewalTitle.textContent = current.renewalDue ? `Renew by ${current.renewalDue}` : "Renewal workflow";
    renewalCopy.textContent = renewalGuidance(current);
    promptPreview.innerHTML = `<strong>Client receives:</strong><br>${esc(exactPrompt(current))}`;
    thread.innerHTML = `
      <div class="bubble inbound"><span>${esc(current.name)} · programme question</span><p>${esc(current.lastMessage)}</p></div>
      ${(current.messages || []).map(message => `<div class="bubble ${message.direction === "out" ? "outbound" : "inbound"}"><span>${message.direction === "out" ? "Tom · The Desk" : esc(current.name)}</span><p>${esc(message.text)}</p></div>`).join("")}
    `;
    reply.value = current.draftReply || "Great question — keep the plan as written for now and tell me how the next session feels. If anything changes, I’ll adjust the next block rather than guessing on the day.";
    renderButtons(current);
    renderStats();
    renderAttention();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.hidden = true, 3200);
  }

  function note(client, text, direction = "out") {
    client.messages = client.messages || [];
    client.messages.push({ direction, text });
  }

  function sendPrompt(stage) {
    const current = active();
    current.sent = current.sent || {};
    const prompt = exactPrompt(current);
    note(current, prompt);
    current.sent[stage] = true;
    if (stage === "early") { current.renewalStage = "final"; current.status = "Early reminder sent"; }
    if (stage === "final") { current.renewalStage = "followup"; current.status = "Renew-today sent"; }
    if (stage === "followup") { current.renewalStage = "followup"; current.status = "Follow-up sent"; }
    save();
    render();
    showToast(`${buttons[stage].textContent === "Sent" ? "Prompt" : "Renewal prompt"} logged in this walkthrough.`);
  }

  function fillSettings() {
    $("set-session-threshold").value = settings.sessionThreshold;
    $("set-day-threshold").value = settings.dayThreshold;
    $("set-final-moment").value = settings.finalMoment;
    $("set-floor-days").value = settings.floorDays;
    $("set-followup").value = settings.followupTiming;
    $("set-block-size").value = settings.blockSize;
    $("set-month-length").value = settings.monthLength;
    $("set-floor-total").value = settings.monthlyFloorTotal;
    $("set-online-total").value = settings.onlineTotal;
    $("set-quiet-hours").value = settings.quietHours;
    $("set-stop-payment").checked = settings.stopOnPaymentIssue;
    $("set-hybrid-checkins").checked = settings.hybridCheckins;
    $("set-early-template").value = settings.earlyTemplate;
    $("set-final-template").value = settings.finalTemplate;
    $("set-followup-template").value = settings.followupTemplate;
    $("set-floor-template").value = settings.floorTemplate;
  }

  function readSettings() {
    settings.sessionThreshold = Math.max(1, Number($("set-session-threshold").value) || defaultSettings.sessionThreshold);
    settings.dayThreshold = Math.max(1, Number($("set-day-threshold").value) || defaultSettings.dayThreshold);
    settings.finalMoment = $("set-final-moment").value;
    settings.floorDays = Math.max(1, Number($("set-floor-days").value) || defaultSettings.floorDays);
    settings.followupTiming = $("set-followup").value;
    settings.blockSize = Math.max(1, Number($("set-block-size").value) || defaultSettings.blockSize);
    settings.monthLength = Math.max(7, Number($("set-month-length").value) || defaultSettings.monthLength);
    settings.monthlyFloorTotal = Math.max(1, Number($("set-floor-total").value) || defaultSettings.monthlyFloorTotal);
    settings.onlineTotal = Math.max(1, Number($("set-online-total").value) || defaultSettings.onlineTotal);
    settings.quietHours = $("set-quiet-hours").value.trim() || defaultSettings.quietHours;
    settings.stopOnPaymentIssue = $("set-stop-payment").checked;
    settings.hybridCheckins = $("set-hybrid-checkins").checked;
    settings.earlyTemplate = $("set-early-template").value.trim() || defaultSettings.earlyTemplate;
    settings.finalTemplate = $("set-final-template").value.trim() || defaultSettings.finalTemplate;
    settings.followupTemplate = $("set-followup-template").value.trim() || defaultSettings.followupTemplate;
    settings.floorTemplate = $("set-floor-template").value.trim() || defaultSettings.floorTemplate;
  }

  list.addEventListener("click", event => {
    const card = event.target.closest("[data-client]");
    if (!card) return;
    activeId = card.dataset.client;
    render();
  });

  $("client-filters").addEventListener("click", event => {
    const chip = event.target.closest("[data-filter]");
    if (!chip) return;
    filter = chip.dataset.filter;
    render();
  });

  $("client-search").addEventListener("input", event => {
    query = event.target.value.trim().toLowerCase();
    render();
  });
  $("client-sort").addEventListener("change", event => {
    sortBy = event.target.value;
    render();
  });

  $("toggle-add-client").addEventListener("click", () => {
    const panel = $("add-client-panel");
    panel.hidden = !panel.hidden;
    if (!panel.hidden) $("new-client-name").focus();
  });

  $("simulate-booking").addEventListener("click", () => {
    const email = "website.booker@example.co.uk";
    let client = clients.find(item => item.email === email);
    if (client) {
      client.packagesBought = (client.packagesBought || 1) + 1;
      client.status = "Website booking";
      client.lastContact = "Today";
      client.nextContact = client.floorDue || "First session";
      client.history = client.history || [];
      client.history.push({ date: "Today", title: "Website package booked", detail: `${client.name} bought another package through the website.` });
      save();
      location.href = `/trainedbytr/client.html?audience=coach&client=${encodeURIComponent(client.id)}`;
      return;
    }
    client = {
      id: `website-booker-${Date.now().toString(36)}`,
      name: "Taylor W.",
      plan: "1-1 Private Coaching",
      type: "sessions",
      sessionsUsed: 0,
      sessionsTotal: settings.blockSize,
      daysRemaining: 0,
      nextSession: "Book first session",
      floorUsed: 0,
      floorTotal: settings.blockSize,
      floorDue: "Book first session",
      floorPrompt: `Scheduled · ${settings.floorDays} days before due`,
      floorState: "scheduled",
      onlineDone: 0,
      onlineTotal: Math.max(2, Math.round(settings.onlineTotal / 2)),
      checkIn: "Not started",
      lastMessage: "Booked through the website package flow.",
      unread: false,
      status: "Website booking",
      value: "£180 block",
      attendance: 0,
      health: "watch",
      lifecycle: "Active",
      paymentStatus: "Package paid",
      autoRenew: false,
      nextBilling: "Package balance",
      email,
      phone: "4475550199",
      preferredContact: "Desk message",
      source: "Website booking",
      lastContact: "Today",
      nextContact: "First session booking",
      bookingState: "Booked",
      bookingCounted: false,
      pauseAutomation: false,
      assetBlock: 1,
      assetSource: "Website programme flow",
      renewalCount: 0,
      programmeMonths: 0,
      progressionReview: "Not due",
      eventGoal: { event: "No event booked", date: "TBC", target: "Set target", sim: "No simulation yet", status: "Building base", adaptation: "Confirm goals after the first check-in." },
      stations: defaultStations.map(station => ({ ...station })),
      coachNotes: [],
      renewalStage: "none",
      note: "Created automatically from a website package booking.",
      joined: "Today",
      packagesBought: 1,
      packagePath: "1-1 Private Coaching",
      gap: "No package gap yet",
      history: [{ date: "Today", title: "Website package booked", detail: "Taylor booked 1-1 Private Coaching through the website." }],
      sent: { early: false, final: false, followup: false },
      messages: []
    };
    clients.push(client);
    save();
    location.href = `/trainedbytr/client.html?audience=coach&client=${encodeURIComponent(client.id)}`;
  });

  $("add-client-panel").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("new-client-name").value.trim();
    if (!name) return;
    const type = $("new-client-type").value;
    const position = Math.max(1, Number($("new-client-position").value) || (type === "monthly" ? settings.monthLength : settings.blockSize));
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
    const floorDue = $("new-client-floor").value.trim() || "Book first session";
    const plan = $("new-client-plan").value;
    clients.push({
      id, name, plan, type,
      sessionsUsed: 0,
      sessionsTotal: type === "sessions" ? position : 0,
      daysRemaining: type === "monthly" ? position : 0,
      nextSession: floorDue,
      floorUsed: 0,
      floorTotal: type === "monthly" ? settings.monthlyFloorTotal : position,
      floorDue,
      floorPrompt: `Scheduled · ${settings.floorDays} days before due`,
      floorState: "scheduled",
      onlineDone: 0,
      onlineTotal: type === "monthly" ? settings.onlineTotal : Math.max(2, Math.round(settings.onlineTotal / 2)),
      checkIn: "Not started",
      lastMessage: "Added by the coach after an off-site package booking.",
      unread: false,
      status: "New client",
      value: $("new-client-value").value.trim() || "New package",
      email: $("new-client-email").value.trim() || `${id}@example.co.uk`,
      phone: $("new-client-phone").value.trim() || "4475550100",
      preferredContact: $("new-client-contact").value,
      lifecycle: "Active",
      paymentStatus: $("new-client-payment").value,
      autoRenew: $("new-client-autorenew").value === "true",
      nextBilling: type === "monthly" ? "Next month" : "Package balance",
      source: "Coach added",
      lastContact: "Today",
      nextContact: floorDue,
      bookingState: "Booked",
      bookingCounted: false,
      pauseAutomation: false,
      assetBlock: 1,
      assetSource: "Coach library",
      renewalCount: 0,
      programmeMonths: 0,
      progressionReview: "Not due",
      eventGoal: { event: "No event booked", date: "TBC", target: "Set target", sim: "No simulation yet", status: "Building base", adaptation: "Confirm goals after the first check-in." },
      stations: defaultStations.map(station => ({ ...station })),
      coachNotes: [],
      attendance: 0,
      health: "watch",
      renewalStage: "none",
      note: "Added manually by the coach.",
      joined: "Today",
      packagesBought: 1,
      packagePath: plan,
      gap: "New client added outside the website",
      
      history: [{ date: "Today", title: "Added to Client Desk", detail: `${name} booked ${plan} outside the website.` }],
      sent: { early: false, final: false, followup: false },
      messages: []
    });
    save();
    location.href = `/trainedbytr/client.html?audience=coach&client=${encodeURIComponent(id)}`;
  });

  buttons.early.addEventListener("click", () => sendPrompt("early"));
  buttons.final.addEventListener("click", () => sendPrompt("final"));
  buttons.followup.addEventListener("click", () => sendPrompt("followup"));

  $("mark-renewed").addEventListener("click", () => {
    const current = active();
    current.renewalStage = "none";
    current.status = "Renewed";
    current.sent = { early: false, final: false, followup: false };
    if (current.type === "monthly") current.daysRemaining = settings.monthLength;
    else { current.sessionsUsed = 0; current.sessionsTotal = settings.blockSize; }
    note(current, "Renewal confirmed — the next block/month is active in this walkthrough.");
    save();
    render();
    showToast("Marked as renewed.");
  });

  $("send-reply").addEventListener("click", () => {
    const current = active();
    note(current, reply.value.trim());
    current.draftReply = reply.value.trim();
    current.unread = false;
    save();
    render();
    showToast("Client reply logged in this walkthrough.");
  });

  $("stop-floor").addEventListener("click", () => {
    const current = active();
    current.floorState = current.floorState === "stopped" ? "scheduled" : "stopped";
    current.floorPrompt = current.floorState === "stopped" ? "Stopped by coach" : `Scheduled · ${settings.floorDays} days before due`;
    save();
    render();
    showToast(current.floorState === "stopped" ? "Automatic reminder stopped." : "Automatic reminder resumed.");
  });

  $("mark-floor-booked").addEventListener("click", () => {
    const current = active();
    current.floorState = "booked";
    current.floorPrompt = "Booked · updates from session completion";
    save();
    render();
    showToast("Floor session marked as booked.");
  });

  $("log-checkin").addEventListener("click", () => {
    const current = active();
    current.checkIn = "Received";
    current.onlineDone = Math.min(current.onlineTotal, current.onlineDone + 1);
    if (!needsRenewal(current) && !current.unread) current.status = "On track";
    save();
    render();
    showToast("Check-in marked received.");
  });

  $("save-settings").addEventListener("click", () => {
    readSettings();
    save();
    render();
    showToast("Client Desk settings saved for this walkthrough.");
  });

  $("reset-settings").addEventListener("click", () => {
    Object.assign(settings, defaultSettings);
    fillSettings();
    save();
    render();
    showToast("Client Desk settings reset.");
  });

  fillSettings();
  save();
  render();
})();
