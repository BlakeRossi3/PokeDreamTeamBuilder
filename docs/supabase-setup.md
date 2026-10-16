# Turning on online accounts (Supabase)

Dream Team Dex works without this: saves stay in each browser. Once you finish these steps, players can:
- sign in with Google or an email code;
- pick a username and get a friend code;
- keep one cloud save that follows them to every device;
- add friends.

Everything here is free on Supabase's free plan. It takes about 20 minutes.

> **Never** put the `service_role` key anywhere in this repo or the site. Only the `anon` key goes in
> `site/config.js`. The anon key is meant to be public: the row-level-security rules in the migration decide what
> it can do.

## 1. Create the project

1. Go to <https://supabase.com>, sign in (GitHub works) and click **New project**.
2. **Name:** `dream-team-dex`. **Database password:** click *Generate*, then store it in a password manager. The
   app never needs it. **Region:** the one closest to most players.
3. Click **Create new project** and wait a minute or two while it starts.

## 2. Create the tables (run the SQL)

1. In the left sidebar open **SQL Editor** → **New query**.
2. Open `supabase/migrations/20261016000000_accounts_and_friends.sql` from this repo, copy all of it, paste it in and
   click **Run**. It should finish with "Success. No rows returned".
   Then do the same with `supabase/migrations/20261017000000_friend_battles.sql` (live friend battles). Run the files
   in date order; both are safe to run again.
   - It's safe to run again later (for example after an update): it only creates what's missing and replaces the
     functions.
   - With the Supabase CLI instead: `supabase link --project-ref <ref>` then `supabase db push`.
3. Check **Table Editor**. You should see `profiles`, `saves`, `save_versions`, `friendships`, `public_profile`,
   `home_likes`, `battle_invites`, `battle_reports` and `battle_results`, each marked "RLS enabled".
4. Friend battles use **Realtime**, which is on by default. The battle migration adds `battle_invites` to the
   `supabase_realtime` publication (so challenges arrive instantly) and adds the policies that keep each match's
   private channel `battle:<match_id>` to its two players. In **Project Settings → Realtime**, leave "Allow public
   access" **off** so only those policies decide who can join a channel.

## 3. Sign-in methods

### Email (one-time code or magic link)

1. **Authentication → Sign In / Providers → Email**: make sure **Enable Email provider** is on. Leave **Confirm
   email** on.
2. **Authentication → Emails → Templates → Magic Link**: replace the body with the text below. The email then shows a
   code players can type, as well as a link:

   ```html
   <h2>Your Dream Team Dex sign-in code</h2>
   <p>Type this code in the app: <strong style="font-size:24px;letter-spacing:4px">{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a> on this device.</p>
   <p>If you didn't ask for this, you can ignore this email.</p>
   ```

   Do the same for the **Confirm signup** template, since a player's first sign-in uses that one.
3. Supabase's built-in email sender only allows a few emails an hour. That's fine for testing; before telling lots of
   players about it, set up free SMTP. **Authentication → Emails → SMTP Settings** works with, for example,
   [Resend](https://resend.com) or [Brevo](https://brevo.com).

### Google

1. Go to <https://console.cloud.google.com/>, create a project (e.g. "Dream Team Dex"), then open
   **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - App name: Dream Team Dex. Support email: yours.
   - Scopes: the defaults (`email`, `profile`, `openid`).
   - Publish the app (it doesn't need Google's review for these scopes).
2. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type: **Web application**.
   - **Authorized JavaScript origins:** `https://blakerossi3.github.io`
   - **Authorized redirect URIs:** the callback URL shown in Supabase under **Authentication → Sign In / Providers →
     Google**. It looks like `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Copy the **Client ID** and **Client secret** into Supabase's Google provider settings, switch it **on** and
   **Save**.

## 4. Allowed addresses (redirect URLs)

**Authentication → URL Configuration**:

- **Site URL:** `https://blakerossi3.github.io/PokeDreamTeamBuilder/`
- **Redirect URLs** (click *Add URL* for each):
  - `https://blakerossi3.github.io/PokeDreamTeamBuilder/`
  - `http://localhost:8765/` (for testing on your computer)

## 5. Connect the site

1. **Project Settings → API** (or **Data API**). Copy the **Project URL** and the **anon public** key. Do *not* copy
   `service_role`.
2. Put them in `site/config.js`:

   ```js
   window.DTD_CONFIG = {
     supabaseUrl: "https://abcdefghijklmnop.supabase.co",
     supabaseAnonKey: "eyJhbGciOi..."
   };
   ```
3. Commit and push to `main`. The Pages workflow deploys it, and the sign-in screen gets a **Play on any device**
   box.

To try it locally first: `python3 scripts/build.py && python3 -m http.server 8765 --directory dist/web`, then open
<http://localhost:8765/>.

## How it works (for later)

- **Local-first.**
  - The game always plays from the browser's own storage, so it works offline.
  - About 4 seconds after the last change, and whenever the tab is hidden, the save uploads with `put_save`.
  - On sign-in and app start, the app checks the cloud copy.
  - The account button shows *Synced*, *Saving…*, *Offline* or *Signed out*.
- **No silent overwrites.**
  - Each upload says which version it builds on.
  - If another device saved in between, the player picks: "Keep this device's progress" or "Use the cloud
    progress", seeing teams, badges and PokéPoints for each.
  - The database also keeps each player's last 20 cloud saves in `save_versions`. You can find them in Table Editor
    if a player ever needs one back.
- **Size:** saves over 1 MB are refused by a database check. Real saves are around 20–100 KB.
- **Everything loaded from the cloud** goes through the same `clean*` checks as local saves.
- **Existing players:**
  - On their first online sign-in they're offered their save files from that device (and a guest session) to bring
    into the account.
  - Local-only save files, guest play and Download/Restore a backup all keep working.
- **Usernames:**
  - 3–16 letters, numbers or `_`, unique regardless of upper or lower case, and filtered for offensive words. The
    list is in `username_ok()` in the SQL and `UNAME_BAD` in the app; keep them in step.
  - Players can change their username once a week.
- **Account menu:** change username, sign out, download my data (everything the cloud stores about you), delete my
  online account (deletes every row; the device keeps a local copy).
- **Friends (Phase 6):** use the `friendships`, `public_profile` and `home_likes` tables and the functions in the same
  migration. Only accepted friends can read a player's `public_profile`; nobody can read anyone else's save.
- **Friend battles (Roadmap 2, phase 5):** `invite_battle` (accepted friends only, at most 5 open challenges, each
  lasts 2 minutes), `respond_battle`, `cancel_battle`, `battle_inbox`. The invite holds the battle's random seed and
  rules (1v1, 3v3 or 6v6; Bag on or off). Both players build the same battle from the seed and send only their
  choices over the private broadcast channel, resolving each turn together. Each reports the result with
  `report_battle`; when both agree it goes in `battle_results`, and a win pays 60 PokéPoints, at most 3 paid wins per
  friend per day. "Online" on the friends list means the friend's app was open in the last 3 minutes
  (`profiles.last_active`, refreshed every minute and visible only to accepted friends).

## Checking the SQL without touching the real project

`sh supabase/tests/run.sh` (needs PostgreSQL installed locally) applies the migrations to a throwaway database
twice. It then runs `supabase/tests/scenario.sql`, which acts as three pretend players and covers:
- usernames, versioned saves, conflicts and the 1 MB cap;
- friend requests, who can see what, and once-a-day Likes;
- friend battles: rules, friends only, privacy, results both players confirm, the 3-paid-wins cap and expiry;
- blocks and account deletion.

## Free plan notes

- A free project **pauses after a week with no activity**. If that happens, open the dashboard and click
  *Restore*. While it's paused the game keeps working locally and syncs once the project is back.
- Limits are generous for a fan project: 50,000 monthly active users and a 500 MB database.

## Updating supabase-js

The client is vendored at `site/vendor/supabase.js` (currently v2.118.0), so the site never depends on a CDN. To
update it:

```sh
npm pack @supabase/supabase-js@2 && tar xzf supabase-supabase-js-*.tgz
cp package/dist/umd/supabase.js site/vendor/supabase.js   # keep the one-line licence header at the top
```
