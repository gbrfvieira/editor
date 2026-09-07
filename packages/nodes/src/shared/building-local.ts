import { type AnyNodeId, sceneRegistry } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import type { Vector3 } from 'three'

/** Converts a world-space point to the selected building's local frame. */
export function worldToSelectedBuildingLocal(point: Vector3): [number, number, number] {
  const buildingId = useViewer.getState().selection.buildingId
  const buildingObj = buildingId ? sceneRegistry.nodes.get(buildingId as AnyNodeId) : undefined
  if (buildingObj) {
    buildingObj.updateWorldMatrix(true, false)
    buildingObj.worldToLocal(point)
  }
  return [point.x, point.y, point.z]
}
