/**
 * Platform detection — desktop keyboard vs touch-primary mobile.
 * Both paths stay live: keyboard always works; touch UI mounts when needed.
 */

export function isTouchPrimary(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const maxTouch = navigator.maxTouchPoints > 0;
  const narrow = window.matchMedia("(max-width: 920px)").matches;
  // Phones/tablets: coarse pointer or touch + narrow / no-hover
  return (coarse && maxTouch) || (maxTouch && noHover) || (maxTouch && narrow);
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Extra sprite/stage scale on phones so art stays readable at arm's length */
export function mobileZoomFactor(): number {
  return isTouchPrimary() ? 1.14 : 1;
}

export function applyPlatformClass(root: HTMLElement = document.body) {
  const touch = isTouchPrimary();
  root.classList.toggle("is-touch", touch);
  root.classList.toggle("is-desktop", !touch);
  root.classList.toggle("is-ios", isIOS());
  return touch;
}
