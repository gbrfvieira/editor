import type { AssetInput } from '@pascal-app/core'

/**
 * A catalog tile: the asset plus optional editor placement metadata.
 * `tool` names the placement tool the tile arms (defaults to the generic
 * `'item'` drop tool) — kinds drawn by their own registry tool (e.g. the
 * modular cabinet) point at that tool id instead.
 */
export type CatalogItem = AssetInput & { tool?: string }

// Third-party catalog assets are not redistributable; awaiting a first-party catalog.
export const CATALOG_ITEMS: CatalogItem[] = []

export function getDefaultCatalogItem(category: string | null | undefined): AssetInput | null {
  if (!category) return null
  return CATALOG_ITEMS.find((item) => item.category === category) ?? null
}
