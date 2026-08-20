let deferredInstallPrompt = null;
let waitingWorker = null;
let refreshRequested = false;

export function setupInstallPrompt({button, onInstalled, onUnavailable}) {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    button.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    button.hidden = true;
    onInstalled?.();
  });

  button.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      onUnavailable?.();
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    button.hidden = true;
  });
}

export async function registerServiceWorker({onUpdateReady, onError}) {
  if (!("serviceWorker" in navigator)) return null;

  // On local development servers (VS Code Live Server, python http.server, dev),
  // unregister Service Worker to prevent old worker caching during development.
  const isDevHost = window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
    || window.location.port === "5500"
    || window.location.port === "5501"
    || window.location.port === "5502"
    || window.location.port === "4173"
    || window.location.search.includes("dev=true");

  if (isDevHost) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    } catch {
      // Ignore unregister errors in dev
    }
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js", {
      updateViaCache: "none"
    });
    if (navigator.onLine) {
      registration.update().catch(() => {});
    }
    if (registration.waiting) {
      waitingWorker = registration.waiting;
      onUpdateReady?.();
    }
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting || installing;
          onUpdateReady?.();
        }
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshRequested) window.location.reload();
    });

    const triggerUpdate = () => {
      if (navigator.onLine) {
        registration.update().catch(() => {});
      }
    };

    window.addEventListener("focus", triggerUpdate);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") triggerUpdate();
    });
    window.addEventListener("online", triggerUpdate);
    window.setInterval(triggerUpdate, 60000);

    return registration;
  } catch (error) {
    console.warn("[pwa] Service worker registration failed:", error);
    onError?.(error);
    return null;
  }
}

export function activateWaitingWorker() {
  refreshRequested = true;
  if (waitingWorker) {
    waitingWorker.postMessage({type: "SKIP_WAITING"});
    window.setTimeout(() => window.location.reload(), 800);
    return true;
  }
  window.location.reload();
  return true;
}
