import { useApp } from '../../store/AppContext'
import './ResumeBanner.css'

// Banner GLOBAL de retomada de sessão anterior.
// Renderizado no topo do app (App.tsx), portanto aparece em QUALQUER aba assim
// que a detecção de sessão (AppContext) define resumeCandidate. Antes, o banner
// só existia dentro do DaySchedulePanel — se o operador reabrisse o app em outra
// aba, nunca via a oferta de retomar a programação (regressão reportada).
function fmtSec(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function ResumeBanner() {
  const { resumeCandidate, resumeFromSnapshot, ignoreResume } = useApp()
  if (!resumeCandidate) return null

  return (
    <div className="resume-banner">
      <span className="resume-banner-icon">⚡</span>
      <span className="resume-banner-text">
        Sessão anterior detectada —{' '}
        <strong>{resumeCandidate.inputTitle}</strong>{' '}
        {resumeCandidate.mode === 'reload'
          ? <>foi interrompido (queda de luz?). Posso recarregar e retomar do ponto {fmtSec(resumeCandidate.elapsedSeconds)} ({fmtSec(resumeCandidate.remainingSeconds)} restantes).</>
          : <>ainda está no ar ({fmtSec(resumeCandidate.remainingSeconds)} restantes)</>}
      </span>
      <button className="resume-banner-btn primary" onClick={() => resumeFromSnapshot()}>
        {resumeCandidate.mode === 'reload' ? 'Retomar Programação' : 'Retomar controle'}
      </button>
      <button className="resume-banner-btn ghost" onClick={ignoreResume}>
        Ignorar
      </button>
    </div>
  )
}
