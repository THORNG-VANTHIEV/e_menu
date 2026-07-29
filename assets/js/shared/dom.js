import {IMAGE_PLACEHOLDER} from "../config.js";

export function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([name, value]) => {
      if (value !== false && value !== null && value !== undefined) {
        node.setAttribute(name, value === true ? "" : String(value));
      }
    });
  }
  if (options.dataset) Object.assign(node.dataset, options.dataset);
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child) node.append(child);
  }
  return node;
}

export function clearNode(node) {
  node.replaceChildren();
  return node;
}

export function setImageFallback(image) {
  image.addEventListener("error", () => {
    if (!image.src.endsWith(IMAGE_PLACEHOLDER.replace("./", ""))) {
      image.src = IMAGE_PLACEHOLDER;
    }
  }, {once: true});
  return image;
}

export function safeExternalUrl(rawUrl, protocols = ["https:", "tel:"]) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const parsed = new URL(rawUrl, window.location.href);
    return protocols.includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

export function debounce(callback, delay = 200) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

export function openDialog(dialog) {
  if (dialog && !dialog.open) dialog.showModal();
}

export function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

export function closeOnBackdrop(dialog) {
  dialog?.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isInside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!isInside) dialog.close();
  });
}
