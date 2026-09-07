import type { Quaternion, Vector3 } from 'three'
import type { SurfaceType } from './placement-types'

export function resolveItemPlacementSurfaceNormal(
  surface: SurfaceType,
  ghostWorldQuaternion: Quaternion,
  hostedItemWorldQuaternion: Quaternion | null,
  target: Vector3,
  attachTo?: 'wall' | 'wall-side' | 'ceiling',
): Vector3 {
  if (surface === 'wall' || surface === 'roof-wall') {
    target.set(0, 0, 1).applyQuaternion(hostedItemWorldQuaternion ?? ghostWorldQuaternion)
    target.y = 0
    if (target.lengthSq() > 1e-6) return target.normalize()
  }
  return target.set(0, 1, 0)
}
