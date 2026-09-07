import { afterEach, describe, expect, test } from 'bun:test'
import { ShelfNode } from '@pascal-app/core'
import useFenceCurveDraft from './use-fence-curve-draft'
import { useFloorplanDraftPreview } from './use-floorplan-draft-preview'
import { usePathDraftPreview } from './use-path-draft-preview'
import { useStairBuildPreview } from './use-stair-build-preview'

afterEach(() => {
  useFenceCurveDraft.getState().reset()
  useFloorplanDraftPreview.getState().reset()
  usePathDraftPreview.getState().reset()
  useStairBuildPreview.getState().reset()
})

describe('live draft preview stores', () => {
  test('dedupes polygon snapshots and owns an immutable point copy', () => {
    let changes = 0
    const unsubscribe = useFloorplanDraftPreview.subscribe(() => {
      changes += 1
    })
    const points: Array<[number, number]> = [
      [0, 0],
      [2, 0],
    ]
    useFloorplanDraftPreview.getState().setPolygonDraft('slab', points)
    useFloorplanDraftPreview.getState().setPolygonDraft('slab', points)
    points[0]![0] = 9

    expect(changes).toBe(1)
    expect(useFloorplanDraftPreview.getState().polygonDraftPoints).toEqual([
      [0, 0],
      [2, 0],
    ])
    unsubscribe()
  })

  test('publishes stair point and rotation atomically', () => {
    let changes = 0
    const unsubscribe = useStairBuildPreview.subscribe(() => {
      changes += 1
    })
    useStairBuildPreview.getState().setPreview([3, 4], Math.PI / 2)
    useStairBuildPreview.getState().setPreview([3, 4], Math.PI / 2)

    expect(changes).toBe(1)
    expect(useStairBuildPreview.getState()).toMatchObject({
      point: [3, 4],
      rotation: Math.PI / 2,
    })
    unsubscribe()
  })

  test('dedupes curved-fence control points and cursor', () => {
    let changes = 0
    const unsubscribe = useFenceCurveDraft.subscribe(() => {
      changes += 1
    })
    const points: Array<[number, number]> = [
      [0, 0],
      [1, 1],
    ]
    useFenceCurveDraft.getState().setDraft(points, [2, 0])
    useFenceCurveDraft.getState().setDraft(points, [2, 0])
    points[0]![0] = 5

    expect(changes).toBe(1)
    expect(useFenceCurveDraft.getState()).toMatchObject({
      cursor: [2, 0],
      pointCount: 2,
      points: [
        [0, 0],
        [1, 1],
      ],
    })
    unsubscribe()
  })

  test('dedupes path drafts and owns immutable point, parameter, and related-node copies', () => {
    let changes = 0
    const unsubscribe = usePathDraftPreview.subscribe(() => {
      changes += 1
    })
    const points: Array<[number, number, number]> = [[0, 1, 2]]
    const parameters = { diameter: 6, shape: 'round' }
    const relatedNodes = [ShelfNode.parse({ id: 'shelf_live-draft-0', position: [1, 2, 3] })]
    usePathDraftPreview
      .getState()
      .setDraft('lineset', points, [3, 4, 5], parameters, relatedNodes)
    usePathDraftPreview
      .getState()
      .setDraft('lineset', points, [3, 4, 5], parameters, relatedNodes)
    points[0]![0] = 9
    parameters.diameter = 12
    relatedNodes[0]!.position[0] = 9

    expect(changes).toBe(1)
    expect(usePathDraftPreview.getState()).toMatchObject({
      cursor: [3, 4, 5],
      kind: 'lineset',
      parameters: { diameter: 6, shape: 'round' },
      points: [[0, 1, 2]],
      relatedNodes: [
        expect.objectContaining({
          id: 'shelf_live-draft-0',
          position: [1, 2, 3],
          type: 'shelf',
        }),
      ],
    })
    unsubscribe()
  })
})
