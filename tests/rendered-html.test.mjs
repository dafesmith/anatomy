import assert from "node:assert/strict";
import test from "node:test";

// Imported as TypeScript — Node strips the annotations on the fly.
import { organById, organs } from "../app/lib/anatomy-data.ts";

/** Escapes copy pulled from the anatomy data before matching it as a pattern. */
const pattern = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let home;

/**
 * Boots the built worker and server-renders `/` once, then shares the result —
 * every assertion below reads the same document.
 */
function renderHome() {
  home ??= (async () => {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
    const { default: worker } = await import(workerUrl.href);

    const response = await worker.fetch(
      new Request("http://localhost/", {
        headers: { accept: "text/html" },
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );

    return { response, html: await response.text() };
  })();

  return home;
}

test("serves the home page as HTML", async () => {
  const { response } = await renderHome();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
});

test("server-renders the Look Inside document head", async () => {
  const { html } = await renderHome();
  assert.match(html, /<html lang="en"/);
  assert.match(
    html,
    // A curly apostrophe, matching the wordmark — JSX needs `&rsquo;` there, and a
    // straight quote here would render the same tagline two different ways.
    /<title>Look Inside — See what’s really in there<\/title>/,
  );
  assert.match(
    html,
    /<meta name="description" content="Explore the human body in 3D, together/,
  );
  assert.match(
    html,
    /<meta property="og:title" content="Look Inside — See what’s really in there"\/>/,
  );
});

// These match the element and its class but stay open about the rest of the
// tag. A feature that hangs a new attribute or state class off the shell is not
// a regression, and a test that fails on one only trains people to ignore it.
test("server-renders the app shell rather than an empty root", async () => {
  const { html } = await renderHome();
  assert.match(html, /<main class="app-shell"[^>]*>/);
  assert.match(html, /<header class="topbar"[^>]*>/);
  assert.match(html, /<strong>Look Inside/);
  assert.match(html, /<em>See what’s really in there<\/em>/);
  assert.match(html, /<div class="workspace"[^>]*>/);
});

test("server-renders every organ into the library", async () => {
  const { html } = await renderHome();
  assert.match(html, /class="organ-library/);
  assert.match(html, /<span>Organ library<\/span>/);

  for (const organ of organs) {
    assert.match(
      html,
      new RegExp(
        `<b>${pattern(organ.name)}</b><small>${pattern(organ.system)}</small>`,
      ),
      `${organ.name} is missing from the organ library`,
    );
  }

  assert.equal(
    html.match(/class="organ-item/g)?.length,
    organs.length,
    "the library should list each organ exactly once",
  );
});

test("opens on the heart with its detail panel filled in", async () => {
  const { html } = await renderHome();
  const heart = organById.heart;

  assert.match(html, /class="organ-item[^"]*\bactive\b/);
  assert.match(html, /<aside class="info-panel"[^>]*>/);
  assert.match(
    html,
    new RegExp(
      `<h1>${pattern(heart.name)}</h1><em>${pattern(heart.poetic)}</em>`,
    ),
  );
  assert.match(html, new RegExp(pattern(heart.description)));
  assert.match(html, new RegExp(pattern(heart.funFact)));
});

test("carries no leftover starter-template scaffolding", async () => {
  const { html } = await renderHome();
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
  assert.doesNotMatch(
    html,
    /codex-preview|sites-preview|sites-skeleton|react-loading-skeleton/i,
  );
});
