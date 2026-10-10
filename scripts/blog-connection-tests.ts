/**
 * Blog page host checks.
 * Never prints workspace or account identifiers.
 */
import { parseBlogHost, takatakBlogPath } from "../src/lib/social/connections/blog-page";

type Status = "PASS" | "FAIL";
type Result = { name: string; status: Status; evidence: string };

const results: Result[] = [];

function check(name: string, run: () => string) {
  try {
    results.push({ name, status: "PASS", evidence: run() });
  } catch (error) {
    results.push({
      name,
      status: "FAIL",
      evidence: error instanceof Error ? error.message : "unknown",
    });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

check("accepts a public website host for a TAKATAK blog page", () => {
  assert(parseBlogHost("Example.COM") === "example.com", "host");
  assert(takatakBlogPath("example.com") === "/blog/example.com", "path");
  return "host and path";
});

check("rejects private or unsafe blog hosts", () => {
  assert(parseBlogHost("localhost") === null, "localhost");
  assert(parseBlogHost("example.com/blog") === null, "path");
  assert(parseBlogHost("../example.com") === null, "traversal");
  assert(parseBlogHost("user@example.com") === null, "userinfo");
  return "rejected unsafe hosts";
});

const failed = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(`${result.status} ${result.name} — ${result.evidence}`);
}

if (failed.length > 0) process.exit(1);
