import { type InputSegment, isWallLayer } from './index'

export type CadUnit = 'm' | 'cm' | 'mm'
export interface UnitSuggestion {
  unit: CadUnit
  metersPerUnit: number
  confidence: number
  source: 'header' | 'geometry' | 'insufficient-data'
}

/** A suggestion only: never changes input geometry or a user's explicit selection. */
export function suggestCadUnit(
  segments: InputSegment[],
  insertionUnits?: number | null,
): UnitSuggestion {
  const units = [
    { unit: 'm' as const, factor: 1, code: 6 },
    { unit: 'cm' as const, factor: 0.01, code: 5 },
    { unit: 'mm' as const, factor: 0.001, code: 4 },
  ]
  const header = units.find((entry) => entry.code === insertionUnits)
  if (header)
    return { unit: header.unit, metersPerUnit: header.factor, confidence: 0.95, source: 'header' }
  const straight = segments.filter((segment) => !segment.source)
  const preferred = straight.filter((segment) => isWallLayer(segment.layer))
  const lengths = (preferred.length ? preferred : straight)
    .map((segment) =>
      Math.hypot(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]),
    )
    .filter((length) => Number.isFinite(length) && length > 0)
    .sort((a, b) => a - b)
  if (lengths.length < 3)
    return { unit: 'm', metersPerUnit: 1, confidence: 0, source: 'insufficient-data' }
  const median = lengths[Math.floor(lengths.length / 2)]
  const candidates = units
    .map((entry) => {
      const fraction =
        lengths.filter((length) => length * entry.factor >= 0.3 && length * entry.factor <= 15)
          .length / lengths.length
      return {
        ...entry,
        fraction,
        score: fraction * 10 - Math.abs(Math.log10((median * entry.factor) / 3)),
      }
    })
    .sort((a, b) => b.score - a.score)
  const best = candidates[0]
  // A tiny drawing cannot be repaired by dividing by 100 or 1000.
  if (best.fraction < 0.5)
    return { unit: 'm', metersPerUnit: 1, confidence: 0, source: 'insufficient-data' }
  return {
    unit: best.unit,
    metersPerUnit: best.factor,
    confidence: Math.min(0.85, Math.max(0.2, (best.score - candidates[1].score) / 10)),
    source: 'geometry',
  }
}
