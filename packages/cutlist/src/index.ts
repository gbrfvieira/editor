export type CabinetCompartmentLike = {
  type: string
  height?: number
  shelfCount?: number
  drawerCount?: number
  doorType?: string
}

export type CabinetLike = {
  id: string
  width: number
  depth: number
  carcassHeight: number
  boardThickness: number
  countertopThickness?: number
  withBottomPanel?: boolean
  withFinishedBack?: boolean
  withCountertop?: boolean
  handleStyle?: string
  materialPreset?: string
  material?: unknown
  stack?: CabinetCompartmentLike[]
}

export type CutListReport = {
  panels: {
    cabinetId: string
    label: string
    widthMm: number
    heightMm: number
    thicknessMm: number
    material?: string
    quantity: number
  }[]
  hardware: { cabinetId: string; item: 'hinge' | 'drawer-slide' | 'handle'; quantity: number }[]
  edgeBanding: { cabinetId: string; panel: string; lengthMm: number }[]
}

const mm = (meters: number) => meters * 1000

function addPanel(
  report: CutListReport,
  cabinet: CabinetLike,
  label: string,
  width: number,
  height: number,
  thickness: number,
  quantity: number,
) {
  if (quantity <= 0 || width <= 0 || height <= 0) return
  const material = typeof cabinet.materialPreset === 'string' ? cabinet.materialPreset : undefined
  const existing = report.panels.find(
    (panel) =>
      panel.cabinetId === cabinet.id &&
      panel.label === label &&
      panel.widthMm === mm(width) &&
      panel.heightMm === mm(height) &&
      panel.thicknessMm === mm(thickness) &&
      panel.material === material,
  )
  if (existing) existing.quantity += quantity
  else
    report.panels.push({
      cabinetId: cabinet.id,
      label,
      widthMm: mm(width),
      heightMm: mm(height),
      thicknessMm: mm(thickness),
      ...(material ? { material } : {}),
      quantity,
    })
}

function addHardware(
  report: CutListReport,
  cabinetId: string,
  item: CutListReport['hardware'][number]['item'],
  quantity: number,
) {
  if (quantity <= 0) return
  const existing = report.hardware.find(
    (entry) => entry.cabinetId === cabinetId && entry.item === item,
  )
  if (existing) existing.quantity += quantity
  else report.hardware.push({ cabinetId, item, quantity })
}

export function createCutList(cabinets: CabinetLike[]): CutListReport {
  const report: CutListReport = { panels: [], hardware: [], edgeBanding: [] }
  for (const cabinet of cabinets) {
    const board = cabinet.boardThickness
    addPanel(report, cabinet, 'side', cabinet.depth, cabinet.carcassHeight, board, 2)
    if (cabinet.withBottomPanel !== false)
      addPanel(report, cabinet, 'bottom', cabinet.width, cabinet.depth, board, 1)
    if (cabinet.withFinishedBack === true)
      addPanel(report, cabinet, 'back', cabinet.width, cabinet.carcassHeight, board, 1)
    if (cabinet.withCountertop === true)
      addPanel(
        report,
        cabinet,
        'countertop',
        cabinet.width,
        cabinet.depth,
        cabinet.countertopThickness ?? board,
        1,
      )

    for (const compartment of cabinet.stack ?? []) {
      if (compartment.type === 'shelf') {
        addPanel(
          report,
          cabinet,
          'shelf',
          cabinet.width,
          cabinet.depth,
          board,
          Math.max(0, Math.floor(compartment.shelfCount ?? 0)),
        )
      } else if (compartment.type === 'door') {
        const leaves = compartment.doorType === 'double' ? 2 : 1
        const height = compartment.height ?? cabinet.carcassHeight
        if (compartment.shelfCount) {
          addPanel(
            report,
            cabinet,
            'shelf',
            cabinet.width,
            cabinet.depth,
            board,
            Math.max(0, Math.floor(compartment.shelfCount)),
          )
        }
        addPanel(report, cabinet, 'door', cabinet.width / leaves, height, board, leaves)
        addHardware(report, cabinet.id, 'hinge', leaves === 2 ? 4 : 2)
        if (cabinet.handleStyle !== 'none') addHardware(report, cabinet.id, 'handle', leaves)
        for (let i = 0; i < leaves; i++)
          report.edgeBanding.push({
            cabinetId: cabinet.id,
            panel: 'door',
            lengthMm: mm(2 * (cabinet.width / leaves + height)),
          })
      } else if (compartment.type === 'drawer') {
        const count = Math.max(0, Math.floor(compartment.drawerCount ?? 0))
        const height = (compartment.height ?? cabinet.carcassHeight) / Math.max(1, count)
        addPanel(report, cabinet, 'drawer-front', cabinet.width, height, board, count)
        addHardware(report, cabinet.id, 'drawer-slide', count)
        if (cabinet.handleStyle !== 'none') addHardware(report, cabinet.id, 'handle', count)
        for (let i = 0; i < count; i++)
          report.edgeBanding.push({
            cabinetId: cabinet.id,
            panel: 'drawer-front',
            lengthMm: mm(2 * (cabinet.width + height)),
          })
      }
    }
  }
  return report
}

export const extractCutList = createCutList

function csvCell(value: string | number | undefined): string {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(report: CutListReport): string {
  const rows: string[] = []
  rows.push('[panels]', 'cabinetId,label,widthMm,heightMm,thicknessMm,material,quantity')
  for (const panel of report.panels)
    rows.push(
      [
        panel.cabinetId,
        panel.label,
        panel.widthMm,
        panel.heightMm,
        panel.thicknessMm,
        panel.material,
        panel.quantity,
      ]
        .map(csvCell)
        .join(','),
    )
  rows.push('', '[hardware]', 'cabinetId,item,quantity')
  for (const item of report.hardware)
    rows.push([item.cabinetId, item.item, item.quantity].map(csvCell).join(','))
  rows.push('', '[edgeBanding]', 'cabinetId,panel,lengthMm')
  for (const item of report.edgeBanding)
    rows.push([item.cabinetId, item.panel, item.lengthMm].map(csvCell).join(','))
  return rows.join('\n')
}
