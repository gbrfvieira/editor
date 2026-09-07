import type { AssetInput } from '@pascal-app/core/schema'

/**
 * Small built-in catalog for standalone/headless MCP use.
 *
 * The editor has a much larger UI catalog, but depending on `@pascal-app/editor`
 * from the MCP package would pull browser/React code into the headless server.
 *
 * Emptied: the former entries pointed at the same third-party,
 * non-redistributable assets as the editor's old Supabase-hosted catalog
 * (packages/editor/src/components/ui/item-catalog/catalog-items.tsx), which
 * was emptied for the same reason. Callers already handle a miss gracefully
 * (place_item falls back to a generic placeholder box; create_room's
 * auto-furnish skips and reports each unresolved placement) — awaiting a
 * first-party catalog.
 */
export const MCP_CATALOG_ITEMS: AssetInput[] = []

export function findCatalogItem(id: string): AssetInput | undefined {
  return MCP_CATALOG_ITEMS.find((item) => item.id === id)
}

export function searchCatalogItems(args: {
  query: string
  category?: string | undefined
}): AssetInput[] {
  const terms = args.query.trim().toLowerCase().split(/\s+/).filter(Boolean)

  return MCP_CATALOG_ITEMS.filter((item) => {
    if (args.category && item.category !== args.category) return false
    const haystack = [item.id, item.name, item.category, ...(item.tags ?? [])]
      .join(' ')
      .toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}
