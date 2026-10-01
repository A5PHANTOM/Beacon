"use client";

import React from "react";
import { getCategoryMeta } from "@/lib/timesheet-constants";

export function CategoryBadge({
  category,
  size = "md",
  showDescription = false,
}: {
  category: string;
  size?: "sm" | "md" | "lg";
  showDescription?: boolean;
}) {
  const meta = getCategoryMeta(category);

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px] gap-1",
    md: "px-2 py-0.5 text-xs gap-1.5",
    lg: "px-2.5 py-1 text-xs gap-2 font-semibold",
  }[size];

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  }[size];

  return (
    <div className="inline-flex flex-col">
      <span
        className={`inline-flex items-center rounded-md font-medium transition-all ${sizeClasses}`}
        style={{
          backgroundColor: meta.bgSoft,
          color: meta.color,
          border: `1px solid ${meta.border}`,
        }}
        title={meta.description}
      >
        <span
          className={`rounded-full shrink-0 ${dotSizes}`}
          style={{ backgroundColor: meta.color }}
        />
        <span className="truncate">{meta.label}</span>
      </span>
      {showDescription && (
        <span className="text-[11px] text-[var(--text-dim)] mt-0.5">
          {meta.description}
        </span>
      )}
    </div>
  );
}
