"use client";

import React from "react";

export function AnimatedBackground() {
  return (
    <div className="clean-ambient-bg" aria-hidden="true">
      {/* Subtle top ambient glow */}
      <div className="ambient-top-glow" />
      {/* Precision micro-dot grid */}
      <div className="ambient-grid" />
    </div>
  );
}
