'use client'

import {
  type CabinetLike,
  createCutList,
  nestPanels,
  toNestingSvg,
  toPdf,
  toXlsx,
} from '@pascal-app/cutlist'
import {
  BRAZILIAN_PRICE_PRESETS,
  brazilianPricePreset,
  calculateQuote,
  toQuoteText,
} from '@pascal-app/quote'
import { useMemo, useState } from 'react'

const DEFAULT_SHEET = { widthMm: 2750, heightMm: 1830 }

/** Nearest Brazilian MDF preset to a cabinet run's own board thickness. */
function nearestBoardPreset(cabinets: CabinetLike[]): 15 | 18 {
  const thicknessMm = (cabinets[0]?.boardThickness ?? 0.018) * 1000
  return Math.abs(thicknessMm - 15) <= Math.abs(thicknessMm - 18) ? 15 : 18
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function CabinetCutlistExportActions({ cabinets }: { cabinets: CabinetLike[] }) {
  const [busy, setBusy] = useState(false)
  const report = useMemo(() => (cabinets.length > 0 ? createCutList(cabinets) : null), [cabinets])
  const nesting = useMemo(
    () => (report ? nestPanels(report.panels, DEFAULT_SHEET) : null),
    [report],
  )

  if (!report || !nesting) return null

  const exportXlsx = async () => {
    setBusy(true)
    try {
      const buffer = await toXlsx(report)
      downloadBlob(
        new Blob([new Uint8Array(buffer)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        'plano-de-corte.xlsx',
      )
    } finally {
      setBusy(false)
    }
  }

  const exportSvg = () => {
    downloadBlob(
      new Blob([toNestingSvg(nesting, DEFAULT_SHEET)], { type: 'image/svg+xml' }),
      'diagrama-de-corte.svg',
    )
  }

  const exportPdf = () => {
    downloadBlob(
      new Blob([new Uint8Array(toPdf(report, nesting))], { type: 'application/pdf' }),
      'plano-de-corte.pdf',
    )
  }

  const exportQuote = () => {
    const boardMm = nearestBoardPreset(cabinets)
    const preset = brazilianPricePreset(boardMm)
    // Non-null: the two BRAZILIAN_PRICE_PRESETS entries always carry exactly
    // their own 'mdf-<n>mm' key.
    const boardPricePerM2 =
      boardMm === 15
        ? BRAZILIAN_PRICE_PRESETS[15].boardPricePerM2['mdf-15mm']!
        : BRAZILIAN_PRICE_PRESETS[18].boardPricePerM2['mdf-18mm']!
    // Panels rarely carry a materialPreset matching 'mdf-15mm'/'mdf-18mm'
    // exactly, so calculateQuote's per-material lookup falls back to the
    // 'default' key — make sure that key resolves to the same board price
    // instead of silently dropping the board line from the quote.
    const prices = {
      ...preset,
      boardPricePerM2: { ...preset.boardPricePerM2, default: boardPricePerM2 },
    }
    const quote = calculateQuote(report, nesting, prices)
    downloadBlob(new Blob([toQuoteText(quote)], { type: 'text/plain' }), 'orcamento-estimado.txt')
  }

  return (
    <div className="flex flex-col gap-1.5 border-border/50 border-t px-1 pt-3">
      <div className="font-medium text-muted-foreground text-xs">Exportar marcenaria</div>
      <button
        className="rounded-lg bg-muted/50 px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-50"
        disabled={busy}
        onClick={() => void exportXlsx()}
        type="button"
      >
        {busy ? 'Gerando XLSX…' : 'Baixar plano de corte (XLSX)'}
      </button>
      <button
        className="rounded-lg bg-muted/50 px-3 py-2 text-left text-xs hover:bg-muted"
        onClick={exportSvg}
        type="button"
      >
        Baixar diagrama de corte (SVG)
      </button>
      <button
        className="rounded-lg bg-muted/50 px-3 py-2 text-left text-xs hover:bg-muted"
        onClick={exportPdf}
        type="button"
      >
        Baixar plano de corte (PDF)
      </button>
      <button
        className="rounded-lg bg-muted/50 px-3 py-2 text-left text-xs hover:bg-muted"
        onClick={exportQuote}
        type="button"
      >
        Baixar orçamento estimado (TXT)
      </button>
      <p className="text-[10px] text-muted-foreground">
        Orçamento com preços indicativos de MDF/ferragem — substitua pela tabela do seu fornecedor.
      </p>
    </div>
  )
}
