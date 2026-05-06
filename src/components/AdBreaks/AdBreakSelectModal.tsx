import { X, ListPlus } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import '../Playlist/ItemModal.css'

interface AdBreakSelectModalProps {
  onClose: () => void
}

export default function AdBreakSelectModal({ onClose }: AdBreakSelectModalProps) {
  const { state, loadBlockIntoPlaylist, t } = useApp()
  const { commercialBlocks } = state

  const insertBlock = (id: string) => {
    const block = commercialBlocks.find((b) => b.id === id)
    if (!block) return
    loadBlockIntoPlaylist(block)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t.toolbar.addAdBreak}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {commercialBlocks.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: 24 }}>
              {t.adBreaks.emptyBlocks}
            </p>
          ) : (
            [...commercialBlocks]
              .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
              .map((block) => (
              <button
                key={block.id}
                onClick={() => insertBlock(block.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <ListPlus size={20} color="var(--accent)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{block.scheduledTime.slice(0,5)} — {block.name}</div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {block.slots.reduce((a, s) => a + s.spotsCount, 0)} spot{block.slots.reduce((a, s) => a + s.spotsCount, 0) !== 1 ? 's' : ''}
                    {block.lastLoadedDate === new Date().toISOString().slice(0,10) && (
                      <span style={{ marginLeft: 8, color: 'var(--success)' }}>✓ Carregado hoje</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
