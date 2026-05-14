# VTMaster — Índice da Documentação

> Versão **5.1.5** — Atualizado em **14/05/2026** com atualização automática via GitHub Releases (`electron-updater`)

---

## Por perfil

### Operação (emissora / playout)
1. [release/LEIA-ME.md](../release/LEIA-ME.md) — Manual do operador
2. [docs/ESTADO_ATUAL.md](ESTADO_ATUAL.md) — Funcionalidades disponíveis

### Desenvolvimento
1. [README.md](../README.md) — Início rápido
2. [docs/DEVELOPMENT.md](DEVELOPMENT.md) — Documentação técnica completa
3. [docs/ESTADO_ATUAL.md](ESTADO_ATUAL.md) — Estado do produto, fases, backlog
4. [docs/Melhoriadeinterface.md](Melhoriadeinterface.md) — Plano de UX/UI, fases visuais e pendências de interface

### Release e distribuição
1. [README.md](../README.md) — Scripts de build
2. [release/LEIA-ME.md](../release/LEIA-ME.md) — Manual do instalador

---

## Conteúdo de cada documento

### [README.md](../README.md)
- Visão geral e instalação
- Como executar em desenvolvimento
- Scripts npm
- Build de distribuição
- Licença

### [docs/DEVELOPMENT.md](DEVELOPMENT.md)
- Arquitetura completa (Electron, React, IPC, estado global)
- Motor de playout: GUID-based, wall-clock, limpeza garantida
- Sistema de Disparo global (globalShortcut, captura de tecla, disparoInterruptRef)
- Sistema de Blocos Comerciais (scheduler, round-robin, autoplayComerciais)
- API `window.spotmaster` completa (preload.ts)
- Protocolo local-media://
- API do vMix (funções, sequência de corte, polling)
- Componentes: StatusBar, Toolbar, GradePanel, DaySchedulePanel, VmixInputPanel, ItemModal, ContextMenu
- Tipos de dados, i18n, persistência

### [docs/ESTADO_ATUAL.md](ESTADO_ATUAL.md)
- Histórico de fases (Fase 1 a 11)
- Melhorias de interface pós-Fase 11 (polimento geral + cockpit da Programação)
- Bugs corrigidos e decisões técnicas por fase
- Fluxos de negócio (playlist, blocos comerciais, disparo)
- Tipos de dados completos com comentários
- Estado global (AppState, AppContextValue, Actions)
- Persistência de dados e migração de versões
- Checklist de funcionalidades implementadas por fase
- Backlog — o que ainda não está implementado

### [docs/Melhoriadeinterface.md](Melhoriadeinterface.md)
- Diagnóstico visual atual do produto
- Fases de evolução de UX/UI
- O que já foi implementado nas Fases 1 a 3
- Pendências e backlog visual para continuidade

### [release/LEIA-ME.md](../release/LEIA-ME.md)
- Manual para o operador de emissora
- Primeiros passos e configuração
- Como usar o Disparo
- Como configurar blocos comerciais
- Integração com vMix

---

## Ordem recomendada de leitura

**Para desenvolvedores:**
1. [README.md](../README.md) — rodar o projeto
2. [DEVELOPMENT.md](DEVELOPMENT.md) — entender a arquitetura
3. [ESTADO_ATUAL.md](ESTADO_ATUAL.md) — estado, decisões e backlog

**Para operadores:**
1. [release/LEIA-ME.md](../release/LEIA-ME.md) — instalar e usar
2. [ESTADO_ATUAL.md](ESTADO_ATUAL.md) seção 13 — lista do que funciona

---

## Histórico de versões

| Fase | Data | O que foi feito |
|------|------|----------------|
| Fase 1 | antes de 07/05/2026 | Motor de playout GUID-based, wall-clock, A/B Roll, limpeza garantida |
| Fase 2 | 07/05/2026 | Sistema de Blocos Comerciais, round-robin, scheduler, fast polling |
| Rebranding | 07/05/2026 | SpotMaster → VTMaster, logo, cor azul |
| Fase 3 | 10/05/2026 | Disparo global, Autoplay Comerciais, pré-carregamento configurável, indicador visual |
| Fase 4 | 10/05/2026 | Ações vMix na playlist (AudioOff/On, SetVolume, Fade, Overlay), menu de contexto (botão direito) |
| Fase 5–6 | 10/05/2026 | Grade Semanal Dom-Sáb, Programação do Dia, Blocos Comerciais reestruturados (CommercialBlockItem) |
| Fase 7 | 10/05/2026 | Dois queues independentes: playlist manual vs grade do dia (dateSchedules) |
| Fase 8 | 11/05/2026 | View em cards por bloco, drag-and-drop, menu de contexto completo na Programação |
| Fase 9 — v3.1.0 | 11/05/2026 | Ponto de Pausa, Export/Import de grade (.vtgrid), auto-sync comerciais, foco em modais, context menus estáveis, pipeline preload.cjs |
| Fase 10 — v3.2.0 | 11/05/2026 | Arrastar entre blocos, copiar/colar, BlockPickerModal, seleção visual, VmixInputPanel dual-mode |
| Fase 11 — v3.3.0 | 12/05/2026 | 8 bugs + 5 robustez, remoção do legacy adBreaks, StatusBar redesenhada (ON AIR badge, countdown, progress bar), PlaylistTable e DaySchedulePanel mais vivos |
| Interface — Fases 1 a 3 | 12/05/2026 | Sidebar com ícones, toolbar reorganizada, favicon VTMaster, cockpit operacional da Programação, design system inicial nas telas principais e fluxo de adicionar item refinado |
| Correção AutoProg — v5.1.4 | 14/05/2026 | `Promise.allSettled` não é mais o fluxo atual; leitura de duração usa `readMediaDurationBatch` com pool, cache persistido e fallback nativo Electron para MP4/MOV/M4V/M4A/3GP quando o Chromium não lê metadata. |
| Auto-update — v5.1.5 | 14/05/2026 | App instalado passa a consultar GitHub Releases via `electron-updater`; Configurações ganhou botão "Verificar atualização"; releases devem publicar `Setup.exe`, `.blockmap` e `latest.yml`. |
