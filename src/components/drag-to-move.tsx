"use client";

// Long-press a bottle in the fridge, drag it, and let go on another place
// to move it there (on a bottle: they swap, like the "move" button). A short
// tap still opens the bottle, and moving the finger before the press is
// long enough is a normal scroll. While dragging the page does not scroll,
// except near the top or bottom edge, where it scrolls by itself.
//
// The slots only carry data attributes (fridge-preview.tsx); everything
// else happens here with plain DOM events, since a drag is a short-lived
// gesture that React state would only slow down.

import { useEffect, useRef, type RefObject } from "react";
import type { Place } from "./fridge-preview";

/** How long a press must last before the bottle lifts (ms), and how far the finger may wander meanwhile (px). */
export const LONG_PRESS_MS = 450;
export const PRESS_SLOP = 8;

/**
 * How fast to scroll (px per frame) with the finger at `y`: faster the
 * closer it is to the edge. The bottom edge sits above the navigation bar.
 */
export function edgeScrollSpeed(y: number, height: number, bottomInset = 0, zone = 80, max = 14): number {
  const fromTop = y;
  const fromBottom = height - bottomInset - y;
  if (fromTop < zone) return -Math.ceil(max * (1 - Math.max(0, fromTop) / zone));
  if (fromBottom < zone) return Math.ceil(max * (1 - Math.max(0, fromBottom) / zone));
  return 0;
}

/** The place a slot element marks (data-zone / data-slot), or null. */
export function placeOf(el: Element | null): { place: Place; el: HTMLElement } | null {
  const slotEl = el?.closest<HTMLElement>("[data-zone]");
  if (!slotEl?.dataset.zone) return null;
  const slot = slotEl.dataset.slot ? Number(slotEl.dataset.slot) : null;
  return { place: { zoneId: slotEl.dataset.zone, slot }, el: slotEl };
}

const TARGET_CLASSES = ["ring-2", "ring-accent", "ring-offset-2", "ring-offset-shelf"];
const NAV_HEIGHT = 64; // the bottom navigation, roughly

export function useDragToMove(container: RefObject<HTMLElement | null>, enabled: boolean, onDrop: (bottleId: string, place: Place) => void) {
  // The latest onDrop, without re-attaching every listener on each render.
  const dropRef = useRef(onDrop);
  useEffect(() => {
    dropRef.current = onDrop;
  });
  useEffect(() => {
    const root = container.current;
    if (!root || !enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: { x: number; y: number; id: number } | null = null;
    let drag: { bottleId: string; source: HTMLElement; ghost: HTMLElement; dx: number; dy: number; x: number; y: number } | null = null;
    let target: { place: Place; el: HTMLElement } | null = null;
    let frame = 0;
    let swallowClick = false;

    const setTarget = (next: { place: Place; el: HTMLElement } | null) => {
      if (target?.el === next?.el) return;
      target?.el.classList.remove(...TARGET_CLASSES);
      target = next && next.el !== drag?.source ? next : null;
      target?.el.classList.add(...TARGET_CLASSES);
    };

    const follow = () => {
      if (!drag) return;
      drag.ghost.style.transform = `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px) scale(1.1)`;
      setTarget(placeOf(document.elementFromPoint(drag.x, drag.y)));
    };

    // Near an edge, keep scrolling while the finger stays there.
    const autoScroll = () => {
      if (!drag) return;
      const speed = edgeScrollSpeed(drag.y, window.innerHeight, NAV_HEIGHT);
      if (speed) {
        window.scrollBy(0, speed);
        follow();
      }
      frame = requestAnimationFrame(autoScroll);
    };

    const lift = (source: HTMLElement, bottleId: string, x: number, y: number) => {
      const box = source.getBoundingClientRect();
      const ghost = source.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-zone");
      ghost.removeAttribute("data-bottle");
      Object.assign(ghost.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: `${box.width}px`,
        height: `${box.height}px`,
        margin: "0",
        pointerEvents: "none",
        zIndex: "60",
        opacity: "0.9",
        boxShadow: "0 8px 24px rgb(0 0 0 / 0.4)",
        transition: "none",
      });
      document.body.appendChild(ghost);
      source.style.opacity = "0.35";
      drag = { bottleId, source, ghost, dx: x - box.left, dy: y - box.top, x, y };
      swallowClick = true;
      navigator.vibrate?.(20);
      follow();
      frame = requestAnimationFrame(autoScroll);
    };

    const end = (drop: boolean) => {
      if (timer) clearTimeout(timer);
      timer = null;
      start = null;
      cancelAnimationFrame(frame);
      if (!drag) return;
      const { bottleId, source, ghost } = drag;
      const place = target?.place;
      setTarget(null);
      ghost.remove();
      source.style.opacity = "";
      drag = null;
      if (drop && place) dropRef.current(bottleId, place);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || drag) return;
      const source = (e.target as Element).closest<HTMLElement>("[data-bottle]");
      if (!source?.dataset.bottle) return;
      const bottleId = source.dataset.bottle;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      timer = setTimeout(() => {
        timer = null;
        if (start) lift(source, bottleId, start.x, start.y);
      }, LONG_PRESS_MS);
    };

    const onMove = (e: PointerEvent) => {
      if (start && e.pointerId !== start.id) return;
      if (drag) {
        drag.x = e.clientX;
        drag.y = e.clientY;
        follow();
        return;
      }
      // Moved before the press was long enough: it is a scroll, not a drag.
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > PRESS_SLOP) end(false);
    };

    // A touch drag must not scroll the page (needs a non-passive listener).
    const onTouchMove = (e: TouchEvent) => {
      if (drag) e.preventDefault();
    };
    // The click that ends a drag must not open the bottle.
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    };
    // A long press on a phone would open the image / text menu.
    const onContextMenu = (e: Event) => {
      if ((e.target as Element).closest("[data-bottle]")) e.preventDefault();
    };
    const onUp = () => {
      const wasDragging = !!drag;
      end(true);
      // No click follows a drag on some browsers: do not swallow the next real tap.
      if (wasDragging) setTimeout(() => (swallowClick = false), 400);
    };
    const onCancel = () => end(false);

    root.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("click", onClick, true);
    root.addEventListener("contextmenu", onContextMenu);
    return () => {
      end(false);
      root.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("contextmenu", onContextMenu);
    };
  }, [container, enabled]);
}
