import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AnyNodeId } from '@pascal-app/core/schema'
import { type CabinetLike, createCutList, nestPanels } from '@pascal-app/cutlist'
import { calculateQuote, type PriceTable } from '@pascal-app/quote'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { ErrorCode, throwMcpError } from './errors'
import { NodeIdSchema } from './schemas'

const priceTableSchema = z.object({
  boardPricePerM2: z.record(z.string(), z.number().nonnegative()),
  edgeBandingPricePerMeter: z.number().nonnegative(),
  hardwarePrices: z.object({
    hinge: z.number().nonnegative(),
    'drawer-slide': z.number().nonnegative(),
    handle: z.number().nonnegative(),
  }),
  laborMultiplier: z.number().positive().optional(),
})

export const generateQuoteInput = {
  cabinetId: NodeIdSchema.optional(),
  cabinetIds: z.array(NodeIdSchema).min(1).optional(),
  prices: priceTableSchema,
}

export const generateQuoteOutput = { report: z.unknown() }

export function registerGenerateQuote(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'generate_quote',
    {
      title: 'Generate cabinet quote',
      description: 'Generate a material, edge-banding and hardware quote for cabinet nodes.',
      inputSchema: generateQuoteInput,
      outputSchema: generateQuoteOutput,
    },
    async ({ cabinetId, cabinetIds, prices }) => {
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
      const cutList = createCutList(nodes as unknown as CabinetLike[])
      const nesting = nestPanels(cutList.panels)
      const report = calculateQuote(cutList, nesting, prices as PriceTable)
      const payload = { report }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
