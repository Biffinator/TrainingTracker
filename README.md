# Hybrid Training Tracker V3.2.0

- Keep me signed in stores a renewable session token on the selected device, never the password. Sign out clears it. Unchecked sessions persist only within that browser tab. Expired/revoked credentials can still require sign-in.
- Training can start on any date. A Saturday start uses Week 1 Saturday/Sunday, then the full Week 1 starts Monday. Weeks 1–4 repeat from that Monday. Use Start tomorrow or choose a date. Existing records stay on their dates.
- Edit this workout changes only the selected date. Edit its title, activity/lifting type, exercises or instructions, and optional status. Use one exercise per line such as Bench press — 3 × 8–10.
- Matching exercise names retain set values when reordered. Removed/replaced exercise logs are archived in the backup and remain available as prior exercise history. Changed workouts are unchecked until completed again.
- Previous weights/reps use the most recent earlier date with that exercise name, ignoring the prescription after the em dash. Keep names consistent; different named exercises do not share history.

The existing Supabase table/function are compatible: no new SQL migration is required. Use the same tracker account on both devices. Original V2 data remains separate until explicitly imported. The full 28-day default program is preserved.

21 automated tests pass. Live session restoration and two-device sync require validation in your signed-in browsers. Do not upload personal history backups to this public repository.

The compact sync strip shows status and Sync now. Account controls are in the footer. Changes save locally immediately and sync after 30 seconds without typing or editing while the app is open and online. Sync now skips the wait. Wait for Saved to cloud before closing the app. A workout editor draft must be saved first.

