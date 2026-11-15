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
between pages, 20–40 s after every fifth page, and 4–8 s between the two lists.
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

## Current worktree

The initial collector and the two follow-up fixes above have been committed and
pushed. The username-from-profile fallback is the only expected pending change
until it is committed; keep the intentionally removed password-login
pages/routes deleted unless the product decision changes.
