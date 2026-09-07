import type { AnyNode, AnyNodeId } from '@pascal-app/core'

/**
 * The level that owns the wall-snap candidates for an opening (door /
 * window), across the two parentings the 2D move can start from:
 *   - wall-hosted (existing opening): parent is a wall → its parent is the level.
 *   - fresh placement (preset/catalog): the clone is parented straight to the
 *     LEVEL (`place-preset` sets `parentId: levelId`), so the parent IS the level.
 *
 * The fresh-placement case is the subtle one: treating the parent as always a
 * wall (`parent.parentId`) resolves a fresh opening's level to the BUILDING,
 * and `collectLevelWallSegments(building)` finds no walls — so a new door /
 * window never snapped in 2D. Returns null when the parent chain is neither.
 */
export function getOpeningHostLevelId(
  node: { parentId: string | null },
  nodes: Record<string, AnyNode | undefined>,
): AnyNodeId | null {
  const parent = node.parentId ? nodes[node.parentId] : undefined
  if (!parent) return null
  if (parent.type === 'level') return parent.id as AnyNodeId
  return (parent.parentId as AnyNodeId | null) ?? null
}
