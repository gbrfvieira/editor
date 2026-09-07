'use client'

import {
  type CabinetLike,
  createCutList,
  nestPanels,
  toNestingSvg,
  toXlsx,
} from '@pascal-app/cutlist'
import { useMemo, useState } from 'react'

const DEFAULT_SHEET = { widthMm: 2750, heightMm: 1830 }

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

  if (!report) return null

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
    const nesting = nestPanels(report.panels, DEFAULT_SHEET)
    downloadBlob(
      new Blob([toNestingSvg(nesting, DEFAULT_SHEET)], { type: 'image/svg+xml' }),
      'diagrama-de-corte.svg',
    )
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
    </div>
  )
}
