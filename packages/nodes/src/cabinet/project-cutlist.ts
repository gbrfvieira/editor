export type ProjectCabinet = {
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
  stack?: {
    type: string
    height?: number
    shelfCount?: number
    drawerCount?: number
    doorType?: string
  }[]
}

export type SceneCabinetCandidate = Partial<ProjectCabinet> & {
  id: string
  type: string
  children?: string[]
}

function isUsableCabinet(
  node: SceneCabinetCandidate,
): node is SceneCabinetCandidate & ProjectCabinet {
  return (
    (node.type === 'cabinet' || node.type === 'cabinet-module') &&
    typeof node.width === 'number' &&
    typeof node.depth === 'number' &&
    typeof node.carcassHeight === 'number' &&
    typeof node.boardThickness === 'number'
  )
}

/** Collects modules and legacy standalone cabinets without double-counting their parent runs. */
export function collectProjectCabinets(nodes: SceneCabinetCandidate[]): ProjectCabinet[] {
  const moduleIds = new Set(
    nodes.filter((node) => node.type === 'cabinet-module').map((node) => node.id),
  )
  return nodes.filter(
    (node): node is SceneCabinetCandidate & ProjectCabinet =>
      isUsableCabinet(node) &&
      (node.type === 'cabinet-module' ||
        !(node.children ?? []).some((childId) => moduleIds.has(childId))),
  )
}
