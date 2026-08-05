# Manual release checklist

Run the site through `npm run serve`; do not open `index.html` with `file://`.

## Core menu

- [ ] Khmer is the first-visit language; switching to English updates navigation, filters, business data, cards and dialogs without reload.
- [ ] Search matches `Beef`, `coffee`, `សាច់គោ`, and `កាហ្វេ`.
- [ ] Category, availability, recommended, vegetarian, halal and spice filters combine correctly.
- [ ] Default, name, low-price and high-price sorting work.
- [ ] The empty-result reset restores the complete menu.
- [ ] The sold-out lemongrass soda remains visible and cannot be added.
- [ ] A broken image URL displays the local placeholder.

## Details, favorites and cart

- [ ] Clicking or tapping a card image, description, price, or other non-control area opens that item's details.
- [ ] The favorite and quick-add buttons keep their own actions and do not also open item details.
- [ ] Status badges stay at the image's bottom-left and never overlap the top-right favorite button.
- [ ] Lok Lak and Kuy Teav require a size; changing variants/add-ons updates the displayed total.
- [ ] Quantity never goes below 1 or above 20.
- [ ] Identical item/options/note selections merge; a different note creates a new row.
- [ ] Favorites, cart, table, language, currency and theme survive reload.
- [ ] Removed menu IDs are ignored in restored favorites/cart.
- [ ] The 5% discount appears only at a subtotal of at least $10.
- [ ] Dual, USD and KHR prices have stable rounding.
- [ ] Order summary includes reference, table, rows, notes, discount and total.
- [ ] The summary clearly says the order was not sent and provides no Copy, Share or Print actions.
- [ ] Marking the order as noted turns the notice green, shows the time, keeps the cart intact and offers Close plus Start New Order.
- [ ] Closing and reopening the same unchanged summary preserves its noted status and reference.
- [ ] Changing an item, quantity, table number or note makes the next summary pending again.
- [ ] Start New Order requires confirmation, then clears items, table number and notes while keeping favorites.
- [ ] Undo restores the pending staff-handoff state.

## Responsive and accessible

- [ ] Test widths: 320, 360, 375, 390, 412, 430, 576, 768, 1024, 1280 and 1440px.
- [ ] No width creates horizontal page scrolling.
- [ ] Bottom navigation does not cover content and respects the safe area.
- [ ] Details and cart remain usable in portrait, landscape and at 200% zoom.
- [ ] Keyboard-only users can search, filter, open/close dialogs, select options and prepare a summary.
- [ ] Focus is visible; dialogs trap focus and restore it on close.
- [ ] Screen reader smoke test announces result, favorite, cart, network and update changes.
- [ ] Light, dark, system theme and reduced-motion mode are readable.

## PWA and deployment

- [ ] Clear site data, visit online once and wait for service worker installation.
- [ ] Enable offline mode, reload and verify menu, images, fonts, search, favorites and cart.
- [ ] Open a never-cached navigation while offline and verify `offline.html`.
- [ ] Change the service worker version, deploy, and verify the controlled update banner.
- [ ] Verify old `emenu-*` caches are deleted after activation.
- [ ] Install from a supported browser and launch in standalone mode.
- [ ] Open Settings and scan the QR code from another device; it must open the deployed URL.
- [ ] Run Lighthouse on the deployed HTTPS URL and record exceptions from the 90/95/95/90 targets.
# Hero slideshow

- Confirm the hero background advances automatically every 5 seconds.
- Swipe left and right on touch screens to change the cover.
- Hold and drag left and right with a mouse to change the cover.
- Swipe repeatedly before the transition finishes and confirm the hero never becomes blank.
- Confirm the transition from the last cover to the first keeps moving forward and never sweeps backward through earlier covers.
- Confirm the business name, tagline, status, hours, and menu button remain fixed.
- Confirm the navigation dots select the expected cover.
