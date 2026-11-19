/** Small focus helpers. Native elements do the heavy lifting; these only move focus deliberately. */
import { useEffect, type RefObject } from 'react';

/** Focus an element after the current render has been committed. */
export function focusSoon(target: HTMLElement | null | undefined | (() => HTMLElement | null | undefined)): void {
  setTimeout(() => {
    const el = typeof target === 'function' ? target() : target;
    el?.focus();
  }, 0);
}

export function focusById(id: string): void {
  focusSoon(() => document.getElementById(id));
}

/** Capture the currently focused element; call the returned function to restore focus to it. */
export function rememberFocus(): () => void {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return () => {
    if (previous && document.contains(previous)) focusSoon(previous);
  };
}

/** Moves focus to the page heading when a page mounts (route change), and sets the document title. */
export function usePageFocus(headingRef: RefObject<HTMLHeadingElement | null>, title: string, enabled = true): void {
  useEffect(() => {
    document.title = `${title} — AccessPilot`;
    if (enabled) headingRef.current?.focus();
    // Run once per page mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
