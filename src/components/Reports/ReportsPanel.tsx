import { useState, useMemo } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useApp } from '../../store/AppContext'
import { formatDate, formatDuration, today } from '../../utils/time'
import type { PlayLog } from '../../types'
import vtmasterLogoSrc from '../../assets/Logo_VTMasterHorizontal.png'
import '../AdBreaks/AdBreaksPanel.css'

export default function ReportsPanel() {
  const { state, t } = useApp()
  const { playLog, clients, campaigns, settings } = state

  const [reportType, setReportType] = useState<'daily' | 'client' | 'campaign'>('daily')
  const [date, setDate] = useState(today())
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [clientId, setClientId] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [generating, setGenerating] = useState(false)

  const getFilteredLogs = (): PlayLog[] => {
    if (reportType === 'daily') {
      return playLog.filter((l) => l.date === date)
    } else if (reportType === 'campaign') {
      return playLog.filter((l) => !campaignId || l.campaignId === campaignId)
    } else {
      return playLog.filter((l) => {
        const dateOk = l.date >= dateFrom && l.date <= dateTo
        const clientOk = !clientId || l.clientId === clientId
        return dateOk && clientOk
      })
    }
  }

  const filteredLogs = getFilteredLogs()

  const selectedCampaign = useMemo(
    () => campaigns.find(c => c.id === campaignId),
    [campaigns, campaignId]
  )

  const generatePDF = async () => {
    setGenerating(true)
    try {
      const doc = new jsPDF()
      const lang = settings.language
      const stationName = settings.stationName

      // ── Header ──
      doc.setFillColor(10, 10, 20)
      doc.rect(0, 0, 210, 32, 'F')

      // VTMaster logo in header
      try {
        const res = await fetch(vtmasterLogoSrc)
        const blob = await res.blob()
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
        doc.addImage(base64, 'PNG', 12, 7, 64, 14)
      } catch {
        // fallback: text if image fails
        doc.setTextColor(14, 165, 233)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('VTMaster', 14, 16)
      }

      // Station name below logo
      doc.setTextColor(180, 180, 200)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(stationName, 12, 27)

      // Report title (centered)
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      const reportTitle = t.reports.reportTitle.toUpperCase()
      doc.text(reportTitle, 210 / 2, 13, { align: 'center' })

      // Generated at
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(160, 160, 190)
      const generatedAt = `${t.reports.generatedAt}: ${new Date().toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}`
      doc.text(generatedAt, 198, 27, { align: 'right' })

      doc.setTextColor(0, 0, 0)

      // ── Report info ──
      let y = 40
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')

      if (reportType === 'daily') {
        doc.text(`${t.reports.selectDate}: ${formatDate(date, lang)}`, 14, y)
      } else if (reportType === 'campaign') {
        const campName = selectedCampaign?.name ?? t.common.all
        const campClient = clients.find(c => c.id === selectedCampaign?.clientId)?.name ?? ''
        doc.text(`${t.campaigns.title}: ${campName}`, 14, y)
        if (campClient) { y += 6; doc.text(`${t.clients.title}: ${campClient}`, 14, y) }
      } else {
        const clientName = clients.find((c) => c.id === clientId)?.name ?? t.common.all
        doc.text(`${t.clients.title}: ${clientName}`, 14, y)
        y += 6
        doc.text(`${t.reports.dateFrom}: ${formatDate(dateFrom, lang)} — ${t.reports.dateTo}: ${formatDate(dateTo, lang)}`, 14, y)
      }

      y += 8
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const airedCount = filteredLogs.filter((l) => l.status === 'aired').length
      const totalDur = filteredLogs.reduce((acc, l) => acc + l.duration, 0)

      if (reportType === 'campaign' && selectedCampaign) {
        const remaining = Math.max(0, selectedCampaign.totalSpots - airedCount)
        const pct = selectedCampaign.totalSpots > 0 ? Math.round((airedCount / selectedCampaign.totalSpots) * 100) : 0
        doc.text(`${t.reports.contracted}: ${selectedCampaign.totalSpots}`, 14, y)
        doc.text(`${t.reports.aired}: ${airedCount}`, 60, y)
        doc.text(`${t.reports.remaining}: ${remaining}`, 100, y)
        doc.text(`${t.reports.completion}: ${pct}%`, 140, y)
        y += 5
      }
      doc.text(`${t.reports.totalSpots}: ${filteredLogs.length}`, 14, y)
      doc.text(`${t.reports.totalDuration}: ${formatDuration(totalDur)}`, 60, y)
      doc.text(`Aired: ${airedCount} | Skipped: ${filteredLogs.length - airedCount}`, 110, y)

      y += 6

      if (filteredLogs.length === 0) {
        doc.setFontSize(10)
        doc.text(t.reports.noData, 14, y + 10)
      } else {
        // ── Table ──
        const sorted = [...filteredLogs].sort((a, b) => {
          const dc = a.date.localeCompare(b.date)
          return dc !== 0 ? dc : a.actualTime.localeCompare(b.actualTime)
        })

        const head = [
          [
            t.log.columns.date,
            t.log.columns.scheduledTime,
            t.log.columns.actualTime,
            t.log.columns.title,
            t.log.columns.client,
            t.log.columns.duration,
            t.log.columns.status,
          ],
        ]

        const body = sorted.map((l) => [
          formatDate(l.date, lang),
          l.scheduledTime ?? '—',
          l.actualTime,
          l.title,
          l.clientName ?? '—',
          formatDuration(l.duration),
          l.status.toUpperCase(),
        ])

        autoTable(doc, {
          startY: y,
          head,
          body,
          headStyles: {
            fillColor: [233, 69, 96],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 7,
          },
          bodyStyles: { fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 245, 250] },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 20 },
            2: { cellWidth: 20 },
            3: { cellWidth: 50 },
            4: { cellWidth: 35 },
            5: { cellWidth: 18 },
            6: { cellWidth: 20 },
          },
          margin: { left: 14, right: 14 },
        })
      }

      // ── Footer on each page ──
      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text(
          `VTMaster · ${stationName} · ${t.reports.generatedAt}: ${new Date().toLocaleDateString()} · ${p}/${pageCount}`,
          210 / 2,
          292,
          { align: 'center' }
        )
      }

      // ── Save ──
      const fileName = reportType === 'daily'
        ? `comprovante-${date}.pdf`
        : reportType === 'campaign'
        ? `campanha-${selectedCampaign?.name ?? 'todos'}.pdf`
        : `comprovante-${clients.find((c) => c.id === clientId)?.name ?? 'todos'}-${dateFrom}-${dateTo}.pdf`

      if (window.spotmaster) {
        const arrayBuf = doc.output('arraybuffer')
        const buffer = Array.from(new Uint8Array(arrayBuf))
        await window.spotmaster.exportPDF(fileName, buffer)
      } else {
        doc.save(fileName)
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="reports-panel">
      <div className="panel-header">
        <h2>{t.reports.title}</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* Report type selector */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {(['daily', 'client', 'campaign'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              style={{
                padding: '8px 18px',
                borderRadius: 7,
                border: `1px solid ${reportType === type ? 'var(--accent)' : 'var(--border)'}`,
                background: reportType === type ? 'var(--accent)' : 'var(--bg-secondary)',
                color: reportType === type ? '#fff' : 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {type === 'daily' ? t.reports.dailyReport : type === 'client' ? t.reports.clientReport : t.reports.campaignReport}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          {reportType === 'daily' ? (
            <div className="form-group-sm">
              <label>{t.reports.selectDate}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '7px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', maxWidth: 200 }} />
            </div>
          ) : reportType === 'campaign' ? (
            <div className="form-group-sm">
              <label>{t.reports.selectCampaign}</label>
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '7px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', minWidth: 240 }}>
                <option value="">{t.common.all}</option>
                {campaigns.map((c) => {
                  const client = clients.find(cl => cl.id === c.clientId)
                  return <option key={c.id} value={c.id}>{c.name} — {client?.name ?? '—'}</option>
                })}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div className="form-group-sm" style={{ flex: 1, minWidth: 140 }}>
                <label>{t.reports.selectClient}</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '7px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}>
                  <option value="">{t.common.all}</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group-sm" style={{ flex: 1, minWidth: 140 }}>
                <label>{t.reports.dateFrom}</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '7px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }} />
              </div>
              <div className="form-group-sm" style={{ flex: 1, minWidth: 140 }}>
                <label>{t.reports.dateTo}</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 5, padding: '7px 10px', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }} />
              </div>
            </div>
          )}
        </div>

        {/* Campaign summary (when campaign selected) */}
        {reportType === 'campaign' && selectedCampaign && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              {t.campaigns.progress}
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedCampaign.totalSpots}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.reports.contracted}</div>
              </div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)' }}>{filteredLogs.filter(l => l.status === 'aired').length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.reports.aired}</div>
              </div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>
                  {Math.max(0, selectedCampaign.totalSpots - filteredLogs.filter(l => l.status === 'aired').length)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.reports.remaining}</div>
              </div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedCampaign.totalSpots > 0
                    ? `${Math.min(100, Math.round((filteredLogs.filter(l => l.status === 'aired').length / selectedCampaign.totalSpots) * 100))}%`
                    : '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.reports.completion}</div>
              </div>
            </div>
          </div>
        )}

        {/* Preview summary */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Preview</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>{filteredLogs.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.reports.totalSpots}</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)' }}>{filteredLogs.filter((l) => l.status === 'aired').length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Aired</div>
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatDuration(filteredLogs.reduce((acc, l) => acc + l.duration, 0))}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.reports.totalDuration}</div>
            </div>
          </div>
        </div>

        {/* Generate button */}
        <button
          className="btn-save"
          onClick={generatePDF}
          disabled={generating || filteredLogs.length === 0}
          style={{ width: '100%', padding: '12px', fontSize: '0.9rem', opacity: filteredLogs.length === 0 ? 0.4 : 1 }}
        >
          {generating ? t.common.loading : `📄 ${t.reports.generatePDF}`}
        </button>

        {filteredLogs.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.83rem', marginTop: 12 }}>
            {t.reports.noData}
          </p>
        )}
      </div>
    </div>
  )
}
