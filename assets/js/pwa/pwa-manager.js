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

  // On VS Code Live Server (port 5500/5501), unregister Service Worker to prevent
  // local single-threaded dev server WebSocket / socket lockups on page refresh.
  const isLiveServer = window.location.port === "5500"
    || window.location.port === "5501"
    || window.location.search.includes("dev=true");

  if (isLiveServer) {
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
