# Hybrid Training Tracker

Static installable PWA for a repeating 4-week hybrid training cycle.

## Deploy with GitHub Pages
1. Create a GitHub repository.
2. Upload all files in this folder to the repository root.
3. In repository Settings > Pages, select **Deploy from a branch** (or GitHub Actions) and publish the `main` branch root.
4. Open the generated Pages URL.

## iPhone install
Open the site in Safari, tap Share, then **Add to Home Screen** / **Open as Web App** depending on iOS wording.

## Important storage note
This first version stores workout data in the browser's localStorage. It persists on that browser/device, but does not sync between iPhone and desktop. Use **Export backup** periodically. A cloud database/auth layer is required for true cross-device sync.
