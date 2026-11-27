import { useEffect, useRef } from 'react';

/**
 * Android's back button closes what is open on top of a screen (a sheet, a
 * dialog, the notifications panel) before it moves between screens
 * (App.tsx). Each open panel adds how to close it here; the newest is
 * closed first, so a sheet opened from a panel closes before the panel.
 */
const open: { close: () => void }[] = [];

/** Adds an open panel; the function returned removes it. */
export const addPanel = (close: () => void): (() => void) => {
  const entry = { close };
  open.push(entry);
  return () => {
    const i = open.indexOf(entry);
    if (i >= 0) open.splice(i, 1);
  };
};

/**
 * Closes the newest open panel. False when none is open, and back moves
 * between screens. A panel that can't close yet (it is saving) stays open
 * and still takes the press, so back never leaves the screen under it.
 */
export const closeNewestPanel = (): boolean => {
  const top = open[open.length - 1];
  if (!top) return false;
  top.close();
  return true;
};

/** While `active`, back closes this panel with `onBack`. */
export const useBackHandler = (active: boolean, onBack: () => void): void => {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (!active) return;
    return addPanel(() => latest.current());
  }, [active]);
};
