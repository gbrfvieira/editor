import type { SlotDeclaration } from '@pascal-app/core'

export type CabinetSlotId =
  | 'front'
  | 'carcass'
  | 'countertop'
  | 'plinth'
  | 'hardware'
  | 'glass'
  | 'appliance'
  | 'applianceInterior'

const FRONT_DEFAULT = 'library:preset-softwhite'
const CARCASS_DEFAULT = 'library:preset-softwhite'
const COUNTERTOP_DEFAULT = 'library:wood-finewood27'
const PLINTH_DEFAULT = 'library:preset-softwhite'
const HARDWARE_DEFAULT = 'library:metal-chrome'
const GLASS_DEFAULT = 'library:preset-glass'
const APPLIANCE_DEFAULT = 'library:metal-steel'
const APPLIANCE_INTERIOR_DEFAULT = 'library:preset-charcoal'

export function cabinetSlots(): SlotDeclaration[] {
  return [
    { slotId: 'front', label: 'Frente', default: FRONT_DEFAULT },
    { slotId: 'carcass', label: 'Caixa', default: CARCASS_DEFAULT },
    { slotId: 'countertop', label: 'Tampo', default: COUNTERTOP_DEFAULT },
    { slotId: 'plinth', label: 'Rodapé', default: PLINTH_DEFAULT },
    { slotId: 'hardware', label: 'Ferragens', default: HARDWARE_DEFAULT },
    { slotId: 'glass', label: 'Vidro', default: GLASS_DEFAULT },
    { slotId: 'appliance', label: 'Eletrodoméstico', default: APPLIANCE_DEFAULT },
    {
      slotId: 'applianceInterior',
      label: 'Interior do eletrodoméstico',
      default: APPLIANCE_INTERIOR_DEFAULT,
    },
  ]
}
