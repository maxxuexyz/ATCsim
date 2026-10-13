# Online profile foundation

The profile schema is prepared for a shared browser/desktop account and later multiplayer sessions. Supabase was selected for this first backend slice because its Auth and Postgres row-level security cover account/profile storage, and its Realtime service can support multiplayer presence and broadcasts later.

## Prepared in this folder

- `migrations/202610100001_profiles_progression.sql` creates online profiles, Miles/XP balances, per-user playtime and handoff totals, an append-only reward ledger, the airport catalog, and atomic airport purchases.
- New accounts receive the free Riga airport unlock.
- Riga is currently the only catalog item; add other airports after Riga is finished.
- Rewards and purchases cannot be written directly through the client data API. They go through database functions so balances cannot be edited by ordinary profile updates.
- The initial single-player reward claim is deduplicated per account/session and imports one guest trial. Its input is capped; multiplayer awards should later come from server-validated role events.
- `migrations/202610100002_friends.sql` adds unique usernames, username changes limited to once every 30 days, friend requests, blocking, and friend-only online/session presence. Apply it after the progression migration.

## Client connection

The browser client is configured in `js/core/supabase-client.js` with the project's URL and publishable key. The publishable key is intended for client-side use when row-level security is enabled. Never place a Supabase secret/service-role key in the game client.

The profile screen supports email/password registration and sign-in. New accounts get a profile and the free Riga unlock from the database trigger. Friends can search exact usernames, send/respond to requests, remove or block friends, and see online/in-session presence when it is enabled. Username changes are limited to once every 30 days. Guests can play one session of up to 20 real-time minutes; after that, an account is required to start another session. A completed guest trial can be imported once after sign-up/sign-in. Signed-in session rewards are submitted when the session ends, and failed network submissions are queued locally for retry.

The static app loads `@supabase/supabase-js` v2 from esm.sh, so account features require an internet connection. The game itself remains playable locally, subject to the guest-session limit.

Riga APP/TWR/GND position switching currently runs in one browser's local simulation state. The existing Supabase profile, friend, presence, and reward tables do not synchronize live aircraft, reserve controller positions, or validate multiplayer commands. Do not treat the local surface radar as multiplayer support; those capabilities require a server-authoritative shared-session design.

## Project setup

1. Create a Supabase project.
2. Run the migration in the project's SQL editor.
3. Configure email/password sign-in and the allowed site URLs for the eventual website and desktop WebView origin.
4. Put the project URL and publishable key in `js/core/supabase-client.js` if you are connecting a different project.

The publishable key is intended for client use when row-level security is enabled. Never place a Supabase secret/service-role key in the game client.

After applying the migration, test account creation and sign-in from the main menu. If email confirmation is enabled, confirm the email before signing in. The claim RPC currently accepts capped single-player session totals from the client; authoritative reward validation will be required for multiplayer.
