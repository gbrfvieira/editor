import type { QuickMeasurementReport, SlabNode } from '@pascal-app/core'
import {
  polygonBoundaryLength,
  polygonReportAnchor,
  polygonSurfaceArea,
} from '../shared/quick-measurement'

export function slabQuickMeasurement(node: SlabNode): QuickMeasurementReport | null {
  if (node.polygon.length < 3) return null
  const elevation = node.elevation ?? 0.05
  const thickness = node.thickness ?? 0.05

  return {
    title: node.name ?? 'Laje de piso',
    kindLabel: 'Laje de piso',
    anchor: polygonReportAnchor(node.polygon, elevation + 0.04),
    metrics: [
      {
        key: 'area',
        label: 'Superfície',
        abbreviation: 'A',
        quantity: 'area',
        value: polygonSurfaceArea(node.polygon, node.holes),
      },
      {
        key: 'perimeter',
        label: 'Perímetro',
        abbreviation: 'P',
        quantity: 'length',
        value: polygonBoundaryLength(node.polygon),
      },
      {
        key: 'thickness',
        label: 'Espessura',
        abbreviation: 'T',
        quantity: 'length',
        value: thickness,
      },
    ],
    note: node.holes.length > 0 ? 'Surface excludes slab openings.' : undefined,
  }
}
