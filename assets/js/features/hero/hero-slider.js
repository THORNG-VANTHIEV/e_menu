export const HERO_SLIDE_INTERVAL_MS = 10_000;

const MIN_SWIPE_DISTANCE_PX = 48;
const SWIPE_WIDTH_RATIO = 0.12;
const MAX_SWIPE_DISTANCE_PX = 120;

function wrapIndex(index, total) {
  return ((index % total) + total) % total;
}

function createSlide(image, index, clone = false) {
  const slide = document.createElement("img");
  slide.className = "hero__image";
  slide.src = image;
  slide.width = 1600;
  slide.height = 1067;
  slide.alt = "";
  slide.decoding = "async";
  slide.draggable = false;
  if (clone) {
    slide.dataset.heroClone = String(index);
  } else {
    slide.dataset.heroSlide = String(index);
    slide.fetchPriority = index === 0 ? "high" : "low";
  }
  return slide;
}

export function createHeroSlider({
  root,
  slider,
  track,
  pagination,
  images,
  intervalMs = HERO_SLIDE_INTERVAL_MS,
  getSlideshowLabel = () => "Hero slideshow",
  getSlideLabel = (number) => `Show slide ${number}`
}) {
  const uniqueImages = [...new Set(images.filter((image) => typeof image === "string" && image))];
  if (!root || !slider || !track || !pagination || !uniqueImages.length) return null;

  const total = uniqueImages.length;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let currentIndex = 0;
  let trackPosition = total > 1 ? 1 : 0;
  let autoTimer = 0;
  let activePointerId = null;
  let pointerStartX = 0;
  let pointerDeltaX = 0;

  track.replaceChildren();
  if (total > 1) track.append(createSlide(uniqueImages[total - 1], total - 1, true));
  uniqueImages.forEach((image, index) => track.append(createSlide(image, index)));
  if (total > 1) track.append(createSlide(uniqueImages[0], 0, true));

  pagination.replaceChildren();
  const dots = uniqueImages.map((_, index) => {
    const dot = document.createElement("button");
    dot.className = "hero__dot";
    dot.type = "button";
    dot.dataset.heroDot = String(index);
    dot.addEventListener("click", () => goTo(index));
    pagination.append(dot);
    return dot;
  });
  pagination.hidden = total < 2;
  slider.dataset.intervalMs = String(intervalMs);

  function updateControls() {
    root.dataset.heroIndex = String(currentIndex);
    dots.forEach((dot, index) => {
      const active = index === currentIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  function refreshLabels() {
    pagination.setAttribute("aria-label", getSlideshowLabel());
    dots.forEach((dot, index) => dot.setAttribute("aria-label", getSlideLabel(index + 1)));
  }

  function renderTrack(animate = true) {
    track.classList.toggle("is-instant", !animate || reducedMotion.matches);
    track.style.transform = `translate3d(-${trackPosition * 100}%, 0, 0)`;
    updateControls();
    if (animate && !reducedMotion.matches) return;
    track.getBoundingClientRect();
    window.requestAnimationFrame(() => track.classList.remove("is-instant"));
  }

  function stopAutoAdvance() {
    window.clearTimeout(autoTimer);
    autoTimer = 0;
  }

  function scheduleAutoAdvance() {
    stopAutoAdvance();
    if (total < 2 || document.hidden || reducedMotion.matches) return;
    autoTimer = window.setTimeout(() => advance(1), intervalMs);
  }

  function normalizeBeforeAdvance() {
    if (trackPosition > 0 && trackPosition < total + 1) return;
    trackPosition = currentIndex + 1;
    renderTrack(false);
  }

  function advance(direction) {
    if (total < 2) return;
    normalizeBeforeAdvance();
    currentIndex = wrapIndex(currentIndex + direction, total);
    trackPosition += direction;
    renderTrack(true);
    scheduleAutoAdvance();
  }

  function goTo(index) {
    const targetIndex = wrapIndex(index, total);
    if (targetIndex === currentIndex) {
      scheduleAutoAdvance();
      return;
    }
    currentIndex = targetIndex;
    trackPosition = currentIndex + 1;
    renderTrack(true);
    scheduleAutoAdvance();
  }

  function normalizeLoopPosition(event) {
    if (event.target !== track || event.propertyName !== "transform") return;
    if (trackPosition === 0) {
      trackPosition = total;
      renderTrack(false);
    } else if (trackPosition === total + 1) {
      trackPosition = 1;
      renderTrack(false);
    }
  }

  function isInteractiveTarget(target) {
    return target instanceof Element && Boolean(target.closest("a, button, input, select, textarea"));
  }

  function handlePointerDown(event) {
    if (total < 2 || !event.isPrimary || event.button !== 0 || isInteractiveTarget(event.target)) return;
    activePointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerDeltaX = 0;
    stopAutoAdvance();
    root.classList.add("is-dragging");
  }

  function handlePointerMove(event) {
    if (event.pointerId !== activePointerId) return;
    pointerDeltaX = event.clientX - pointerStartX;
    if (Math.abs(pointerDeltaX) > 6 && event.cancelable) event.preventDefault();
    track.style.transform = `translate3d(calc(-${trackPosition * 100}% + ${pointerDeltaX}px), 0, 0)`;
  }

  function handlePointerEnd(event) {
    if (event.pointerId !== activePointerId) return;
    const swipeDistance = Math.min(
      MAX_SWIPE_DISTANCE_PX,
      Math.max(MIN_SWIPE_DISTANCE_PX, root.clientWidth * SWIPE_WIDTH_RATIO)
    );
    activePointerId = null;
    root.classList.remove("is-dragging");
    if (pointerDeltaX <= -swipeDistance) {
      advance(1);
    } else if (pointerDeltaX >= swipeDistance) {
      advance(-1);
    } else {
      renderTrack(true);
      scheduleAutoAdvance();
    }
    pointerDeltaX = 0;
  }

  function handleVisibilityChange() {
    if (document.hidden) stopAutoAdvance();
    else scheduleAutoAdvance();
  }

  function handleReducedMotionChange() {
    renderTrack(false);
    scheduleAutoAdvance();
  }

  root.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointermove", handlePointerMove, {passive: false});
  window.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("pointercancel", handlePointerEnd);
  track.addEventListener("transitionend", normalizeLoopPosition);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  reducedMotion.addEventListener("change", handleReducedMotionChange);

  refreshLabels();
  renderTrack(false);
  window.requestAnimationFrame(() => slider.classList.add("is-ready"));
  scheduleAutoAdvance();

  return {
    get index() {
      return currentIndex;
    },
    refreshLabels,
    next: () => advance(1),
    previous: () => advance(-1),
    goTo,
    destroy() {
      stopAutoAdvance();
      root.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      track.removeEventListener("transitionend", normalizeLoopPosition);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotion.removeEventListener("change", handleReducedMotionChange);
    }
  };
}
