import { useState } from 'react'
import { Music2, ChevronRight } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { AutoBlocoAssignment } from '../../types'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { Field } from '../ui/Field'
import PageHeader from '../ui/PageHeader'

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─── Assignment Modal ─────────────────────────────────────────────────────────

function AssignModal({
  slotId,
  slotTitle,
  slotTime,
  dayOfWeek,
  currentSequenceId,
  onSave,
  onClose,
}: {
  slotId: string
  slotTitle: string
  slotTime: string
  dayOfWeek: number
  currentSequenceId: string | null
  onSave: (assignment: AutoBlocoAssignment) => void
  onClose: () => void
}) {
  const { state } = useApp()
  const [sequenceId, setSequenceId] = useState<string | null>(currentSequenceId)

  const handleSave = () => {
    onSave({
      id: crypto.randomUUID(),
      programSlotId: slotId,
      dayOfWeek,
      sequenceId,
    })
  }

  return (
    <Modal
      title={`Atribuir Sequência — ${DAY_LABELS[dayOfWeek]}`}
      onClose={onClose}
      maxWidth={400}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave}>Salvar</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          padding: '10px 14px',
          background: 'var(--bg-secondary)',
          borderRadius: 8,
          fontSize: '0.85rem',
        }}>
          <span style={{ fontFamily: 'monospace', color: 'var(--accent)', marginRight: 10 }}>
            {slotTime.slice(0, 5)}
          </span>
          <strong>{slotTitle}</strong>
        </div>

        <Field label="Sequência a usar" hint="Escolha 'Sem automação' para preencher manualmente na Programação.">
          <select
            className="input"
            value={sequenceId ?? ''}
            onChange={e => setSequenceId(e.target.value || null)}
          >
            <option value="">— Sem automação (manual) —</option>
            {state.musicSequences.map(seq => (
              <option key={seq.id} value={seq.id}>{seq.name}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  )
}

// ─── AutoBloco Tab ────────────────────────────────────────────────────────────

export default function AutoBlocoTab() {
  const { state, dispatch } = useApp()
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    // Start on today's day-of-week
    return new Date().getDay()
  })
  const [assigningSlot, setAssigningSlot] = useState<{
    id: string; title: string; time: string
  } | null>(null)

  // All bloco_musical slots for the selected day
  const slotsForDay = (state.weeklyGrid[selectedDay] ?? [])
    .filter(s => s.type === 'bloco_musical')
    .slice()
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

  const getAssignment = (slotId: string) =>
    state.autoBlocoAssignments.find(
      a => a.programSlotId === slotId && a.dayOfWeek === selectedDay,
    ) ?? null

  const getSequenceName = (id: string | null) => {
    if (!id) return null
    return state.musicSequences.find(s => s.id === id)?.name ?? '(sequência removida)'
  }

  const handleSaveAssignment = (assignment: AutoBlocoAssignment) => {
    dispatch({ type: 'SET_AUTO_BLOCO_ASSIGNMENT', payload: assignment })
    setAssigningSlot(null)
  }

  const handleDeleteAssignment = (id: string) => {
    dispatch({ type: 'DELETE_AUTO_BLOCO_ASSIGNMENT', payload: id })
  }

  return (
    <div>
      <PageHeader
        title="Atribuição de Blocos"
        subtitle="Defina qual sequência automática gera cada bloco musical da grade semanal."
      />

      {/* Day selector */}
      <div className="ap-day-selector">
        {DAY_LABELS.map((label, d) => (
          <button
            key={d}
            className={`ap-day-btn ${selectedDay === d ? 'active' : ''}`}
            onClick={() => setSelectedDay(d)}
          >
            {label}
          </button>
        ))}
      </div>

      {slotsForDay.length === 0 ? (
        <div className="ap-empty">
          <Music2 size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <br />
          Nenhum <strong>bloco musical</strong> na grade de {DAY_LABELS[selectedDay]}.
          <br />
          <span style={{ fontSize: '0.8rem' }}>
            Adicione slots do tipo <em>Bloco Musical</em> na aba <strong>Grade</strong>.
          </span>
        </div>
      ) : (
        <div>
          {slotsForDay.map(slot => {
            const assignment = getAssignment(slot.id)
            const seqName = getSequenceName(assignment?.sequenceId ?? null)

            return (
              <div
                key={slot.id}
                className="ap-slot-row"
                onClick={() => setAssigningSlot({ id: slot.id, title: slot.title, time: slot.scheduledTime })}
              >
                <span className="ap-slot-time">{slot.scheduledTime.slice(0, 5)}</span>
                <span className="ap-slot-name">{slot.title}</span>

                {seqName ? (
                  <span className="ap-slot-seq assigned">{seqName}</span>
                ) : (
                  <span className="ap-slot-seq unassigned">Manual</span>
                )}

                {assignment && assignment.sequenceId && (
                  <Button
                    variant="ghost"
                    iconOnly
                    icon={<span style={{ fontSize: 11, color: '#ef4444' }}>✕</span>}
                    onClick={e => {
                      e.stopPropagation()
                      handleDeleteAssignment(assignment.id)
                    }}
                  />
                )}

                <ChevronRight size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      )}

      {assigningSlot && (
        <AssignModal
          slotId={assigningSlot.id}
          slotTitle={assigningSlot.title}
          slotTime={assigningSlot.time}
          dayOfWeek={selectedDay}
          currentSequenceId={getAssignment(assigningSlot.id)?.sequenceId ?? null}
          onSave={handleSaveAssignment}
          onClose={() => setAssigningSlot(null)}
        />
      )}
    </div>
  )
}
