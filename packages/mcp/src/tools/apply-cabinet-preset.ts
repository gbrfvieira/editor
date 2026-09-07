import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AnyNodeId } from '@pascal-app/core/schema'
import { CabinetModuleNode } from '@pascal-app/core/schema'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { CABINET_PRESET_IDS, cabinetPresetPatch } from './cabinet-shared'
import { ErrorCode, throwMcpError } from './errors'
import { liveSyncOutput, persistencePayload, publishLiveSceneSnapshot } from './live-sync'
import { NodeIdSchema } from './schemas'

export const applyCabinetPresetInput = {
  moduleId: NodeIdSchema,
  presetId: z.enum(CABINET_PRESET_IDS),
}

export const applyCabinetPresetOutput = {
  moduleId: z.string(),
  presetId: z.enum(CABINET_PRESET_IDS),
  ...liveSyncOutput,
}

export function registerApplyCabinetPreset(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'apply_cabinet_preset',
    {
      title: 'Apply cabinet preset',
      description: 'Apply one of the built-in cabinet module presets.',
      inputSchema: applyCabinetPresetInput,
      outputSchema: applyCabinetPresetOutput,
    },
    async ({ moduleId, presetId }) => {
      const module = bridge.getNode(moduleId as AnyNodeId)
      if (!module) throwMcpError(ErrorCode.InvalidParams, `Cabinet module not found: ${moduleId}`)
      if (module.type !== 'cabinet-module') {
        throwMcpError(
          ErrorCode.InvalidParams,
          `Node ${moduleId} is a ${module.type}, expected cabinet-module`,
        )
      }
      const run = module.parentId ? bridge.getNode(module.parentId as AnyNodeId) : null
      const patch = cabinetPresetPatch(presetId, run?.type === 'cabinet' ? run : undefined)
      const next = CabinetModuleNode.parse({ ...module, ...patch })
      bridge.updateNode(module.id as AnyNodeId, next)
      const persistence = await publishLiveSceneSnapshot(bridge, 'apply_cabinet_preset')
      const payload = {
        moduleId: module.id as string,
        presetId,
        ...persistencePayload(persistence),
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
