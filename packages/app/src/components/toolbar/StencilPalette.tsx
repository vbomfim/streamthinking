/**
 * StencilPalette — browsable panel for placing SVG stencil expressions.
 *
 * Provides a scrollable panel with collapsible category sections
 * showing a grid of stencil thumbnails. Supports click-to-place
 * (at viewport center) and drag-to-place (at drop position).
 *
 * Categories are listed immediately from metadata. SVGs are loaded
 * lazily when a category is expanded, with a loading indicator.
 *
 * @module
 */

import { useState, useCallback, useEffect, type DragEvent } from 'react';
import { nanoid } from 'nanoid';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { VisualExpression, ExpressionData } from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import {
  getCategories,
  getCategoryStencils,
  svgToDataUri,
} from '@infinicanvas/engine';
import type { StencilEntry } from '@infinicanvas/engine';

// ── Constants ──────────────────────────────────────────────

/** Panel width in pixels. */
const PANEL_WIDTH = 240;

/** Size of each stencil thumbnail in pixels. */
const THUMBNAIL_SIZE = 48;

/** Number of columns in the stencil grid. */
const GRID_COLUMNS = 3;

/** Map from kebab-case category IDs to human-readable display names. */
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  architecture: 'Architecture',
  azure: 'Azure',
  'azure-arm': 'Azure ARM',
  'generic-it': 'Generic IT',
  kubernetes: 'Kubernetes',
  network: 'Network',
  security: 'Security',
};

// ── Props ──────────────────────────────────────────────────

/** Props for StencilPalette. */
export interface StencilPaletteProps {
  /** Callback when a stencil expression is created. */
  onInsert: (expression: VisualExpression) => void;
  /** Whether the panel is visible. */
  isOpen: boolean;
}

// ── Expression factory ─────────────────────────────────────

/**
 * Creates a VisualExpression from a stencil catalog entry.
 *
 * Places at (0, 0) — the caller (App.tsx) handles viewport centering.
 * Uses the stencil's defaultSize from the catalog.
 */
function createStencilExpression(entry: StencilEntry): VisualExpression {
  const data: ExpressionData = {
    kind: 'stencil' as const,
    stencilId: entry.id,
    category: entry.category,
    label: entry.label,
  };

  return {
    id: nanoid(),
    kind: 'stencil',
    position: { x: 0, y: 0 },
    size: { ...entry.defaultSize },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE, fontSize: 10 },
    meta: {
      author: { type: 'human', id: 'local-user', name: 'User' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data,
  };
}

/**
 * Returns a human-readable display name for a category slug.
 * Falls back to title-casing the slug if not found in the map.
 */
function getCategoryDisplayName(category: string): string {
  return (
    CATEGORY_DISPLAY_NAMES[category] ??
    category
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

// ── Component ──────────────────────────────────────────────

/**
 * StencilPalette — scrollable panel with collapsible category sections.
 *
 * Each category shows a grid of stencil thumbnails with labels.
 * Clicking a stencil calls onInsert with a new VisualExpression.
 * Dragging a stencil sets transfer data for canvas drop handling.
 *
 * Categories are listed immediately from sync metadata. SVGs load
 * lazily when a category is expanded.
 */
export function StencilPalette({ onInsert, isOpen }: StencilPaletteProps) {
  const categories = getCategories();
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [loadedStencils, setLoadedStencils] = useState<Map<string, StencilEntry[]>>(
    new Map(),
  );
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(
    new Set(),
  );

  // Load stencils for all expanded categories
  useEffect(() => {
    if (!isOpen) return;

    for (const category of categories) {
      if (collapsedCategories.has(category)) continue;
      if (loadedStencils.has(category)) continue;
      if (loadingCategories.has(category)) continue;

      setLoadingCategories((prev) => new Set(prev).add(category));

      getCategoryStencils(category).then(
        (stencils) => {
          setLoadedStencils((prev) => new Map(prev).set(category, stencils));
          setLoadingCategories((prev) => {
            const next = new Set(prev);
            next.delete(category);
            return next;
          });
        },
        () => {
          // On error, clear loading state so it can be retried
          setLoadingCategories((prev) => {
            const next = new Set(prev);
            next.delete(category);
            return next;
          });
        },
      );
    }
  }, [isOpen, categories, collapsedCategories, loadedStencils, loadingCategories]);

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleStencilClick = useCallback(
    (entry: StencilEntry) => {
      const expression = createStencilExpression(entry);
      onInsert(expression);
    },
    [onInsert],
  );

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, entry: StencilEntry) => {
      event.dataTransfer.setData(
        'application/x-infinicanvas-stencil',
        entry.id,
      );
      event.dataTransfer.effectAllowed = 'copy';

      // Create offscreen drag preview from SVG
      const dragImg = new Image(40, 40);
      dragImg.src = svgToDataUri(entry.svgContent);
      document.body.appendChild(dragImg);
      dragImg.style.position = 'absolute';
      dragImg.style.top = '-9999px';
      if (typeof event.dataTransfer.setDragImage === 'function') {
        event.dataTransfer.setDragImage(dragImg, 20, 20);
      }
      requestAnimationFrame(() => document.body.removeChild(dragImg));
    },
    [],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-testid="stencil-palette-panel"
      role="navigation"
      aria-label="Stencil palette"
      style={{
        position: 'fixed',
        left: 60,
        top: '50%',
        transform: 'translateY(-50%)',
        width: PANEL_WIDTH,
        maxHeight: '80vh',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-toolbar, #ffffff)',
        borderRadius: 10,
        boxShadow: '0 4px 16px var(--shadow, rgba(0, 0, 0, 0.15))',
        border: '1px solid var(--border, #e0e0e0)',
        padding: 8,
        zIndex: 20,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {categories.map((category) => {
        const isCollapsed = collapsedCategories.has(category);
        const stencils = loadedStencils.get(category);
        const isLoading = loadingCategories.has(category);
        const displayName = getCategoryDisplayName(category);
        const stencilCount = stencils?.length;
        const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

        return (
          <div key={category} style={{ marginBottom: 4 }}>
            {/* Category header — clickable to toggle */}
            <button
              type="button"
              data-testid={`category-header-${category}`}
              aria-expanded={!isCollapsed}
              aria-label={`${displayName} category`}
              onClick={() => toggleCategory(category)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                width: '100%',
                padding: '6px 4px',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: 'var(--text-primary, #333333)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f4ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ChevronIcon size={14} />
              <span>{displayName}</span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  color: '#999',
                  fontWeight: 400,
                }}
              >
                {stencilCount !== undefined ? stencilCount : ''}
              </span>
            </button>

            {/* Stencil grid — hidden when collapsed */}
            {!isCollapsed && isLoading && (
              <div
                data-testid={`category-loading-${category}`}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '12px 0',
                  color: '#999',
                }}
              >
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {!isCollapsed && stencils && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
                  gap: 4,
                  padding: '4px 0',
                }}
              >
                {stencils.map((entry) => (
                  <StencilItem
                    key={entry.id}
                    entry={entry}
                    onClick={handleStencilClick}
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── StencilItem sub-component ──────────────────────────────

/** Props for StencilItem. */
interface StencilItemProps {
  entry: StencilEntry;
  onClick: (entry: StencilEntry) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, entry: StencilEntry) => void;
}

/**
 * Individual stencil thumbnail with label.
 *
 * Renders a small SVG preview (48×48) with the stencil label below.
 * Supports click-to-place and drag-to-place interactions.
 */
function StencilItem({ entry, onClick, onDragStart }: StencilItemProps) {
  return (
    <div
      data-testid={`stencil-item-${entry.id}`}
      draggable="true"
      onClick={() => onClick(entry)}
      onDragStart={(e) => onDragStart(e, entry)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background-color 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f0f4ff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* SVG thumbnail — trusted bundled content */}
      <div
        data-testid={`stencil-svg-${entry.id}`}
        style={{
          width: THUMBNAIL_SIZE,
          height: THUMBNAIL_SIZE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={svgToDataUri(entry.svgContent)}
          alt={entry.label}
          width={THUMBNAIL_SIZE - 8}
          height={THUMBNAIL_SIZE - 8}
          style={{ objectFit: 'contain', pointerEvents: 'none' }}
        />
      </div>

      {/* Label */}
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-primary, #666)',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: THUMBNAIL_SIZE + 16,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.label}
      </span>
    </div>
  );
}
