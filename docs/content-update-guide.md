# Content update guide

All public menu content lives in `data/`; there is no admin dashboard or database.

## Add or edit a dish

1. Prepare a WebP image at a practical card size (about 960px wide, ideally 40–120KB).
2. Save it in `assets/images/menu/` using a lowercase kebab-case name.
3. Add or update the record in `data/menu-items.json`.
4. Keep `id` unique and lowercase; reference an active category ID.
5. Provide at least one of `name.km` or `name.en`; both are strongly recommended.
6. Keep prices and deltas non-negative, `spicyLevel` from 0–3, and `sortOrder` numeric.
7. When variants exist, exactly one available variant must have `"default": true`.
8. Add the image path to `precache-manifest.js` for guaranteed offline access.
9. Increment `VERSION` in `service-worker.js`.
10. Run `npm run check`, then test through `npm run serve`.

Invalid records are skipped and logged so one bad dish cannot crash the full menu.

## Stock, price and promotions

- Out of stock: set `flags.available` to `false`; the card remains visible but Add is disabled.
- Price: update `basePrice.amount`, a variant `priceDelta`, or an add-on `price`.
- Exchange rate: update `business.currency.usdToKhr`; it is a static owner setting.
- Discount: update `business.order.discountPercent` and `discountMinimumUsd`.
- Promotion text: edit `data/promotions.json`. A promotion is informational unless corresponding pricing logic exists in the business settings.

## Business and translations

- Identity, address, contacts, hours, currency and order limits: `data/business.json`
- Interface strings: `data/translations.json`
- Category order and visibility: `data/categories.json`

Leave an unused contact value empty; the related action hides automatically. Only `https:` and `tel:` dynamic links are accepted.

## Release check

Run:

```bash
npm run check
npm run serve
```

Then follow `tests/manual-test-checklist.md`, including online-to-offline and update-banner checks.
