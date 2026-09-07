import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AnyNodeId } from '@pascal-app/core/schema'
import { CabinetModuleNode, generateId } from '@pascal-app/core/schema'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { ErrorCode, throwMcpError } from './errors'
import { liveSyncOutput, persistencePayload, publishLiveSceneSnapshot } from './live-sync'
import { measurement } from './measurement'
import { NodeIdSchema } from './schemas'

const compartmentTypes = [
  'door',
  'drawer',
  'shelf',
  'sink',
  'oven',
  'microwave',
  'dishwasher',
  'cooktop-gas',
  'cooktop-induction',
  'pull-out-pantry',
  'fridge-single',
  'fridge-double',
  'fridge-top-freezer',
  'fridge-bottom-freezer',
  'hood-pyramid',
  'hood-curved-glass',
] as const

export const addCabinetModuleInput = {
  runId: NodeIdSchema,
  compartmentType: z.enum(compartmentTypes),
  height: measurement('length', 'm', { positive: true }).optional(),
  count: z.number().int().positive().max(8).optional(),
}

export const addCabinetModuleOutput = { moduleId: z.string(), ...liveSyncOutput }

export function registerAddCabinetModule(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'add_cabinet_module',
    {
      title: 'Add cabinet module',
      description: 'Add a compartment module to an existing cabinet run.',
      inputSchema: addCabinetModuleInput,
      outputSchema: addCabinetModuleOutput,
    },
    async ({ runId, compartmentType, height, count }) => {
      const run = bridge.getNode(runId as AnyNodeId)
      if (!run) throwMcpError(ErrorCode.InvalidParams, `Cabinet run not found: ${runId}`)
      if (run.type !== 'cabinet') {
        throwMcpError(
          ErrorCode.InvalidParams,
          `Node ${runId} is a ${run.type}, expected cabinet run`,
        )
      }
      const compartment: Record<string, unknown> = {
        id: generateId('compartment'),
        type: compartmentType,
        ...(height !== undefined ? { height } : {}),
      }
      if (compartmentType === 'drawer' && count !== undefined) compartment.drawerCount = count
      if (compartmentType === 'shelf' && count !== undefined) compartment.shelfCount = count
      if (compartmentType === 'door' && count !== undefined) compartment.shelfCount = count
      const moduleNode = CabinetModuleNode.parse({
        parentId: runId,
        width: run.width,
        depth: run.depth,
        carcassHeight: run.carcassHeight,
        stack: [compartment],
        children: [],
      })
      const id = bridge.createNode(moduleNode, runId as AnyNodeId)
      const persistence = await publishLiveSceneSnapshot(bridge, 'add_cabinet_module')
      const payload = { moduleId: id as string, ...persistencePayload(persistence) }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
