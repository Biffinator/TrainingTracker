# Hybrid Training Tracker V2.0.0

Static, deployment-ready update for Biffinator/TrainingTracker. No build, accounts, credentials, or cloud services required.

## Replace V1 on GitHub Pages

1. Open your current tracker in each browser/device where you have logs. Click **Export backup** and keep each downloaded JSON file somewhere safe. Do not upload personal backup files to GitHub.
2. Extract **hybrid-training-tracker-v2.zip** on your computer. Open the extracted folder containing `index.html`.
3. Open https://github.com/Biffinator/TrainingTracker and select the **main** branch.
4. Choose **Add file → Upload files**. Drag these files and the `icons` folder into the upload area: `index.html`, `app.js`, `core.js`, `program.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `README.md`, and `icons`. The `tests` folder and `package.json` are optional for deployment; they contain the automated checks. Upload the contents, not the ZIP or an enclosing folder. Files with the same paths replace V1 files.
5. Enter **Upgrade Hybrid Training Tracker to V2** as the commit message. Choose **Commit directly to the main branch**, then **Commit changes**. If GitHub requires a pull request, create the proposed branch, open its pull request, and merge it into main.
6. Open **Settings → Pages**. Keep **Deploy from a branch**, **main**, **/ (root)**. Save only if you changed these settings.
7. Open **Actions**. Wait for the newest **pages build and deployment** run for your V2 commit to finish with a green check. If it fails, open that run for its error before trying the tracker.
8. Visit https://biffinator.github.io/TrainingTracker/ in the same browser where you logged V1 workouts. Wait briefly for the new service worker, then reload. The heading should display **V2** and the footer **V2.0.0**.

## If the old screen remains

V1 used a cache-first service worker. V2 replaces it and removes its old app cache while retaining local workout storage. Close all tracker tabs/windows (including the installed app), reopen the normal site online, wait briefly, and reload. On Windows you can also press Ctrl+Shift+R. Once V2 appears in the browser, reopen the installed app. Do not clear site data or uninstall the app to force an update; this may remove your logs. Confirm the green deployment check and that the repository's `sw.js` contains `hybrid-v2.0.0` if it still shows V1.

## Verify the update

- Confirm the month calendar has seven weekday columns and every date is selectable on phone and desktop.
- With Cycle Starts set to **September 7, 2026**, September 28 is Week 4; October 5 is Cycle 2, Week 1; November 2 is Cycle 3, Week 1. Earlier calendar dates retain the calculated week when you return to them. Dates before the start have no workout.
- Future dates show the schedule but cannot be logged. The start date must be a Monday. Changing it intentionally recalculates the schedule while keeping all logs on their original dates; the app warns if history exists.
- On a current/past scheduled date, check one component: **◐**. Complete all required components: green **✓**. Mark missed: red **✕**. Clear status: blank. Notes and entered set values remain when you clear status or mark missed.
- Saturday's explicitly optional treadmill is not required for a green check. All other daily components remain required. Lifting completion is checked at workout level; typing sets alone does not mark the lift complete.
- On a lifting day, enter separate weight/reps values for each set, then reload and verify they remain. Use one consistent weight unit (lb or kg). For timed core work, use seconds in the reps/seconds field. Core circuits have one row per round.
- On a later occurrence of that same lift A/B/C, the latest earlier logged sets appear as **Last**. Lift B values do not appear as Lift A history. Future/current-date entries are excluded from previous values.
- Export a V2 backup and keep it. Restore accepts V2 backups, asks before replacing history, and first downloads a copy of the current data. Restore is replacement, not a cross-device merge.

## V1 data migration

The original key `hybridTrackerV1` is never overwritten or deleted. V2 uses `hybridTrackerV2`. Migration requires using the same site origin and browser/profile; logs on another device are separate.

V1 recorded entries like `1-Mon`, not real dates. When V1 data is detected, choose **Place V1 logs in first cycle** only if those dates are appropriate. Otherwise choose **Keep V1 as backup only**. Both choices retain the original data in the V2 backup. Existing V2 records take priority over V1 records for an occupied date.

V1's single weight/reps entry cannot reliably identify individual sets. It is displayed separately as **V1 entry** and can appear in previous-workout history with **sets unknown**. No made-up set values are created. Original run instruction fields and other legacy details are retained in the backup even where they are not displayed as lifting sets.

## Program and persistence

The full program was recovered from the deployed repository. `program.js` preserves V1's exercise names, normal prescriptions, daily plunge, treadmill variations, Monday/Wednesday/Friday lifts, Tuesday Norwegian 4×4 in Week 2, Week 3 tempo, Thursday bike, alternating Saturday long run/bike, Sunday recovery/basketball, and Week 4 deload. V2 renders reduced deload set counts by rounding normal sets × 0.7 (three sets → two; two sets → one), while leaving original prescriptions visible.

Data remains in this browser/device. Cloud sync is deferred to a later phase requiring secure identity and storage. Export regularly; browser storage can be removed by browser cleanup/private browsing. No analytics or remote workout database is included. V2 caches app assets for offline use after one successful online load.

## Validation

Seven automated core tests cover 4,000 days of repeating cycles, DST/leap dates, status rules, all 28 program days, V1 migration, previous sets, and backup validation. Run with Node.js: `npm test`. Application and service worker syntax were checked. Browser visual/interaction tests and a live GitHub deployment have not been performed as part of this file delivery.

GitHub references:
- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
