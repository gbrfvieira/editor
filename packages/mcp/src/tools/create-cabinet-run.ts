import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AnyNodeId } from '@pascal-app/core/schema'
import { CabinetNode } from '@pascal-app/core/schema'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { ErrorCode, throwMcpError } from './errors'
import { liveSyncOutput, persistencePayload, publishLiveSceneSnapshot } from './live-sync'
import { measurement } from './measurement'
import { NodeIdSchema, Vec2Schema, Vec3Schema } from './schemas'

export const createCabinetRunInput = {
  levelId: NodeIdSchema,
  start: Vec2Schema.optional(),
  end: Vec2Schema.optional(),
  width: measurement('length', 'm', { min: 0.05, max: 3 }).optional(),
  position: Vec3Schema.optional(),
  rotation: z.number().finite().optional(),
  depth: measurement('length', 'm', { min: 0.3, max: 1.2 }).optional(),
  name: z.string().optional(),
}

export const createCabinetRunOutput = { cabinetId: z.string(), ...liveSyncOutput }

export function registerCreateCabinetRun(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'create_cabinet_run',
    {
      title: 'Create cabinet run',
      description:
        'Create a parametric cabinet run on a level. Provide start/end points or an explicit width, position and rotation.',
      inputSchema: createCabinetRunInput,
      outputSchema: createCabinetRunOutput,
    },
    async ({ levelId, start, end, width, position, rotation, depth, name }) => {
      const parent = bridge.getNode(levelId as AnyNodeId)
      if (!parent) throwMcpError(ErrorCode.InvalidParams, `Level not found: ${levelId}`)
      if (parent.type !== 'level') {
        throwMcpError(
          ErrorCode.InvalidParams,
          `Node ${levelId} is a ${parent.type}, expected level`,
        )
      }
      if ((start && !end) || (!start && end)) {
        throwMcpError(ErrorCode.InvalidParams, 'start and end must be supplied together')
      }

      let resolvedWidth = width
      let resolvedPosition = position ? ([...position] as [number, number, number]) : [0, 0, 0]
      let resolvedRotation = rotation ?? 0
      if (start && end) {
        const [sx, sz] = start as [number, number]
        const [ex, ez] = end as [number, number]
        const dx = ex - sx
        const dz = ez - sz
        resolvedWidth = Math.hypot(dx, dz)
        if (resolvedWidth < 0.05) {
          throwMcpError(ErrorCode.InvalidParams, 'start and end must be at least 0.05 m apart')
        }
        resolvedPosition = [(sx + ex) / 2, 0, (sz + ez) / 2]
        resolvedRotation = Math.atan2(dz, dx)
      }
      if (resolvedWidth === undefined) {
        throwMcpError(ErrorCode.InvalidParams, 'Provide start/end or an explicit width')
      }

      const cabinet = CabinetNode.parse({
        ...(name ? { name } : {}),
        parentId: levelId,
        width: resolvedWidth,
        position: resolvedPosition,
        rotation: resolvedRotation,
        ...(depth !== undefined ? { depth } : {}),
      })
      const id = bridge.createNode(cabinet, levelId as AnyNodeId)
      const persistence = await publishLiveSceneSnapshot(bridge, 'create_cabinet_run')
      const payload = { cabinetId: id as string, ...persistencePayload(persistence) }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
