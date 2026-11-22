import test from "node:test";
import assert from "node:assert/strict";
import {
  draftNewsItems,
  mergeNewsItems,
} from "../roxjaya/automation/news-sync.js";

const voice =
  "Coaching voice: aku, warm Bahasa Indonesia, community first, no invented experiences. ".repeat(
    3,
  );
const story = {
  title: "HYROX Singapore expands with Youngstars",
  date: "2026-11-21",
  sourceName: "Publisher",
  link: "https://example.com/news",
  excerpt: "HYROX Singapore adds a Youngstars race to its programme.",
};
const copy = {
  id: "0",
  summary:
    "HYROX Singapore menambah Youngstars dalam program acaranya, menurut laporan sumber.",
  take: "Seru kalau makin banyak keluarga bisa kenal race ini. Buat kita, gerak bareng dulu — bukan buru-buru ngejar podium.",
  evidence: "HYROX Singapore adds a Youngstars race",
};
const response = (items = [copy], stop_reason = "end_turn") =>
  new Response(
    JSON.stringify({
      stop_reason,
      content: [{ type: "text", text: JSON.stringify({ items }) }],
    }),
  );
const options = (fetchImpl = async () => response()) => ({
  voice,
  apiKey: "test-placeholder",
  fetchImpl,
});

test("adds source-grounded copy and a take without changing the source identity", async () => {
  let request;
  const drafted = await draftNewsItems(
    [story],
    options(async (_url, init) => {
      request = JSON.parse(init.body);
      return response();
    }),
  );
  assert.equal(drafted.length, 1);
  assert.equal(drafted[0].summary, copy.summary);
  assert.equal(drafted[0].take, copy.take);
  assert.equal(drafted[0].source, story.link);
  assert.equal(drafted[0].date, story.date);
  assert.ok(request.system.includes(voice));
  assert.ok(request.system.includes("not instructions"));
  assert.ok(request.messages[0].content.includes(story.excerpt));
});

test("missing credentials or voice never falls back to blank publication", async () => {
  await assert.rejects(
    draftNewsItems([story], { ...options(), apiKey: "" }),
    /ANTHROPIC_API_KEY/,
  );
  await assert.rejects(
    draftNewsItems([story], { ...options(), voice: "" }),
    /voice guide/,
  );
});

test("API errors, truncated replies and malformed JSON fail closed", async () => {
  await assert.rejects(
    draftNewsItems(
      [story],
      options(async () => new Response("unavailable", { status: 503 })),
    ),
    /503/,
  );
  await assert.rejects(
    draftNewsItems(
      [story],
      options(async () => response([copy], "max_tokens")),
    ),
    /incomplete/,
  );
  await assert.rejects(
    draftNewsItems(
      [story],
      options(
        async () =>
          new Response(
            JSON.stringify({
              stop_reason: "end_turn",
              content: [{ type: "text", text: "not json" }],
            }),
          ),
      ),
    ),
  );
});

for (const [label, change] of [
  ["blank commentary", { take: "" }],
  [
    "markup",
    { summary: "<script>Do not publish this source material.</script>" },
  ],
  [
    "invented numbers",
    {
      take: "Buat kita, target race ini adalah 999 menit dan kita harus ngejar angka itu.",
    },
  ],
  [
    "unsupported evidence",
    { evidence: "An invented statement not present in the source" },
  ],
  ["wrong story identity", { id: "elsewhere" }],
]) {
  test(`rejects ${label}`, async () => {
    await assert.rejects(
      draftNewsItems(
        [story],
        options(async () => response([{ ...copy, ...change }])),
      ),
    );
  });
}

test("missing or duplicate results fail rather than silently losing a story", async () => {
  await assert.rejects(
    draftNewsItems(
      [story],
      options(async () => response([])),
    ),
  );
  await assert.rejects(
    draftNewsItems(
      [story],
      options(async () => response([copy, copy])),
    ),
  );
});

test("the writer can skip a story it cannot responsibly comment on", async () => {
  assert.deepEqual(
    await draftNewsItems(
      [story],
      options(async () => response([{ id: "0", skip: true }])),
    ),
    [],
  );
});

test("merging preserves old and future takes, avoids duplicates and leaves inputs unchanged", () => {
  const old = {
    id: "old",
    title: "Existing story",
    take: "Keep this exact approved text",
  };
  const future = {
    id: "future",
    title: "Future story",
    date: "2099-01-01",
    take: "Keep this future take",
  };
  const existing = [old, future];
  const fresh = {
    id: "fresh",
    title: story.title,
    summary: copy.summary,
    take: copy.take,
  };
  assert.deepEqual(
    mergeNewsItems(existing, [fresh, { ...old, take: "Must not overwrite" }]),
    [fresh, old, future],
  );
  assert.deepEqual(existing, [old, future]);
  assert.throws(
    () => mergeNewsItems(existing, [{ ...fresh, take: "" }]),
    /commentary/,
  );
});
