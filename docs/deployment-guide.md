# GitHub Pages deployment

## Publish

1. Create a public or Pages-enabled repository.
2. Put this project's files at the repository root.
3. Commit and push to `main`.
4. In GitHub, open **Settings → Pages**.
5. Choose **Deploy from a branch**, `main`, and `/(root)`.
6. Save and wait for the HTTPS URL.
7. Open the deployed URL in a new browser profile and complete the production checklist.

`.nojekyll` is already present. All application files use `./` repository-relative paths for project-page compatibility.

## Before the first public release

- Replace the sample phone, Telegram and map links in `data/business.json`.
- Review all Khmer and English content, prices, allergen notes and opening hours.
- Add the final canonical and absolute Open Graph URLs to `index.html` once the domain is known.
- Run Lighthouse on the deployed URL (targets: 90 Performance, 95 Accessibility, 95 Best Practices, 90 SEO).
- Open Settings and scan the generated QR on another device. It derives the final URL at runtime.
- Add `robots.txt` and `sitemap.xml` after the permanent URL is known.

## Release and cache updates

For every critical content or application change:

1. Update `precache-manifest.js` if files were added or renamed.
2. Increment `VERSION` in `service-worker.js`.
3. Run `npm run check`.
4. Test online, offline and the controlled update banner.
5. Commit and push.
6. For a stable release, create a semantic tag such as `v1.0.0`.

The new worker waits. Customers see an update banner and choose when to activate it, so an in-progress note is never refreshed unexpectedly.

## Troubleshooting

- `file://` does not support service workers; use `npm run serve`.
- A 404 for assets usually means a root-absolute URL was added. Use `./assets/...` or another relative URL.
- If offline installation fails, browser console logs identify the exact precache path.
- If old content remains, confirm the service worker version changed and then accept the update banner.
