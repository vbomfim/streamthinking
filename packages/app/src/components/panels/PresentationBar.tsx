/**
 * PresentationBar — bottom-center floating navigation bar for presentation mode.
 *
 * Shows waypoint counter, prev/next buttons, add waypoint button, and exit button.
 * Only visible when waypoints exist. Unobtrusive: small, semi-transparent.
 *
 * Follows existing panel patterns: inline styles, lucide-react icons,
 * store access via useCanvasStore selector. [CLEAN-CODE] [CUSTOM]
 *
 * @module
 */

import { useCallback } from 'react';
import { useCanvasStore } from '@infinicanvas/engine';
import { ChevronLeft, ChevronRight, Plus, X, Play } from 'lucide-react';

/** Button size in pixels. */
const BUTTON_SIZE = 32;

/** Icon size in pixels. */
const ICON_SIZE = 16;

/** PresentationBar — bottom-center presentation navigation panel. */
export function PresentationBar() {
  const waypoints = useCanvasStore((s) => s.waypoints);
  const presentationIndex = useCanvasStore((s) => s.presentationIndex);

  const handleAddWaypoint = useCallback(() => {
    useCanvasStore.getState().addWaypoint();
  }, []);

  const handlePrev = useCallback(() => {
    useCanvasStore.getState().prevWaypoint();
  }, []);

  const handleNext = useCallback(() => {
    useCanvasStore.getState().nextWaypoint();
  }, []);

  const handlePlay = useCallback(() => {
    useCanvasStore.getState().goToWaypoint(0);
  }, []);

  const handleExit = useCallback(() => {
    useCanvasStore.getState().exitPresentation();
  }, []);

  const handleClear = useCallback(() => {
    useCanvasStore.getState().clearWaypoints();
  }, []);

  // Hide when no waypoints exist and not in presentation mode
  if (waypoints.length === 0) return null;

  const isPresenting = presentationIndex >= 0;
  const displayIndex = isPresenting ? presentationIndex + 1 : 0;

  return (
    <div
      data-testid="presentation-bar"
      style={{
        position: 'fixed',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        backgroundColor: 'var(--bg-toolbar, #ffffff)',
        borderRadius: 10,
        boxShadow: '0 2px 8px var(--shadow, rgba(0,0,0,0.12))',
        border: '1px solid var(--border, #e0e0e0)',
        zIndex: 20,
        opacity: isPresenting ? 1 : 0.85,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Start presentation from waypoint 1 (when not presenting) */}
      {!isPresenting && (
        <button
          type="button"
          data-testid="presentation-play"
          aria-label="Start presentation"
          onClick={handlePlay}
          style={buttonStyle}
        >
          <Play size={ICON_SIZE} />
        </button>
      )}

      {/* Previous waypoint */}
      {isPresenting && (
        <button
          type="button"
          data-testid="presentation-prev"
          aria-label="Previous waypoint"
          onClick={handlePrev}
          style={buttonStyle}
        >
          <ChevronLeft size={ICON_SIZE} />
        </button>
      )}

      {/* Waypoint counter */}
      <span
        data-testid="presentation-counter"
        style={{
          minWidth: 48,
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: 'var(--text-primary, #333333)',
          userSelect: 'none',
        }}
      >
        {isPresenting
          ? `${displayIndex} / ${waypoints.length}`
          : `${waypoints.length} slides`}
      </span>

      {/* Next waypoint */}
      {isPresenting && (
        <button
          type="button"
          data-testid="presentation-next"
          aria-label="Next waypoint"
          onClick={handleNext}
          style={buttonStyle}
        >
          <ChevronRight size={ICON_SIZE} />
        </button>
      )}

      {/* Separator */}
      <div
        style={{
          width: 1,
          height: 20,
          backgroundColor: 'var(--border, #e0e0e0)',
          margin: '0 2px',
        }}
      />

      {/* Add waypoint at current camera position */}
      <button
        type="button"
        data-testid="presentation-add"
        aria-label="Add waypoint"
        onClick={handleAddWaypoint}
        style={buttonStyle}
      >
        <Plus size={ICON_SIZE} />
      </button>

      {/* Exit presentation or clear all waypoints */}
      <button
        type="button"
        data-testid="presentation-exit"
        aria-label={isPresenting ? 'Exit presentation' : 'Clear waypoints'}
        onClick={isPresenting ? handleExit : handleClear}
        style={buttonStyle}
      >
        <X size={ICON_SIZE} />
      </button>
    </div>
  );
}

/** Shared button style — matches ZoomControls pattern. */
const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: BUTTON_SIZE,
  height: BUTTON_SIZE,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  color: 'var(--text-primary, #333333)',
  transition: 'background-color 0.15s',
};
