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
  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js");
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
    return registration;
  } catch (error) {
    console.warn("[pwa] Service worker registration failed:", error);
    onError?.(error);
    return null;
  }
}

export function activateWaitingWorker() {
  if (!waitingWorker) return false;
  refreshRequested = true;
  waitingWorker.postMessage({type: "SKIP_WAITING"});
  return true;
}
