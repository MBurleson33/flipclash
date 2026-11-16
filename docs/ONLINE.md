# Online multiplayer

Each player uses their own phone. A small Cloudflare server (`server/`) holds the only full copy of the game,
runs the same rules engine as the app, and sends each phone **only what that player is allowed to see** —
nobody's device ever receives another player's face-down cards or secret pick, so nobody can cheat.

- Host: **Play → Online → Create a room** → share the 4-letter code or the invite link.
- Friends: **Play → Online → Join** and type the code (or just open the invite link).
- The host picks 2–4 seats and can make any seat a computer player (Easy / Medium / Hard).
- Everyone peeks at the same time, and the defender can lock in before the attacker — no waiting around.
- Drop out? Reopen the app → **Online → Rejoin room**. The game waits for you.
- If someone is gone for good, the host can tap **Let a computer play for …**. If the host's phone is offline,
  the next connected player gets the host controls.

## One-time setup

### 1. Deploy the room server (free Cloudflare account)

**Option A — from the Cloudflare dashboard (auto-deploys on every merge):**
1. Sign up / log in at dash.cloudflare.com.
2. **Workers & Pages → Create → Import a repository** → connect GitHub → pick `MBurleson33/flipclash`.
3. Set **Root directory** to `server`. Leave the build command empty; the deploy command is `npx wrangler deploy`.
4. Deploy. Copy the URL it gives you, e.g. `https://flipclash-rooms.<your-subdomain>.workers.dev`.

**Option B — from a computer:**
```bash
cd server
npm install
npx wrangler login     # opens a browser to sign in
npx wrangler deploy    # prints the server URL
```

Check it: opening `<server URL>/health` should show `ok`.

### 2. Point the app at it (Vercel)

Vercel → the `flipclash` project → **Settings → Environment Variables** → add

| Name | Value |
|---|---|
| `VITE_ROOM_SERVER` | the server URL from step 1 (no trailing slash) |

Then **Deployments → Redeploy**. The **Online** mode lights up; without the variable it shows "coming soon".

## Costs

Cloudflare's free Workers plan includes Durable Objects. Family games use a tiny fraction of the daily free
allowance. Idle rooms delete themselves after 3 days.

## Local development

```bash
cd server && npm install && npm run dev          # room server on http://127.0.0.1:8787
VITE_ROOM_SERVER=http://127.0.0.1:8787 npm run dev   # app, in the repo root
```
Open the app in two browser windows (one normal, one private) to play against yourself.
