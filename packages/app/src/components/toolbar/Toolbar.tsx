/**
 * Toolbar — vertical tool selection bar on the left side of the canvas.
 *
 * Renders icon buttons for each drawing tool. Clicking a tool sets
 * `activeTool` in the canvas store. The active tool is visually
 * highlighted with a blue background.
 *
 * Uses lucide-react for icons.
 *
 * @module
 */

import { useCanvasStore } from '@infinicanvas/engine';
import type { ToolType } from '@infinicanvas/engine';
import type { ExpressionStyle } from '@infinicanvas/protocol';
import {
  MousePointer2,
  Square,
  Circle,
  Diamond,
  Minus,
  ArrowRight,
  Pencil,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Tool definition for rendering toolbar buttons. */
interface ToolDefinition {
  type: ToolType;
  icon: LucideIcon;
  label: string;
}

/** Ordered list of tools displayed in the toolbar. */
const TOOLS: ToolDefinition[] = [
  { type: 'select', icon: MousePointer2, label: 'Select (V)' },
  { type: 'rectangle', icon: Square, label: 'Rectangle (R)' },
  { type: 'ellipse', icon: Circle, label: 'Ellipse (O)' },
  { type: 'diamond', icon: Diamond, label: 'Diamond (D)' },
  { type: 'line', icon: Minus, label: 'Line (L)' },
  { type: 'arrow', icon: ArrowRight, label: 'Arrow (A)' },
  { type: 'freehand', icon: Pencil, label: 'Pen (P)' },
  { type: 'text', icon: Type, label: 'Text (T)' },
];

/** Toolbar button size in pixels. */
const BUTTON_SIZE = 36;

/** Icon size in pixels. */
const ICON_SIZE = 18;

/** Toolbar component — renders a vertical bar on the left side. */
export function Toolbar() {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const lastUsedStyle = useCanvasStore((s) => s.lastUsedStyle);

  const isTransparentFill = lastUsedStyle.backgroundColor === 'transparent';

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      style={{
        position: 'fixed',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 6,
        backgroundColor: 'var(--bg-toolbar, #ffffff)',
        borderRadius: 10,
        boxShadow: '0 2px 8px var(--shadow, rgba(0, 0, 0, 0.12))',
        border: '1px solid var(--border, #e0e0e0)',
        zIndex: 20,
      }}
    >
      {TOOLS.map((tool) => {
        const isActive = activeTool === tool.type;
        const Icon = tool.icon;

        return (
          <button
            key={tool.type}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={isActive}
            data-tool={tool.type}
            onClick={() => setActiveTool(tool.type)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              backgroundColor: isActive ? '#4A90D9' : 'transparent',
              color: isActive ? '#ffffff' : 'var(--text-primary, #333333)',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            <Icon size={ICON_SIZE} />
          </button>
        );
      })}

      {/* Style indicator — shows current stroke/fill colors */}
      <div
        style={{
          width: '100%',
          height: 1,
          backgroundColor: '#e0e0e0',
          margin: '2px 0',
        }}
      />
      <StyleIndicator style={lastUsedStyle} isTransparentFill={isTransparentFill} />
    </div>
  );
}

/** Small swatch showing current stroke + fill colors. */
function StyleIndicator({
  style,
  isTransparentFill,
}: {
  style: ExpressionStyle;
  isTransparentFill: boolean;
}) {
  return (
    <div
      data-testid="style-indicator"
      data-transparent={isTransparentFill ? 'true' : 'false'}
      title={`Stroke: ${style.strokeColor} / Fill: ${style.backgroundColor}`}
      style={{
        width: BUTTON_SIZE - 8,
        height: BUTTON_SIZE - 8,
        borderRadius: 4,
        borderColor: style.strokeColor,
        borderWidth: 3,
        borderStyle: 'solid',
        backgroundColor: isTransparentFill ? 'transparent' : style.backgroundColor,
        backgroundImage: isTransparentFill
          ? 'repeating-conic-gradient(#ddd 0% 25%, transparent 0% 50%)'
          : undefined,
        backgroundSize: isTransparentFill ? '8px 8px' : undefined,
        margin: '0 auto',
        cursor: 'default',
      }}
    />
  );
}
