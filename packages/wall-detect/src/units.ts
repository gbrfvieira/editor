import { type InputSegment, isWallLayer } from './index'

export type CadUnit = 'm' | 'cm' | 'mm'
export interface UnitSuggestion {
  unit: CadUnit
  metersPerUnit: number
  confidence: number
  source: 'header' | 'geometry' | 'insufficient-data'
}

const UNITS = [
  { unit: 'm' as const, factor: 1, code: 6 },
  { unit: 'cm' as const, factor: 0.01, code: 5 },
  { unit: 'mm' as const, factor: 0.001, code: 4 },
]

function plausibleFraction(lengths: number[], factor: number): number {
  return (
    lengths.filter((length) => length * factor >= 0.3 && length * factor <= 15).length /
    lengths.length
  )
}

/**
 * A suggestion only: never changes input geometry or a user's explicit
 * selection. The DXF $INSUNITS header is a strong signal when present, but
 * real files sometimes carry a stale or simply wrong header (drawn at one
 * scale, template inherited from another) — so a header claim is only
 * trusted when the geometry doesn't actively contradict it.
 */
export function suggestCadUnit(
  segments: InputSegment[],
  insertionUnits?: number | null,
): UnitSuggestion {
  const header = UNITS.find((entry) => entry.code === insertionUnits)
  const straight = segments.filter((segment) => !segment.source)
  const preferred = straight.filter((segment) => isWallLayer(segment.layer))
  const lengths = (preferred.length ? preferred : straight)
    .map((segment) =>
      Math.hypot(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]),
    )
    .filter((length) => Number.isFinite(length) && length > 0)
    .sort((a, b) => a - b)

  if (header && (lengths.length < 3 || plausibleFraction(lengths, header.factor) >= 0.3)) {
    return { unit: header.unit, metersPerUnit: header.factor, confidence: 0.95, source: 'header' }
  }
  if (lengths.length < 3)
    return { unit: 'm', metersPerUnit: 1, confidence: 0, source: 'insufficient-data' }
  const median = lengths[Math.floor(lengths.length / 2)]
  const candidates = UNITS.map((entry) => {
    const fraction = plausibleFraction(lengths, entry.factor)
    return {
      ...entry,
      fraction,
      score: fraction * 10 - Math.abs(Math.log10((median * entry.factor) / 3)),
    }
  }).sort((a, b) => b.score - a.score)
  const best = candidates[0]
  // A tiny drawing cannot be repaired by dividing by 100 or 1000.
  if (best.fraction < 0.5)
    return { unit: 'm', metersPerUnit: 1, confidence: 0, source: 'insufficient-data' }
  return {
    unit: best.unit,
    metersPerUnit: best.factor,
    // A header that geometry disagrees with is a real red flag, so cap
    // confidence lower than the header-trusted path even at a clean win.
    confidence: header
      ? Math.min(0.6, Math.max(0.2, (best.score - candidates[1].score) / 10))
      : Math.min(0.85, Math.max(0.2, (best.score - candidates[1].score) / 10)),
    source: 'geometry',
  }
}
