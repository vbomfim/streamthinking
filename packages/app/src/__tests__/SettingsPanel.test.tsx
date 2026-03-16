/**
 * Unit tests for SettingsPanel component.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies: renders fields, saves to localStorage, loads on mount,
 * shows warning text about API key storage.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsPanel, SETTINGS_STORAGE_KEY } from '../components/panels/SettingsPanel.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('SettingsPanel', () => {
  it('renders Gateway URL field', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    const input = container.querySelector('[data-testid="settings-gateway-url"]');
    expect(input).not.toBeNull();
  });

  it('renders Gateway API Key field', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    const input = container.querySelector('[data-testid="settings-api-key"]');
    expect(input).not.toBeNull();
  });

  it('displays warning about local storage', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    expect(container.textContent).toContain(
      "API keys are stored in your browser's local storage",
    );
  });

  it('saves settings to localStorage on input change', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    const urlInput = container.querySelector(
      '[data-testid="settings-gateway-url"]',
    ) as HTMLInputElement;

    fireEvent.change(urlInput, { target: { value: 'http://localhost:3001' } });

    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    expect(saved.gatewayUrl).toBe('http://localhost:3001');
  });

  it('saves API key to localStorage on input change', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    const keyInput = container.querySelector(
      '[data-testid="settings-api-key"]',
    ) as HTMLInputElement;

    fireEvent.change(keyInput, { target: { value: 'sk-test-123' } });

    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    expect(saved.apiKey).toBe('sk-test-123');
  });

  it('loads existing settings from localStorage on mount', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ gatewayUrl: 'http://my-api.com', apiKey: 'my-key' }),
    );

    const { container } = render(<SettingsPanel onClose={() => {}} />);

    const urlInput = container.querySelector(
      '[data-testid="settings-gateway-url"]',
    ) as HTMLInputElement;
    const keyInput = container.querySelector(
      '[data-testid="settings-api-key"]',
    ) as HTMLInputElement;

    expect(urlInput.value).toBe('http://my-api.com');
    expect(keyInput.value).toBe('my-key');
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, 'not-json');

    const { container } = render(<SettingsPanel onClose={() => {}} />);
    const urlInput = container.querySelector(
      '[data-testid="settings-gateway-url"]',
    ) as HTMLInputElement;

    // Should render with empty defaults, not crash
    expect(urlInput.value).toBe('');
  });

  it('calls onClose when close button is clicked', () => {
    let closed = false;
    const { container } = render(
      <SettingsPanel onClose={() => { closed = true; }} />,
    );
    const closeButton = container.querySelector('[data-testid="settings-close"]')!;
    fireEvent.click(closeButton);
    expect(closed).toBe(true);
  });

  it('renders with a title "Settings"', () => {
    const { container } = render(<SettingsPanel onClose={() => {}} />);
    expect(container.textContent).toContain('Settings');
  });
});
