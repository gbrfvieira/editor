import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AnyNodeId } from '@pascal-app/core/schema'
import { WallNode } from '@pascal-app/core/schema'
import { commitWalls, type DetectedWall, toWallNodePatches } from '@pascal-app/floorplan-import'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { ErrorCode, throwMcpError } from './errors'
import { liveSyncOutput, persistencePayload, publishLiveSceneSnapshot } from './live-sync'
import { NodeIdSchema, Vec2Schema } from './schemas'

const detectedWallSchema = z.object({
  start: Vec2Schema,
  end: Vec2Schema,
  thickness: z.number().positive(),
  confidence: z.number().min(0).max(1),
})

export const commitFloorplanWallsInput = {
  levelId: NodeIdSchema,
  walls: z.array(detectedWallSchema),
  minConfidence: z.number().min(0).max(1).optional(),
  defaultHeight: z.number().positive().optional(),
}

export const commitFloorplanWallsOutput = { wallIds: z.array(z.string()), ...liveSyncOutput }

export function registerCommitFloorplanWalls(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'commit_floorplan_walls',
    {
      title: 'Commit floorplan walls',
      description: 'Create approved detected walls on a level after preview/review.',
      inputSchema: commitFloorplanWallsInput,
      outputSchema: commitFloorplanWallsOutput,
    },
    async ({ levelId, walls, minConfidence, defaultHeight }) => {
      const parent = bridge.getNode(levelId as AnyNodeId)
      if (!parent) throwMcpError(ErrorCode.InvalidParams, `Level not found: ${levelId}`)
      if (parent.type !== 'level') {
        throwMcpError(
          ErrorCode.InvalidParams,
          `Node ${levelId} is a ${parent.type}, expected level`,
        )
      }
      const patches = toWallNodePatches(walls as DetectedWall[], { minConfidence, defaultHeight })
      const wallIds: string[] = []
      commitWalls(
        patches,
        {
          createNode: (data, parentId) => {
            const node = WallNode.parse(data)
            wallIds.push(bridge.createNode(node, parentId as AnyNodeId) as string)
          },
        },
        levelId,
      )
      const persistence = await publishLiveSceneSnapshot(bridge, 'commit_floorplan_walls')
      const payload = { wallIds, ...persistencePayload(persistence) }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
