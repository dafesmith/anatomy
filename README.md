# Look Inside

An interactive 3D anatomy atlas — nine organs as real glTF models you can orbit,
section, and annotate, with hand-painted illustrations for every organ.

Built on [vinext](https://github.com/cloudflare/vinext) (Next.js App Router on
Cloudflare Workers) with a hand-rolled three.js viewer.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
```

```bash
npm run dev
```

## The four views

The top nav has four destinations plus a Lessons modal.

### Explore

The default view: organ library on the left, 3D viewer in the middle, organ
detail on the right, and a row of learning cards below.

The viewer (`app/lib/three/`) loads a `.glb` per organ, places labelled hotspots
in 3D that re-project as you orbit, and offers isolate, cross-section, layers,
and compare tools. Models are parsed once and kept in an LRU cache of 3 by
`AnatomyAssetManager`.

### Systems

An index of all 8 body systems, grouped from the `system` field already carried
by every organ in `app/lib/anatomy-data.ts`. Click a system to filter the organ
library to it, or an organ to load it in 3D.

**Use case:** the organ library is an alphabetical-ish list that says nothing
about how organs relate. Systems answers "what else is in the digestive system?"
— which is how anatomy is actually taught and examined.

### Library

A cross-cutting reference index of every named detail in the atlas — **90
entries**: 72 conditions, 9 tissue types, 9 comparisons. Filterable by kind and
searchable.

**Use case:** those 90 details were previously reachable only five at a time by
opening each organ in turn, so *"which organ gets glomerulonephritis?"* had no
answer short of clicking through all nine. Search matches the organ name as well
as the term, so `kidney` also surfaces *Nephrotic syndrome* and *Renal cortex* —
entries that never contain the word.

### Notes

Study notes attached to an organ, so they come back when that organ does. Add,
edit, delete; click a note's organ chip to load it in the viewer.

**Use case:** revision is personal. Reading about the heart, you want to write
"mitral = bicuspid" against *that organ* and find it next week.

### Saved organs

A Save toggle in the organ actions, and the library's bookmark button filters to
saved organs. Saved and selected are marked separately in the list.

## Persistence

Notes and saved organs live in `localStorage` behind async interfaces
(`NotesStore`, `FavoritesStore`) that a database-backed implementation can
replace without touching a caller.

They are **not** in a database yet, deliberately: `.openai/hosting.json` has
`"d1": null` and `db/schema.ts` is empty, so `getDb()` would throw. The practical
consequence is that notes and saved organs are **per-browser** — they do not
follow a user to another device, and clearing site data removes them.

To move to D1: provision the `d1` binding, declare a `notes` table in
`db/schema.ts`, scope rows by the email from `getChatGPTUser()` (see
[Workspace Auth Headers](#workspace-auth-headers)), and repoint `notesStore` /
`favoritesStore` at an API-backed implementation.

## Architecture notes

**The Explore surfaces stay mounted.** Switching to another view sets `hidden` on
the workspace rather than unmounting it. `AnatomyAssetManager` is per-viewer and
`dispose()` drops its parsed-model cache, so unmounting would pay a full cold
load on every return to Explore. Keeping it mounted is free: the viewer's
`IntersectionObserver` idles the render loop when off-screen, and `resize()`
clamps to 1×1 so a zero-size container can't produce a `NaN` camera aspect.

**Derived data, not duplicated data.** `systems` and `referenceIndex` in
`app/lib/anatomy-data.ts` are both reductions over `organs`. Adding an organ puts
it in its system and its details in the reference index automatically; an organ
carrying a brand-new `system` string becomes its own group rather than silently
vanishing.

## Testing

`npm test` currently **fails on a clean checkout**, and did so before this work:
`tests/rendered-html.test.mjs` is leftover starter-template scaffolding that
asserts a `SkeletonPreview` component and an `app/_sites-preview/` directory,
neither of which exists any more. It needs rewriting against the real app.

Until it is, use:

```bash
npx tsc --noEmit && npm run lint && npm run build
```

### Manual test checklist

The views were verified in-browser against these cases.

| Area | Case | Expected |
| --- | --- | --- |
| Viewer | Load `/` | WebGL2 context, organ paints, hotspots placed |
| Viewer | Drag the model | Orbits; hotspots re-project and occlude correctly |
| Viewer | Click a hotspot | Callout opens with that structure's label and detail |
| Viewer | Switch organ | New `.glb` loads; returning to a cached organ skips the loading pass |
| Systems | Open Systems | 8 tiles, 9 organs, Digestive shows Liver + Intestine |
| Systems | Click "Filter library" | Returns to Explore, library narrowed to that system |
| Systems | Click an organ | Returns to Explore with it loaded and the filter cleared |
| Library | Open Library | 90 entries; pills read 90 / 72 / 9 / 9 |
| Library | Filter to Tissues | Exactly 9 rows, all kinded `Tissue` |
| Library | Search `kidney` | 10 rows including Glomerulonephritis and Renal cortex |
| Library | Click a row | Returns to Explore with that entry's organ loaded |
| Notes | Save a note | Appears in the list; composer clears |
| Notes | Reload the page | Note survives |
| Notes | Edit / delete | Change persists to storage |
| Notes | Corrupt `localStorage` | Malformed entries dropped, view still renders |
| Saved | Toggle Save | Label flips Save/Saved; marker appears in the library row |
| Saved | Select another organ | Toggle reflects *that* organ, not the last one |
| Saved | Bookmark button | Library shows only saved organs; empty hint when none |
| Nav | Any view | `aria-current="page"` on the active item |
| Nav | Viewport 375px | Nav visible on its own row, 44px touch targets, all four views reachable |
| Nav | Below 1040px | Labels hidden visually but `aria-label` keeps every button named |
| Layout | 1440 / 1100 / 1000 / 375 | Grids step 4 / 3 / 2 / 1 columns with no horizontal overflow |

## Repository layout

- `app/components/` — `AnatomyApp` (shell and view state), `OrganViewer`,
  `SystemsIndex`, `LibraryIndex`, `NotesView`, `OrganArt`
- `app/lib/anatomy-data.ts` — the 9 organs plus the `systems` and
  `referenceIndex` derivations
- `app/lib/three/` — viewer, loaders and asset cache, hotspots, materials
- `app/lib/notes-store.ts`, `app/lib/favorites-store.ts`,
  `app/lib/local-store.ts` — client-side persistence
- `app/globals.css` — the whole stylesheet, with breakpoints at 1350 / 1040 / 760 / 470
- `public/models/` — 9 `.glb` models
- `public/anatomy/<organ>/` — `webp` illustrations per organ
- `db/schema.ts` — intentionally empty until a database is needed
- `.openai/hosting.json` — declares optional D1 and R2 bindings

> **Note on clone size:** the `.glb` history is large enough that GitHub warns
> about it (several files over 50 MB in history). Consider Git LFS if this
> becomes painful.

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev` — start local development
- `npm run build` — verify the vinext build output
- `npm run lint` — ESLint
- `npm test` — **currently broken**, see [Testing](#testing)
- `npm run db:generate` — generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
