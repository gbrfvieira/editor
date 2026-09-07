import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AnyNodeId } from '@pascal-app/core/schema'
import { CabinetModuleNode } from '@pascal-app/core/schema'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { newCompartment } from './cabinet-shared'
import { ErrorCode, throwMcpError } from './errors'
import { liveSyncOutput, persistencePayload, publishLiveSceneSnapshot } from './live-sync'
import { measurement } from './measurement'
import { NodeIdSchema, Vec3Schema } from './schemas'

const compartmentTypes = z.enum([
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

export const addCabinetModuleInput = {
  runId: NodeIdSchema,
  compartmentType: compartmentTypes,
  width: measurement('length', 'm', { min: 0.05, max: 3 }).optional(),
  position: Vec3Schema.optional(),
}

export const addCabinetModuleOutput = { moduleId: z.string(), ...liveSyncOutput }

export function registerAddCabinetModule(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'add_cabinet_module',
    {
      title: 'Add cabinet module',
      description: 'Add a compartment module inside an existing cabinet run.',
      inputSchema: addCabinetModuleInput,
      outputSchema: addCabinetModuleOutput,
    },
    async ({ runId, compartmentType, width, position }) => {
      const run = bridge.getNode(runId as AnyNodeId)
      if (!run) throwMcpError(ErrorCode.InvalidParams, `Cabinet run not found: ${runId}`)
      if (run.type !== 'cabinet') {
        throwMcpError(
          ErrorCode.InvalidParams,
          `Node ${runId} is a ${run.type}, expected cabinet run`,
        )
      }
      const moduleWidth = width ?? Math.min(0.5, run.width)
      const modules = bridge
        .getChildren(run.id as AnyNodeId)
        .filter((node) => node.type === 'cabinet-module')
      const rightEdge = modules.reduce(
        (max, module) => Math.max(max, module.position[0] + module.width / 2),
        run.position[0] - run.width / 2,
      )
      const modulePosition = position
        ? ([...position] as [number, number, number])
        : [rightEdge + moduleWidth / 2, run.position[1], run.position[2]]
      const module = CabinetModuleNode.parse({
        parentId: run.id,
        name: `${compartmentType} cabinet module`,
        width: moduleWidth,
        depth: run.depth,
        carcassHeight: run.carcassHeight,
        boardThickness: run.boardThickness,
        plinthHeight: run.plinthHeight,
        toeKickDepth: run.toeKickDepth,
        countertopThickness: 0,
        countertopOverhang: run.countertopOverhang,
        showPlinth: false,
        withCountertop: false,
        handleStyle: run.handleStyle,
        frontStyle: run.frontStyle,
        frontOverlay: run.frontOverlay,
        position: modulePosition,
        stack: [newCompartment(compartmentType)],
      })
      const id = bridge.createNode(module, run.id as AnyNodeId)
      const persistence = await publishLiveSceneSnapshot(bridge, 'add_cabinet_module')
      const payload = { moduleId: id as string, ...persistencePayload(persistence) }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
