import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AnyNodeId } from '@pascal-app/core/schema'
import { WallNode } from '@pascal-app/core/schema'
import { commitWalls, type DetectedWall, toWallNodePatches } from '@pascal-app/floorplan-import'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { ErrorCode, throwMcpError } from './errors'
import { liveSyncOutput, persistencePayload, publishLiveSceneSnapshot } from './live-sync'
import { NodeIdSchema } from './schemas'

const detectedWallSchema = z.object({
  start: z.array(z.number()).length(2),
  end: z.array(z.number()).length(2),
  thickness: z.number().positive(),
  confidence: z.number().min(0).max(1),
})

export const commitFloorplanWallsInput = {
  levelId: NodeIdSchema,
  walls: z.array(detectedWallSchema),
}

export const commitFloorplanWallsOutput = { wallIds: z.array(z.string()), ...liveSyncOutput }

export function registerCommitFloorplanWalls(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'commit_floorplan_walls',
    {
      title: 'Commit floor plan walls',
      description: 'Create approved detected walls on a scene level.',
      inputSchema: commitFloorplanWallsInput,
      outputSchema: commitFloorplanWallsOutput,
    },
    async ({ levelId, walls }) => {
      const level = bridge.getNode(levelId as AnyNodeId)
      if (!level) throwMcpError(ErrorCode.InvalidParams, `Level not found: ${levelId}`)
      if (level.type !== 'level')
        throwMcpError(ErrorCode.InvalidParams, `Node ${levelId} is not a level`)
      const wallIds: string[] = []
      const patches = toWallNodePatches(walls as DetectedWall[])
      commitWalls(
        patches,
        {
          createNode(data, parentId) {
            const id = bridge.createNode(WallNode.parse(data), parentId as AnyNodeId)
            wallIds.push(id as string)
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
