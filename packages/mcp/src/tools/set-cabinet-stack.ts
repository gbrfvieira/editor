import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AnyNodeId } from '@pascal-app/core/schema'
import { CabinetModuleNode } from '@pascal-app/core/schema'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { newCompartment } from './cabinet-shared'
import { ErrorCode, throwMcpError } from './errors'
import { liveSyncOutput, persistencePayload, publishLiveSceneSnapshot } from './live-sync'
import { NodeIdSchema } from './schemas'

const compartmentType = z.enum([
  'shelf',
  'drawer',
  'door',
  'oven',
  'microwave',
  'dishwasher',
  'sink',
  'cooktop-gas',
  'cooktop-induction',
  'pull-out-pantry',
  'fridge-single',
  'fridge-double',
  'fridge-top-freezer',
  'fridge-bottom-freezer',
  'hood-pyramid',
  'hood-curved-glass',
])

const compartment = z.object({
  id: z.string().optional(),
  type: compartmentType,
  height: z.number().positive().optional(),
  shelfCount: z.number().int().min(0).max(8).optional(),
  drawerCount: z.number().int().min(1).max(6).optional(),
  doorType: z.enum(['single-left', 'single-right', 'double', 'glass']).optional(),
})

export const setCabinetStackInput = {
  moduleId: NodeIdSchema,
  stack: z.array(compartment).max(32),
}

export const setCabinetStackOutput = {
  moduleId: z.string(),
  compartmentCount: z.number(),
  ...liveSyncOutput,
}

export function registerSetCabinetStack(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'set_cabinet_stack',
    {
      title: 'Set cabinet stack',
      description:
        'Replace a cabinet module compartment stack with the supplied door/drawer/shelf layout.',
      inputSchema: setCabinetStackInput,
      outputSchema: setCabinetStackOutput,
    },
    async ({ moduleId, stack }) => {
      const module = bridge.getNode(moduleId as AnyNodeId)
      if (!module) throwMcpError(ErrorCode.InvalidParams, `Cabinet module not found: ${moduleId}`)
      if (module.type !== 'cabinet-module') {
        throwMcpError(
          ErrorCode.InvalidParams,
          `Node ${moduleId} is a ${module.type}, expected cabinet-module`,
        )
      }
      const normalizedStack = stack.map(({ id, type, ...fields }) =>
        newCompartment(type, id ? { ...fields, id } : fields),
      )
      const next = CabinetModuleNode.parse({ ...module, stack: normalizedStack })
      bridge.updateNode(module.id as AnyNodeId, next)
      const persistence = await publishLiveSceneSnapshot(bridge, 'set_cabinet_stack')
      const payload = {
        moduleId: module.id as string,
        compartmentCount: normalizedStack.length,
        ...persistencePayload(persistence),
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
