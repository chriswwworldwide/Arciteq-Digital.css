import { describe, it, expect } from "vitest";
import {
  emptyInbox,
  validateCandidate,
  upsertCandidates,
  pendingItems,
  decide,
  applyEdits,
  applyPatches,
  buildDigest,
} from "../src/inbox.js";
import {
  parseFeed,
  selectNews,
  buildNewsCandidates,
  MAX_PER_RUN,
} from "../roxjaya/automation/news-sync.js";
import {
  parseHyroxDate,
  rangeLabel,
  parseEventPage,
  buildCandidates,
} from "../roxjaya/automation/hyrox-sync.js";

const now = new Date("2026-09-03T00:00:00Z");

const eventCandidate = {
  key: "event:hyrox-jakarta:2027-06-25",
  kind: "event",
  title: "HYROX Jakarta — 25–27 June 2027",
  summary: "found",
  source: "https://hyrox.com/event/hyrox-jakarta/",
  apply: [
    {
      file: "roxjaya/data/events.json",
      path: "next",
      value: { date: "2027-06-25" },
    },
    { file: "data/products.json", path: "x", value: 1 },
    { file: "../etc/passwd", path: "x", value: 1 },
  ],
};

describe("inbox candidates", () => {
  it("rejects malformed candidates and strips bad patches", () => {
    expect(validateCandidate({ kind: "event", title: "x" })).toBeNull();
    expect(
      validateCandidate({ key: "a:b", kind: "bogus", title: "x" }),
    ).toBeNull();
    expect(
      validateCandidate({ key: "a:b", kind: "event", title: "" }),
    ).toBeNull();
    const c = validateCandidate({
      ...eventCandidate,
      source: "javascript:alert(1)",
    });
    expect(c.source).toBe("");
    expect(c.apply).toHaveLength(2); // path traversal dropped, other file kept for the writable check
  });

  it("adds once, updates on change, and re-asks an ignored item only if it changed", () => {
    let { inbox, added } = upsertCandidates(
      emptyInbox(),
      [eventCandidate],
      now,
    );
    expect(added).toBe(1);
    expect(pendingItems(inbox)).toHaveLength(1);
    const id = pendingItems(inbox)[0].id;

    ({ inbox, added } = upsertCandidates(inbox, [eventCandidate], now));
    expect(added).toBe(0);
    expect(inbox.items).toHaveLength(1);

    inbox = decide(inbox, id, "ignore", now).inbox;
    expect(pendingItems(inbox)).toHaveLength(0);
    inbox = upsertCandidates(inbox, [eventCandidate], now).inbox;
    expect(pendingItems(inbox)).toHaveLength(0);

    inbox = upsertCandidates(
      inbox,
      [{ ...eventCandidate, title: "HYROX Jakarta — 26–28 June 2027" }],
      now,
    ).inbox;
    expect(pendingItems(inbox)).toHaveLength(1);
  });

  it("decide validates action and id", () => {
    const { inbox } = upsertCandidates(emptyInbox(), [eventCandidate], now);
    expect(decide(inbox, "nope", "approve").error).toBe("Not found");
    expect(decide(inbox, inbox.items[0].id, "delete").error).toBe(
      "Unknown action",
    );
  });

  it("applies patches only to writable files", () => {
    const files = {
      "roxjaya/data/events.json": { note: "n", next: null },
      "data/products.json": { list: [] },
    };
    const item = validateCandidate(eventCandidate);
    const res = applyPatches(item, {
      allowedFiles: ["roxjaya/data/events.json"],
      readJson: (f) => files[f],
      writeJson: (f, v) => (files[f] = v),
    });
    expect(res.applied).toEqual(["roxjaya/data/events.json"]);
    expect(res.skipped).toEqual([
      { file: "data/products.json", reason: "not_writable" },
    ]);
    expect(files["roxjaya/data/events.json"].next).toEqual({
      date: "2027-06-25",
    });
    expect(files["data/products.json"]).toEqual({ list: [] });
  });

  it("builds a digest with one deep link per action", () => {
    const { inbox } = upsertCandidates(emptyInbox(), [eventCandidate], now);
    const d = buildDigest({
      brand: "Roxjaya",
      siteUrl: "https://roxjaya.com/",
      coachPath: "/roxjaya/coach/",
      pending: pendingItems(inbox),
      counts: { wall_photo: 3, leads: 2 },
    });
    expect(d.subject).toBe("Roxjaya: 3 things need you this week");
    expect(d.actions.map((a) => a.href)).toEqual([
      "https://roxjaya.com/roxjaya/coach/#people?q=wall_photo",
      "https://roxjaya.com/roxjaya/coach/#people",
      "https://roxjaya.com/roxjaya/coach/#inbox",
    ]);
    expect(d.text).toContain("3 wall photos waiting");
    const quiet = buildDigest({
      brand: "Roxjaya",
      siteUrl: "https://x.y",
      coachPath: "/c/",
    });
    expect(quiet.subject).toBe("Roxjaya: nothing needs you this week");
  });
});

describe("hyrox-sync parsing", () => {
  it("parses hyrox.com date strings", () => {
    expect(parseHyroxDate("11. Feb. 2027")).toBe("2027-02-11");
    expect(parseHyroxDate("7. Jan. 2027")).toBe("2027-01-07");
    expect(parseHyroxDate("26 November 2026")).toBe("2026-11-26");
    expect(parseHyroxDate("Feb 2027")).toBeNull();
    expect(parseHyroxDate("11. Foo. 2027")).toBeNull();
  });

  it("labels ranges", () => {
    expect(rangeLabel("2027-02-11", "2027-02-14")).toBe("11–14 February 2027");
    expect(rangeLabel("2026-10-31", "2026-11-01")).toBe("31 Oct – 1 Nov 2026");
    expect(rangeLabel("2026-12-05")).toBe("5 December 2026");
  });

  it("reads dates + address from an event page and returns nulls when missing", () => {
    const html = `<div class="w-post-elm post_custom_field type_text event_date_1"><span class="w-post-elm-before">From </span><span class="w-post-elm-value">11. Feb. 2027</span></div>
      <div class="event_date_3"><span class="w-post-elm-value">14. Feb. 2027</span></div>
      <div class="event_map_address"><span class="w-post-elm-value">BITEC &amp; Co, Bangkok</span></div>`;
    expect(parseEventPage(html)).toEqual({
      start: "2027-02-11",
      end: "2027-02-14",
      address: "BITEC & Co, Bangkok",
    });
    expect(parseEventPage("<html>changed</html>")).toEqual({
      start: null,
      end: null,
      address: "",
    });
  });

  it("only proposes changes, never matches, and alerts on unreadable pages", () => {
    const cities = {
      home: "jakarta",
      cities: [
        {
          slug: "jakarta",
          race: { name: "HYROX Jakarta", status: "tbc", dates: null },
        },
        {
          slug: "bangkok",
          race: {
            name: "HYROX Bangkok",
            status: "confirmed",
            start: "2027-02-11",
            dates: "11–14 February 2027",
          },
        },
      ],
    };
    const events = [
      {
        slug: "hyrox-bangkok",
        title: "HYROX Bangkok",
        link: "https://hyrox.com/event/hyrox-bangkok/",
        start: "2027-02-11",
        end: "2027-02-14",
        address: "BITEC",
      },
      {
        slug: "hyrox-jakarta",
        title: "HYROX Jakarta",
        link: "https://hyrox.com/event/hyrox-jakarta/",
        start: "2027-06-25",
        end: "2027-06-27",
        address: "NICE, PIK2",
      },
      {
        slug: "hyrox-taipei",
        title: "HYROX Taipei",
        link: "https://hyrox.com/event/hyrox-taipei/",
        start: null,
        end: null,
        address: "",
      },
      {
        slug: "hyrox-mumbai",
        title: "HYROX Mumbai",
        link: "https://hyrox.com/event/hyrox-mumbai/",
        start: "2026-01-01",
        end: null,
        address: "",
      },
    ];
    const out = buildCandidates({
      events,
      cities,
      eventsJson: { next: null },
      today: "2026-09-03",
    });
    expect(out.map((c) => c.key)).toEqual([
      "event:hyrox-jakarta:2027-06-25",
      "alert:nodates:hyrox-taipei",
    ]);
    const jkt = out[0];
    expect(
      jkt.apply.find((p) => p.file === "roxjaya/data/events.json").value,
    ).toEqual({
      name: "HYROX Jakarta",
      date: "2027-06-25",
      url: "https://hyrox.com/event/hyrox-jakarta/",
    });
    expect(jkt.apply.find((p) => p.path === "cities.0.race.dates").value).toBe(
      "25–27 June 2027",
    );
  });

  it("reminds about results only in the window after a tracked race", () => {
    const cities = {
      home: "jakarta",
      cities: [
        {
          slug: "seoul",
          race: {
            name: "HYROX Seoul",
            status: "confirmed",
            start: "2026-11-13",
            dates: "13–15 November 2026",
          },
        },
      ],
    };
    expect(
      buildCandidates({
        events: [],
        cities,
        eventsJson: {},
        today: "2026-11-14",
      }),
    ).toHaveLength(0);
    const r = buildCandidates({
      events: [],
      cities,
      eventsJson: {},
      today: "2026-11-18",
    });
    expect(r).toHaveLength(1);
    expect(r[0].key).toBe("results:seoul:2026-11-13");
    expect(
      buildCandidates({
        events: [],
        cities,
        eventsJson: {},
        today: "2026-11-30",
      }),
    ).toHaveLength(0);
  });
});

const rss = (items) =>
  `<?xml version="1.0"?><rss><channel>${items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${i.link}</link><pubDate>${i.date}</pubDate>${
          i.source ? `<source url="x">${i.source}</source>` : ""
        }<description>${i.desc || ""}</description></item>`,
    )
    .join("")}</channel></rss>`;

describe("news feed", () => {
  const feed = rss([
    {
      title:
        "Hong Kong Hyrox tickets go on sale Thursday - South China Morning Post",
      link: "https://news.google.com/rss/articles/abc",
      date: "Wed, 02 Sep 2026 07:00:00 GMT",
    },
    {
      title: "HYROX athlete dies after Singapore race - Straits Times",
      link: "https://news.google.com/rss/articles/sad",
      date: "Tue, 01 Sep 2026 07:00:00 GMT",
    },
    {
      title: "Best sled push tips from a HYROX coach - Men&amp;#39;s Health",
      link: "https://news.google.com/rss/articles/generic",
      date: "Tue, 01 Sep 2026 07:00:00 GMT",
    },
    {
      title: "Old Hyrox Bangkok story - Bangkok Post",
      link: "https://news.google.com/rss/articles/old",
      date: "Tue, 01 Jun 2026 07:00:00 GMT",
    },
    {
      title: "Not a real link - Foo",
      link: "javascript:alert(1)",
      date: "Wed, 02 Sep 2026 07:00:00 GMT",
    },
    {
      title: "Hong Kong Hyrox tickets go on sale Thursday - Some Blog",
      link: "https://news.google.com/rss/articles/dupe",
      date: "Wed, 02 Sep 2026 08:00:00 GMT",
    },
  ]);

  it("parses RSS, splits Google's publisher suffix and drops bad links", () => {
    const items = parseFeed(feed, "Google News");
    expect(items).toHaveLength(5);
    expect(items[0]).toMatchObject({
      title: "Hong Kong Hyrox tickets go on sale Thursday",
      sourceName: "South China Morning Post",
      date: "2026-09-02",
      link: "https://news.google.com/rss/articles/abc",
    });
    expect(parseFeed("<not xml", "x")).toEqual([]);
  });

  it("keeps only recent Asia Hyrox stories, skips sensitive ones, dedupes headlines and caps the batch", () => {
    const items = parseFeed(feed, "Google News");
    const picked = selectNews(items, { today: "2026-09-03" });
    expect(picked.map((i) => i.title)).toEqual([
      "Hong Kong Hyrox tickets go on sale Thursday",
    ]);
    const already = selectNews(items, {
      today: "2026-09-03",
      published: [{ title: "Hong Kong Hyrox tickets go on sale Thursday" }],
    });
    expect(already).toEqual([]);
    const many = Array.from({ length: 10 }, (_, n) => ({
      title: `Hyrox Jakarta story ${n}`,
      link: `https://example.com/${n}`,
      date: "2026-09-02",
      sourceName: "x",
      excerpt: "",
    }));
    expect(selectNews(many, { today: "2026-09-03" })).toHaveLength(MAX_PER_RUN);
  });

  it("news candidates validate, publish only after a summary is written, and prepend into news.json", () => {
    const [cand] = buildNewsCandidates(
      selectNews(parseFeed(feed, "Google News"), { today: "2026-09-03" }),
    );
    const valid = validateCandidate(cand);
    expect(valid).toMatchObject({
      kind: "news",
      key: "news:2026-09-02-hong-kong-hyrox-tickets-go-on-sale-thursday",
      editable: ["summary", "take"],
      summary: "",
    });
    expect(valid.apply[0].op).toBe("prepend");

    const { inbox } = upsertCandidates(emptyInbox(), [cand], now);
    const [item] = pendingItems(inbox);
    const approved = decide(inbox, item.id, "approve", now);
    applyEdits(approved.item, {
      summary: "  HK tickets on sale Thursday.  ",
      take: "Be at your laptop.",
      title: "hacked",
      bogus: "x",
    });
    expect(approved.item.summary).toBe("HK tickets on sale Thursday.");
    expect(approved.item.title).not.toBe("hacked");
    expect(approved.item.data.bogus).toBeUndefined();
    expect(approved.item.apply[0].value).toMatchObject({
      summary: "HK tickets on sale Thursday.",
      take: "Be at your laptop.",
    });

    const files = {
      "roxjaya/data/news.json": {
        items: [{ id: "older", title: "Older" }],
      },
    };
    const res = applyPatches(approved.item, {
      allowedFiles: ["roxjaya/data/news.json"],
      readJson: (f) => files[f],
      writeJson: (f, j) => (files[f] = j),
    });
    expect(res.applied).toEqual(["roxjaya/data/news.json"]);
    const list = files["roxjaya/data/news.json"].items;
    expect(list.map((i) => i.id)).toEqual([
      "2026-09-02-hong-kong-hyrox-tickets-go-on-sale-thursday",
      "older",
    ]);
    expect(list[0].take).toBe("Be at your laptop.");

    // Re-approving the same id replaces rather than duplicates.
    applyPatches(approved.item, {
      allowedFiles: ["roxjaya/data/news.json"],
      readJson: (f) => files[f],
      writeJson: (f, j) => (files[f] = j),
    });
    expect(files["roxjaya/data/news.json"].items).toHaveLength(2);
  });
});
