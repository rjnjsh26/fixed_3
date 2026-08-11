# Internal Use Only

A small messaging app with a real, server-side passcode gate. No one — not
even someone who views the page source — can reach the app, the message
history, or the member list without the correct passcode. That check happens
in `middleware.ts`, on the server, before any of that content is sent to the
browser.

## What you need (all free tiers)

- A GitHub account (to hold the code so Vercel can deploy it)
- A [Vercel](https://vercel.com) account (hosting)
- An [Upstash](https://console.upstash.com) account (the shared database
  that stores the member list and message threads)

## 1. Create the database

1. Go to the Upstash console → **Create Database** → choose the free tier,
   any region close to you.
2. Open the database → **REST API** tab. Copy the `UPSTASH_REDIS_REST_URL`
   and `UPSTASH_REDIS_REST_TOKEN` values — you'll need them in step 3.

## 2. Put the code on GitHub

1. Create a new empty repository on GitHub.
2. Upload everything in this folder to that repository (drag-and-drop on
   GitHub's web UI works fine for a project this size, or use `git push` if
   you're comfortable with it).

## 3. Deploy on Vercel

1. In Vercel, click **Add New → Project**, and import the GitHub repo you
   just created.
2. Before deploying, open **Environment Variables** and add:
   - `APP_PASSWORD` → `WRxsti26p` (or whatever you want the passcode to be)
   - `SESSION_SECRET` → any long random string (run `openssl rand -hex 32`
     locally if you have a terminal, or just mash the keyboard for 40+
     characters)
   - `UPSTASH_REDIS_REST_URL` → from step 1
   - `UPSTASH_REDIS_REST_TOKEN` → from step 1
3. Click **Deploy**. Vercel gives you a URL like
   `https://internal-use-only-yourname.vercel.app`.

## 4. Use it

Visit the URL. You'll hit the passcode screen first — nothing else loads
until that's correct. Enter it, pick a display name, and you're in the
"Everyone" group chat and can start 1:1 threads with anyone else who's
joined.

Share the **URL and the passcode** only with people you trust. Anyone
without the passcode cannot reach the app, the API, or any stored messages —
the check happens before the server sends a response, not in the browser.

## Changing or revoking access

- **Change the passcode**: update `APP_PASSWORD` in Vercel's project
  settings and redeploy. Anyone who hasn't logged in yet needs the new one;
  people already logged in stay in until their 30-day session expires (edit
  `SESSION_DAYS` in `lib/auth.ts` to shorten that).
- **Wipe the conversation history**: open your Upstash database console and
  delete the keys starting with `euo:`.
- **Take it down entirely**: delete the Vercel project, or just remove the
  environment variables.

## Local development (optional)

```bash
npm install
cp .env.example .env.local   # fill in the same values as step 3
npm run dev
```
