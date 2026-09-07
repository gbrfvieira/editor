import type { CatalogCategory } from './../../../store/use-editor'

export type FurnishToolConfig = {
  id: 'item'
  iconSrc: string
  label: string
  catalogCategory: CatalogCategory
}

export const furnishTools: FurnishToolConfig[] = [
  { id: 'item', iconSrc: '/icons/couch.webp', label: 'Mobiliário', catalogCategory: 'furniture' },
  { id: 'item', iconSrc: '/icons/appliance.webp', label: 'Eletrodoméstico', catalogCategory: 'appliance' },
  { id: 'item', iconSrc: '/icons/kitchen.webp', label: 'Cozinha', catalogCategory: 'kitchen' },
  { id: 'item', iconSrc: '/icons/bathroom.webp', label: 'Banheiro', catalogCategory: 'bathroom' },
  { id: 'item', iconSrc: '/icons/tree.webp', label: 'Área externa', catalogCategory: 'outdoor' },
]
