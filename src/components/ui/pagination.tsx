"use client";

import React from "react";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  itemLabel?: string;
  className?: string;
  compact?: boolean;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  itemLabel = "items",
  className = "",
  compact = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  if (safePage !== currentPage && totalItems > 0) {
    onPageChange(safePage);
  }

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  // Generate page numbers with smart ellipsis window
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (safePage > 3) {
        pages.push("ellipsis");
      }

      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safePage < totalPages - 2) {
        pages.push("ellipsis");
      }
      pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs select-none ${className}`}
      aria-label="Pagination Navigation"
    >
      {/* Item Range Summary */}
      <div className="text-[var(--text-dim)] text-xs flex items-center gap-2">
        <span>
          Showing <span className="mono font-semibold text-[var(--text)]">{startItem}</span> to{" "}
          <span className="mono font-semibold text-[var(--text)]">{endItem}</span> of{" "}
          <span className="mono font-semibold text-[var(--text)]">{totalItems}</span> {itemLabel}
        </span>

        {/* Page Size Selector */}
        {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[var(--border)]">
            <span className="text-[var(--text-faint)]">Show:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
                onPageChange(1);
              }}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)] cursor-pointer"
              aria-label="Items per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-1">
        {/* First Button */}
        {!compact && (
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            title="First page"
            aria-label="Go to first page"
            className="w-7 h-7 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 18l-6-6 6-6M18 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          title="Previous page"
          aria-label="Go to previous page"
          className="w-7 h-7 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (p === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-6 text-center text-[var(--text-faint)] select-none mono"
                >
                  …
                </span>
              );
            }

            const isActive = p === safePage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={isActive ? "page" : undefined}
                className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold mono transition flex items-center justify-center ${
                  isActive
                    ? "bg-[var(--accent)] text-white shadow-xs"
                    : "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages || totalItems === 0}
          title="Next page"
          aria-label="Go to next page"
          className="w-7 h-7 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* Last Button */}
        {!compact && (
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage >= totalPages || totalItems === 0}
            title="Last page"
            aria-label="Go to last page"
            className="w-7 h-7 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 18l6-6-6-6M6 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
