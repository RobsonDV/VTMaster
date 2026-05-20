# VTMaster — Índice da Documentação

> Versão **5.5.34** — Atualizado em **20/05/2026** — Ciclo completo de auditoria + endurecimento operacional (v5.5.24 a v5.5.34): Playlist Contínua, pre-arming de bloco comercial, retomada após queda de luz, safeguards anti-fantasma

---

## Por perfil

### Operação (emissora / playout)
1. [README.md](../README.md) — Instalação e visão geral
2. [docs/ESTADO_ATUAL.md](ESTADO_ATUAL.md) — Funcionalidades disponíveis

### Desenvolvimento
1. [README.md](../README.md) — Início rápido
2. [docs/DEVELOPMENT.md](DEVELOPMENT.md) — Documentação técnica completa
3. [docs/ESTADO_ATUAL.md](ESTADO_ATUAL.md) — Estado do produto, fases, backlog
4. [docs/Melhoriadeinterface.md](Melhoriadeinterface.md) — Plano de UX/UI, fases visuais e pendências de interface
5. [docs/ATUALIZACOES.md](ATUALIZACOES.md) — Como publicar e testar updates automáticos

### Release e distribuição
1. [README.md](../README.md) — Scripts de build
2. [docs/ATUALIZACOES.md](ATUALIZACOES.md) — Auto-update, publicação de releases e checklist de atualização

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

### [docs/ATUALIZACOES.md](ATUALIZACOES.md)
- Como funciona o auto-update via GitHub Releases
- Checklist para subir novas versões
- Arquivos obrigatórios (`Setup.exe`, `.blockmap`, `latest.yml`)
- Como testar uma atualização real entre duas versões
- Troubleshooting de update

---

## Ordem recomendada de leitura

**Para desenvolvedores:**
1. [README.md](../README.md) — rodar o projeto
2. [DEVELOPMENT.md](DEVELOPMENT.md) — entender a arquitetura
3. [ESTADO_ATUAL.md](ESTADO_ATUAL.md) — estado, decisões e backlog
4. [ATUALIZACOES.md](ATUALIZACOES.md) — publicar versões e validar auto-update

**Para operadores:**
1. [README.md](../README.md) — instalar e usar
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
| Teste auto-update — v5.1.6 | 14/05/2026 | Release pequena para validar se instalações 5.1.5 detectam, baixam e instalam uma nova versão via GitHub Releases. |
| **Fase 13 — Comercial Pro** | 14/05/2026 | Campaign, Segment, ProgramWindow — sistema completo de contratos comerciais com distribuição automática, modalidade Rotativo, gate de campanha no motor de playout, relatório por campanha, log com campaignId. |
| **Fix: Autoplay Comercial** | 14/05/2026 | 3 bugs corrigidos: preloader de 20s lê commercialBlocks direto (sem precisar gerar Programação do Dia), commInterruptTimeRef separado do scheduleInterruptTimeRef, grace window de 10 min para app aberto após o horário. |
| **v5.2.0** | 15/05/2026 | Banco de Mídia (Vídeos/Áudios/Inputs/Ações), VideoPro, AudioPro + AudioStyles com placeholder visual, On Air fullscreen, Command Palette (Ctrl+K), Saídas vMix (Rec/Stream/FTB/EXT/SRT), VmixHealth, Transições configuráveis (Cut/Fade/Merge), Snapshot Comercial, badges EXT+FTB na StatusBar, diferenciação visual áudio na Playlist/Programação, StopInput+PowerSaveBlocker para operação 24h. |
| **v5.3.0** | 16/05/2026 | **Redesign broadcast UI**: marcadores laterais coloridos (AO AR/PROX/tipo), preenchimento de progresso como fundo da track, badges AO AR/PROX nas tracks, hierarquia visual por foco (bloco ativo cresce, demais recuam), diferenciação por tipo (MÚS/VHT/VID/TRL/VMX/COM). **MediaBank**: pin/unpin (painel fixo no layout), drag & drop de arquivos e pastas (inserção aleatória de pasta), toggle Música/Vinheta. **Sidebar colapsável**. **Iniciar Programação** sempre do item selecionado. **GC Musical** pula vinhetas. **Fix crítico**: áudios agora são removidos do vMix (StopInput antes de RemoveInput). |
| **v5.5.18–22** | mai/2026 | Reset de Fábrica em Configurações, limpeza de instalação, restauração Electron 41 + flags GPU, correção stale closure em `insertItemAtGroupEnd`, sandbox revisado. |
| **v5.5.23** | 19/05/2026 | **Migração das inserções da Programação para actions do reducer** (`INSERT_ITEM_AFTER`, `INSERT_ITEM_BEFORE`, `ADD_DATE_SCHEDULE_ITEM`) — elimina stale closure em rajadas de inserção via MediaBank e drag-and-drop. Mesma trilha do v5.5.22. |
| **v5.5.24 — Auditoria QA** | 19/05/2026 | 8 correções da auditoria forense: remoção do `preload.cts` órfão, feedback de falha em `registerTrigger`, deps de `runSequence`, tracking + clear de timers do GC Musical em `stopPlayback`, reset de `lastFastPosRef`, guard de duplo `loadAll` em StrictMode, memoização de `t`, `clearInterval` do auto-update no `will-quit`. |
| **v5.5.25** | 19/05/2026 | **Sequência não para mais em falha de 1 arquivo**: `playItem` removeu `abortRef.current = true` no path "file failed to load" — item fica `error`, motor segue para o próximo. **Guard contra `dateSchedules = {}`**: auto-save pula a persistência se o objeto está vazio, evitando wipe acidental em race transiente do startup. **Instrumentação no `loadAll`** com log de quantos dias foram lidos do disco. |
| **v5.5.26 — Retomar Programação após queda de luz** | 19/05/2026 | Novo modo `'reload'` para o resume de sessão. Quando o vMix também reinicia (queda de luz típica) e perde o input, o app calcula tempo decorrido por wall-clock (`now - snapshot.startedAt`), e ao clicar **Retomar Programação**: `loadNewInput` recarrega o arquivo, `SetPosition` seek para o ponto, `Cut + PlayInput`, e o `startScheduleFromItem` retoma. Banner adapta texto entre modo `'live'` (input ainda no ar — antigo) e `'reload'` (recarrega e seeka). |
| **v5.5.27** | 19/05/2026 | **Next reaproveita o preload antecipatório** em `skipToNext` — sem isto, o vMix recebia AddInput duplicado e o preload virava input fantasma. **Stop Next sem ghost**: `playItem` pula o preload se `stopAfterCurrentRef` está armado; novo `sequenceEndedRef` faz `.then()` tardios descartarem o GUID em vez de gravá-lo em `preloadedInputRef`. |
| **v5.5.28** | 19/05/2026 | **Detecção de scrub manual no vMix**: novo `activeInputEndedRef: Set<string>` atualizado pelo fast-poll quando `position >= duration - 500ms`. `playItem.wait` quebra cedo se o GUID atual está marcado E já passou 1.5 s, eliminando o "vMix ocioso esperando o wall-clock". |
| **v5.5.29** | 19/05/2026 | **Pausa pré-programada em bloco comercial**: novo `CommercialBlockItemType = 'pause'`, `expandBlockItems` gera o item correspondente, `runSequence` já tratava `type === 'pause'`. UI em `AdBreaksPanel` com botão **⏸ Pausa**, renderização cinza-azulada na linha e na pílula colapsada. **Fim do erro "Referência de objeto não definida" no Stop**: `removeOwnedInput` ganhou dedup via `pendingRemovalRef: Map<guid, timer>` — chamadas redundantes (sweep + cleanupInputs explícito) agora são consolidadas, sem mais double-removal causando `NullReferenceException` no vMix. |
| **v5.5.30** | 20/05/2026 | **Playlist Contínua** (`settings.continuousPlayback`, toggle persistente na Toolbar): quando ON, o motor não para após o bloco comercial — continua o próximo pending por ordem. Resolve o "para após bloco" reportado em produção. **Failsafe no scheduler comercial**: quando `dateSchedules[today]` não tem o bloco mas `commercialBlocks` tem na janela atual, injeta inline via `expandBlockItems` em vez de confiar no preload de 20s. **Logging detalhado**: `[autoplay-com] FAILSAFE`, `disparando bloco @HH:MM`, `interrompendo sequência`, etc. |
| **v5.5.31** | 20/05/2026 | **Pre-arming de bloco comercial**: novo scheduler dedicado (2s tick, 30s lead time) carrega o primeiro item playable do bloco em PVW do vMix 30s antes do horário. Banner novo no StatusBar: "🎯 BLOCO Nome @HH:MM ARMADO em Ns" com countdown a cada segundo. Quando o scheduler comercial dispara, transfere o GUID armado para `preloadedInputRef` — `playItem` usa direto via Cut, sem AddInput sob pressão. Ações vMix (AudioOff, OverlayInput) e inputs permanentes não são pré-armados; respeitam a ordem natural do bloco. |
| **v5.5.32** | 20/05/2026 | **Banner de arming estável** (não pisca mais): arming usa chave `(blockId + filePath)` em vez de `item.id` como identidade, sobrevivendo a re-gerações de schedule causadas por auto-sync. `MARK_BLOCK_LOADED` só dispatcha quando `block.lastLoadedDate !== today` — elimina o jitter de re-renders que fazia banner piscar e input entrar/sair do vMix. |
| **v5.5.33** | 20/05/2026 | **Safeguards contra 'playing' fantasma**: antes de marcar um item como playing, varre a fila e marca como done qualquer outro item em playing (invariante "no máximo 1 item playing por queue"). Safeguard final em `runSequence` end. **Logs detalhados de transições de status**: `[playItem] ▶ X → playing`, `✓ X → done`, `⚠ X sumiu da queue` — facilita diagnóstico via DevTools quando algum item ficar pendurado. |
| **v5.5.34** | 20/05/2026 | **Barra de progresso suave**: CSS `transition: width 0.55s linear` em todas as 4 barras (StatusBar, Cockpit, day-progress, bc-item-bg-fill) > 500ms do fast-poll = overlap garantido, sem o "step" visível. **Arming não orfaniza preload musical**: quando o scheduler comercial sobrescreve `preloadedInputRef` com o GUID do arming, o GUID musical antigo (preload do próximo item) é removido do vMix antes — sem mais input fantasma quando música tocando + bloco se aproximando. |
