/**
 * Unit tests for uiStore — UI preferences state management.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers theme toggling, persistence to localStorage, and
 * data-theme attribute application.
 *
 * @vitest-environment jsdom
 * @module
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useUiStore, THEME_STORAGE_KEY, applyThemeToDocument } from '../store/uiStore.js';
import type { Theme } from '../store/uiStore.js';

// ── Store reset before each test ───────────────────────────

beforeEach(() => {
  useUiStore.setState({ theme: 'light' });
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ── Theme state ────────────────────────────────────────────

describe('uiStore — theme state', () => {
  it('defaults to "light" theme', () => {
    const state = useUiStore.getState();
    expect(state.theme).toBe('light');
  });

  it('setTheme updates theme to "dark"', () => {
    useUiStore.getState().setTheme('dark');
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('setTheme updates theme to "light"', () => {
    useUiStore.getState().setTheme('dark');
    useUiStore.getState().setTheme('light');
    expect(useUiStore.getState().theme).toBe('light');
  });

  it('toggleTheme switches from light to dark', () => {
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('toggleTheme switches from dark to light', () => {
    useUiStore.setState({ theme: 'dark' });
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('light');
  });

  it('toggleTheme round-trips correctly', () => {
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('dark');
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('light');
  });
});

// ── Theme persistence ──────────────────────────────────────

describe('uiStore — theme persistence', () => {
  it('setTheme persists preference to localStorage', () => {
    useUiStore.getState().setTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('toggleTheme persists preference to localStorage', () => {
    useUiStore.getState().toggleTheme();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('loadPersistedTheme reads from localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    useUiStore.getState().loadPersistedTheme();
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('loadPersistedTheme defaults to light when localStorage is empty', () => {
    useUiStore.getState().loadPersistedTheme();
    expect(useUiStore.getState().theme).toBe('light');
  });

  it('loadPersistedTheme defaults to light when localStorage has invalid value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid-theme');
    useUiStore.getState().loadPersistedTheme();
    expect(useUiStore.getState().theme).toBe('light');
  });
});

// ── applyThemeToDocument ───────────────────────────────────

describe('applyThemeToDocument', () => {
  it('sets data-theme attribute to "light"', () => {
    applyThemeToDocument('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sets data-theme attribute to "dark"', () => {
    applyThemeToDocument('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
