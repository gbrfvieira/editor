import type { CabinetNode } from '@pascal-app/core/schema'

export const CABINET_PRESET_IDS = [
  'base-door',
  'drawer-base',
  'dishwasher',
  'cooktop-gas',
  'cooktop-induction',
  'sink-base',
  'tall-pantry',
  'oven-tower',
  'fridge-single',
] as const

export type CabinetPresetId = (typeof CABINET_PRESET_IDS)[number]

type Compartment = Record<string, unknown> & { id: string; type: string }

let compartmentSequence = 0

export function newCompartment(type: string, fields: Record<string, unknown> = {}): Compartment {
  compartmentSequence += 1
  return { id: `cc_mcp_${compartmentSequence}`, type, ...fields }
}

function basePatch(run: CabinetNode | undefined): Record<string, unknown> {
  return {
    cabinetType: 'base',
    depth: run?.depth ?? 0.6,
    carcassHeight: run?.carcassHeight ?? 0.8,
    plinthHeight: run?.plinthHeight ?? 0.1,
    toeKickDepth: run?.toeKickDepth ?? 0.075,
    countertopThickness: 0,
    countertopOverhang: run?.countertopOverhang ?? 0.02,
    showPlinth: false,
    withCountertop: false,
    handleStyle: run?.handleStyle ?? 'bar',
    frontOverlay: run?.frontOverlay ?? 'full',
    stack: [newCompartment('door')],
  }
}

/**
 * Mirrors the public CABINET_PRESETS ids without coupling MCP to a private
 * source file in the nodes package. The values intentionally stay as a patch
 * so the live run supplies context-sensitive depth and height defaults.
 */
export function cabinetPresetPatch(
  id: CabinetPresetId,
  run: CabinetNode | undefined,
): Record<string, unknown> {
  const base = basePatch(run)
  switch (id) {
    case 'base-door':
      return {
        ...base,
        name: 'Base Cabinet',
        width: 0.5,
        stack: [
          newCompartment('drawer', { height: 0.44, drawerCount: 3 }),
          newCompartment('door', { doorType: 'double', shelfCount: 2 }),
        ],
      }
    case 'drawer-base':
      return {
        ...base,
        name: 'Drawer Base',
        width: 0.5,
        stack: [newCompartment('drawer', { drawerCount: 3 })],
      }
    case 'dishwasher':
      return {
        ...base,
        name: 'Dishwasher',
        width: 0.6,
        stack: [newCompartment('dishwasher', { height: run?.carcassHeight ?? 0.8 })],
      }
    case 'cooktop-gas':
      return {
        ...base,
        name: 'Gas Hob Base',
        width: 0.75,
        stack: [
          newCompartment('drawer', { drawerCount: 2 }),
          newCompartment('cooktop-gas', { height: 0.08, cooktopLayout: 'gas-5burner-wok' }),
        ],
      }
    case 'cooktop-induction':
      return {
        ...base,
        name: 'Induction Base',
        width: 0.75,
        stack: [
          newCompartment('drawer', { drawerCount: 2 }),
          newCompartment('cooktop-induction', { height: 0.08, cooktopLayout: 'induction-4zone' }),
        ],
      }
    case 'sink-base':
      return {
        ...base,
        name: 'Sink Base',
        width: 0.8,
        stack: [newCompartment('door', { doorType: 'double' }), newCompartment('sink')],
      }
    case 'tall-pantry':
      return {
        ...base,
        cabinetType: 'tall',
        name: 'Tall Pantry',
        width: 0.5,
        carcassHeight: 2.07,
        stack: [newCompartment('door', { doorType: 'double', shelfCount: 4 })],
      }
    case 'oven-tower':
      return {
        ...base,
        cabinetType: 'tall',
        name: 'Oven Tower',
        width: 0.61,
        carcassHeight: 2.07,
        stack: [
          newCompartment('drawer', { height: 0.42, drawerCount: 2 }),
          newCompartment('oven', { height: 0.595 }),
          newCompartment('microwave', { height: 0.39 }),
          newCompartment('door', { doorType: 'double', shelfCount: 2 }),
        ],
      }
    case 'fridge-single':
      return {
        ...base,
        cabinetType: 'tall',
        name: 'Single Door Refrigerator',
        width: 0.76,
        carcassHeight: 1.78,
        stack: [newCompartment('fridge-single', { height: 1.78 })],
      }
  }
}
