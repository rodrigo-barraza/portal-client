import type { KeyboardEvent } from "react";

/**
 * Props that make a non-button element (a card, a table row) behave like
 * a button: focusable, announced as one, and activated by Enter / Space.
 * For elements whose markup can't be a <button> (block content, grids).
 */
export function activationProps(onActivate: () => void, label?: string) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
