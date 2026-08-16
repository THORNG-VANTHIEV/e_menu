import {element, setImageFallback} from "../../shared/dom.js";
import {formatPrice, getItemStartingPriceCents, toCents} from "../../shared/currency.js";

function icon(name, className = "") {
  return element("i", {className: `bi ${name} ${className}`.trim(), attrs: {"aria-hidden": "true"}});
}

function priceStack(cents, business, settings) {
  const price = formatPrice(cents, business, settings.currency, settings.language);
  const stack = element("span", {className: "price-stack"});
  stack.append(element("strong", {text: price.primary}));
  if (price.secondary) stack.append(element("small", {text: price.secondary}));
  return stack;
}

function itemBadges(item, t) {
  const wrapper = element("div", {className: "menu-card__badges"});
  if (!item.flags?.available) {
    wrapper.append(element("span", {className: "item-badge item-badge--sold", text: t("soldOut")}));
    return wrapper;
  }
  if (item.flags?.popular) {
    wrapper.append(element("span", {className: "item-badge"}, [icon("bi-graph-up-arrow"), document.createTextNode(t("popular"))]));
  } else if (item.flags?.new) {
    wrapper.append(element("span", {className: "item-badge"}, [icon("bi-stars"), document.createTextNode(t("new"))]));
  } else if (item.flags?.recommended) {
    wrapper.append(element("span", {className: "item-badge"}, [icon("bi-award"), document.createTextNode(t("recommended"))]));
  }
  return wrapper;
}

function createMediaVisual(item, category, localize, isDetail = false) {
  if (item.image) {
    return setImageFallback(element("img", {
      attrs: {
        src: item.image,
        alt: localize(item.name),
        width: "960",
        height: "720",
        loading: isDetail ? "eager" : "lazy",
        decoding: "async"
      }
    }));
  }
  const prefix = isDetail ? "detail-media" : "menu-card";
  const placeholder = element("div", {className: `${prefix}__placeholder`});
  const iconWrap = element("div", {className: `${prefix}__placeholder-icon`});
  iconWrap.append(element("i", {
    className: `bi ${category?.icon || "bi-egg-fried"}`,
    attrs: {"aria-hidden": "true"}
  }));
  placeholder.append(iconWrap);
  return placeholder;
}

export function createMenuCard({item, category, business, settings, i18n, isFavorite}) {
  const {t, localize} = i18n;
  const card = element("article", {
    className: `menu-card${item.flags?.available ? "" : " is-unavailable"}`,
    dataset: {menuCard: item.id, openItem: item.id}
  });
  const media = element("div", {className: "menu-card__media"});
  const visual = createMediaVisual(item, category, localize, false);
  const favorite = element("button", {
    className: `favorite-button${isFavorite ? " is-favorite" : ""}`,
    attrs: {
      type: "button",
      "aria-label": isFavorite ? t("removedFavorite") : t("addedFavorite"),
      title: t("favorites"),
      "aria-pressed": String(isFavorite)
    },
    dataset: {favorite: item.id}
  }, icon(isFavorite ? "bi-heart-fill" : "bi-heart"));
  media.append(visual, itemBadges(item, t), favorite);

  const body = element("div", {className: "menu-card__body"});
  body.append(element("p", {
    className: "menu-card__category",
    text: localize(category?.name) || t("menu")
  }));
  const heading = element("h3");
  const openButton = element("button", {
    className: "menu-card__open",
    text: localize(item.name),
    attrs: {type: "button"},
    dataset: {openItem: item.id}
  });
  heading.append(openButton);
  body.append(
    heading,
    element("p", {className: "menu-card__description", text: localize(item.description)})
  );

  const footer = element("div", {className: "menu-card__footer"});
  const pricing = priceStack(getItemStartingPriceCents(item), business, settings);
  if (item.variants?.length) {
    pricing.querySelector("strong").prepend(`${t("from")} `);
  }
  const requiresDetail = (item.variants || []).length > 0;
  const action = element("button", {
    className: "quick-add",
    attrs: {
      type: "button",
      "aria-label": `${requiresDetail ? t("viewDetails") : t("add")} ${localize(item.name)}`,
      title: requiresDetail ? t("viewDetails") : t("add"),
      disabled: !item.flags?.available
    },
    dataset: requiresDetail ? {openItem: item.id} : {quickAdd: item.id}
  }, icon(requiresDetail ? "bi-arrow-up-right" : "bi-plus-lg"));
  footer.append(pricing, action);
  body.append(footer);
  card.append(media, body);
  return card;
}

function createOptionRow({type, name, value, label, price, checked, disabled}) {
  const row = element("label", {className: "option-row"});
  row.append(
    element("input", {
      attrs: {type, name, value, checked, disabled}
    }),
    element("span", {text: label})
  );
  if (price) row.append(element("small", {text: price}));
  return row;
}

export function renderItemDetail(container, {item, category, business, settings, i18n}) {
  const {t, localize} = i18n;
  const availableVariants = (item.variants || []).filter((variant) => variant.available);
  const selectedVariant = availableVariants.find((variant) => variant.default) || availableVariants[0] || null;

  const media = element("div", {className: "detail-media"});
  media.append(
    createMediaVisual(item, category, localize, true),
    element("button", {
      className: "icon-button",
      attrs: {type: "button", "aria-label": "Close", title: "Close"},
      dataset: {closeDialog: ""}
    }, icon("bi-x-lg"))
  );

  const body = element("div", {className: "detail-body"});
  const heading = element("div", {className: "detail-heading"});
  const titleWrap = element("div");
  titleWrap.append(
    element("h2", {text: localize(item.name), attrs: {id: "detail-title"}}),
    priceStack(getItemStartingPriceCents(item), business, settings)
  );
  const headingActions = element("div", {className: "detail-heading__actions"});
  const favorite = element("button", {
    className: "icon-button",
    attrs: {type: "button", "aria-label": t("favorites"), title: t("favorites")},
    dataset: {favorite: item.id}
  }, icon("bi-heart"));
  const desktopClose = element("button", {
    className: "icon-button detail-close-btn",
    attrs: {type: "button", "aria-label": "Close", title: "Close"},
    dataset: {closeDialog: ""}
  }, icon("bi-x-lg"));
  headingActions.append(favorite, desktopClose);
  heading.append(titleWrap, headingActions);
  body.append(heading, element("p", {className: "detail-description", text: localize(item.description)}));

  const meta = element("div", {className: "detail-meta"});
  const ingredients = element("p");
  ingredients.append(element("strong", {text: `${t("ingredients")}:`}), document.createTextNode(` ${localize(item.ingredients) || t("unknown")}`));
  const allergens = element("p");
  allergens.append(
    element("strong", {text: `${t("allergens")}:`}),
    document.createTextNode(` ${(item.allergens || []).join(", ") || t("noAllergens")}`)
  );
  meta.append(ingredients, allergens);
  body.append(meta);

  const form = element("form", {attrs: {id: "detail-form"}, dataset: {itemId: item.id}});
  if (item.variants?.length) {
    const variants = element("fieldset", {className: "option-group"});
    variants.append(element("legend", {text: t("chooseSize")}));
    item.variants.forEach((variant) => {
      const delta = toCents(variant.priceDelta);
      const formatted = delta ? formatPrice(delta, business, settings.currency, settings.language).primary : "";
      variants.append(createOptionRow({
        type: "radio",
        name: "variant",
        value: variant.id,
        label: localize(variant.name),
        price: delta ? `+ ${formatted}` : "",
        checked: variant.id === selectedVariant?.id,
        disabled: !variant.available
      }));
    });
    variants.append(element("p", {className: "form-error", attrs: {id: "variant-error", hidden: true}, text: t("selectionRequired")}));
    form.append(variants);
  }

  if (item.addOns?.length) {
    const addOns = element("fieldset", {className: "option-group"});
    addOns.append(element("legend", {text: t("addOns")}));
    item.addOns.forEach((addOn) => {
      const formatted = formatPrice(toCents(addOn.price), business, settings.currency, settings.language).primary;
      addOns.append(createOptionRow({
        type: "checkbox",
        name: "add-on",
        value: addOn.id,
        label: `${localize(addOn.name)}${addOn.available ? "" : ` — ${t("soldOut")}`}`,
        price: `+ ${formatted}`,
        disabled: !addOn.available
      }));
    });
    form.append(addOns);
  }

  const noteLabel = element("label", {className: "detail-note"});
  noteLabel.append(
    element("span", {text: t("itemNote")}),
    element("textarea", {
      attrs: {name: "item-note", maxlength: "240", placeholder: t("itemNotePlaceholder")}
    })
  );
  form.append(noteLabel);
  body.append(form);

  const footer = element("footer", {className: "detail-footer"});
  const stepper = element("div", {className: "quantity-stepper", attrs: {"aria-label": t("quantity")}});
  stepper.append(
    element("button", {attrs: {type: "button", "aria-label": "Decrease quantity"}, dataset: {detailQty: "decrease"}}, icon("bi-dash")),
    element("span", {text: "1", attrs: {id: "detail-quantity", "aria-live": "polite"}}),
    element("button", {attrs: {type: "button", "aria-label": "Increase quantity"}, dataset: {detailQty: "increase"}}, icon("bi-plus"))
  );
  const addButton = element("button", {
    className: "btn btn-primary",
    attrs: {type: "button", disabled: !item.flags?.available},
    dataset: {detailAdd: item.id}
  });
  addButton.append(
    element("span", {text: item.flags?.available ? t("addToCart") : t("soldOut")}),
    element("strong", {attrs: {id: "detail-total"}, text: formatPrice(
      getItemStartingPriceCents(item),
      business,
      settings.currency,
      settings.language
    ).primary})
  );
  footer.append(stepper, addButton);
  container.replaceChildren(media, body, footer);
}

export function getDetailSelection(form, quantity) {
  const formData = new FormData(form);
  return {
    variantId: String(formData.get("variant") || ""),
    addOnIds: formData.getAll("add-on").map(String),
    note: String(formData.get("item-note") || ""),
    quantity
  };
}
