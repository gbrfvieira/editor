import type { CutListReport } from './index'

export type CutPanel = CutListReport['panels'][number] & { panelId?: string }

export type NestingPlacement = {
  panelId: string
  widthMm: number
  heightMm: number
  rotated: boolean
  xMm: number
  yMm: number
}

export type NestingResult = {
  sheets: { index: number; panels: NestingPlacement[] }[]
  sheetCount: number
  wasteAreaM2: number
  utilizationPercent: number
  /** Physical sheet dimensions used for the calculation (optional for compatibility). */
  sheetWidthMm?: number
  sheetHeightMm?: number
}

export type SheetSize = { widthMm: number; heightMm: number }

type Shelf = { yMm: number; heightMm: number; usedWidthMm: number }
type WorkingSheet = { shelves: Shelf[]; panels: NestingPlacement[] }

const DEFAULT_SHEET: SheetSize = { widthMm: 2750, heightMm: 1830 }
const DEFAULT_KERF_MM = 3

function areaMm2(widthMm: number, heightMm: number): number {
  return Math.max(0, widthMm) * Math.max(0, heightMm)
}

function expandedPanels(
  panels: CutPanel[],
): Array<CutPanel & { instance: number; sourceIndex: number }> {
  return panels.flatMap((panel, sourceIndex) =>
    Array.from({ length: Math.max(0, Math.floor(panel.quantity)) }, (_, instance) => ({
      ...panel,
      instance,
      sourceIndex,
    })),
  )
}

function candidateOrientations(
  panel: CutPanel,
): Array<{ widthMm: number; heightMm: number; rotated: boolean }> {
  const direct = { widthMm: panel.widthMm, heightMm: panel.heightMm, rotated: false }
  if (panel.widthMm === panel.heightMm) return [direct]
  return [direct, { widthMm: panel.heightMm, heightMm: panel.widthMm, rotated: true }]
}

function placementId(panel: CutPanel & { instance: number; sourceIndex: number }): string {
  return panel.panelId ?? `${panel.cabinetId}:${panel.label}:${panel.sourceIndex}:${panel.instance}`
}

/**
 * Packs panels with a first-fit decreasing shelf heuristic. It is deliberately
 * deterministic and permits a 90-degree rotation, but is not an optimal
 * bin-packing solver.
 */
export function nestPanels(
  panels: CutPanel[],
  sheet: SheetSize = DEFAULT_SHEET,
  kerfMm = DEFAULT_KERF_MM,
): NestingResult {
  const workingSheets: WorkingSheet[] = []
  const items = expandedPanels(panels).sort(
    (left, right) => areaMm2(right.widthMm, right.heightMm) - areaMm2(left.widthMm, left.heightMm),
  )

  for (const panel of items) {
    const orientations = candidateOrientations(panel)
    let placed = false
    for (const current of workingSheets) {
      const options: Array<{
        shelf: Shelf
        orientation: (typeof orientations)[number]
        score: number
      }> = []
      for (const shelf of current.shelves) {
        for (const orientation of orientations) {
          const xMm = shelf.usedWidthMm === 0 ? 0 : shelf.usedWidthMm + kerfMm
          if (
            xMm + orientation.widthMm <= sheet.widthMm &&
            orientation.heightMm <= shelf.heightMm
          ) {
            options.push({ shelf, orientation, score: sheet.widthMm - (xMm + orientation.widthMm) })
          }
        }
      }
      options.sort((left, right) => left.score - right.score)
      const best = options[0]
      if (best) {
        const xMm = best.shelf.usedWidthMm === 0 ? 0 : best.shelf.usedWidthMm + kerfMm
        current.panels.push({
          panelId: placementId(panel),
          widthMm: best.orientation.widthMm,
          heightMm: best.orientation.heightMm,
          rotated: best.orientation.rotated,
          xMm,
          yMm: best.shelf.yMm,
        })
        best.shelf.usedWidthMm = xMm + best.orientation.widthMm
        placed = true
        break
      }

      const yMm =
        current.shelves.length === 0
          ? 0
          : current.shelves[current.shelves.length - 1].yMm +
            current.shelves[current.shelves.length - 1].heightMm +
            kerfMm
      const newOrientation = orientations.find(
        (orientation) =>
          orientation.widthMm <= sheet.widthMm && yMm + orientation.heightMm <= sheet.heightMm,
      )
      if (newOrientation) {
        current.shelves.push({
          yMm,
          heightMm: newOrientation.heightMm,
          usedWidthMm: newOrientation.widthMm,
        })
        current.panels.push({ panelId: placementId(panel), ...newOrientation, xMm: 0, yMm })
        placed = true
        break
      }
    }

    if (!placed) {
      const orientation = orientations.find(
        (candidate) => candidate.widthMm <= sheet.widthMm && candidate.heightMm <= sheet.heightMm,
      )
      if (!orientation) continue
      workingSheets.push({
        shelves: [{ yMm: 0, heightMm: orientation.heightMm, usedWidthMm: orientation.widthMm }],
        panels: [{ panelId: placementId(panel), ...orientation, xMm: 0, yMm: 0 }],
      })
    }
  }

  const sheets = workingSheets.map((working, index) => ({ index, panels: working.panels }))
  const sheetArea = areaMm2(sheet.widthMm, sheet.heightMm)
  const usedArea = sheets.reduce(
    (sum, current) =>
      sum +
      current.panels.reduce((inner, panel) => inner + areaMm2(panel.widthMm, panel.heightMm), 0),
    0,
  )
  const totalArea = sheets.length * sheetArea
  return {
    sheets,
    sheetCount: sheets.length,
    wasteAreaM2: (totalArea - usedArea) / 1_000_000,
    utilizationPercent: totalArea === 0 ? 0 : (usedArea / totalArea) * 100,
    sheetWidthMm: sheet.widthMm,
    sheetHeightMm: sheet.heightMm,
  }
}
