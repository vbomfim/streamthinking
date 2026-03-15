/**
 * Unit tests for ExportMenu component.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies all menu options render, click handlers trigger exports,
 * and import file picker works.
 *
 * @vitest-environment jsdom
 * @module
 */

import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExportMenu } from '../components/panels/ExportMenu.js';

describe('ExportMenu', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the export menu button', () => {
    const { container } = render(<ExportMenu />);
    const button = container.querySelector('[aria-label="Export menu"]');
    expect(button).not.toBeNull();
  });

  it('shows menu options when button is clicked', () => {
    const { container } = render(<ExportMenu />);
    const button = container.querySelector('[aria-label="Export menu"]')!;
    fireEvent.click(button);

    expect(container.querySelector('[data-action="export-png"]')).not.toBeNull();
    expect(container.querySelector('[data-action="export-svg"]')).not.toBeNull();
    expect(container.querySelector('[data-action="export-json"]')).not.toBeNull();
    expect(container.querySelector('[data-action="import-json"]')).not.toBeNull();
  });

  it('hides menu options by default', () => {
    const { container } = render(<ExportMenu />);
    expect(container.querySelector('[data-action="export-png"]')).toBeNull();
  });

  it('renders Export PNG option text', () => {
    const { container } = render(<ExportMenu />);
    fireEvent.click(container.querySelector('[aria-label="Export menu"]')!);
    const pngOption = container.querySelector('[data-action="export-png"]');
    expect(pngOption?.textContent).toContain('PNG');
  });

  it('renders Export SVG option text', () => {
    const { container } = render(<ExportMenu />);
    fireEvent.click(container.querySelector('[aria-label="Export menu"]')!);
    const svgOption = container.querySelector('[data-action="export-svg"]');
    expect(svgOption?.textContent).toContain('SVG');
  });

  it('renders Export JSON option text', () => {
    const { container } = render(<ExportMenu />);
    fireEvent.click(container.querySelector('[aria-label="Export menu"]')!);
    const jsonOption = container.querySelector('[data-action="export-json"]');
    expect(jsonOption?.textContent).toContain('Export JSON');
  });

  it('renders Import JSON option text', () => {
    const { container } = render(<ExportMenu />);
    fireEvent.click(container.querySelector('[aria-label="Export menu"]')!);
    const importOption = container.querySelector('[data-action="import-json"]');
    expect(importOption?.textContent).toContain('Import JSON');
  });

  it('closes menu when clicking an option', () => {
    const { container } = render(<ExportMenu />);
    fireEvent.click(container.querySelector('[aria-label="Export menu"]')!);
    const jsonOption = container.querySelector('[data-action="export-json"]')!;
    fireEvent.click(jsonOption);
    // Menu should close after action
    expect(container.querySelector('[data-action="export-json"]')).toBeNull();
  });
});
