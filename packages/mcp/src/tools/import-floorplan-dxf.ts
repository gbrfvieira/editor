import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { extractDxfVectorSegments } from '@pascal-app/dxf-vector-extract'
import { detectWalls } from '@pascal-app/wall-detect'
import { z } from 'zod'
import type { SceneOperations } from '../operations'

export const importFloorplanDxfInput = {
  bytesBase64: z.string().min(1),
  preferLayerContaining: z.string().optional(),
  snapToleranceM: z.number().positive().optional(),
}

export const importFloorplanDxfOutput = { walls: z.array(z.unknown()) }

export function registerImportFloorplanDxf(server: McpServer, _bridge: SceneOperations): void {
  server.registerTool(
    'import_floorplan_dxf',
    {
      title: 'Preview floorplan DXF',
      description:
        'Decode a base64 ASCII DXF and return detected walls for review without scene writes.',
      inputSchema: importFloorplanDxfInput,
      outputSchema: importFloorplanDxfOutput,
    },
    async ({ bytesBase64, preferLayerContaining, snapToleranceM }) => {
      let source: string
      try {
        source = Buffer.from(bytesBase64, 'base64').toString('utf8')
      } catch {
        throw new Error('bytesBase64 is not valid base64')
      }
      const segments = extractDxfVectorSegments(source).flatMap((layer) =>
        layer.segments.map((segment) => ({ ...segment, layer: layer.layer })),
      )
      const result = detectWalls(segments, {
        ...(preferLayerContaining !== undefined ? { preferLayerContaining } : {}),
        ...(snapToleranceM !== undefined ? { snapToleranceM } : {}),
      })
      const payload = { walls: result.walls }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
