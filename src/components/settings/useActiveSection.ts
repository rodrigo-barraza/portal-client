"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** How long a click-driven smooth scroll owns the highlight before the
 *  scroll observer takes over again. */
const CLICK_SCROLL_LOCK_MS = 900;

/**
 * Tracks which settings section is in view, for the section nav.
 *
 * Sections are the elements under `containerRef` carrying
 * `data-section-id`. The active one is the first (in document order) whose
 * top part is on screen; clicking a nav item scrolls to its section and
 * holds the highlight there while the smooth scroll passes the others.
 */
export function useActiveSection(
  containerRef: RefObject<HTMLElement | null>,
  initialSection: string,
) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const lockedUntilRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;

    const sections = [
      ...container.querySelectorAll<HTMLElement>("[data-section-id]"),
    ];
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.sectionId;
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        if (Date.now() < lockedUntilRef.current) return;
        const first = sections.find((section) =>
          visible.has(section.dataset.sectionId ?? ""),
        );
        if (first?.dataset.sectionId) setActiveSection(first.dataset.sectionId);
      },
      // Only the top 40% of the viewport counts as "reading here".
      { rootMargin: "0px 0px -60% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [containerRef]);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      setActiveSection(sectionId);
      lockedUntilRef.current = Date.now() + CLICK_SCROLL_LOCK_MS;
      containerRef.current
        ?.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [containerRef],
  );

  return { activeSection, scrollToSection };
}
