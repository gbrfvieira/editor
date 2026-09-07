import type { CatalogCategory, StructureTool } from '../../../store/use-editor'

export type ToolConfig = {
  id: StructureTool
  iconSrc: string
  label: string
  catalogCategory?: CatalogCategory
}

// Shared structure-tool metadata (icons + labels). The build palette now lives
// in the community Build sidebar; this list survives only as the lookup table
// for cursor/floorplan indicators. Roof-mounted accessories are intentionally
// absent — they're placed from the roof inspector's "Add element" section.
export const tools: ToolConfig[] = [
  { id: 'wall', iconSrc: '/icons/wall.webp', label: 'Parede' },
  { id: 'door', iconSrc: '/icons/door.webp', label: 'Porta' },
  { id: 'window', iconSrc: '/icons/window.webp', label: 'Janela' },
  { id: 'stair', iconSrc: '/icons/stairs.webp', label: 'Escadas' },
  { id: 'roof', iconSrc: '/icons/roof.webp', label: 'Telhado de duas águas' },
  { id: 'fence', iconSrc: '/icons/fence.webp', label: 'Cerca' },
  { id: 'column', iconSrc: '/icons/column.webp', label: 'Pilar' },
  { id: 'elevator', iconSrc: '/icons/elevator.webp', label: 'Elevador' },
  { id: 'slab', iconSrc: '/icons/floor.webp', label: 'Laje' },
  { id: 'ceiling', iconSrc: '/icons/ceiling.webp', label: 'Teto' },
  { id: 'zone', iconSrc: '/icons/zone.webp', label: 'Ambiente' },
  { id: 'spawn', iconSrc: '/icons/spawn-point.webp', label: 'Ponto inicial' },
  { id: 'shelf', iconSrc: '/icons/shelf.webp', label: 'Prateleira' },
]
