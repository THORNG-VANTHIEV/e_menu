import {element, setImageFallback} from "../../shared/dom.js";
import {formatPrice} from "../../shared/currency.js";
import {getCartTotals} from "./cart-service.js";

function icon(name) {
  return element("i", {className: `bi ${name}`, attrs: {"aria-hidden": "true"}});
}

function displayPrice(cents, business, settings) {
  const value = formatPrice(cents, business, settings.currency, settings.language);
  return value.secondary ? `${value.primary} · ${value.secondary}` : value.primary;
}

function quantityStepper(row, t) {
  const stepper = element("div", {className: "quantity-stepper", attrs: {"aria-label": t("quantity")}});
  stepper.append(
    element("button", {
      attrs: {type: "button", "aria-label": "Decrease quantity"},
      dataset: {cartQty: "decrease", rowKey: row.key}
    }, icon("bi-dash")),
    element("span", {text: row.quantity}),
    element("button", {
      attrs: {type: "button", "aria-label": "Increase quantity"},
      dataset: {cartQty: "increase", rowKey: row.key}
    }, icon("bi-plus"))
  );
  return stepper;
}

function rowOptions(row, item, localize, t) {
  const labels = [];
  const variant = item.variants?.find((entry) => entry.id === row.variantId);
  if (variant) labels.push(localize(variant.name));
  row.addOnIds.forEach((id) => {
    const addOn = item.addOns?.find((entry) => entry.id === id);
    if (addOn) labels.push(`+ ${localize(addOn.name)}`);
  });
  if (row.note) labels.push(`${t("note")}: ${row.note}`);
  return labels.join(" · ");
}

export function renderCart({content, footer, cart, items, business, settings, i18n}) {
  const {t, localize} = i18n;
  const itemMap = new Map(items.map((item) => [item.id, item]));
  content.replaceChildren();
  footer.replaceChildren();

  if (!cart.rows.length) {
    const empty = element("div", {className: "state-card"});
    empty.append(
      element("span", {className: "state-card__icon"}, icon("bi-bag")),
      element("h3", {text: t("emptyCartTitle")}),
      element("p", {text: t("emptyCartBody")}),
      element("button", {
        className: "btn btn-primary",
        text: t("continueBrowsing"),
        attrs: {type: "button"},
        dataset: {continueBrowsing: ""}
      })
    );
    content.append(empty);
    footer.hidden = true;
    return;
  }

  const list = element("div", {className: "cart-list"});
  cart.rows.forEach((row) => {
    const item = itemMap.get(row.itemId);
    if (!item) return;
    const card = element("article", {className: "cart-row"});
    card.append(setImageFallback(element("img", {
      className: "cart-row__image",
      attrs: {src: item.image, alt: localize(item.name), width: "144", height: "144", loading: "lazy"}
    })));
    const body = element("div", {className: "cart-row__body"});
    const heading = element("div", {className: "cart-row__heading"});
    heading.append(
      element("h3", {text: localize(item.name)}),
      element("button", {
        className: "remove-row",
        attrs: {type: "button", "aria-label": `${t("remove")} ${localize(item.name)}`},
        dataset: {removeRow: row.key}
      }, [icon("bi-trash3"), document.createTextNode(` ${t("remove")}`)])
    );
    body.append(heading);
    const options = rowOptions(row, item, localize, t);
    if (options) body.append(element("p", {className: "cart-row__options", text: options}));
    const rowFooter = element("div", {className: "cart-row__footer"});
    rowFooter.append(
      quantityStepper(row, t),
      element("span", {
        className: "cart-row__price",
        text: displayPrice(row.unitPriceCents * row.quantity, business, settings)
      })
    );
    body.append(rowFooter);
    card.append(body);
    list.append(card);
  });

  const fields = element("div", {className: "order-fields"});
  const tableLabel = element("label", {className: "field"});
  tableLabel.append(
    element("span", {text: t("tableNumber")}),
    element("input", {
      attrs: {
        id: "cart-table-input",
        type: "text",
        maxlength: "60",
        value: cart.table,
        placeholder: t("tablePlaceholder"),
        required: business.order?.requireTableNumber
      }
    })
  );
  const noteLabel = element("label", {className: "field"});
  noteLabel.append(
    element("span", {text: t("orderNote")}),
    element("textarea", {
      attrs: {id: "cart-note-input", maxlength: "500", placeholder: t("orderNotePlaceholder")}
    })
  );
  noteLabel.querySelector("textarea").value = cart.note;
  fields.append(tableLabel, noteLabel);
  content.append(list, fields);

  const totals = getCartTotals(cart, business);
  const totalsNode = element("div", {className: "cart-totals"});
  const subtotal = element("div");
  subtotal.append(element("span", {text: t("subtotal")}), element("strong", {text: displayPrice(totals.subtotalCents, business, settings)}));
  totalsNode.append(subtotal);
  if (totals.discountCents) {
    const discount = element("div", {className: "cart-totals__discount"});
    discount.append(element("span", {text: `${t("discount")} (${business.order.discountPercent}%)`}), element("strong", {text: `− ${displayPrice(totals.discountCents, business, settings)}`}));
    totalsNode.append(discount);
  }
  const grand = element("div", {className: "cart-totals__grand"});
  grand.append(element("strong", {text: t("total")}), element("strong", {text: displayPrice(totals.totalCents, business, settings)}));
  totalsNode.append(grand);

  const action = element("button", {
    className: "btn btn-primary",
    attrs: {type: "button"},
    dataset: {prepareSummary: ""}
  }, [document.createTextNode(t("prepareSummary")), icon("bi-arrow-right")]);
  footer.append(totalsNode, action);
  footer.hidden = false;
}

export function buildOrderSummary({cart, items, business, settings, i18n, reference, date = new Date()}) {
  const {t, localize} = i18n;
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const root = element("div");
  const brand = element("div", {className: "order-summary__brand"});
  const brandText = element("div");
  brandText.append(
    element("h3", {text: localize(business.name)}),
    element("p", {text: date.toLocaleString(settings.language === "km" ? "km-KH" : "en-US", {dateStyle: "medium", timeStyle: "short"})})
  );
  brand.append(element("img", {attrs: {src: business.logo, alt: "", width: "46", height: "46"}}), brandText);

  const meta = element("div", {className: "summary-meta"});
  const ref = element("div");
  ref.append(element("span", {text: t("orderRef")}), element("strong", {text: reference}));
  const table = element("div");
  table.append(element("span", {text: t("table")}), element("strong", {text: cart.table || "—"}));
  meta.append(ref, table);

  const list = element("div", {className: "summary-items"});
  const textLines = [
    localize(business.name),
    `${t("orderRef")}: ${reference}`,
    `${t("table")}: ${cart.table || "—"}`,
    "—"
  ];
  cart.rows.forEach((row) => {
    const item = itemMap.get(row.itemId);
    if (!item) return;
    const options = rowOptions(row, item, localize, t);
    const line = element("div", {className: "summary-item"});
    line.append(
      element("strong", {text: `${row.quantity} × ${localize(item.name)}`}),
      element("span", {text: displayPrice(row.unitPriceCents * row.quantity, business, settings)})
    );
    if (options) line.append(element("small", {text: options}));
    list.append(line);
    textLines.push(`${row.quantity} × ${localize(item.name)} — ${displayPrice(row.unitPriceCents * row.quantity, business, settings)}`);
    if (options) textLines.push(`  ${options}`);
  });

  const totals = getCartTotals(cart, business);
  const totalsNode = element("div", {className: "cart-totals"});
  [
    [t("subtotal"), totals.subtotalCents],
    ...(totals.discountCents ? [[`${t("discount")} (${business.order.discountPercent}%)`, -totals.discountCents]] : []),
    [t("total"), totals.totalCents]
  ].forEach(([label, cents], index, values) => {
    const row = element("div", {className: index === values.length - 1 ? "cart-totals__grand" : ""});
    const formatted = `${cents < 0 ? "− " : ""}${displayPrice(Math.abs(cents), business, settings)}`;
    row.append(element(index === values.length - 1 ? "strong" : "span", {text: label}), element("strong", {text: formatted}));
    totalsNode.append(row);
    textLines.push(`${label}: ${formatted}`);
  });

  if (cart.note) {
    const note = element("p", {className: "summary-note"});
    note.append(element("strong", {text: `${t("note")}: `}), document.createTextNode(cart.note));
    totalsNode.append(note);
    textLines.push(`${t("note")}: ${cart.note}`);
  }
  textLines.push("", t("notSentNotice"));
  root.append(brand, meta, list, totalsNode);
  return {node: root, text: textLines.join("\n")};
}
