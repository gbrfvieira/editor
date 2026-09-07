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
  width: measurement('length', 'm', { positive: true }).optional(),
  position: Vec3Schema.optional(),
  rotation: measurement('angle', 'rad').optional(),
}

export const createCabinetRunOutput = { cabinetId: z.string(), ...liveSyncOutput }

export function registerCreateCabinetRun(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'create_cabinet_run',
    {
      title: 'Create cabinet run',
      description:
        'Create a parametric cabinet run on a level, optionally aligned between two plan points.',
      inputSchema: createCabinetRunInput,
      outputSchema: createCabinetRunOutput,
    },
    async ({ levelId, start, end, width, position, rotation }) => {
      const level = bridge.getNode(levelId as AnyNodeId)
      if (!level) throwMcpError(ErrorCode.InvalidParams, `Level not found: ${levelId}`)
      if (level.type !== 'level') {
        throwMcpError(ErrorCode.InvalidParams, `Node ${levelId} is a ${level.type}, expected level`)
      }
      if ((start && !end) || (!start && end)) {
        throwMcpError(ErrorCode.InvalidParams, 'start and end must be provided together')
      }

      let runWidth = width
      let runPosition = (position ?? [0, 0, 0]) as [number, number, number]
      let runRotation = rotation ?? 0
      if (start && end) {
        const [sx, sz] = start as [number, number]
        const [ex, ez] = end as [number, number]
        const dx = ex - sx
        const dz = ez - sz
        runWidth = Math.hypot(dx, dz)
        runPosition = [(sx + ex) / 2, 0, (sz + ez) / 2]
        runRotation = Math.atan2(dz, dx)
      }
      const cabinet = CabinetNode.parse({
        width: runWidth ?? 0.5,
        position: runPosition,
        rotation: runRotation,
        children: [],
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
