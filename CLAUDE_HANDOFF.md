# Browser collector handoff

Updated: 16 November 2026 (Europe/Istanbul)

## Decision and safety boundary

Password-based server login was removed from the web product because Instagram's
CAA/2FA flow did not provide a usable verification path and repeated datacentre
logins were increasing account risk. Do **not** make further Instagram login
attempts from the server.

The web flow is now browser-only:

1. `/tr/topla` or `/en/topla` gives the user a bookmarklet.
2. The bookmarklet runs only on `instagram.com`, opens the collection page, and
   fetches the two lists with the user's already-signed-in browser session.
3. Instagram CSP prevents a direct request to this site, so the bookmarklet
   transfers the lists to the opened window with `postMessage`.
4. The opened site window submits the lists to `/api/collect`; the backend only
   compares and stores the lists. It receives no Instagram credential.

The collector is deliberately sequential and paced: 50 items/page, 2.5–5 s
between pages, 20–30 s after every sixth page, and 3–6 s between the two lists.
It stops rather than retries after 429/401/403.

## Files and responsibilities

- `web/src/lib/collector.ts`: inline bookmarklet source and pacing.
- `web/src/components/app/CollectClient.tsx`: `/topla` postMessage receiver,
  progress view, and same-origin handoff to `/api/collect`.
- `web/src/app/api/collect/route.ts`: sanitizes data, opens/reuses a
  credential-less collection session, calls `/api/ingest`, writes web cookies.
- `backend/internal/api/handlers.go`: `POST /api/collect-session`, which makes
  a session containing only the Instagram username.
- `web/src/app/[locale]/panel/page.tsx`: skips `/api/profile` for collection
  sessions; this is essential so opening the dashboard cannot trigger a
  server-side Instagram request.
- `web/src/app/api/ig/[...path]/route.ts`: rejects all server-side Instagram
  proxy calls while the collection-mode cookie is set.

The panel takes the just-computed result from `sessionStorage` and disables row
details, unfollow, remove-follower, and server-side re-analysis in collection
mode. It shows a truthful limitation notice instead.

## Additional fixes made after the previous handoff

- Reuse a collection session only if its username matches the current browser
  collection (case-insensitive). Switching Instagram accounts in another tab
  therefore cannot attach new lists to the old account's snapshot.
- The collection-mode cookie is `HttpOnly`, and the server-side Instagram proxy
  rejects every collection-mode request. The browser-only boundary is enforced
  in both the panel and the proxy, not merely hidden in the UI.
- Updated the landing, FAQ, privacy, terms, and UI wording to say that the
  service never asks for or receives an Instagram password/session cookie.
- Removed unused web login/challenge client types and API methods.
- After observing a normal-size account's collection time, the browser pacing
  was modestly shortened: 2–4 seconds between pages, a 20–30 second rest after
  every sixth page, and 3–6 seconds between the two lists. It remains strictly
  serial and treats the first 429/401/403 as a terminal result—never retry.

## Verification completed

- `cd backend && go test ./...` — passed.
- `cd web && npm run typecheck` — passed.
- `cd web && npm run lint` — passed.
- `git diff --check` — passed.

`npm run build` cannot run in this environment because Node is `18.13.0`, while
this Next.js version requires Node `>=18.18.0` (or a supported later release).

The prior agent tested `window.open` plus `postMessage` on a real Instagram
page without making an Instagram API request. Do not perform a live list
collection or login test until the account has rested and the user explicitly
chooses to do so.

## Follow-up fixes after the initial collector release

- Legacy `/tr/giris` and `/en/giris` now return a `307` redirect to the
  collection page, so old links cannot revive the removed password-login path.
- React production builds deliberately replace a JSX `javascript:` `href` with
  a throwing URL. `CollectClient` assigns the generated bookmarklet using
  `setAttribute` after hydration instead. A bookmark saved before that fix must
  be deleted and recreated from `/topla`.
- The collector now first takes the username from the URL when the user runs it
  on their own Instagram profile (for example, `instagram.com/example/`). This
  avoids the unreliable extra `/users/{id}/info/` Instagram call. The UI now
  explicitly tells users to open their own profile before invoking the
  bookmarklet; it retains the old lookup only as a fallback.
- Each Instagram list-page request has a 90-second timeout. A held request is
  aborted and reported as a stopped collection; it is never retried. This is
  important because the progress bar is intentionally indeterminate without
  known follower/following totals, so a stuck network request could otherwise
  look like normal pacing forever.
- The collector also reads the owner profile through Instagram's normal web
  profile endpoint, as a best-effort browser-side enhancement. Its avatar,
  name, verification state and post count travel with the collected analysis
  and are retained in `sessionStorage`; refusal of that one request never
  blocks the lists. Signed Instagram image URLs are permitted up to 4096
  characters in the ingest sanitizer (the former 512-character limit silently
  truncated them, causing broken list avatars).

## Next product decision: Follower accounts (approved, not yet implemented)

The owner approved a separate Follower account system. It must offer both:

- email + password registration, with a one-time email verification code before
  activation; and
- Google OAuth sign-in.

Its purpose is to let one person see their stored analyses on web and phone.
Persist an opaque **Follower** web-session token and link analyses/snapshots to
the Follower user id. Do **not** persist an Instagram session/cookie/token or
resume server-side Instagram access: new data is always collected by the
person's currently signed-in browser on `instagram.com`.

This needs a real user store (recommended: PostgreSQL), password hashing,
verification-code expiry/rate limits, deletion of the user and all associated
analysis data, plus SMTP and Google OAuth production configuration. Required
production values are a PostgreSQL connection, SMTP host/port/user/password/
sender, Google OAuth client id/secret, and the registered callback
`https://takipanaliz.com/api/auth/google/callback`.

## Mobile bookmarklets

The collection bookmarklet also works on phones when it is saved as a normal
browser bookmark whose URL is replaced with the copied `javascript:` code.
`/topla` now has explicit Safari/iPhone and Chrome/Android instructions. It
must run on the same browser's `instagram.com` page, not inside the Instagram
app. “Add to Home Screen” is a web shortcut, not a JavaScript bookmarklet, and
must not be presented as an alternative.

## Recommended easier phone path (not yet implemented for the browser-only flow)

Bookmarklets are the no-install fallback, not the best phone UX. The simpler
product path is a Follower native app with an embedded browser collector:

- on first use, the person signs in to Instagram in that app's WebView;
- the Instagram cookie remains in that device's WebView and is never uploaded
  to the Follower server;
- later collections are a single in-app button, with no bookmark editing; and
- the collected result is associated with the person's separate Follower
  account so it can be viewed on another device.

The repository has an older Expo mobile app, but it currently hands a captured
Instagram session to the backend and therefore does **not** meet this new
browser-only boundary. It must be refactored to post browser-collected lists to
`/api/collect`, like the web bookmarklet. Android is the practical first target;
iPhone distribution requires a native iOS app or Safari extension and the
corresponding Apple distribution setup. A PWA/add-to-home-screen shortcut alone
cannot read another origin's Instagram session and is not a replacement.

## Current worktree

The initial collector and the two follow-up fixes above have been committed and
pushed. The username-from-profile fallback is the only expected pending change
until it is committed; keep the intentionally removed password-login
pages/routes deleted unless the product decision changes.
