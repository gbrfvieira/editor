import type { AnyNode } from '@pascal-app/core'

export type NodeDisplay = {
  icon: string
  label: string
}

const TYPE_DEFAULTS: Record<string, NodeDisplay> = {
  item: { icon: '/icons/item.webp', label: 'Item' },
  wall: { icon: '/icons/wall.webp', label: 'Parede' },
  door: { icon: '/icons/door.webp', label: 'Porta' },
  window: { icon: '/icons/window.webp', label: 'Janela' },
  slab: { icon: '/icons/floor.webp', label: 'Laje' },
  ceiling: { icon: '/icons/ceiling.webp', label: 'Teto' },
  column: { icon: '/icons/column.webp', label: 'Pilar' },
  elevator: { icon: '/icons/elevator.webp', label: 'Elevador' },
  fence: { icon: '/icons/fence.webp', label: 'Cerca' },
  roof: { icon: '/icons/roof.webp', label: 'Telhado' },
  'roof-segment': { icon: '/icons/roof.webp', label: 'Água do telhado' },
  stair: { icon: '/icons/stairs.webp', label: 'Escada' },
  'stair-segment': { icon: '/icons/stairs.webp', label: 'Lance de escada' },
  scan: { icon: '/icons/mesh.webp', label: 'Escaneamento 3D' },
  guide: { icon: '/icons/floorplan.webp', label: 'Imagem de guia' },
}

export function getTypeDisplay(type: string): NodeDisplay {
  return TYPE_DEFAULTS[type] ?? { icon: '/icons/select.webp', label: type }
}

export function getNodeDisplay(node: AnyNode | null | undefined): NodeDisplay {
  if (!node) return { icon: '/icons/select.webp', label: 'Seleção' }
  const fallback = TYPE_DEFAULTS[node.type] ?? { icon: '/icons/select.webp', label: node.type }
  // Item nodes carry an asset with its own thumbnail/name
  if (node.type === 'item') {
    return {
      icon: node.asset?.thumbnail || fallback.icon,
      label: node.name || node.asset?.name || fallback.label,
    }
  }
  return {
    icon: fallback.icon,
    label: node.name || fallback.label,
  }
}
