import { type SlotDeclaration, WALL_SURFACE_SLOT_DEFAULTS } from '@pascal-app/core'

/**
 * A wall exposes two paintable faces — interior + exterior. Painting writes
 * `node.slots[interior|exterior]` via `wallPaint` like every other kind; this
 * declaration surfaces the slot list + declared defaults for the picker and
 * keeps walls on the same `{ slotId, label, default }` contract. The defaults
 * come from core so the viewer's material resolver renders the identical value.
 */
export function wallSlots(): SlotDeclaration[] {
  return [
    { slotId: 'interior', label: 'Interior', default: WALL_SURFACE_SLOT_DEFAULTS.interior },
    { slotId: 'exterior', label: 'Exterior', default: WALL_SURFACE_SLOT_DEFAULTS.exterior },
    {
      slotId: 'lowerInterior',
      label: 'Faixa inferior (interior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.lowerInterior,
    },
    {
      slotId: 'middleInterior',
      label: 'Faixa intermediária (interior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.middleInterior,
    },
    {
      slotId: 'upperInterior',
      label: 'Faixa superior (interior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.upperInterior,
    },
    {
      slotId: 'topInterior',
      label: 'Faixa do topo (interior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.topInterior,
    },
    {
      slotId: 'lowerExterior',
      label: 'Faixa inferior (exterior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.lowerExterior,
    },
    {
      slotId: 'middleExterior',
      label: 'Faixa intermediária (exterior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.middleExterior,
    },
    {
      slotId: 'upperExterior',
      label: 'Faixa superior (exterior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.upperExterior,
    },
    {
      slotId: 'topExterior',
      label: 'Faixa do topo (exterior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.topExterior,
    },
    {
      slotId: 'skirtingInterior',
      label: 'Rodapé (interior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.skirtingInterior,
    },
    {
      slotId: 'skirtingExterior',
      label: 'Rodapé (exterior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.skirtingExterior,
    },
    {
      slotId: 'crownInterior',
      label: 'Sanca (interior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.crownInterior,
    },
    {
      slotId: 'crownExterior',
      label: 'Sanca (exterior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.crownExterior,
    },
    {
      slotId: 'chairRailInterior',
      label: 'Roda-meio (interior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.chairRailInterior,
    },
    {
      slotId: 'chairRailExterior',
      label: 'Roda-meio (exterior)',
      default: WALL_SURFACE_SLOT_DEFAULTS.chairRailExterior,
    },
  ]
}
