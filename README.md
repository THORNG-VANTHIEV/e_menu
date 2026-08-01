# M'lou Kitchen E-Menu

An offline-first, bilingual Cambodian e-menu built as a static Progressive Web App. It uses Bootstrap 5.3, local JSON, local fonts, Vanilla JavaScript modules and no backend or build step.

## Included

- Khmer/English menu, business profile, hours and contact links
- Search, category/dietary/spice filters and sorting
- Item details with variants, add-ons, notes and live pricing
- Device-local favorites and a versioned cart
- USD, KHR and dual-price display with integer-safe calculations
- Order summary with table/note and an in-person staff handoff confirmation
- Light, dark and system themes
- Responsive phone, tablet and desktop layouts
- Install prompt, offline cache, fallback page and controlled update banner
- Deployment-aware QR code that uses the current site URL
- Data validation, service tests and release documentation

## Run locally

Requirements: Node.js 20+ and Python 3.

```bash
npm run check
npm run serve
```

Open [http://localhost:4173](http://localhost:4173). PWA features require `localhost` or HTTPS; do not use `file://`.

To test offline behavior:

1. Open the site online and wait for the service worker to install.
2. Reload once so the installed worker controls the page.
3. In browser developer tools, switch the network to Offline.
4. Reload and verify the menu, images, fonts, favorites and cart.

## Project layout

```text
data/                     Business, categories, menu, promotions, translations
assets/css/               Bootstrap plus mobile-first project styles
assets/js/                Feature-oriented ES modules
assets/images/            Local optimized menu/business/PWA artwork
assets/fonts/             Local Inter and Noto Sans Khmer
assets/vendor/            Pinned Bootstrap, Bootstrap Icons and QR renderer
tests/                    Native Node tests and manual release checklist
docs/                     Content and deployment guides
service-worker.js         Cache strategies and lifecycle
precache-manifest.js      Complete offline app/data/image list
```

## Content updates

See [docs/content-update-guide.md](./docs/content-update-guide.md). After changing critical HTML, CSS, JavaScript, JSON, fonts or precached images:

1. Add any new required file to `precache-manifest.js`.
2. Increment `VERSION` in `service-worker.js`.
3. Run `npm run check`.
4. Test online, then offline, before deploying.

## GitHub Pages

See [docs/deployment-guide.md](./docs/deployment-guide.md). Every application URL is repository-relative, so the same files work at `https://username.github.io/repository-name/`.

The Settings screen generates a QR code from the current address. It therefore points to `localhost` during development and automatically points to the final GitHub Pages URL after deployment.

## Local-only data

This application does not send an order to a kitchen and does not store it centrally. Cart items, favorites, table/name, notes, language, currency and theme stay in the current browser's local storage. Clearing browser data removes them.

## License

Project code is MIT licensed. Generated food and brand images are project assets. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for pinned vendor and font licenses.
