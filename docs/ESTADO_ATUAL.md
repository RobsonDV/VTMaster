# VTMaster — Estado Atual do Projeto

> Atualizado em **12/05/2026** — Versão **4.0.0** — Fase 11 concluída + melhorias de interface (Fases 1 a 3 de UX)

---

## Índice

1. [O que o VTMaster faz](#1-o-que-o-vtmaster-faz)
2. [Stack técnico](#2-stack-técnico)
3. [Estrutura de arquivos](#3-estrutura-de-arquivos)
4. [Histórico de fases](#4-histórico-de-fases)
5. [Motor de playout](#5-motor-de-playout)
6. [Grade Semanal — Estrutura](#6-grade-semanal--estrutura)
7. [Programação do Dia](#7-programação-do-dia)
8. [Blocos Comerciais](#8-blocos-comerciais)
9. [Sistema de Disparo Global](#9-sistema-de-disparo-global)
10. [Ponto de Pausa](#10-ponto-de-pausa)
11. [Export / Import de Estrutura de Grade](#11-export--import-de-estrutura-de-grade)
12. [Tipos de dados completos](#12-tipos-de-dados-completos)
13. [Estado global (AppContext)](#13-estado-global-appcontext)
14. [Persistência de dados](#14-persistência-de-dados)
15. [Integração vMix](#15-integração-vmix)
16. [Build e preload.cjs](#16-build-e-preloadcjs)
17. [Funcionalidades — checklist v3.3](#17-funcionalidades--checklist-v33)
18. [Backlog](#18-backlog)

---

## 1. O que o VTMaster faz

O VTMaster é um software desktop para **emissoras de TV e rádio** controlarem a grade de programação diária via integração com o **vMix**.

### Fluxo de playout direto (Playlist manual)

```
Operador monta playlist com itens (spots, vinhetas, programas, câmeras)
        ↓
Clica "Iniciar Playlist" ou usa o Disparo
        ↓
VTMaster carrega cada clipe como novo input no vMix
PlayInput → PreviewInput → Cut (vai ao ar)
Aguarda o clipe terminar (wall-clock + fast polling)
        ↓
Próximo clipe — sem intervenção manual
```

### Fluxo de Grade de Programação

```
Operador monta a Estrutura Semanal (Dom-Sáb):
  → Blocos Musicais: horário + 1 slot placeholder por bloco
  → Blocos Comerciais: horário + spots cadastrados (round-robin)
  → Programas: horário + arquivo ou input vMix
        ↓
Clica "Aplicar no Ar" (GradePanel) ou "Atualizar" (Programação)
        ↓
Sistema gera a Programação do Dia para a data selecionada
        ↓
Cards de bloco aparecem na aba Programação (musical/comercial/programa)
        ↓
Operador adiciona arquivos de música via botão [📁] em cada slot vazio
Arrasta e reordena itens com drag-and-drop
Menu de contexto (botão direito): Iniciar daqui, Pausar, Ponto de Pausa, vMix, Duplicar...
        ↓
"Iniciar Programação" começa a partir do bloco do horário atual
(itens de blocos anteriores são automaticamente marcados como skipped)
```

### Fluxo de Blocos Comerciais

```
Operador cadastra anunciantes (Clientes) e seus spots (arquivos)
        ↓
Cria Blocos Comerciais na aba Blocos Comerciais:
  → Editor inline (sem navegar para outra tela)
  → Spots de Cliente (round-robin), Ação vMix, Input vMix
        ↓
Blocos são vinculados à Estrutura Semanal via bloco_comercial
        ↓
Ao gerar a Programação do Dia: spots são expandidos em items individuais
        ↓
Auto-sync: quando o bloco é configurado/alterado, a programação de hoje
           atualiza automaticamente (sem necessidade de clicar "Atualizar")
```

---

## 2. Stack técnico

| Camada | Tecnologia |
|--------|-----------|
| Desktop | Electron 41.x |
| UI | React 19.x + TypeScript 6.x |
| Build | Vite 8 + Rolldown |
| Ícones | lucide-react |
| PDF | jsPDF + jspdf-autotable |
| i18n | Custom (pt.ts / en.ts) |
| Estado | React useReducer + Context API |
| Persistência | JSON files em %APPDATA%/SpotMaster/ |
| Atalho global | Electron globalShortcut |

---

## 3. Estrutura de arquivos

```
VTMaster/
├── electron/
│   ├── main.ts          → Processo principal (IPC, janela, protocolos, globalShortcut)
│   ├── preload.ts       → Bridge renderer↔main via contextBridge (fonte — gera preload.js)
│   └── vmix.ts          → Integração HTTP com a API do vMix
│
├── scripts/
│   └── build-preload-cjs.cjs  → Converte dist-electron/preload.js (ESM) → preload.cjs (CJS)
│                                 Roda automaticamente após electron:compile
│
├── dist-electron/
│   ├── main.js          → Compilado do main.ts (ESM)
│   ├── preload.js       → Compilado do preload.ts (ESM) — gerado por tsc
│   ├── preload.cjs      → Convertido do preload.js (CJS) — gerado pelo script acima
│   │                      ← Electron CARREGA ESTE ARQUIVO (main.ts → preload.cjs)
│   └── vmix.js          → Compilado do vmix.ts (ESM)
│
├── src/
│   ├── App.tsx          → Layout, navegação de painéis, sidebar com ícones, uso do activePanel persistido, modais globais
│   ├── App.css          → Variáveis CSS, tema dark/light, layout
│   ├── types/index.ts   → TODOS os tipos e interfaces
│   ├── store/
│   │   └── AppContext.tsx → Estado global, motor de playout, scheduler, disparo
│   ├── i18n/
│   │   ├── pt.ts        → Strings PT (fonte da verdade)
│   │   └── en.ts        → Strings EN
│   ├── utils/time.ts    → now(), today() (local TZ), formatDuration()
│   └── components/
│       ├── Toolbar/     → Toolbar em duas camadas: controles globais no topo + ações contextuais por tela
│       ├── StatusBar/   → Rodapé: badge ON AIR, countdown, barra de progresso, status vMix
│       ├── Grade/
│       │   ├── GradePanel.tsx       → Estrutura semanal + Export/Import de grade
│       │   └── ProgramSlotModal.tsx → Criar/editar slot (Programa/Musical/Comercial)
│       ├── DaySchedule/
│       │   ├── DaySchedulePanel.tsx → Programação do Dia com cockpit operacional, card-view, drag-drop e ponto de pausa
│       │   └── DaySchedulePanel.css
│       ├── AdBreaks/
│       │   ├── AdBreaksPanel.tsx    → UI dos Blocos Comerciais (accordion inline)
│       │   └── AdBreaksPanel.css
│       ├── Clients/     → Cadastro de anunciantes + spots com detecção de duração
│       ├── Playlist/
│       │   ├── PlaylistTable.tsx  → Tabela + controles
│       │   ├── ContextMenu.tsx    → Menu de contexto (botão direito)
│       │   ├── ItemModal.tsx      → Criar/editar item (mídia ou ação vMix)
│       │   └── VmixInputPanel.tsx → Painel lateral de inputs do vMix
│       ├── Log/         → Log de veiculação com filtros e exportação CSV
│       ├── Reports/     → Geração de PDF (diário e por anunciante)
│       └── Settings/    → Modal de configurações (vMix, Disparo, tema, idioma)
│
└── docs/
    ├── ESTADO_ATUAL.md  → Este arquivo
    ├── DEVELOPMENT.md   → Documentação técnica detalhada
    └── INDEX.md         → Índice geral
```

---

## 4. Histórico de fases

### Fase 1 — Motor de playout base
Motor GUID-based, wall-clock. Reescrita completa do loop de playout. Bugs críticos corrigidos: sequência parava no item 2, áudios não avançavam, race conditions no preload, inputs fantasmas.

### Fase 2 — Sistema de Blocos Comerciais
Cadastro de spots por anunciante, round-robin contínuo, scheduler 30s, proteção contra carga dupla.

### Fase 3 — Disparo Global e Automação
`globalShortcut` Electron, Autoplay Comerciais como toggle separado, pré-carregamento configurável (1–60 min).

### Fase 4 — Ações vMix e Menu de Contexto
Novo tipo `vmix_action` na playlist, menu de contexto completo (inserir ação/input, editar, duplicar, pular).

### Fase 5 — Grade de Programação Semanal
- Aba **Estrutura**: template semanal Dom-Sáb com slots de Programa, Bloco Musical e Bloco Comercial
- Aba **Programação**: calendário por data com view independente do queue de playlist
- `weeklyGrid: WeeklyProgramGrid` — estado persistido por dia da semana
- `dateSchedules: Record<string, PlaylistItem[]>` — programação por data específica
- `generatePlaylistFromGrid()`: gera a programação diária a partir do template semanal
- Auto-geração ao iniciar o app (se não há programação para hoje)
- Watcher de meia-noite: gera automaticamente o próximo dia

### Fase 6 — Reestruturação de Blocos Comerciais
- `CommercialBlockItem` (mini-playlist dentro do bloco): `spot_client`, `vmix_action`, `vmix_input`
- Spots movidos para aba **Clientes** (cada anunciante gerencia seus próprios spots)
- `expandBlockItems()`: converte itens do bloco em PlaylistItems com rodízio
- Suporte a filtro por dia da semana em cada bloco

### Fase 7 — Programação do Dia como Queue Independente
- Dois queues independentes: `playlist` (manual) e `dateSchedules[date]` (grade)
- `activeQueueRef`: controla qual queue `runSequence` usa
- `startSchedule()` vs `startSequence()`: ativam queues diferentes
- DaySchedulePanel com date picker e persistência de data entre abas

### Fase 8 — Card-View, Drag-Drop e UX do Operador (v3.0)
- View em cards por bloco (musical/comercial/programa) com cores e drag-and-drop
- Menu de contexto completo na Programação: Iniciar daqui, Pausar, vMix, Input vMix, Duplicar
- `startScheduleFromNow()`: pula blocos anteriores ao horário atual ao iniciar
- `startScheduleFromItem()`: inicia a partir de item específico
- `pauseSchedule()`: para a sequência e reseta item atual para pending
- Modo merge no "Atualizar": preserva existentes, adiciona apenas faltantes
- `today()` corrigido para fuso horário local (era UTC — bug no Brasil após 21h)
- Blocos Comerciais com expansão inline (accordion)

### Fase 9 — Correções, Ponto de Pausa, Export/Import de Grade (v3.1.0)

#### 9a. Blocos musicais: 1 slot placeholder (não mais 10–20)
`generatePlaylistFromGrid` agora cria **exatamente 1 slot vazio** por bloco musical (em vez do cálculo por duração que criava 10–20 slots). O operador preenche manualmente.

#### 9b. Merge ("Atualizar") sincroniza corretamente blocos comerciais
Nova lógica distingue itens com e sem conteúdo real:
- **Itens pendentes** do bloco → sempre substituídos por dados frescos
- **Placeholders** (sem `filePath`, sem `inputName`, não é `vmix_action`) com status `skipped`/`done` → também removidos (eram stubs, não conteúdo real veiculado)
- **Itens com conteúdo** que já veicularam (`done`/`skipped`) → mantidos

#### 9c. Auto-sync da programação quando blocos comerciais são alterados
`useEffect` que observa `state.commercialBlocks`: quando um bloco é configurado ou alterado, a programação de hoje é automaticamente re-sincronizada (merge mode), desde que a sequência não esteja rodando.

#### 9d. Ponto de Pausa (novo tipo 'pause')
- Novo `SpotType: 'pause'` adicionado
- Menu de contexto na Programação: "Ponto de Pausa" na seção "Inserir após"
- Quando a sequência alcança um ponto de pausa: marca como `done`, para a sequência, limpa vMix completamente — exatamente igual ao fim natural
- Operador reinicia manualmente quando quiser
- Visual: `⏸ Pausa automática` em amarelo no card

#### 9e. autoplayComerciais: comportamento correto
A sequência só para entre blocos quando foi iniciada/interrompida pelo scheduler automático (`scheduleInterruptTimeRef !== ''`). Starts manuais (`scheduleInterruptTimeRef = ''`) correm livremente sem parar.

Lógica em `runSequence`:
```
Se activeQueue=schedule E (autoPlay OU autoplayComerciais) E scheduledDue=[] E scheduleInterruptTimeRef≠''
→ break (espera o próximo trigger do scheduler)
```

#### 9f. Skip de itens sem arquivo em playItem (não apenas no runSequence)
`playItem` agora verifica no início se o item tem conteúdo reproduzível. Se não tem (`!filePath && !inputName && type !== 'vmix_action' && type !== 'pause'`), marca como `skipped` e retorna imediatamente. Evita silêncios de 3+ segundos por placeholder.

#### 9g. Export / Import de Estrutura de Grade
- Botões "Exportar" e "Importar" na aba Estrutura
- Exporta os 7 dias como arquivo `.vtgrid` (JSON com versão e metadata)
- Importa: modal de seleção de dias (quais dias do arquivo aplicar)
- `commercialBlockId` preservados (para uso na mesma instalação)
- Novos IPC handlers: `export-grid`, `import-grid`

#### 9h. Correção: foco em modais no Electron
Substituição de `autoFocus` por `useRef + useEffect(() => ref.current?.focus(), [])` em todos os modais. Corrige o problema de "placeholder trava / não consigo digitar" que ocorria intermitentemente quando a janela perdia foco entre operações.

#### 9i. Correção: listeners de contexto estáveis
Context menus usavam `useEffect([onClose])`. Como `onClose` era uma arrow inline, re-registrava os listeners do `document` a cada render do pai (a cada 300ms durante playback). Corrigido com o padrão `useRef(onClose)` + `useEffect([], [])` — listeners registrados apenas uma vez por mount/unmount.

#### 9j. Correção: pipeline de build do preload.cjs
O Electron carrega `dist-electron/preload.cjs` (CommonJS), mas o `tsc` gerava apenas `preload.js` (ESM). O `preload.cjs` era um arquivo legado não atualizado automaticamente. Criado `scripts/build-preload-cjs.cjs` que converte o ESM para CJS e é executado automaticamente por `npm run electron:compile`. Garante que qualquer método novo em `preload.ts` chega ao `window.spotmaster` sem intervenção manual.

---

### Fase 10 — Programação Avançada, Arrastar entre Blocos, Copiar/Colar (v3.2.0)

#### 10a. Remoção do auto-carregamento de comerciais na Playlist
O `setInterval` de 30s em `AppContext` tinha dois papéis: watcher de meia-noite (mantido) e pré-carregador automático de blocos comerciais na playlist via `loadBlockIntoPlaylist` (removido). Agora blocos comerciais só entram na Playlist pelo botão manual "Inserir Bloco Comercial". A função `loadBlockIntoPlaylist` foi preservada no Context para uso manual.

#### 10b. Disparo e Autoplay Comerciais visíveis apenas na aba Programação
Os botões **Disparo ON/OFF** e **Autoplay Comerc.** da `Toolbar` passaram a ser renderizados condicionalmente: `{activePanel === 'programacao' && <> ... </>}`. Em todas as outras abas (Playlist, Estrutura, etc.) ficam ocultos, evitando acionamento acidental.

#### 10c. Sub-toolbar da Programação — botões sempre ativos
- **"+Adicionar item"**: sempre habilitado com estilo preenchido accent. Se há item selecionado, abre `AddItemModal` para o bloco daquele item. Se não há seleção, abre `BlockPickerModal`.
- **"Inputs vMix"**: sempre habilitado (removido `disabled={!vmixStatus.connected}`). Abre normalmente; se não conectado, exibe estado vazio.

#### 10d. BlockPickerModal — escolha de bloco sem seleção prévia
Componente local definido em `DaySchedulePanel.tsx`. Exibe lista de blocos com ícone `Clock`, horário, `slot.title` e contagem de itens. Clicar num bloco fecha o modal e abre o `AddItemModal` para aquele bloco. Ativado quando `showBlockPicker === true`.

#### 10e. Seleção visual de item na Programação
Clicar num card de item o seleciona: estado `selectedItemId: string | null`. O item selecionado recebe classe `selected` — borda lateral accent e fundo `color-mix(in srgb, var(--accent) 12%, transparent)`. Clicar no mesmo item deseleciona. Botão direito (contextMenu) também seleciona automaticamente.

#### 10f. Arrastar itens entre blocos diferentes
`handleDrop` detecta se o item arrastado veio de bloco diferente comparando `scheduledTime?.slice(0,5)`. Se diferente, cria `movedItem = { ...dragItem, scheduledTime: targetItem.scheduledTime }` antes de inserir. O item migra para o novo bloco com o `scheduledTime` correto.

#### 10g. Copiar / Colar no menu de contexto
Dois novos itens na seção "Editar" do `ScheduleCtxMenu`:
- **"Copiar item"** (ícone `Copy`): guarda referência em `copiedItem` (estado do componente)
- **"Colar abaixo"** (ícone `Clipboard`): visível apenas quando `copiedItem !== null`. Insere cópia com novo ID, `status: 'pending'`, logo abaixo do item clicado, herdando o `scheduledTime` do bloco de destino.

Props adicionados ao `ScheduleCtxMenu`: `onCopy: () => void`, `onPaste: () => void`, `canPaste: boolean`.

#### 10h. Correção do botão "+ Adicionar música"
`handleAddToGroup` anteriormente chamava `handleInsertAfter(lastItem)`, copiando o `type` do último item — se o último era `type: 'pause'`, um ponto de pausa era inserido em vez de uma música. Corrigido: `handleAddToGroup` agora chama `setAddItemGroup(group)`, abrindo o `AddItemModal` com as opções corretas.

#### 10i. VmixInputPanel — prop onAddInput para uso na Programação
`VmixInputPanel` ganhou prop opcional `onAddInput?: (inp: VmixInput) => void`:
- **Sem prop** (uso na Playlist): comportamento original — `addToEnd` → `dispatch ADD_PLAYLIST_ITEM`
- **Com prop** (uso na Programação): o botão `+` chama `onAddInput(inp)` em vez de `addToEnd`
- Hint text muda dinamicamente: `"Arraste para a programação · + Adiciona abaixo do item selecionado"`

Em `DaySchedulePanel`, `onAddInput` insere abaixo do `selectedItemId` (mesmo bloco) via `insertAfterItem`, ou appenda ao `groups[0]` via `insertItemAtGroupEnd` se nada estiver selecionado.

---

### Fase 11 — Robustez, Remoção de Legacy e UX Visual (v3.3.0)

#### 11a. Correções de bugs e robustez

- **runSequence error handling**: `runSequence` agora envolve o loop em `try/catch`. Erros inesperados são logados e a sequência termina com cleanup normal em vez de travar silenciosamente.
- **Log de arquivo não encontrado**: `playItem` detecta quando `filePath` está definido mas o arquivo não existe no disco. Em vez de deixar o vMix retornar erro, registra `ADD_LOG` com `status:'error'` e marca o item como `'error'` imediatamente, sem bloquear a sequência.
- Oito bugs corrigidos e cinco melhorias de robustez aplicados ao `AppContext.tsx`. As correções aumentam a estabilidade em edições de longa duração (maratonas, programações de dia inteiro).

#### 11b. Remoção completa do legacy `adBreaks`

A estrutura `adBreaks: AdBreak[]` era um remanescente do sistema antigo de blocos comerciais (anterior à Fase 6). Mantida apenas por compatibilidade de migração. Removida completamente:

| Local | O que foi removido |
|-------|-------------------|
| `src/types/index.ts` | Interface `AdBreak` inteira |
| `AppState` | Campo `adBreaks: AdBreak[]` |
| `AppContext.tsx` | Import do tipo, `initialState.adBreaks`, 3 action types (`ADD_AD_BREAK`, `UPDATE_AD_BREAK`, `DELETE_AD_BREAK`), 3 cases no reducer, carregamento no startup, payload no `LOAD_ALL`, `useEffect` de auto-save |

> O componente `AdBreaksPanel.tsx` **não foi removido** — ele é a UI dos `CommercialBlocks` (nome antigo do mesmo painel, ainda válido). Apenas o modelo de dados legado foi eliminado.

#### 11c. StatusBar redesenhada

O rodapé agora possui **três elementos visuais ativos** quando há item tocando:

| Elemento | Descrição |
|----------|----------|
| Badge `◉ ON AIR` | Substitui o ponto verde. Fundo vermelho translucido, borda, pulsa com `box-shadow` ciclando a cada 1,2s. |
| Countdown `−44:32` | Aparece ao lado do título do item atual. Fonte `Courier New` verde. Atualiza em tempo real via `activeItemProgress`. |
| Barra de progresso | 3px de altura, fixada na borda inferior do rodapé. Gradiente `var(--error) → var(--accent)`. Transição `width` 0,4s. |

**Arquitetura do layout:**
- `.status-bar` virou `flex-direction: column` com `transition: height 0.2s ease`
- Sem item: `height: 34px` (comportamento anterior)
- Com item: `height: 48px` (acomoda a barra + leve aumento de padding)
- `.statusbar-main` é o wrapper flex horizontal de todo o conteúdo anterior (vmix, item atual, próximo)
- `.statusbar-progress-track` é um filho separado abaixo do `statusbar-main`, `height: 3px`

#### 11d. PlaylistTable — linha playing e progresso

| Elemento | Antes | Depois |
|----------|-------|--------|
| Linha playing (fundo) | 8% verde | 16% verde + `border-left: 3px solid var(--success)` + `box-shadow` inset |
| Progress track (altura) | 4px | 6px |
| Progress track (fundo) | `var(--bg-tertiary)` | blend `bg-hover / border` — mais visível |
| Progress fill | sem glow | `box-shadow: 0 0 8px` verde |
| Badge pending | 15% | 22% |
| Badge playing | 20% | 28% + `font-weight: 700` |
| Badge error | 20% | 25% |

#### 11e. DaySchedulePanel — vibrância de cor

| Elemento | Antes | Depois |
|----------|-------|--------|
| Fundo do card (todos os tipos) | 6% cor | 12% cor |
| Borda do card (todos os tipos) | 35% cor | 45% cor |
| Header do card (todos os tipos) | 18% cor | 30% cor |
| Status badge do card | 20% cor | 30% cor |
| Linha item playing (fundo) | 8% accent | 15% accent + `border-left: 2px` |
| Barra inline de progresso | 2px sem glow | 3px + `box-shadow` accent |

---

## 5. Motor de playout

### Princípio: GUID-based, wall-clock

Cada input carregado pelo VTMaster é identificado pelo **GUID** (`key` attribute no XML do vMix). Estável mesmo com renumeração. O avanço é feito exclusivamente por **wall-clock**.

### Refs de controle

```typescript
activeInputRef            // GUID do input atualmente no ar ('' para inputs permanentes)
preloadedInputRef         // { guid, filePath } do próximo input já carregado em background
spotmasterGuidsRef        // Set<string> — todos os GUIDs carregados nesta sessão
abortRef                  // true quando stopPlayback() foi chamado
scheduleInterruptRef      // true quando abort foi pelo scheduler (retoma)
scheduleInterruptTimeRef  // HH:MM:SS do último trigger do scheduler (anti-re-trigger)
disparoInterruptRef       // true quando abort foi pelo Disparo (retoma)
activeQueueRef            // 'playlist' | 'schedule' — qual queue runSequence usa
```

### Fluxo de `playItem(item, nextFilePath?)`

```
1. Verificar se tem conteúdo: !filePath && !inputName && !vmix_action → status:'skipped', return
2. UPDATE item → status: 'playing'
3. Se vmix_action: executa comando vMix, 150ms, ADD_LOG, done, return
4. Se filePath:
   → Verificar preload (usar se bate, descartar se stale, carregar se vazio)
   → loadNewInput: AddInput → pollForNewInput (GUID) → SetPosition(0)
   → Se vídeo: PlayInput + sleep(300ms)
   → PreviewInput + sleep(100ms) + Cut
   → Se áudio: sleep(500ms) + PlayInput + sleep(200ms)
   → RemoveInput(prevGuid) com 5s de delay
5. Se inputName (permanente): SetPosition(0) + PlayInput + PreviewInput + Cut
6. ADD_LOG
7. Wall-clock loop (300ms):
   → Verifica abortRef a cada tick
   → Quando remaining ≤ 10s: preload do próximo em background
8. UPDATE item → status: 'done'
```

### `runSequence()` — lógica completa

```
while (true):
  1. Handle abort/interrupt
  2. pending = getQueue().filter(status='pending')
  3. Se pending vazio → break
  4. scheduledDue = pending filtrado por (scheduledTime <= now AND autoplay ativo)
  5. Se scheduledDue > 0: pula itens de ordem menor que o primeiro due
  6. ← NOVO v3.1: Se schedule+autoplay+scheduledDue=[]+ scheduleInterruptTimeRef≠'' → break
  7. next = scheduledDue[0] ?? pending[0 por order]
  8. Se next.type='pause' → done + break (para sequência, limpa vMix)
  9. Se next sem conteúdo → skipped + sleep(50ms) + continue
  10. playItem(next, afterNext.filePath?)
  11. sleep(200ms) + continue
```

---

## 6. Grade Semanal — Estrutura

### Conceitos

| Tipo de slot | O que é | Como preenche |
|-------------|---------|---------------|
| `bloco_musical` | Sequência de músicas | Aba **Programação** — [📁] por item |
| `bloco_comercial` | Intervalo de spots | Aba **Blocos Comerciais** — spots de anunciantes |
| `programa` | Vídeo/câmera/vinheta | Na **Estrutura** — arquivo ou input vMix |

### Comportamento de slots musicais gerados
Cada `bloco_musical` gera **exatamente 1 slot vazio** na programação (placeholder). O operador adiciona músicas manualmente via [📁] ou [+ Adicionar música]. Não há mais cálculo de quantidade por duração.

### Export / Import
Botões **Exportar** e **Importar** na aba Estrutura:
- **Exportar**: salva os 7 dias em arquivo `.vtgrid` (JSON estruturado)
- **Importar**: carrega um `.vtgrid`, modal permite selecionar quais dias aplicar

### Copiar estrutura entre dias
Botão "Copiar para..." no GradePanel: copia os slots de um dia para outros (atalhos Seg-Sex, Fim de semana, ou dias específicos).

---

## 7. Programação do Dia

### View em cards

Cada bloco da Estrutura vira um card colorido:
- 🎵 **Musical** — indigo: slots de música com [📁] e [+ Adicionar música]
- 💰 **Comercial** — verde: spots expandidos do bloco
- 📺 **Programa** — azul: arquivo/câmera configurado

### Operações disponíveis

| Ação | Como |
|------|------|
| Adicionar arquivo a slot vazio | Botão [📁] no item |
| Inserir nova música | Botão [+] no item ou "Adicionar música" no card |
| Reordenar dentro do bloco | Drag-and-drop pelo handle ⠿ |
| **Reordenar entre blocos** | Drag-and-drop para item de bloco diferente — `scheduledTime` atualiza automaticamente |
| **Selecionar item** | Clicar na linha — destaque visual accent; clicar novamente deseleciona |
| **Adicionar item (toolbar)** | Botão "+Adicionar item" sempre ativo — abre `AddItemModal` no bloco do item selecionado, ou `BlockPickerModal` se nenhum selecionado |
| **Painel Inputs vMix (toolbar)** | Botão "Inputs vMix" sempre ativo — `+` insere abaixo do item selecionado; arrastar também funciona |
| Iniciar a partir de agora | Botão "Iniciar Programação" — pula blocos passados |
| Iniciar a partir de item específico | Menu de contexto → "Iniciar daqui" |
| Pausar reprodução | Menu de contexto → "Pausar" (item atual volta para pending) |
| **Inserir ponto de pausa** | Menu de contexto → "Ponto de Pausa" (para sequência automaticamente) |
| Adicionar ação vMix | Menu de contexto → "Ação vMix" |
| Adicionar input vMix | Menu de contexto → "Input do vMix" |
| **Copiar item** | Menu de contexto → "Copiar item" |
| **Colar abaixo** | Menu de contexto → "Colar abaixo" (disponível quando há algo copiado; herda `scheduledTime` do bloco) |
| Duplicar item | Menu de contexto → "Duplicar Item" |
| Pular item | Menu de contexto → "Pular" |
| Atualizar da Estrutura | Botão "Atualizar" — merge mode |

### Modo merge do "Atualizar"

Preserva **tudo** existente que representa conteúdo real, substitui apenas stubs e itens desatualizados:
1. Itens **não-comerciais** → sempre mantidos
2. Itens comerciais com **conteúdo real** (filePath/inputName) já veiculados → mantidos
3. Itens comerciais **pendentes** → removidos e substituídos por dados frescos do bloco
4. Itens comerciais sem conteúdo (**placeholders**) com qualquer status → removidos e substituídos

### Auto-sync quando bloco é alterado

Quando o operador salva um bloco comercial (adiciona/remove/altera spots), um `useEffect` em `AppContext` detecta a mudança e roda `generatePlaylistFromGrid(hoje, true)` automaticamente, desde que:
- A programação de hoje já existe (fresh generation cuida de dias novos)
- A sequência NÃO esteja tocando (para não interferir com playback ativo)

### `startScheduleFromNow()`

```
1. Lê horário atual (HH:MM local)
2. Encontra o bloco mais recente cujo tempo ≤ agora
3. Marca todos os itens de blocos ANTES desse como 'skipped'
4. Inicia runSequence — começa pelo bloco atual
```

---

## 8. Blocos Comerciais

### Estrutura de dados

```typescript
CommercialBlock {
  id, name, scheduledTime: string  // HH:MM:SS
  items: CommercialBlockItem[]
  enabled: boolean
  daysOfWeek?: number[]            // 0=Dom...6=Sáb; undefined = todos
  lastLoadedDate?: string          // proteção contra carga dupla (YYYY-MM-DD)
}

CommercialBlockItem {
  id, order, type: 'spot_client' | 'vmix_action' | 'vmix_input'
  // spot_client:
  clientId?, spotsCount?
  // vmix_action:
  vmixAction?: { function, input?, value? }
  // vmix_input:
  inputName?, duration?
}
```

### Comportamento de placeholder

Quando um bloco está vazio (sem spots configurados), a programação mostra um **item placeholder** — visualmente indica que o bloco existe mas está sem conteúdo. Assim que o operador configura spots no bloco, o auto-sync ou o botão "Atualizar" substituem o placeholder pelos itens reais.

### Round-robin contínuo

```
Cliente com spots [A, B, C], spotsCount=2:
1ª execução: rotation[clientId]=0 → pega A, B → avança para 2
2ª execução: rotation[clientId]=2 → pega C, A → avança para 1
3ª execução: rotation[clientId]=1 → pega B, C → avança para 0
```

Índice nunca reseta. Contínuo entre dias e execuções (persistido em `spotRotation`).

---

## 9. Sistema de Disparo Global

| Estado | Ação |
|--------|------|
| App parado, pendentes existem | Inicia sequência |
| App tocando | Avança para o próximo item (interrompe o atual) |
| App parado, sem pendentes | Nenhuma ação |

Configuração: Configurações → Disparo → Capturar Tecla → qualquer tecla/combinação.
Funciona minimizado via `globalShortcut` do Electron. Suporta gamepad e MIDI via polling no renderer.

---

## 10. Ponto de Pausa

### O que é

Um item especial inserido na programação via menu de contexto (botão direito → "Ponto de Pausa"). Funciona como um marcador que para a sequência automaticamente quando é alcançado.

### Comportamento

```
Sequência roda normalmente...
→ Chega no item ⏸ Pausa automática
→ runSequence marca o item como 'done' e faz break
→ Cleanup normal: remove todos os inputs do vMix, isSequencePlaying = false
→ Operador vê a sequência parada, vMix limpo
→ Reinicia manualmente quando quiser (ex: "Iniciar daqui" no próximo item)
```

### Diferença de `pauseSchedule()`

| | `pauseSchedule()` | Ponto de Pausa |
|--|-------------------|----------------|
| Ativado por | Menu de contexto → "Pausar" (durante playback) | Item na sequência |
| Item pausado | Volta para `pending` (permite retomar) | `done` (consumido) |
| vMix | Pausa o input atual | Remove todos os inputs |
| Uso | Pausa de emergência com retomada | Ponto pré-programado de parada |

### Visual

No card da programação: `⏸ Pausa automática` em texto amarelo itálico bold. No arquivo `.vtgrid` exportado, pontos de pausa são incluídos se existirem nos slots.

---

## 11. Export / Import de Estrutura de Grade

### Formato do arquivo `.vtgrid`

```json
{
  "version": "1",
  "type": "vtmaster-grade",
  "exportedAt": "2026-05-11",
  "grid": {
    "0": [...slots do Domingo...],
    "1": [...slots da Segunda...],
    ...
    "6": [...slots do Sábado...]
  }
}
```

### Exportar

Clique em **"Exportar"** na aba Estrutura → diálogo "Salvar como" → `.vtgrid` (ou `.json`). Salva os 7 dias completos com todos os campos dos slots (incluindo `commercialBlockId`).

### Importar

Clique em **"Importar"** → seleciona arquivo → **modal de seleção de dias**:
- Mostra os 7 dias do arquivo com contagem de slots `(5)`
- Atalhos: "Seg–Sex", "Fim de semana", "Todos"
- Aviso ⚠ sobre substituição
- Ao confirmar: cada slot recebe novo ID (`crypto.randomUUID()`), `order` é renumerado

### Sobre `commercialBlockId`
- **Mesma instalação**: IDs combinam — vínculos com blocos comerciais funcionam normalmente
- **Instalação diferente**: IDs não existem — os slots ficam com horário e tipo corretos, mas o vínculo do bloco precisa ser refeito manualmente

---

## 12. Tipos de dados completos

### SpotType e SpotStatus

```typescript
type SpotStatus = 'pending' | 'playing' | 'done' | 'skipped' | 'error'
type SpotType   = 'spot' | 'vinheta' | 'programa' | 'bumper' | 'outros' | 'vmix_action' | 'pause'
//                                                                                          ↑ v3.1
```

### PlaylistItem

```typescript
interface PlaylistItem {
  id: string
  order: number
  title: string
  clientId?: string
  clientName?: string
  duration: number           // segundos (0 para vmix_action e pause)
  scheduledTime?: string     // HH:MM:SS
  inputName?: string
  type: SpotType
  status: SpotStatus
  filePath?: string
  mediaType?: 'video' | 'image' | 'audio'
  notes?: string
  adBreakId?: string         // referência ao CommercialBlock
  vmixAction?: VmixActionItem
}
```

### ProgramSlot (Estrutura Semanal)

```typescript
interface ProgramSlot {
  id: string
  order: number
  title: string              // auto-nome: "Musical 08:00", "Comercial 10:30"
  type: ScheduleSlotType     // SpotType | 'bloco_comercial' | 'bloco_musical'
  scheduledTime: string      // HH:MM:SS
  filePath?: string
  inputName?: string
  duration: number
  mediaType?: 'video' | 'audio' | 'image'
  commercialBlockId?: string // vincula ao CommercialBlock
  vmixAction?: VmixActionItem
}

type WeeklyProgramGrid = Record<number, ProgramSlot[]>  // 0=Dom...6=Sáb
```

### AppSettings

```typescript
interface AppSettings {
  vmixHost: string
  vmixPort: number
  stationName: string
  theme: 'dark' | 'light'
  language: 'pt' | 'en'
  autoConnect: boolean
  autoPlay: boolean             // autoplay geral por scheduledTime
  triggerEnabled: boolean
  triggerKey: string | null
  autoplayComerciais: boolean   // blocos comerciais disparam automaticamente
  preloadMinutes: number        // minutos antes para pré-carregar (padrão: 5)
}
```

### SpotMasterAPI (window.spotmaster)

```typescript
interface SpotMasterAPI {
  saveData(key, data): Promise<void>
  loadData(key): Promise<unknown>
  getVersion(): Promise<string>
  exportPlaylist(data): Promise<string | null>
  importPlaylist(): Promise<unknown>
  exportGrid(data): Promise<string | null>      // ← v3.1
  importGrid(): Promise<unknown>                // ← v3.1
  exportPDF(filePath, buffer): Promise<boolean>
  browseVideoFile(): Promise<string | null>
  vmixRequest(params): Promise<{success, data?, error?}>
  vmixStartPolling(host, port): Promise<boolean>
  vmixStopPolling(): Promise<boolean>
  onVmixStatus(callback): void
  removeVmixStatusListener(): void
  vmixStartFastPolling(host, port): Promise<boolean>
  vmixStopFastPolling(): Promise<boolean>
  onVmixFastStatus(callback): void
  removeVmixFastStatusListener(): void
  openExternal(url): Promise<void>
  registerTrigger(key): Promise<boolean>
  unregisterTrigger(): Promise<void>
  onTriggerFired(callback): void
  removeTriggerListener(): void
}
```

---

## 13. Estado global (AppContext)

### AppState

```typescript
interface AppState {
  playlist:           PlaylistItem[]
  dateSchedules:      Record<string, PlaylistItem[]>  // YYYY-MM-DD → programação do dia
  weeklyGrid:         WeeklyProgramGrid               // template semanal Dom-Sáb
  clients:            Client[]
  clientSpots:        ClientSpot[]
  commercialBlocks:   CommercialBlock[]
  spotRotation:       SpotRotation
  playLog:            PlayLog[]
  settings:           AppSettings
  vmixStatus:         VmixStatus
  activePanel:        string
  isLoading:          boolean
  isSequencePlaying:  boolean
  activeItemProgress: { inputNum, position, duration } | null
}
```

### Funções expostas via Context

```typescript
interface AppContextValue {
  state, dispatch, t, saveToStorage
  playItem(item, nextFilePath?): Promise<void>   // pula itens sem conteúdo
  playSingleItem(): void
  startSequence(): void                          // inicia playlist manual
  startSchedule(): void                          // inicia grade do dia (início)
  startScheduleFromNow(): void                   // inicia grade (bloco atual)
  startScheduleFromItem(id): void               // inicia de item específico
  pauseSchedule(): void                          // pausa, reseta item para pending
  stopPlayback(): Promise<void>
  loadBlockIntoPlaylist(block): void
  disparo(): void
  generatePlaylistFromGrid(date?, merge?): void
}
```

### useEffects críticos em AppContext

| useEffect | Deps | O que faz |
|-----------|------|-----------|
| Midnight watcher + preloader | `[state.isLoading, ...]` | Detecta virada de dia, pré-carrega blocos |
| Autoplay scheduler geral | `[state.isLoading, ...]` | Verifica a cada 1s itens gerais com scheduledTime vencido |
| Autoplay scheduler comercial | `[state.isLoading, ...]` | Verifica a cada 1s blocos com adBreakId vencidos |
| stateRef sync | `[]` | `stateRef.current = state` após cada render |
| Trigger keyboard | `[triggerEnabled, triggerKey, ...]` | Registra/cancela globalShortcut |
| Fast status listener | `[]` | Atualiza barra de progresso via fast polling |
| Auto-load today | `[isLoading]` | Gera grade do dia se não existe ao iniciar |
| **Auto-sync comerciais** | `[commercialBlocks]` | Re-sincroniza grade quando blocos são alterados ← v3.1 |

---

## 14. Persistência de dados

Todos os dados em `%APPDATA%\SpotMaster\` (Windows):

| Chave | Conteúdo |
|-------|---------|
| `settings` | AppSettings (tema, vMix, disparo, autoplay) |
| `playlist` | Playlist manual atual |
| `weeklyGrid` | Grade semanal Dom-Sáb (Estrutura) |
| `dateSchedules` | Programações por data YYYY-MM-DD |
| `commercialBlocks` | Blocos comerciais com items |
| `clientSpots` | Spots por anunciante |
| `spotRotation` | Índices de rodízio round-robin |
| `clients` | Anunciantes cadastrados |
| `playLog` | Histórico de veiculação |
| `activePanel` | Último painel ativo |

**Migração automática:** blocos no formato antigo (`slots[]`) são convertidos para `items[]` no `LOAD_ALL`.

> **Nota de branding:** o nome técnico `SpotMaster` ainda permanece em storage, bridge e alguns identificadores internos por compatibilidade. A interface visível do produto deve usar `VTMaster`.

---

## 15. Integração vMix

### Funções utilizadas

| Função | Uso |
|--------|-----|
| `AddInput Value=Video\|path` | Carrega vídeo |
| `AddInput Value=AudioFile\|path` | Carrega áudio |
| `AddInput Value=Image\|path` | Carrega imagem |
| `SetPosition Input=GUID&Value=0` | Rebobina |
| `PlayInput Input=GUID` | Inicia reprodução |
| `PreviewInput Input=GUID` | Envia para Preview |
| `Cut` | Corta Preview → Program |
| `RemoveInput Input=GUID` | Remove input (sempre por GUID, nunca por número) |
| `Pause Input=GUID` | Pausa reprodução (pauseSchedule) |
| Qualquer função HTTP | Via `vmix_action` (configurável pelo operador) |

### Polling duplo

| Tipo | Intervalo | Quando |
|------|-----------|--------|
| Normal | 2s | vMix conectado (status bar, painel de inputs) |
| Fast | 500ms | Durante reprodução ativa (barra de progresso) |

---

## 16. Build e preload.cjs

### Problema
O Electron carrega `dist-electron/preload.cjs` (CommonJS), mas o `tsc` com `"module": "ESNext"` gera apenas `preload.js` (ESM). O `preload.cjs` era um arquivo legado que ficava desatualizado silenciosamente a cada novo método adicionado ao `preload.ts`.

### Solução atual

```
npm run electron:compile
  = tsc -p tsconfig.electron.json    → gera dist-electron/preload.js (ESM)
  + node scripts/build-preload-cjs.cjs → converte para dist-electron/preload.cjs (CJS)
```

O script de conversão:
1. Lê `dist-electron/preload.js`
2. Substitui `import { X } from 'electron'` → `const { X } = require('electron')`
3. Prefixa identificadores com `electron_1.`
4. Grava `dist-electron/preload.cjs`

**Regra:** Ao adicionar qualquer método novo em `preload.ts`, rodar `npm run build` (ou `npm run electron:compile`) é suficiente — o `preload.cjs` é atualizado automaticamente.

---

## 17. Funcionalidades — checklist v3.3

### ✅ Fase 1 — Motor de playout base
- [x] Playlist manual: criar, editar, reordenar, excluir itens
- [x] Drag & drop de inputs vMix para posição específica
- [x] Sequência automática GUID-based, wall-clock
- [x] Corte: PlayInput → PreviewInput → Cut
- [x] A/B Roll gapless (preload antecipado 10s)
- [x] Inputs permanentes intocáveis (câmeras, NDI)
- [x] Limpeza garantida via spotmasterGuidsRef
- [x] Autoplay por scheduledTime
- [x] Log automático + PDF + CSV
- [x] Tema dark/light, bilíngue PT/EN

### ✅ Fase 2 — Blocos Comerciais
- [x] Cadastro de spots por anunciante
- [x] Detecção automática de duração
- [x] Round-robin contínuo entre execuções
- [x] Scheduler 30s com proteção contra carga dupla
- [x] Toggle ativo/inativo por bloco

### ✅ Fase 3 — Disparo Global
- [x] Captura de tecla (F1-F12, letras, combinações, teclas de mídia)
- [x] globalShortcut Electron (funciona minimizado)
- [x] Autoplay Comerciais como toggle separado
- [x] Pré-carregamento configurável (1-60 min)
- [x] Gamepad via polling (navigator.getGamepads)
- [x] MIDI via Web MIDI API

### ✅ Fase 4 — Ações vMix e Menu de Contexto
- [x] Tipo `vmix_action` na playlist
- [x] Menu de contexto completo (inserir, editar, duplicar, pular)
- [x] INSERT_PLAYLIST_ITEM_AFTER no reducer

### ✅ Fase 5-6 — Grade Semanal + Reestruturação Comercial
- [x] Aba Estrutura: template semanal Dom-Sáb
- [x] Três tipos de slot: Programa, Bloco Musical, Bloco Comercial
- [x] CommercialBlockItem: spot_client, vmix_action, vmix_input
- [x] expandBlockItems() com round-robin integrado
- [x] Filtro de dias da semana por bloco
- [x] Copiar estrutura entre dias

### ✅ Fase 7 — Programação do Dia como Queue Independente
- [x] dateSchedules: Record<string, PlaylistItem[]>
- [x] Dois queues independentes: playlist vs. grade
- [x] activeQueueRef — controla qual queue runSequence usa
- [x] DaySchedulePanel com date picker

### ✅ Fase 8 — Card-View, Drag-Drop e UX Avançada
- [x] View em cards por bloco (musical/comercial/programa)
- [x] Cards coloridos: indigo, verde, azul
- [x] Drag-and-drop com handle ⠿
- [x] Menu de contexto completo na Programação
- [x] startScheduleFromNow() / startScheduleFromItem() / pauseSchedule()
- [x] Modo merge no "Atualizar"
- [x] today() corrigido para fuso local
- [x] Blocos Comerciais com expansão inline

### ✅ Fase 9 — v3.1.0

- [x] **Bloco musical: 1 slot placeholder** (não mais 10–20 calculados)
- [x] **Merge corrigido**: remove placeholders com qualquer status, preserva conteúdo real
- [x] **Auto-sync**: programação atualiza automaticamente quando bloco é configurado
- [x] **Ponto de Pausa**: novo SpotType 'pause', menu de contexto, runSequence break limpo
- [x] **autoplayComerciais correto**: para quando scheduler disparou, corre livre em start manual
- [x] **playItem skip**: itens sem conteúdo → skipped imediatamente (sem silêncio)
- [x] **Export de grade**: botão Exportar → arquivo .vtgrid
- [x] **Import de grade**: botão Importar → modal de seleção de dias
- [x] **Foco em modais**: useRef+useEffect substitui autoFocus (confiável no Electron)
- [x] **Context menu estável**: useRef(onClose) evita re-registro de listeners a cada render
- [x] **preload.cjs pipeline**: script automático mantém CJS sincronizado com TS source

### ✅ Fase 10 — v3.2.0

- [x] **Sem auto-carregamento de comerciais na Playlist**: removido `loadBlockIntoPlaylist` do interval de 30s
- [x] **Disparo/AutoplayComerciais visíveis só na aba Programação**: `{activePanel === 'programacao' && ...}`
- [x] **Sub-toolbar sempre ativa**: "+Adicionar item" e "Inputs vMix" sem `disabled`
- [x] **BlockPickerModal**: lista de blocos para seleção quando nenhum item está selecionado
- [x] **Seleção visual de item**: click seleciona/deseleciona, borda e fundo accent
- [x] **Arrastar entre blocos**: `scheduledTime` do item atualiza para o bloco de destino
- [x] **Copiar / Colar**: menu de contexto → "Copiar item" / "Colar abaixo" (herda `scheduledTime`)
- [x] **Correção "+ Adicionar música"**: `handleAddToGroup` abre `AddItemModal` (não clona `type` do último item)
- [x] **VmixInputPanel.onAddInput**: prop opcional — na Programação `+` insere no schedule; comportamento original da Playlist preservado

### ✅ Fase 11 — v3.3.0

- [x] **runSequence error handling**: try/catch no loop principal, erros não travam a sequência
- [x] **Log de arquivo não encontrado**: `playItem` detecta arquivo ausente antes de chamar vMix, marca como `error` e continua
- [x] **8 bugs corrigidos + 5 melhorias de robustez**: AppContext mais estável em programações longas
- [x] **Remoção do legacy `adBreaks`**: tipo, estado, reducer, startup load, save effect — tudo eliminado
- [x] **StatusBar redesenhada**: badge `◉ ON AIR` pulsante, countdown `−44:32`, barra de progresso 3px inferior
- [x] **Layout StatusBar**: `flex-direction: column`, `.statusbar-main`, height 34→48px com transição CSS
- [x] **Playlist — linha playing**: fundo 16% verde + border-left 3px + inset shadow
- [x] **Playlist — progress track**: 4→6px, overflow:visible, glow no fill
- [x] **Playlist — status badges**: mais saturados (pending 22%, playing 28%+bold, error 25%)
- [x] **DaySchedule — cards**: fundo 6→12%, bordas 35→45%
- [x] **DaySchedule — headers**: 18→30% (muito mais visíveis)
- [x] **DaySchedule — item playing**: fundo 8→15% + border-left
- [x] **DaySchedule — barra inline**: 2→3px + glow accent

### ✅ Melhorias de interface — 12/05/2026

- [x] **Aba ativa persistida no layout**: `App.tsx` passou a respeitar `activePanel` salvo no estado global
- [x] **Sidebar com ícones**: navegação lateral mais clara e com melhor leitura
- [x] **Toolbar em dois níveis**: topo global + ações contextuais por aba
- [x] **Favicon VTMaster**: substituição do ícone de template
- [x] **Textos visíveis alinhados com a marca VTMaster**
- [x] **Cockpit da Programação**: resumo operacional com agora, próximo e ações principais
- [x] **Destaque visual de bloco atual e próximo bloco** na aba Programação
- [x] **Núcleo do design system**: novos componentes `Button`, `Modal`, `Field`, `SegmentedControl` e `Badge`
- [x] **Migração dos modais principais**: `ItemModal`, `SettingsModal`, `ProgramSlotModal` e edição rápida de horário passaram a usar a base compartilhada
- [x] **Base compartilhada aplicada em telas operacionais**: `Toolbar`, `GradePanel` e `AdBreaksPanel` agora usam o design system inicial
- [x] **Fluxo de adicionar item na Programação refinado**: `AddItemModal`, `BlockPickerModal` e modais auxiliares ganharam hierarquia visual e melhor leitura operacional

### Pós-Fase 11 — Melhorias de Interface (12/05/2026)

#### Interface 1 — Polimento rápido e coesão

- **Aba ativa corrigida**: `App.tsx` passou a usar diretamente `state.activePanel`, eliminando divergência entre a navegação persistida e o conteúdo renderizado.
- **Sidebar com ícones**: a navegação lateral ficou mais larga e legível, com ícones por seção para leitura mais rápida pelo operador.
- **Toolbar reorganizada**: o topo foi dividido em uma faixa global (marca, status vMix, tema, idioma, configurações) e uma faixa contextual com ações da aba ativa.
- **Marca visível alinhada**: favicon antigo de template foi trocado por um ícone VTMaster, e textos visíveis ao usuário foram atualizados de SpotMaster para VTMaster onde fazia sentido de produto.
- **Compatibilidade preservada**: nomes técnicos como `%APPDATA%/SpotMaster/` e `window.spotmaster` continuam existindo internamente para não quebrar storage, preload e integrações já estáveis.

#### Interface 2 — Cockpit operacional da Programação

- **Novo topo operacional na aba Programação**: `DaySchedulePanel` ganhou um cockpit com bloco atual, próximo bloco/item e resumo do dia.
- **Ações principais concentradas**: centralizar, atualizar, adicionar item, abrir Inputs vMix e iniciar/parar programação ficaram reunidos em destaque visual.
- **Leitura operacional melhorada**: blocos atual e próximo passaram a ter marcação visual dedicada para reduzir ambiguidade durante operação ao vivo.
- **Refino de implementação**: o cabeçalho antigo foi mantido temporariamente no DOM e ocultado por CSS para reduzir risco funcional nesta etapa.

#### Interface 3 — Design system e fluxo de inserção

- **Design system inicial em produção**: `Button`, `Modal`, `Field`, `SegmentedControl`, `Badge` e `PageHeader` passaram a sustentar os principais fluxos novos.
- **Modais principais migrados**: Playlist, Configurações, Estrutura e edição rápida deixaram de depender de estilos isolados.
- **Telas operacionais alinhadas**: Toolbar, Estrutura e Blocos Comerciais receberam a mesma base visual compartilhada.
- **Adicionar item na Programação corrigido**: o fluxo voltou a usar modal centralizado e legível, com escolha clara entre arquivo de mídia, ação vMix e input vMix, além de seletor de bloco mais limpo.

---

## 18. Backlog

### Alta prioridade

| Item | Descrição |
|------|-----------|
| **Cleanup ao excluir anunciante** | clientSpots ficam órfãos ao deletar o cliente |
| **Prévia de mídia** | Pré-visualizar clipe antes de adicionar à programação |
| **Edição inline de título/duração** | Editar diretamente na linha do card sem abrir modal |

### Média prioridade

| Item | Descrição |
|------|-----------|
| **Importação CSV** | Carregar itens a partir de planilha |
| **Múltiplos blocos no mesmo horário** | Potencial conflito de scheduledTime |
| **Resetar programação do dia** | Botão para regerar do zero (descartando edições manuais) |
| **Colar em bloco específico** | BlockPickerModal para o "Colar" (hoje sempre cola abaixo do item clicado) |

### Baixa prioridade

| Item | Descrição |
|------|-----------|
| **Licenciamento** | Proteção por CNPJ/chave de ativação |
| **Sincronização em rede** | Múltiplos operadores editando simultaneamente |
| **Suporte nativo MIDI/HID** | Hoje via mapeamento de teclas em software externo |
