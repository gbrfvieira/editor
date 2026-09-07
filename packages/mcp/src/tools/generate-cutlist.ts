import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AnyNodeId } from '@pascal-app/core/schema'
import { type CabinetLike, createCutList } from '@pascal-app/cutlist'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { ErrorCode, throwMcpError } from './errors'
import { NodeIdSchema } from './schemas'

export const generateCutlistInput = {
  cabinetId: NodeIdSchema.optional(),
  cabinetIds: z.array(NodeIdSchema).min(1).optional(),
}

export const generateCutlistOutput = { report: z.unknown() }

export function registerGenerateCutlist(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'generate_cutlist',
    {
      title: 'Generate cabinet cut list',
      description: 'Generate panels, hardware and edge banding for one or more cabinet nodes.',
      inputSchema: generateCutlistInput,
      outputSchema: generateCutlistOutput,
    },
    async ({ cabinetId, cabinetIds }) => {
      const ids = cabinetIds ?? (cabinetId ? [cabinetId] : [])
      if (ids.length === 0)
        throwMcpError(ErrorCode.InvalidParams, 'cabinetId or cabinetIds is required')
      const nodes = ids.map((id) => bridge.getNode(id as AnyNodeId))
      const missing = ids.findIndex((_, index) => !nodes[index])
      if (missing >= 0) throwMcpError(ErrorCode.InvalidParams, `Cabinet not found: ${ids[missing]}`)
      const invalid = nodes.find(
        (node) => node?.type !== 'cabinet' && node?.type !== 'cabinet-module',
      )
      if (invalid)
        throwMcpError(ErrorCode.InvalidParams, `Node ${invalid.id} is not a cabinet node`)
      const report = createCutList(nodes as unknown as CabinetLike[])
      const payload = { report }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
