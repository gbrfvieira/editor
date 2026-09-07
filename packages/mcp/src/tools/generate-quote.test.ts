import { expect, test } from 'bun:test'
import type { SceneOperations } from '../operations'
import { registerGenerateQuote } from './generate-quote'

type Handler = (input: Record<string, unknown>) => Promise<unknown>

function harness() {
  const registrations = new Map<string, Handler>()
  const server = {
    registerTool(name: string, _config: unknown, handler: Handler) {
      registrations.set(name, handler)
    },
  }
  const nodes = {
    cabinet_1: {
      id: 'cabinet_1',
      type: 'cabinet',
      width: 0.6,
      depth: 0.6,
      carcassHeight: 0.8,
      boardThickness: 0.018,
      stack: [{ type: 'door', doorType: 'single-left', height: 0.8 }],
      handleStyle: 'bar',
    },
  }
  const bridge = {
    getNode: (id: string) => nodes[id as keyof typeof nodes] ?? null,
  } as unknown as SceneOperations
  return { registrations, server, bridge }
}

const prices = {
  boardPricePerM2: { default: 20 },
  edgeBandingPricePerMeter: 2,
  hardwarePrices: { hinge: 1, 'drawer-slide': 3, handle: 4 },
}

test('registers and calculates a quote for a cabinet', async () => {
  const { registrations, server, bridge } = harness()
  registerGenerateQuote(server as never, bridge)
  const result = await registrations.get('generate_quote')!({ cabinetId: 'cabinet_1', prices })
  const payload = JSON.parse((result as { content: [{ text: string }] }).content[0].text)
  expect(payload.report.subtotal).toBeGreaterThan(0)
  expect(payload.report.lineItems.length).toBeGreaterThan(0)
})

test('rejects an unknown cabinet id', async () => {
  const { registrations, server, bridge } = harness()
  registerGenerateQuote(server as never, bridge)
  await expect(
    registrations.get('generate_quote')!({ cabinetId: 'missing', prices }),
  ).rejects.toThrow()
})
