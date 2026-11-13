import assert from "node:assert/strict";
import {
  MAX_REVIEW_IMPORT_ROWS,
  parseReviewImport,
  REVIEW_IMPORT_HOSTS,
  parseReviewCSV,
} from "../src/lib/reputation/import-model";
import { stableReviewImportId } from "../src/lib/reputation/import-id";
const client = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const listing = "33333333-3333-4333-8333-333333333333";
const example = () => ({
  source: "google",
  externalId: "review-123",
  author: "Synthetic person",
  text: "A synthetic review for automated checks.",
  rating: 4,
  reviewedAt: "2026-10-01T12:00:00.000Z",
  url: "https://www.google.com/maps/reviews/example",
});
const input = (row: unknown = example()) => ({
  listingId: listing,
  provenance: "manual",
  rows: [row],
});
const invalid = (value: unknown) =>
  assert.equal(parseReviewImport(value).ok, false);
let count = 0;
async function check(name: string, run: () => unknown | Promise<unknown>) {
  await run();
  count++;
  console.log("PASS", name);
}
async function main() {
  await check("normalizes explicitly reviewed fields without mutation", () => {
    const row = {
      ...example(),
      author: "  Synthetic person  ",
      text: "  Body  ",
      externalId: " review-123 ",
    };
    const result = parseReviewImport(input(row));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.rows[0], {
      ...example(),
      author: "Synthetic person",
      text: "Body",
      externalId: "review-123",
    });
    assert.equal(row.text, "  Body  ");
    assert.equal(parseReviewImport({ ...input(), rows: result.rows }).ok, true);
  });
  await check(
    "rejects arbitrary tenant, publication, reply and hidden root fields",
    () => {
      for (const key of [
        "clientId",
        "tenant",
        "replyComment",
        "published",
        "metadata",
        "qmapsReviewId",
        "__proto__",
      ]) {
        invalid({ ...input(), [key]: "injected" });
        invalid(input({ ...example(), [key]: "injected" }));
      }
      invalid(null);
      invalid([]);
      invalid("mail content");
      invalid(input(Object.create({ ...example() })));
    },
  );
  await check(
    "requires listing UUID and explicit recognized import provenance",
    () => {
      for (const value of ["", "1", other + "x", null])
        invalid({ ...input(), listingId: value });
      for (const value of [undefined, "mailbox", "api", null, {}, ["email"]])
        invalid({ ...input(), provenance: value });
      for (const provenance of ["manual", "email", "csv"])
        assert.equal(parseReviewImport({ ...input(), provenance }).ok, true);
    },
  );
  await check("bounds review rows and refuses whole email envelopes", () => {
    invalid({ ...input(), rows: [] });
    invalid({
      ...input(),
      rows: Array(MAX_REVIEW_IMPORT_ROWS + 1).fill(example()),
    });
    invalid({ ...input(), rows: "email body" });
    invalid(
      input({ ...example(), headers: { from: "not-proof@example.com" } }),
    );
    const rows = Array.from({ length: MAX_REVIEW_IMPORT_ROWS }, (_, i) => ({
      ...example(),
      externalId: String(i),
    }));
    assert.equal(parseReviewImport({ ...input(), rows }).ok, true);
  });
  await check(
    "supports only explicit review sources and no social star invention",
    () => {
      for (const source of [
        "takatak",
        "instagram",
        "google_play",
        "app_store",
        "other",
        "GOOGLE",
        "toString",
        "__proto__",
      ])
        invalid(input({ ...example(), source }));
      for (const source of Object.keys(REVIEW_IMPORT_HOSTS)) {
        const row = {
          ...example(),
          source,
          rating: source === "facebook" || source === "booking" ? null : 4,
          url: undefined,
        };
        assert.equal(parseReviewImport(input(row)).ok, true, source);
      }
      invalid(input({ ...example(), source: "facebook", url: undefined }));
    },
  );
  await check(
    "accepts omitted ratings but rejects fractions, strings, NaN and invalid stars",
    () => {
      for (const rating of [null, undefined, 1, 5])
        assert.equal(
          parseReviewImport(input({ ...example(), rating })).ok,
          true,
        );
      for (const rating of [0, 6, -1, 2.5, "5", NaN, Infinity, {}])
        invalid(input({ ...example(), rating }));
    },
  );
  await check(
    "bounds text identity and author without silent truncation",
    () => {
      for (const externalId of [
        "",
        "  ",
        "x".repeat(257),
        10,
        "unsafe\u0000id",
      ])
        invalid(input({ ...example(), externalId }));
      for (const text of ["", "\n\t ", "x".repeat(5001), 10, "bad\u0001text"])
        invalid(input({ ...example(), text }));
      for (const author of [10, "x".repeat(121), "bad\u0000name"])
        invalid(input({ ...example(), author }));
      assert.equal(
        parseReviewImport(
          input({
            ...example(),
            text: "x".repeat(5000),
            author: "x".repeat(120),
            externalId: "x".repeat(256),
          }),
        ).ok,
        true,
      );
    },
  );
  await check(
    "rejects impossible dates, absent timezone and excess-future time",
    () => {
      for (const reviewedAt of [
        "2026-02-29T12:00:00Z",
        "2026-04-31T12:00:00Z",
        "2026-13-01T12:00:00Z",
        "2026-01-00T12:00:00Z",
        "2026-10-01",
        "2026-10-01T12:00:00",
        "2026-10-01T24:00:00Z",
        "2026-10-01T12:00:60Z",
        "2026-10-01T12:00:00+15:00",
        new Date(Date.now() + 25 * 3600000).toISOString(),
      ])
        invalid(input({ ...example(), reviewedAt }));
      const result = parseReviewImport(
        input({ ...example(), reviewedAt: "2024-02-29T12:00:00-05:00" }),
      );
      assert.equal(result.ok, true);
      if (result.ok)
        assert.equal(result.rows[0].reviewedAt, "2024-02-29T17:00:00.000Z");
    },
  );
  await check(
    "evidence links require exact source HTTPS hosts, no credentials or explicit ports",
    () => {
      for (const url of [
        "http://www.google.com/review",
        "https://google.com.evil.test/review",
        "https://evilgoogle.com/review",
        "https://facebook.com/review",
        "https://google.com:443/review",
        "https://google.com:8080/review",
        "https://user@google.com/review",
        "https://google.com\\@evil.test/review",
        "https://127.0.0.1/review",
        "https://google.com./review",
        " https://google.com/review",
        "https://google.com/\nreview",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "https://google.com\t.evil.test/",
      ])
        invalid(input({ ...example(), url }));
      for (const url of [
        undefined,
        "",
        "https://maps.google.com/review",
        "https://g.page/example",
      ])
        assert.equal(parseReviewImport(input({ ...example(), url })).ok, true);
    },
  );
  await check(
    "duplicate source identities fail atomically while distinct sources stay distinct",
    () => {
      invalid({
        ...input(),
        rows: [
          example(),
          { ...example(), externalId: " review-123 ", text: "Changed body" },
        ],
      });
      assert.equal(
        parseReviewImport({
          ...input(),
          rows: [example(), { ...example(), source: "yelp", url: undefined }],
        }).ok,
        true,
      );
    },
  );
  await check(
    "stable UUID idempotence is scoped to tenant, listing, source and external identity",
    () => {
      const id = stableReviewImportId(client, listing, "google", "review-123");
      assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      assert.equal(
        id,
        stableReviewImportId(
          client.toUpperCase(),
          listing.toUpperCase(),
          "google",
          " review-123 ",
        ),
      );
      for (const args of [
        [other, listing, "google", "review-123"],
        [client, other, "google", "review-123"],
        [client, listing, "yelp", "review-123"],
        [client, listing, "google", "different"],
      ])
        assert.notEqual(
          id,
          stableReviewImportId(...(args as [string, string, string, string])),
        );
      assert.throws(
        () => stableReviewImportId("bad", listing, "google", "id"),
        /invalid_import_identity/,
      );
      assert.throws(
        () => stableReviewImportId(client, listing, "instagram", "id"),
        /invalid_import_identity/,
      );
    },
  );
  await check(
    "CSV handles quoted commas, escaped quotes and multiline text",
    () => {
      const csv =
        'source,externalId,text,reviewedAt,rating\r\ngoogle,example,"A comma, a ""quote""\nand a newline",2026-10-01T12:00:00Z,4\r\n';
      const result = parseReviewCSV(csv);
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.deepEqual(result.rows, [
        {
          source: "google",
          externalId: "example",
          text: 'A comma, a "quote"\nand a newline',
          reviewedAt: "2026-10-01T12:00:00Z",
          rating: 4,
        },
      ]);
      assert.equal(
        parseReviewImport({ ...input(), rows: result.rows, provenance: "csv" })
          .ok,
        true,
      );
    },
  );
  await check(
    "CSV rejects malformed quoting, unauthorized headers, field-count drift and limits",
    () => {
      for (const csv of [
        'source,externalId,text,reviewedAt\ngoogle,id,"unclosed,date',
        'source,externalId,text,reviewedAt\ngoogle,id,te"xt,date',
        'source,externalId,text,reviewedAt\ngoogle,id,"text"extra,date',
        "source,externalId,text,reviewedAt,clientId\ngoogle,id,text,date,tenant",
        "source,source,text,reviewedAt\ngoogle,google,text,date",
        "source,externalId,text,reviewedAt\ngoogle,id,text",
        "source,externalId,text,reviewedAt",
        "x".repeat(128 * 1024 + 1),
      ])
        assert.equal(parseReviewCSV(csv).ok, false);
      assert.equal(
        parseReviewCSV(
          "source,externalId,text,reviewedAt\n" +
            Array(51).fill("google,id,text,2026-10-01T12:00:00Z").join("\n"),
        ).ok,
        false,
      );
    },
  );
  await check(
    "CSV blank ratings stay unrated and formula-looking text is never evaluated",
    () => {
      const result = parseReviewCSV(
        "\uFEFFsource,externalId,text,reviewedAt,rating\nfacebook,id,=SUM(A1:A2),2026-10-01T12:00:00Z,",
      );
      assert.equal(result.ok, true);
      if (!result.ok) return;
      const parsed = parseReviewImport({
        ...input(),
        rows: result.rows,
        provenance: "csv",
      });
      assert.equal(parsed.ok, true);
      if (parsed.ok) {
        assert.equal(parsed.rows[0].rating, null);
        assert.equal(parsed.rows[0].text, "=SUM(A1:A2)");
      }
    },
  );
  await check(
    "preview rejects normalized payloads that exceed the server submission bound",
    () => {
      const row = example();
      const result = parseReviewImport({
        ...input(),
        rows: Array.from({ length: 50 }, (_, index) => ({
          ...row,
          externalId: `large-${index}`,
          text: "é".repeat(5000),
        })),
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /128 KiB/);
    },
  );
  await check("Booking scores never become invented five-star ratings", () => {
    invalid(
      input({
        ...example(),
        source: "booking",
        rating: 4,
        url: "https://www.booking.com/hotel/test",
      }),
    );
    assert.equal(
      parseReviewImport(
        input({
          ...example(),
          source: "booking",
          rating: null,
          url: "https://www.booking.com/hotel/test",
        }),
      ).ok,
      true,
    );
  });
  console.log(`Review import: ${count} checks passed.`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
