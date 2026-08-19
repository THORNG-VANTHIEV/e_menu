import {PAGE_SIZE, SEARCH_DEBOUNCE_MS, DEFAULT_FILTERS} from "./config.js";
import {createDataSignature, fetchFreshLocalData, loadLocalData} from "./api/local-data-source.js";
import {createStore} from "./state/store.js";
import {createI18n} from "./shared/i18n.js";
import {
  clearNode,
  closeDialog,
  closeOnBackdrop,
  debounce,
  element,
  openDialog,
  safeExternalUrl
} from "./shared/dom.js";
import {formatPrice} from "./shared/currency.js";
import {filterAndSortMenu, getActiveFilterCount} from "./features/menu/menu-service.js";
import {createMenuCard, getDetailSelection, renderItemDetail} from "./features/menu/menu-view.js";
import {
  addCartRow,
  changeCartQuantity,
  createCartSignature,
  createOrderReference,
  emptyCart,
  getCartCount,
  loadCart,
  removeCartRow,
  saveCart,
  unitPriceCents,
  updateCartDetails
} from "./features/cart/cart-service.js";
import {buildOrderSummary, renderCart} from "./features/cart/cart-view.js";
import {clearFavorites, loadFavorites, toggleFavorite} from "./features/favorites/favorites-service.js";
import {createHeroSlider} from "./features/hero/hero-slider.js";
import {
  applyTheme,
  getThemeToggleTarget,
  loadSettings,
  persistSetting,
  resolveTheme
} from "./features/settings/settings-service.js";
import {activateWaitingWorker, registerServiceWorker, setupInstallPrompt} from "./pwa/pwa-manager.js";

const dom = {
  menuLoading: document.querySelector("#menu-loading"),
  menuGrid: document.querySelector("#menu-grid"),
  emptyState: document.querySelector("#empty-state"),
  errorState: document.querySelector("#error-state"),
  errorMessage: document.querySelector("#error-message"),
  retryButton: document.querySelector("#retry-button"),
  resultCount: document.querySelector("#result-count"),
  categoryChips: document.querySelector("#category-chips"),
  activeFilters: document.querySelector("#active-filters"),
  activeFilterList: document.querySelector("#active-filter-list"),
  filterCount: document.querySelector("#filter-count"),
  searchInput: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search-button"),
  sortSelect: document.querySelector("#sort-select"),
  loadMore: document.querySelector("#load-more-button"),
  filterDialog: document.querySelector("#filter-dialog"),
  detailDialog: document.querySelector("#detail-dialog"),
  detailContent: document.querySelector("#detail-content"),
  cartDialog: document.querySelector("#cart-dialog"),
  cartContent: document.querySelector("#cart-content"),
  cartFooter: document.querySelector("#cart-footer"),
  orderDialog: document.querySelector("#order-dialog"),
  orderSummary: document.querySelector("#order-summary-print"),
  orderStatus: document.querySelector("#order-status"),
  orderStatusIcon: document.querySelector("#order-status-icon"),
  orderStatusMessage: document.querySelector("#order-status-message"),
  orderHandoffButton: document.querySelector("#order-handoff-button"),
  orderSummaryCloseButton: document.querySelector("#order-summary-close-button"),
  undoOrderNotedButton: document.querySelector("#undo-order-noted-button"),
  settingsDialog: document.querySelector("#settings-dialog"),
  confirmDialog: document.querySelector("#confirm-dialog"),
  confirmMessage: document.querySelector("#confirm-message"),
  offlineBanner: document.querySelector("#offline-banner"),
  updateBanner: document.querySelector("#update-banner"),
  updateButton: document.querySelector("#update-app-button"),
  installButton: document.querySelector("#install-button"),
  toastRegion: document.querySelector("#toast-region"),
  liveRegion: document.querySelector("#live-region"),
  promotionSection: document.querySelector("#promotion-section"),
  promotionList: document.querySelector("#promotion-list"),
  contactActions: document.querySelector("#contact-actions"),
  hoursList: document.querySelector("#hours-list"),
  hero: document.querySelector("#home"),
  heroSlider: document.querySelector("#hero-slider"),
  heroTrack: document.querySelector("#hero-track"),
  heroPagination: document.querySelector("#hero-pagination"),
  welcomeScreen: document.querySelector("#welcome-screen"),
  welcomeLogo: document.querySelector("#welcome-logo"),
  welcomeTitle: document.querySelector("#welcome-title"),
  welcomeTaglineBadge: document.querySelector("#welcome-tagline-badge"),
  welcomeStatus: document.querySelector("#welcome-status"),
  welcomeHours: document.querySelector("#welcome-hours"),
  welcomeEnterBtn: document.querySelector("#welcome-enter-btn"),
  welcomeLangKm: document.querySelector("#welcome-lang-km"),
  welcomeLangEn: document.querySelector("#welcome-lang-en")
};

const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
let store;
let i18n;
let currentDetailId = "";
let detailQuantity = 1;
let orderNotedAt = null;
let notedOrderSignature = "";
let orderSummarySignature = "";
let orderSummaryReference = "";
let pendingConfirmAction = null;
let heroSliderController = null;
let heroSlideSignature = "";
let currentDataSignature = "";

function showToast(message, iconName = "bi-check-circle") {
  const toast = element("div", {className: "app-toast"});
  toast.append(
    element("i", {className: `bi ${iconName}`, attrs: {"aria-hidden": "true"}}),
    element("span", {text: message})
  );
  dom.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function announce(message) {
  dom.liveRegion.textContent = "";
  window.setTimeout(() => {
    dom.liveRegion.textContent = message;
  }, 30);
}

function localizedDayRecord(business, date = new Date()) {
  return business.openingHours.find((record) => record.day === dayKeys[date.getDay()]);
}

function getOpenStatus(business, date = new Date()) {
  const record = localizedDayRecord(business, date);
  if (!record || record.closed) return {open: false, record};
  const minutes = date.getHours() * 60 + date.getMinutes();
  const [openHour, openMinute] = record.open.split(":").map(Number);
  const [closeHour, closeMinute] = record.close.split(":").map(Number);
  return {
    open: minutes >= openHour * 60 + openMinute && minutes < closeHour * 60 + closeMinute,
    record
  };
}

function syncHeroSlider(business) {
  const images = Array.isArray(business.heroSlides) && business.heroSlides.length
    ? business.heroSlides
    : [business.cover];
  const signature = images.join("|");
  if (signature !== heroSlideSignature) {
    heroSliderController?.destroy();
    heroSliderController = createHeroSlider({
      root: dom.hero,
      slider: dom.heroSlider,
      track: dom.heroTrack,
      pagination: dom.heroPagination,
      images,
      intervalMs: business.heroSlideIntervalMs,
      getSlideshowLabel: () => i18n.t("heroSlideshow"),
      getSlideLabel: (number) => i18n.t("showSlide", {number})
    });
    heroSlideSignature = signature;
  }
  heroSliderController?.refreshLabels();
}

function dismissWelcomeScreen() {
  if (!dom.welcomeScreen) return;
  dom.welcomeScreen.classList.add("is-hidden");
  dom.welcomeScreen.setAttribute("aria-hidden", "true");
}

function showWelcomeScreen() {
  if (!dom.welcomeScreen) return;
  dom.welcomeScreen.classList.remove("is-hidden");
  dom.welcomeScreen.removeAttribute("aria-hidden");
}

function renderBusiness(state) {
  const {business, settings, network} = state;
  const name = i18n.localize(business.name);
  const tagline = i18n.localize(business.tagline);
  document.title = `${name} — ${i18n.t("menu")}`;
  document.querySelector("#header-business-name").textContent = name;
  document.querySelector("#hero-title").textContent = name;
  document.querySelector("#hero-tagline").textContent = tagline;
  document.querySelector("#footer-business-name").textContent = name;
  document.querySelector("#about-copy").textContent = i18n.localize(business.about);
  document.querySelector("#business-address").textContent = i18n.localize(business.address);
  document.querySelector("#header-logo").src = business.logo;
  if (dom.welcomeTitle) dom.welcomeTitle.textContent = name;
  if (dom.welcomeLogo) {
    dom.welcomeLogo.src = settings.language === "km"
      ? "./assets/images/icons/lotcha_siemreap_kh.png"
      : "./assets/images/icons/lotcha_siemreap.png";
  }
  syncHeroSlider(business);

  const {open, record} = getOpenStatus(business);
  const status = document.querySelector("#business-status");
  status.classList.toggle("is-closed", !open);
  status.querySelector("span:last-child").textContent = i18n.t(open ? "open" : "closed");
  const hoursText = record?.closed
    ? ` ${i18n.t("closedDay")}`
    : ` ${record?.open || "—"} – ${record?.close || "—"}`;
  document.querySelector("#today-hours").lastChild.textContent = hoursText;

  if (dom.welcomeStatus) {
    dom.welcomeStatus.classList.toggle("is-closed", !open);
    dom.welcomeStatus.querySelector("span:last-child").textContent = i18n.t(open ? "open" : "closed");
  }
  if (dom.welcomeHours) {
    dom.welcomeHours.lastChild.textContent = hoursText;
  }
  if (dom.welcomeLangKm && dom.welcomeLangEn) {
    dom.welcomeLangKm.classList.toggle("is-active", settings.language === "km");
    dom.welcomeLangEn.classList.toggle("is-active", settings.language === "en");
  }

  clearNode(dom.hoursList);
  business.openingHours.forEach((hours) => {
    const row = element("div", {className: hours.day === dayKeys[new Date().getDay()] ? "is-today" : ""});
    row.append(
      element("dt", {text: `${i18n.t(hours.day)}${hours.day === dayKeys[new Date().getDay()] ? ` · ${i18n.t("today")}` : ""}`}),
      element("dd", {text: hours.closed ? i18n.t("closedDay") : `${hours.open} – ${hours.close}`})
    );
    dom.hoursList.append(row);
  });

  clearNode(dom.contactActions);
  const contacts = [
    {
      value: business.contact?.phone,
      href: business.contact?.phone ? `tel:${business.contact.phone}` : "",
      label: i18n.t("call"),
      icon: "bi-telephone",
      network: false
    },
    {
      value: business.contact?.telegramUrl,
      href: safeExternalUrl(business.contact?.telegramUrl, ["https:"]),
      label: i18n.t("telegram"),
      icon: "bi-telegram",
      network: true
    },
    {
      value: business.contact?.mapUrl,
      href: safeExternalUrl(business.contact?.mapUrl, ["https:"]),
      label: i18n.t("map"),
      icon: "bi-geo-alt",
      network: true
    }
  ];
  contacts.filter((contact) => contact.value && contact.href).forEach((contact) => {
    const link = element("a", {
      className: `contact-action${contact.network && !network.online ? " is-network-disabled" : ""}`,
      attrs: {
        href: contact.href,
        target: contact.network ? "_blank" : null,
        rel: contact.network ? "noopener noreferrer" : null,
        "aria-disabled": contact.network && !network.online ? "true" : null
      }
    });
    link.append(
      element("i", {className: `bi ${contact.icon}`, attrs: {"aria-hidden": "true"}}),
      document.createTextNode(contact.label)
    );
    dom.contactActions.append(link);
  });

  const languageButton = document.querySelector("#language-button");
  languageButton.querySelector("span").textContent = settings.language === "km" ? "EN" : "ខ្មែរ";
  const resolvedTheme = applyTheme(settings.theme);
  const themeButton = document.querySelector("#theme-button");
  const targetTheme = getThemeToggleTarget(resolvedTheme);
  themeButton.querySelector("i").className = `bi ${targetTheme === "light" ? "bi-sun" : "bi-moon-stars"}`;
  themeButton.setAttribute("aria-label", i18n.t(targetTheme === "light" ? "switchToLight" : "switchToDark"));
  themeButton.setAttribute("title", i18n.t(targetTheme === "light" ? "switchToLight" : "switchToDark"));
}

function renderPromotions(state) {
  clearNode(dom.promotionList);
  state.promotions.forEach((promotion) => {
    const card = element("article", {className: "promotion-card"});
    const copy = element("div");
    copy.append(
      element("p", {className: "promotion-card__label", text: i18n.localize(promotion.label) || i18n.t("promotion")}),
      element("h3", {text: i18n.localize(promotion.title)}),
      element("p", {text: i18n.localize(promotion.description)})
    );
    card.append(
      element("span", {className: "promotion-card__icon"}, element("i", {className: "bi bi-gift", attrs: {"aria-hidden": "true"}})),
      copy
    );
    dom.promotionList.append(card);
  });
  dom.promotionSection.hidden = state.promotions.length === 0;
}

function renderCategories(state) {
  clearNode(dom.categoryChips);
  const categories = [
    {id: "all", name: {km: i18n.t("all"), en: i18n.t("all")}, icon: "bi-grid"},
    ...state.categories
  ];
  categories.forEach((category) => {
    const active = state.filters.categoryId === category.id;
    const button = element("button", {
      className: `category-chip${active ? " is-active" : ""}`,
      attrs: {type: "button", "aria-current": active ? "true" : null},
      dataset: {category: category.id}
    });
    button.append(
      element("i", {className: `bi ${category.icon || "bi-circle"}`, attrs: {"aria-hidden": "true"}}),
      document.createTextNode(category.id === "all" ? i18n.t("all") : i18n.localize(category.name))
    );
    dom.categoryChips.append(button);
  });
}

function activeFilterLabels(state) {
  const labels = [];
  if (state.filters.favoritesOnly) labels.push(`♥ ${i18n.t("favorites")}`);
  if (state.filters.availableOnly) labels.push(i18n.t("availableNow"));
  if (state.filters.recommendedOnly) labels.push(i18n.t("recommended"));
  state.filters.dietary.forEach((key) => labels.push(i18n.t(key)));
  state.filters.spicyLevels.forEach((level) => labels.push(level ? "🌶".repeat(level) : i18n.t("notSpicy")));
  return labels;
}

function renderMenu(state) {
  const filtered = filterAndSortMenu(
    state.menuItems,
    state.filters,
    state.favorites,
    state.settings.language
  );
  const visible = filtered.slice(0, state.visibleCount);
  const categoryMap = new Map(state.categories.map((category) => [category.id, category]));
  const favoriteSet = new Set(state.favorites);
  const fragment = document.createDocumentFragment();
  visible.forEach((item) => {
    fragment.append(createMenuCard({
      item,
      category: categoryMap.get(item.categoryId),
      business: state.business,
      settings: state.settings,
      i18n,
      isFavorite: favoriteSet.has(item.id)
    }));
  });
  dom.menuGrid.replaceChildren(fragment);

  dom.menuLoading.hidden = true;
  dom.errorState.hidden = true;
  dom.menuGrid.hidden = visible.length === 0;
  dom.emptyState.hidden = filtered.length !== 0;
  dom.loadMore.hidden = visible.length >= filtered.length;
  dom.resultCount.textContent = `${filtered.length} ${i18n.t(filtered.length === 1 ? "result" : "results")}`;
  dom.clearSearch.hidden = !state.filters.query;

  if (!filtered.length) {
    dom.emptyState.querySelector("h3").textContent = state.filters.favoritesOnly
      ? i18n.t("emptyFavoritesTitle")
      : i18n.t("noResultsTitle");
    dom.emptyState.querySelector("p").textContent = state.filters.favoritesOnly
      ? i18n.t("emptyFavoritesBody")
      : i18n.t("noResultsBody");
  }

  const labels = activeFilterLabels(state);
  clearNode(dom.activeFilterList);
  labels.forEach((label) => dom.activeFilterList.append(element("span", {className: "active-filter-pill", text: label})));
  dom.activeFilters.hidden = labels.length === 0;
  const clearFiltersButton = document.querySelector("#clear-filters-button");
  const clearActionKey = state.filters.favoritesOnly ? "clearFavorites" : "clearAll";
  clearFiltersButton.dataset.i18n = clearActionKey;
  clearFiltersButton.textContent = i18n.t(clearActionKey);
  clearFiltersButton.hidden = state.filters.favoritesOnly && state.favorites.length === 0;
  const filterCount = getActiveFilterCount(state.filters);
  dom.filterCount.textContent = String(filterCount);
  dom.filterCount.hidden = filterCount === 0;
}

function renderCartBadges(state) {
  const count = getCartCount(state.cart);
  document.querySelectorAll("[data-cart-count]").forEach((badge) => {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
  });
}

function syncFilterControls(state) {
  if (document.activeElement !== dom.searchInput) dom.searchInput.value = state.filters.query;
  dom.sortSelect.value = state.filters.sort;
  document.querySelector("#available-filter").checked = state.filters.availableOnly;
  document.querySelector("#recommended-filter").checked = state.filters.recommendedOnly;
  document.querySelectorAll('input[name="dietary"]').forEach((input) => {
    input.checked = state.filters.dietary.includes(input.value);
  });
  document.querySelectorAll('input[name="spicy"]').forEach((input) => {
    input.checked = state.filters.spicyLevels.includes(Number(input.value));
  });
}

function syncSettingsControls(state) {
  document.querySelectorAll('input[name="language"]').forEach((input) => {
    input.checked = input.value === state.settings.language;
  });
  document.querySelectorAll('input[name="currency"]').forEach((input) => {
    input.checked = input.value === state.settings.currency;
  });
  document.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.checked = input.value === state.settings.theme;
  });
  const qrNode = document.querySelector("#menu-qr-code");
  if (qrNode && !qrNode.hasChildNodes() && window.QRCode) {
    const menuUrl = new URL("./", window.location.href).href;
    new window.QRCode(qrNode, {
      text: menuUrl,
      width: 148,
      height: 148,
      colorDark: "#102d23",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M
    });
  }
}

function renderNetwork(state) {
  const online = state.network.online;
  dom.offlineBanner.hidden = online;
  const label = document.querySelector("#network-label");
  label.textContent = i18n.t(online ? "online" : "offline");
  label.classList.toggle("is-offline", !online);
}

function renderOpenDialogs(state) {
  if (dom.detailDialog.open && currentDetailId) {
    openItemDetail(currentDetailId, false);
  }
  if (dom.cartDialog.open) {
    renderCart({
      content: dom.cartContent,
      footer: dom.cartFooter,
      cart: state.cart,
      items: state.menuItems,
      categories: state.categories,
      business: state.business,
      settings: state.settings,
      i18n
    });
  }
  if (dom.orderDialog.open) renderOrderHandoffStatus();
}

function renderAll(state) {
  i18n.setLanguage(state.settings.language);
  i18n.applyDocumentTranslations();
  renderBusiness(state);
  renderPromotions(state);
  renderCategories(state);
  renderMenu(state);
  renderCartBadges(state);
  syncFilterControls(state);
  syncSettingsControls(state);
  renderNetwork(state);
  renderOpenDialogs(state);
}

function updateState(updater, reason) {
  const state = store.setState(updater, reason);
  renderAll(state);
  return state;
}

function openItemDetail(itemId, show = true) {
  const state = store.getState();
  const item = state.menuItems.find((entry) => entry.id === itemId);
  if (!item) return;
  const category = state.categories.find((entry) => entry.id === item.categoryId);
  currentDetailId = itemId;
  if (show) detailQuantity = 1;
  renderItemDetail(dom.detailContent, {
    item,
    category,
    business: state.business,
    settings: state.settings,
    i18n
  });
  const favoriteButton = dom.detailContent.querySelector("[data-favorite]");
  const favorite = state.favorites.includes(itemId);
  favoriteButton.classList.toggle("is-favorite", favorite);
  favoriteButton.querySelector("i").className = `bi ${favorite ? "bi-heart-fill" : "bi-heart"}`;
  favoriteButton.setAttribute("aria-pressed", String(favorite));
  dom.detailContent.querySelector("#detail-quantity").textContent = detailQuantity;
  updateDetailTotal();
  if (show) openDialog(dom.detailDialog);
}

function updateDetailTotal() {
  const state = store?.getState();
  const form = dom.detailContent.querySelector("#detail-form");
  if (!state || !form || !currentDetailId) return;
  const item = state.menuItems.find((entry) => entry.id === currentDetailId);
  if (!item) return;
  const selection = getDetailSelection(form, detailQuantity);
  const cents = unitPriceCents(item, selection.variantId, selection.addOnIds) * detailQuantity;
  const formatted = formatPrice(cents, state.business, state.settings.currency, state.settings.language);
  const total = dom.detailContent.querySelector("#detail-total");
  total.textContent = formatted.secondary ? `${formatted.primary} · ${formatted.secondary}` : formatted.primary;
}

function addSelectionToCart(item, selection) {
  const state = store.getState();
  const maximum = state.business.order?.maxQuantityPerRow || 20;
  const cart = saveCart(addCartRow(state.cart, item, selection, maximum));
  const next = updateState((current) => ({...current, cart}), "cart-add");
  closeDialog(dom.detailDialog);
  showToast(i18n.t("addedToCart"));
  announce(`${getCartCount(next.cart)} ${i18n.t("cartCountAnnouncement")}`);
}

function resetFilters() {
  updateState((state) => ({
    ...state,
    filters: {...DEFAULT_FILTERS},
    visibleCount: PAGE_SIZE
  }), "filters-reset");
}

function applyDialogFilters() {
  const dietary = [...document.querySelectorAll('input[name="dietary"]:checked')].map((input) => input.value);
  const spicyLevels = [...document.querySelectorAll('input[name="spicy"]:checked')].map((input) => Number(input.value));
  updateState((state) => ({
    ...state,
    filters: {
      ...state.filters,
      availableOnly: document.querySelector("#available-filter").checked,
      recommendedOnly: document.querySelector("#recommended-filter").checked,
      dietary,
      spicyLevels
    },
    visibleCount: PAGE_SIZE
  }), "filters-apply");
}

function openCart() {
  const state = store.getState();
  renderCart({
    content: dom.cartContent,
    footer: dom.cartFooter,
    cart: state.cart,
    items: state.menuItems,
    categories: state.categories,
    business: state.business,
    settings: state.settings,
    i18n
  });
  openDialog(dom.cartDialog);
}

function askConfirmation(message, action) {
  pendingConfirmAction = action;
  dom.confirmMessage.textContent = message;
  dom.confirmDialog.returnValue = "";
  openDialog(dom.confirmDialog);
}

function requestClearFavorites() {
  askConfirmation(i18n.t("clearFavoritesConfirm"), () => {
    const favorites = clearFavorites();
    updateState((state) => ({...state, favorites}), "favorites-clear");
    showToast(i18n.t("favoritesCleared"));
  });
}

function persistCartFields() {
  const table = dom.cartContent.querySelector("#cart-table-input");
  const note = dom.cartContent.querySelector("#cart-note-input");
  if (!table && !note) return store.getState().cart;
  const cart = saveCart(updateCartDetails(store.getState().cart, {
    table: table?.value,
    note: note?.value
  }));
  store.setState((state) => ({...state, cart}), "cart-details");
  return cart;
}

function prepareSummary() {
  const state = store.getState();
  const cart = persistCartFields();
  const tableInput = dom.cartContent.querySelector("#cart-table-input");
  if (state.business.order?.requireTableNumber && !cart.table.trim()) {
    tableInput?.focus();
    return;
  }
  const cartSignature = createCartSignature(cart);
  if (cartSignature !== orderSummarySignature) {
    orderSummarySignature = cartSignature;
    orderSummaryReference = createOrderReference();
  }
  if (cartSignature !== notedOrderSignature) {
    orderNotedAt = null;
    notedOrderSignature = "";
  }
  const summary = buildOrderSummary({
    cart,
    items: state.menuItems,
    business: state.business,
    settings: state.settings,
    i18n,
    reference: orderSummaryReference
  });
  dom.orderSummary.replaceChildren(summary.node);
  renderOrderHandoffStatus();
  closeDialog(dom.cartDialog);
  openDialog(dom.orderDialog);
}

function renderOrderHandoffStatus() {
  const noted = orderNotedAt instanceof Date;
  const time = noted
    ? orderNotedAt.toLocaleTimeString(i18n.language === "km" ? "km-KH" : "en-US", {hour: "numeric", minute: "2-digit"})
    : "";
  const messageKey = noted ? "orderNotedNotice" : "notSentNotice";
  const actionKey = noted ? "startNewOrder" : "staffNotedAction";

  dom.orderStatus.classList.toggle("order-status--success", noted);
  dom.orderStatusIcon.className = `bi ${noted ? "bi-check-circle-fill" : "bi-info-circle"}`;
  dom.orderStatusMessage.dataset.i18n = messageKey;
  dom.orderStatusMessage.textContent = i18n.t(messageKey, {time});
  dom.undoOrderNotedButton.hidden = !noted;
  dom.orderSummaryCloseButton.hidden = !noted;

  const icon = dom.orderHandoffButton.querySelector("i");
  const label = dom.orderHandoffButton.querySelector("span");
  icon.className = `bi ${noted ? "bi-plus-circle" : "bi-check2-circle"}`;
  label.dataset.i18n = actionKey;
  label.textContent = i18n.t(actionKey);
}

function startNewOrder() {
  const cart = saveCart(emptyCart());
  orderNotedAt = null;
  notedOrderSignature = "";
  orderSummarySignature = "";
  orderSummaryReference = "";
  dom.orderSummary.replaceChildren();
  updateState((state) => ({...state, cart}), "new-order");
  closeDialog(dom.orderDialog);
  showToast(i18n.t("newOrderStarted"));
  announce(i18n.t("newOrderStarted"));
}

function handleSettingsChange(input) {
  if (!["language", "currency", "theme"].includes(input.name)) return;
  persistSetting(input.name, input.value);
  updateState((state) => ({
    ...state,
    settings: {...state.settings, [input.name]: input.value}
  }), `settings-${input.name}`);
}

function setActiveNavigationItem(item) {
  const navigation = item.closest(".mobile-nav, .desktop-nav");
  if (!navigation) return;

  navigation.querySelectorAll(".mobile-nav__item, a").forEach((candidate) => {
    const active = candidate === item;
    candidate.classList.toggle("active", active);
    if (active) candidate.setAttribute("aria-current", "page");
    else candidate.removeAttribute("aria-current");
  });
}

function handleDocumentClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const button = target.closest("button, a");
  if (!button) {
    const menuCard = target.closest("[data-menu-card][data-open-item]");
    if (menuCard) openItemDetail(menuCard.dataset.openItem);
    return;
  }

  if (button.matches(".mobile-nav__item, .desktop-nav a")) {
    setActiveNavigationItem(button);
  }

  if (button.matches("[data-open-cart]")) {
    event.preventDefault();
    openCart();
    return;
  }
  if (button.matches("[data-close-dialog]")) {
    closeDialog(button.closest("dialog"));
    return;
  }
  if (button.matches("[data-continue-browsing]")) {
    closeDialog(dom.cartDialog);
    document.querySelector("#menu").scrollIntoView({behavior: "smooth"});
    return;
  }
  if (button.matches("[data-show-menu]")) {
    dismissWelcomeScreen();
    if (store.getState().filters.favoritesOnly) {
      updateState((state) => ({
        ...state,
        filters: {...state.filters, favoritesOnly: false},
        visibleCount: PAGE_SIZE
      }), "menu-view");
    }
    return;
  }
  if (button.dataset.openItem) {
    openItemDetail(button.dataset.openItem);
    return;
  }
  if (button.dataset.quickAdd) {
    const item = store.getState().menuItems.find((entry) => entry.id === button.dataset.quickAdd);
    if (item?.flags?.available) addSelectionToCart(item, {quantity: 1, addOnIds: [], note: "", variantId: ""});
    return;
  }
  if (button.dataset.favorite) {
    const itemId = button.dataset.favorite;
    const wasFavorite = store.getState().favorites.includes(itemId);
    const favorites = toggleFavorite(store.getState().favorites, itemId);
    updateState((state) => ({...state, favorites}), "favorite-toggle");
    showToast(i18n.t(wasFavorite ? "removedFavorite" : "addedFavorite"), wasFavorite ? "bi-heart" : "bi-heart-fill");
    return;
  }
  if (button.dataset.category) {
    updateState((state) => ({
      ...state,
      filters: {...state.filters, categoryId: button.dataset.category},
      visibleCount: PAGE_SIZE
    }), "category");
    return;
  }
  if (button.matches("[data-reset-filters]")) {
    resetFilters();
    return;
  }
  if (button.matches("[data-show-favorites]")) {
    updateState((state) => ({
      ...state,
      filters: {...DEFAULT_FILTERS, favoritesOnly: true},
      visibleCount: PAGE_SIZE
    }), "favorites-view");
    closeDialog(dom.settingsDialog);
    document.querySelector("#menu").scrollIntoView({behavior: "smooth"});
    announce(i18n.t("showingFavorites"));
    return;
  }
  if (button.dataset.detailQty) {
    const maximum = store.getState().business.order?.maxQuantityPerRow || 20;
    const delta = button.dataset.detailQty === "increase" ? 1 : -1;
    const next = Math.max(1, Math.min(maximum, detailQuantity + delta));
    if (next === detailQuantity && delta > 0) showToast(i18n.t("maxQuantity"), "bi-info-circle");
    detailQuantity = next;
    dom.detailContent.querySelector("#detail-quantity").textContent = String(detailQuantity);
    updateDetailTotal();
    return;
  }
  if (button.dataset.detailAdd) {
    const state = store.getState();
    const item = state.menuItems.find((entry) => entry.id === button.dataset.detailAdd);
    const form = dom.detailContent.querySelector("#detail-form");
    if (!item || !form) return;
    const selection = getDetailSelection(form, detailQuantity);
    if (item.variants?.length && !selection.variantId) {
      const error = form.querySelector("#variant-error");
      error.hidden = false;
      form.querySelector('input[name="variant"]:not(:disabled)')?.focus();
      return;
    }
    addSelectionToCart(item, selection);
    return;
  }
  if (button.dataset.cartQty) {
    const state = store.getState();
    const maximum = state.business.order?.maxQuantityPerRow || 20;
    const row = state.cart.rows.find((entry) => entry.key === button.dataset.rowKey);
    const delta = button.dataset.cartQty === "increase" ? 1 : -1;
    if (row && delta > 0 && row.quantity >= maximum) {
      showToast(i18n.t("maxQuantity"), "bi-info-circle");
      return;
    }
    const cart = saveCart(changeCartQuantity(state.cart, button.dataset.rowKey, delta, maximum));
    updateState((current) => ({...current, cart}), "cart-quantity");
    return;
  }
  if (button.dataset.removeRow) {
    const cart = saveCart(removeCartRow(store.getState().cart, button.dataset.removeRow));
    updateState((state) => ({...state, cart}), "cart-remove");
    return;
  }
  if (button.matches("[data-prepare-summary]")) {
    prepareSummary();
  }
}

function attachEvents() {
  document.addEventListener("click", handleDocumentClick);
  const debouncedPersistCart = debounce(persistCartFields, 250);
  document.addEventListener("input", (event) => {
    if (event.target.matches("#cart-table-input, #cart-note-input")) {
      debouncedPersistCart();
    }
  });
  document.addEventListener("change", (event) => {
    const input = event.target;
    if (input.closest("#settings-dialog")) handleSettingsChange(input);
    if (input.closest("#detail-form")) updateDetailTotal();
    if (input.matches("#cart-table-input, #cart-note-input")) {
      debouncedPersistCart.cancel();
      persistCartFields();
    }
  });

  const updateSearch = debounce((value) => {
    updateState((state) => ({
      ...state,
      filters: {...state.filters, query: value},
      visibleCount: PAGE_SIZE
    }), "search");
  }, SEARCH_DEBOUNCE_MS);
  dom.searchInput.addEventListener("input", (event) => updateSearch(event.target.value));
  dom.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && event.currentTarget.value) {
      updateSearch.cancel();
      event.currentTarget.value = "";
      updateState((state) => ({
        ...state,
        filters: {...state.filters, query: ""},
        visibleCount: PAGE_SIZE
      }), "search-clear");
    }
  });
  dom.clearSearch.addEventListener("click", () => {
    updateSearch.cancel();
    dom.searchInput.value = "";
    updateState((state) => ({
      ...state,
      filters: {...state.filters, query: ""},
      visibleCount: PAGE_SIZE
    }), "search-clear");
    dom.searchInput.focus();
  });
  dom.sortSelect.addEventListener("change", (event) => {
    updateState((state) => ({
      ...state,
      filters: {...state.filters, sort: event.target.value},
      visibleCount: PAGE_SIZE
    }), "sort");
  });

  document.querySelector("#filter-button").addEventListener("click", () => openDialog(dom.filterDialog));
  document.querySelector("#apply-filters-button").addEventListener("click", applyDialogFilters);
  document.querySelector("#dialog-clear-filters").addEventListener("click", () => {
    document.querySelector("#available-filter").checked = false;
    document.querySelector("#recommended-filter").checked = false;
    document.querySelectorAll('input[name="dietary"], input[name="spicy"]').forEach((input) => {
      input.checked = false;
    });
  });
  document.querySelector("#clear-filters-button").addEventListener("click", () => {
    if (store.getState().filters.favoritesOnly) {
      requestClearFavorites();
      return;
    }
    resetFilters();
  });
  dom.loadMore.addEventListener("click", () => {
    updateState((state) => ({...state, visibleCount: state.visibleCount + PAGE_SIZE}), "load-more");
  });

  dom.welcomeEnterBtn?.addEventListener("click", () => {
    dismissWelcomeScreen();
    document.querySelector("#menu")?.scrollIntoView({behavior: "smooth"});
  });

  dom.welcomeLangKm?.addEventListener("click", () => {
    if (store.getState().settings.language !== "km") {
      persistSetting("language", "km");
      updateState((state) => ({...state, settings: {...state.settings, language: "km"}}), "language");
    }
  });

  dom.welcomeLangEn?.addEventListener("click", () => {
    if (store.getState().settings.language !== "en") {
      persistSetting("language", "en");
      updateState((state) => ({...state, settings: {...state.settings, language: "en"}}), "language");
    }
  });

  document.querySelector("#language-button").addEventListener("click", () => {
    const language = store.getState().settings.language === "km" ? "en" : "km";
    persistSetting("language", language);
    updateState((state) => ({...state, settings: {...state.settings, language}}), "language");
  });
  document.querySelector("#theme-button").addEventListener("click", () => {
    const currentPreference = store.getState().settings.theme;
    const theme = getThemeToggleTarget(resolveTheme(currentPreference));
    persistSetting("theme", theme);
    updateState((state) => ({...state, settings: {...state.settings, theme}}), "theme");
  });
  document.querySelector("#settings-button").addEventListener("click", () => openDialog(dom.settingsDialog));

  document.querySelector("#clear-cart-settings").addEventListener("click", () => {
    askConfirmation(i18n.t("clearCartConfirm"), () => {
      const cart = saveCart(emptyCart());
      updateState((state) => ({...state, cart}), "cart-clear");
      showToast(i18n.t("cartCleared"));
    });
  });
  document.querySelector("#clear-favorites-settings").addEventListener("click", requestClearFavorites);
  dom.confirmDialog.addEventListener("close", () => {
    if (dom.confirmDialog.returnValue === "confirm") pendingConfirmAction?.();
    pendingConfirmAction = null;
  });

  dom.orderHandoffButton.addEventListener("click", () => {
    if (orderNotedAt) {
      askConfirmation(i18n.t("startNewOrderConfirm"), startNewOrder);
      return;
    }
    orderNotedAt = new Date();
    notedOrderSignature = orderSummarySignature || createCartSignature(store.getState().cart);
    renderOrderHandoffStatus();
  });
  dom.undoOrderNotedButton.addEventListener("click", () => {
    orderNotedAt = null;
    notedOrderSignature = "";
    renderOrderHandoffStatus();
    dom.orderHandoffButton.focus();
  });
  dom.updateButton.addEventListener("click", activateWaitingWorker);

  [dom.filterDialog, dom.detailDialog, dom.cartDialog, dom.orderDialog, dom.settingsDialog, dom.confirmDialog]
    .forEach(closeOnBackdrop);

  window.addEventListener("online", () => {
    updateState((state) => ({...state, network: {online: true}}), "online");
    announce(i18n.t("online"));
  });
  window.addEventListener("offline", () => {
    updateState((state) => ({...state, network: {online: false}}), "offline");
    announce(i18n.t("offlineMessage"));
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (store.getState().settings.theme === "system") renderAll(store.getState());
  });
}

function showLoadError(error) {
  console.error("[app] Initialization failed:", error);
  dom.menuLoading.hidden = true;
  dom.menuGrid.hidden = true;
  dom.emptyState.hidden = true;
  dom.errorState.hidden = false;
  dom.errorMessage.textContent = i18n?.t("loadErrorBody") || "The menu could not be loaded. Check your connection and try again.";
}

async function bootstrap() {
  document.querySelector("#current-year").textContent = String(new Date().getFullYear());
  const data = await loadLocalData();
  const settings = loadSettings(data.business);
  i18n = createI18n(data.translations, settings.language);
  const favorites = loadFavorites(data.menuItems.map((item) => item.id));
  const cart = loadCart(data.menuItems, data.business.order?.maxQuantityPerRow);
  store = createStore({
    ...data,
    settings,
    favorites,
    cart,
    network: {online: navigator.onLine},
    filters: {...DEFAULT_FILTERS},
    visibleCount: PAGE_SIZE
  });

  attachEvents();
  renderAll(store.getState());
  setupInstallPrompt({
    button: dom.installButton,
    onInstalled: () => showToast(i18n.t("installed")),
    onUnavailable: () => showToast(i18n.t("installUnavailable"), "bi-info-circle")
  });

  currentDataSignature = createDataSignature(data);

  const showUpdateNotification = () => {
    dom.updateBanner.hidden = false;
    announce(i18n.t("updateReady"));
  };

  const checkForDataUpdates = async () => {
    if (!navigator.onLine) return;
    try {
      const fresh = await fetchFreshLocalData();
      if (!fresh) return;
      const freshSig = createDataSignature(fresh);
      if (currentDataSignature && freshSig && freshSig !== currentDataSignature) {
        currentDataSignature = freshSig;
        updateState((state) => ({
          ...state,
          business: fresh.business,
          categories: fresh.categories,
          menuItems: fresh.menuItems,
          promotions: fresh.promotions,
          translations: fresh.translations
        }), "data-live-sync");
        showToast(i18n.t("updateReady"), "bi-arrow-repeat");
        announce(i18n.t("updateReady"));
      }
    } catch {
      // Ignore network failures
    }
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "DATA_CACHE_UPDATED") {
        checkForDataUpdates();
      }
    });
  }

  window.addEventListener("focus", checkForDataUpdates);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForDataUpdates();
  });
  window.addEventListener("online", checkForDataUpdates);
  window.setInterval(checkForDataUpdates, 30000);

  // Trigger an initial freshness check in background
  window.setTimeout(checkForDataUpdates, 1500);

  await registerServiceWorker({
    onUpdateReady: showUpdateNotification
  });
}

dom.retryButton.addEventListener("click", () => window.location.reload());
bootstrap().catch(showLoadError);
