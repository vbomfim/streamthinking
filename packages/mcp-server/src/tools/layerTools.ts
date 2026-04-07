/**
 * Layer MCP tools — manage canvas layers for diagram organization.
 *
 * Layers allow expressions to be organized into groups with
 * visibility and lock controls. The MCP server stores layer state
 * via the gateway client.
 *
 * @module
 */

import type { IGatewayClient } from '../gatewayClient.js';
import type { Layer } from '@infinicanvas/protocol';

/** Gateway client extended with layer capabilities. */
export interface ILayerGatewayClient extends IGatewayClient {
  /** Get all layers in the current session. */
  getLayers(): Layer[];
  /** Get the active layer ID. */
  getActiveLayerId(): string;
  /** Add a new layer to the session. Returns the layer ID. */
  sendLayerAdd(name?: string): string;
  /** Set the active layer for new expressions. */
  sendSetActiveLayer(layerId: string): void;
  /** Toggle a layer's visibility. */
  sendToggleLayerVisibility(layerId: string): void;
  /** Move expressions to a different layer. */
  sendMoveToLayer(expressionIds: string[], layerId: string): void;
}

/**
 * List all layers in the current session.
 *
 * Returns a formatted text summary of all layers with their
 * visibility, lock status, and which one is active.
 */
export function executeListLayers(
  client: ILayerGatewayClient,
): string {
  const layers = client.getLayers();
  const activeLayerId = client.getActiveLayerId();

  const lines = layers.map((layer, i) => {
    const visibility = layer.visible ? 'visible' : 'hidden';
    const lock = layer.locked ? ', locked' : '';
    const active = layer.id === activeLayerId ? ' (active)' : '';
    return `${i + 1}. "${layer.name}" — ${visibility}${lock}${active}`;
  });

  return `${layers.length} layer(s):\n\n${lines.join('\n')}`;
}

/**
 * Add a new layer to the session.
 *
 * Creates a layer with the given name (or auto-generated name)
 * and returns a confirmation message.
 */
export function executeAddLayer(
  client: ILayerGatewayClient,
  params: { name?: string },
): string {
  if (!client.isConnected()) {
    return 'Not connected to gateway — cannot add layer.';
  }

  const id = client.sendLayerAdd(params.name);
  const name = params.name ?? 'auto-named';
  return `Layer "${name}" created (id: ${id}).`;
}

/**
 * Set the active layer for new expressions.
 *
 * All new expressions will be created on this layer.
 */
export function executeSetActiveLayer(
  client: ILayerGatewayClient,
  params: { layerId: string },
): string {
  const layers = client.getLayers();
  const layer = layers.find((l) => l.id === params.layerId);

  if (!layer) {
    return `Layer '${params.layerId}' not found.`;
  }

  client.sendSetActiveLayer(params.layerId);
  return `Active layer set to "${layer.name}".`;
}

/**
 * Toggle a layer's visibility.
 *
 * Hidden layers and their expressions are not rendered on the canvas.
 */
export function executeToggleLayerVisibility(
  client: ILayerGatewayClient,
  params: { layerId: string },
): string {
  const layers = client.getLayers();
  const layer = layers.find((l) => l.id === params.layerId);

  if (!layer) {
    return `Layer '${params.layerId}' not found.`;
  }

  client.sendToggleLayerVisibility(params.layerId);
  const newState = layer.visible ? 'hidden' : 'visible';
  return `Layer "${layer.name}" is now ${newState}.`;
}

/**
 * Move expressions to a different layer.
 *
 * Moves the specified expressions to the target layer.
 */
export function executeMoveToLayer(
  client: ILayerGatewayClient,
  params: { expressionIds: string[]; layerId: string },
): string {
  if (!client.isConnected()) {
    return 'Not connected to gateway — cannot move expressions.';
  }

  const layers = client.getLayers();
  const layer = layers.find((l) => l.id === params.layerId);

  if (!layer) {
    return `Layer '${params.layerId}' not found.`;
  }

  client.sendMoveToLayer(params.expressionIds, params.layerId);
  return `Moved ${params.expressionIds.length} expression(s) to layer "${layer.name}".`;
}
