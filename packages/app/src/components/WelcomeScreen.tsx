/**
 * WelcomeScreen — full-page overlay shown on first visit.
 *
 * Displays project name, tagline, example actions, and a
 * "Get Started" button. Dismissed state persists to localStorage.
 * Not shown on subsequent visits. [CLEAN-CODE]
 *
 * @module
 */

import { useState } from 'react';
import { Square, MessageSquare, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** localStorage key for welcome dismissed state. */
export const WELCOME_STORAGE_KEY = 'infinicanvas:welcomed';

/** Example action definition. */
interface WelcomeAction {
  icon: LucideIcon;
  label: string;
}

/** Example actions displayed on the welcome screen. */
const WELCOME_ACTIONS: WelcomeAction[] = [
  { icon: Square, label: 'Draw a shape' },
  { icon: MessageSquare, label: 'Ask AI to diagram something' },
  { icon: Download, label: 'Import a canvas' },
];

/** Check if user has already dismissed the welcome screen. */
function hasBeenWelcomed(): boolean {
  try {
    return localStorage.getItem(WELCOME_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Full-page welcome overlay shown on first visit.
 *
 * Shows project name, tagline, 3 example actions, and a dismiss button.
 * Once dismissed, the state is saved to localStorage and the overlay
 * is not shown on subsequent visits.
 */
export function WelcomeScreen() {
  const [dismissed, setDismissed] = useState(hasBeenWelcomed);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
    } catch {
      // localStorage unavailable — continue anyway
    }
    setDismissed(true);
  };

  return (
    <div
      data-testid="welcome-screen"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-toolbar, #ffffff)',
          borderRadius: 16,
          padding: '48px 40px',
          maxWidth: 480,
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
        }}
      >
        {/* Project name */}
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            margin: '0 0 8px 0',
            color: 'var(--text-primary, #333333)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          StreamThinking
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: 15,
            color: 'var(--text-secondary, #666666)',
            margin: '0 0 32px 0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          A visual communication protocol for humans &amp; AI
        </p>

        {/* Example actions */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 32,
          }}
        >
          {WELCOME_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.label}
                data-testid="welcome-action"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-canvas, #f5f5f5)',
                  color: 'var(--text-primary, #333333)',
                  fontSize: 14,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <Icon size={20} style={{ flexShrink: 0, color: '#4A90D9' }} />
                {action.label}
              </div>
            );
          })}
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          data-testid="welcome-dismiss"
          onClick={handleDismiss}
          style={{
            padding: '12px 32px',
            fontSize: 15,
            fontWeight: 600,
            backgroundColor: '#4A90D9',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            transition: 'background-color 0.15s',
          }}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
