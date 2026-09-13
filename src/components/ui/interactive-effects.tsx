"use client";

import React, { useEffect } from "react";

export function InteractiveEffects() {
  useEffect(() => {
    // 1. Click Ripple Effect
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest(
        "button, .btn-primary, .btn-ghost, .card, .metric, .filter-chip, .nav-item, .attn-row, .ws-switcher, .spotlight-card"
      ) as HTMLElement | null;

      if (!target) return;

      const rect = target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 2;

      const ripple = document.createElement("span");
      ripple.className = "click-ripple-bubble";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x - size / 2}px`;
      ripple.style.top = `${y - size / 2}px`;

      // Ensure target position supports absolute child
      const computedPos = window.getComputedStyle(target).position;
      if (computedPos === "static") {
        target.style.position = "relative";
      }

      target.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 650);
    };

    // 2. Card Spotlight Hover Tracking
    const handlePointerMove = (e: PointerEvent) => {
      const cards = document.querySelectorAll<HTMLElement>(".spotlight-card, .metric, .card");
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty("--card-x", `${x}px`);
        card.style.setProperty("--card-y", `${y}px`);
      });
    };

    window.addEventListener("click", handleClick, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  return null;
}
