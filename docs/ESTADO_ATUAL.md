# VTMaster — Estado Atual do Projeto

> Atualizado em **11/05/2026** — Versão **3.0.0** — Fase 8: Grade de Programação + Programação do Dia

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
10. [Tipos de dados completos](#10-tipos-de-dados-completos)
11. [Estado global (AppContext)](#11-estado-global-appcontext)
12. [Persistência de dados](#12-persistência-de-dados)
13. [Integração vMix](#13-integração-vmix)
14. [Funcionalidades — checklist v3.0](#14-funcionalidades--checklist-v30)
15. [Backlog](#15-backlog)

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

### Fluxo de Grade de Programação (v3.0)

```
Operador monta a Estrutura Semanal (Dom-Sáb):
  → Blocos Musicais: horário + slots gerados automaticamente
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
Menu de contexto (botão direito): Iniciar daqui, Pausar, vMix, Duplicar...
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
Blocos são vinculados à Estrutura Semanal
        ↓
Ao gerar a Programação do Dia: spots são expandidos em items individuais
        ↓
Scheduler (30s): X minutos antes → pré-carrega na playlist manual também
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
│   ├── preload.ts       → Bridge renderer↔main via contextBridge
│   └── vmix.ts          → Integração HTTP com a API do vMix
│
├── src/
│   ├── App.tsx          → Layout, navegação de painéis, modais globais
│   ├── App.css          → Variáveis CSS, tema dark/light, layout
│   ├── types/index.ts   → TODOS os tipos e interfaces
│   ├── store/
│   │   └── AppContext.tsx → Estado global, motor de playout, scheduler, disparo
│   ├── i18n/
│   │   ├── pt.ts        → Strings PT (fonte da verdade)
│   │   └── en.ts        → Strings EN
│   ├── utils/time.ts    → now(), today() (local TZ), formatDuration()
│   └── components/
│       ├── Toolbar/     → vMix, Disparo ON/OFF, Autoplay Comerc., tema, idioma
│       ├── StatusBar/   → Status vMix, item atual, próximo
│       ├── Grade/
│       │   ├── GradePanel.tsx       → Estrutura semanal (template Dom-Sáb)
│       │   └── ProgramSlotModal.tsx → Criar/editar slot (Programa/Musical/Comercial)
│       ├── DaySchedule/
│       │   ├── DaySchedulePanel.tsx → Programação do Dia (card-view, drag-drop)
│       │   └── DaySchedulePanel.css → Estilos cards, drag-over, etc.
│       ├── AdBreaks/
│       │   ├── AdBreaksPanel.tsx    → Blocos com expansão inline (accordion)
│       │   └── AdBreaksPanel.css
│       ├── Clients/     → Cadastro de anunciantes + spots com detecção de duração
│       ├── Playlist/
│       │   ├── PlaylistTable.tsx  → Tabela + controles
│       │   ├── ContextMenu.tsx    → Menu de contexto (botão direito)
│       │   ├── ItemModal.tsx      → Criar/editar item
│       │   └── VmixInputPanel.tsx → Painel lateral de inputs do vMix
│       ├── Log/         → Log de veiculação
│       └── Reports/     → Geração de PDF
│
└── docs/
    ├── ESTADO_ATUAL.md  → Este arquivo
    ├── DEVELOPMENT.md   → Documentação técnica detalhada
    └── INDEX.md         → Índice geral
```

---

## 4. Histórico de fases

### Fase 1 — Motor de playout base
Motor GUID-based, wall-clock. Bugs críticos corrigidos: sequência parava no item 2, áudios não avançavam, race conditions no preload, inputs fantasmas. Reescrita completa do loop de playout.

### Fase 2 — Sistema de Blocos Comerciais
Cadastro de spots por anunciante, round-robin contínuo, scheduler 30s, proteção contra carga dupla.

### Fase 3 — Disparo Global e Automação
`globalShortcut` Electron, Autoplay Comerciais como toggle separado, pré-carregamento configurável.

### Fase 4 — Ações vMix e Menu de Contexto
Novo tipo `vmix_action` na playlist, menu de contexto completo (inserir ação/input, editar, duplicar, pular).

### Fase 5 — Grade de Programação Semanal
- **Aba Estrutura**: template semanal Dom-Sáb com slots de Programa, Bloco Musical e Bloco Comercial
- **Aba Programação**: calendário por data com view independente do queue de playlist
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
- **DaySchedulePanel**: date picker, seletor de data com persistência entre abas

### Fase 8 — Card-View, Drag-Drop e UX do Operador (v3.0)
- **View em cards por bloco** na Programação: cards coloridos (musical/comercial/programa)
- **Drag-and-drop** para reordenar itens dentro e entre blocos
- **Menu de contexto** na Programação: Iniciar daqui, Pausar, Ação vMix, Input vMix, Duplicar
- `startScheduleFromNow()`: pula blocos anteriores ao horário atual ao iniciar
- `startScheduleFromItem()`: inicia a partir de um item específico (botão direito → Iniciar daqui)
- `pauseSchedule()`: para a sequência e reseta item atual para pending (permite retomar)
- **Skip automático de itens vazios** no `runSequence` (sem arquivo nem input = pulado)
- **Modo merge** no "Atualizar": preserva itens existentes, adiciona apenas horários novos
- **today() corrigido** para fuso horário local (antes usava UTC, causava bugs noturnos no Brasil)
- **Blocos Comerciais** com expansão inline (accordion) — sem navegar para tela separada
- Auto-centralizar no bloco atual ao montar o painel de Programação
- `selectedDate` persistido no App.tsx (sobrevive à troca de abas)

---

## 5. Motor de playout

### Princípio: GUID-based, wall-clock

Cada input carregado pelo VTMaster é identificado pelo **GUID** (`key` attribute no XML do vMix). Estável mesmo com renumeração. O avanço é feito exclusivamente por **wall-clock**, nunca por polling de estado.

### Refs de controle

```typescript
activeInputRef          // GUID do input atualmente no ar ('' para inputs permanentes)
preloadedInputRef       // { guid, filePath } do próximo input já carregado em background
spotmasterGuidsRef      // Set<string> — todos os GUIDs carregados nesta sessão
abortRef                // true quando stopPlayback() foi chamado
scheduleInterruptRef    // true quando abort foi pelo scheduler (retoma)
disparoInterruptRef     // true quando abort foi pelo Disparo (retoma)
activeQueueRef          // 'playlist' | 'schedule' — qual queue runSequence usa
```

### Fluxo de `playItem(item, nextFilePath?)`

```
1. UPDATE item → status: 'playing'
2. Se filePath:
   → Verificar preload (usar se bate, descartar se stale, carregar se vazio)
   → loadNewInput: AddInput → pollForNewInput (GUID) → SetPosition(0)
   → Se vídeo: PlayInput + sleep(300ms)
   → PreviewInput + sleep(100ms) + Cut
   → Se áudio: sleep(500ms) + PlayInput + sleep(200ms)
   → RemoveInput(prevGuid) com 5s de delay
3. Se inputName (permanente): SetPosition(0) + PlayInput + PreviewInput + Cut
4. ADD_LOG
5. Wall-clock loop (300ms):
   → Verifica abortRef a cada tick
   → Quando remaining ≤ 10s: preload do próximo em background
6. UPDATE item → status: 'done'
```

### Skip de itens vazios

Se o item selecionado em `runSequence` não tem `filePath`, `inputName` e não é `vmix_action`, é marcado como `skipped` instantaneamente sem chamar `playItem`. Permite que blocos musicais sem arquivos sejam pulados sem travar a sequência.

---

## 6. Grade Semanal — Estrutura

### Conceitos

| Tipo de slot | O que é | Como preenche |
|-------------|---------|---------------|
| `bloco_musical` | Sequência de músicas | Aba **Programação** — [📁] por item |
| `bloco_comercial` | Intervalo de spots | Aba **Blocos Comerciais** — spots de anunciantes |
| `programa` | Vídeo/câmera | Na **Estrutura** — arquivo ou input vMix |

### Auto-naming
Slots criados na Estrutura recebem nome automático: `Musical 08:00`, `Comercial 10:30`, `Programa 14:00`.

### Cálculo de slots musicais
```
durationMins <= 15 → 1 slot por 2.5 min  (música curta)
durationMins >  15 → 1 slot por 2.0 min  (bloco longo)
```

### Copiar estrutura entre dias
Botão "Copiar Dia" no GradePanel: copia os slots de um dia para outros (Seg-Sex, Dom, ou dias específicos).

---

## 7. Programação do Dia

### View em cards

Cada bloco da Estrutura vira um card colorido:
- 🎵 **Musical** — indigo: mostra slots de música com [📁] e [+]
- 💰 **Comercial** — verde: mostra spots expandidos do bloco
- 📺 **Programa** — azul: mostra arquivo/câmera configurado

### Operações disponíveis

| Ação | Como |
|------|------|
| Adicionar arquivo a slot vazio | Botão [📁] no item, ou menu de contexto |
| Inserir nova música | Botão [+] no item ou "Adicionar música" no card |
| Reordenar | Drag-and-drop pelo handle ⠿ |
| Iniciar a partir de agora | Botão "Iniciar Programação" — pula blocos passados |
| Iniciar a partir de item específico | Menu de contexto → "Iniciar daqui" |
| Pausar | Menu de contexto → "Pausar" (item atual volta para pending) |
| Adicionar ação vMix | Menu de contexto → "Ação vMix" |
| Adicionar input vMix | Menu de contexto → "Input do vMix" |
| Pular item | Menu de contexto → "Pular" |
| Atualizar da Estrutura | Botão "Atualizar" — modo merge (preserva tudo existente) |

### Modo merge do "Atualizar"

O botão "Atualizar" usa `merge=true` em `generatePlaylistFromGrid`:
- Identifica horários (HH:MM) já presentes na programação atual
- Gera itens para todos os slots da Estrutura
- Filtra: mantém apenas os itens de **novos** horários (não cobertos)
- Combina existentes + novos, reordena por scheduledTime

### `startScheduleFromNow()`

```
1. Lê horário atual (HH:MM local)
2. Encontra o bloco mais recente cujo tempo ≤ agora
3. Marca todos os itens de blocos ANTES desse como 'skipped'
4. Inicia runSequence — começa pelo bloco atual
```

### Persistência da data selecionada

`selectedDate` vive no App.tsx (não no componente). Sobrevive à troca de abas. Auto-centraliza no bloco do horário atual ao montar.

---

## 8. Blocos Comerciais

### Estrutura de dados

```typescript
CommercialBlock {
  id, name, scheduledTime: string  // HH:MM:SS
  items: CommercialBlockItem[]
  enabled: boolean
  daysOfWeek?: number[]            // 0=Dom...6=Sáb; undefined = todos
  lastLoadedDate?: string          // proteção contra carga dupla
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

### Expansão inline no painel

Cada card de bloco tem botão ▾ para expandir um editor inline:
- Campos: nome, horário, ativo/inativo, dias da semana
- Lista de itens com `BlockItemRow` editável
- Botões: + Spot de Cliente, + Ação vMix, + Input vMix
- Salvar/Cancelar dentro do card (sem navegar)

### Round-robin contínuo

```
Cliente com spots [A, B, C], spotsCount=2:
1ª execução: rotation[clientId]=0 → pega A, B → avança para 2
2ª execução: rotation[clientId]=2 → pega C, A → avança para 1
3ª execução: rotation[clientId]=1 → pega B, C → avança para 0
```

Índice nunca reseta. Contínuo entre dias e execuções.

---

## 9. Sistema de Disparo Global

| Estado | Ação |
|--------|------|
| App parado, pendentes existem | Inicia sequência |
| App tocando | Avança para o próximo item (interrompe o atual) |
| App parado, sem pendentes | Nenhuma ação |

Configuração: Configurações → Disparo → Capturar Tecla → qualquer tecla/combinação.
Funciona minimizado via `globalShortcut` do Electron.

---

## 10. Tipos de dados completos

### PlaylistItem
```typescript
interface PlaylistItem {
  id: string
  order: number
  title: string
  clientId?: string
  clientName?: string
  duration: number           // segundos
  scheduledTime?: string     // HH:MM:SS
  inputName?: string
  type: SpotType             // 'spot' | 'vinheta' | 'programa' | 'bumper' | 'outros' | 'vmix_action'
  status: SpotStatus         // 'pending' | 'playing' | 'done' | 'skipped' | 'error'
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
  title: string              // auto-nome: "Musical 08:00"
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
  autoPlay: boolean
  triggerEnabled: boolean
  triggerKey: string | null
  autoplayComerciais: boolean
  preloadMinutes: number
}
```

---

## 11. Estado global (AppContext)

### AppState
```typescript
interface AppState {
  playlist:           PlaylistItem[]
  dateSchedules:      Record<string, PlaylistItem[]>  // YYYY-MM-DD → programação do dia
  weeklyGrid:         WeeklyProgramGrid               // template semanal Dom-Sáb
  adBreaks:           AdBreak[]
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
  playItem(item): Promise<void>
  playSingleItem(): void
  startSequence(): void          // inicia playlist manual
  startSchedule(): void          // inicia grade do dia (desde o início)
  startScheduleFromNow(): void   // inicia grade do dia (a partir do bloco atual)
  startScheduleFromItem(id): void // inicia a partir de item específico
  pauseSchedule(): void           // pausa e reseta item atual para pending
  stopPlayback(): Promise<void>
  loadBlockIntoPlaylist(block): void
  disparo(): void
  generatePlaylistFromGrid(date?, merge?): void
}
```

### Actions do reducer

**Schedule/Grade:**
`SET_DATE_SCHEDULE`, `UPDATE_SCHEDULE_ITEM`, `DELETE_SCHEDULE_ITEM`, `REORDER_DATE_SCHEDULE`,
`SET_WEEKLY_GRID`, `ADD_PROGRAM_SLOT`, `UPDATE_PROGRAM_SLOT`, `DELETE_PROGRAM_SLOT`, `REORDER_PROGRAM_SLOTS`

**Playlist:** `SET_PLAYLIST`, `ADD_PLAYLIST_ITEM`, `UPDATE_PLAYLIST_ITEM`, `DELETE_PLAYLIST_ITEM`, `CLEAR_PLAYLIST`, `REORDER_PLAYLIST`, `INSERT_PLAYLIST_ITEM_AFTER`

**Comercial:** `ADD_COMMERCIAL_BLOCK`, `UPDATE_COMMERCIAL_BLOCK`, `DELETE_COMMERCIAL_BLOCK`, `MARK_BLOCK_LOADED`, `ADD_CLIENT_SPOT`, `UPDATE_CLIENT_SPOT`, `DELETE_CLIENT_SPOT`, `SET_SPOT_ROTATION`

**App:** `SET_SETTINGS`, `SET_VMIX_STATUS`, `SET_SEQUENCE_PLAYING`, `SET_ACTIVE_ITEM_PROGRESS`, `SET_ACTIVE_PANEL`, `SET_LOADING`, `LOAD_ALL`

---

## 12. Persistência de dados

Todos os dados em `%APPDATA%\SpotMaster\` (Windows):

| Chave | Conteúdo |
|-------|---------|
| `settings` | Configurações (tema, vMix, disparo, preload) |
| `playlist` | Playlist manual atual |
| `weeklyGrid` | Grade semanal (Estrutura) Dom-Sáb |
| `dateSchedules` | Programações por data YYYY-MM-DD |
| `commercialBlocks` | Blocos comerciais com itens |
| `clientSpots` | Spots por anunciante |
| `spotRotation` | Índices de rodízio round-robin |
| `clients` | Anunciantes cadastrados |
| `playLog` | Histórico de veiculação |
| `adBreaks` | Blocos legacy (compatibilidade) |
| `activePanel` | Último painel ativo |

**Migração automática:** blocos no formato antigo (`slots[]`) são convertidos para `items[]` no LOAD_ALL.

---

## 13. Integração vMix

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
| `RemoveInput Input=GUID` | Remove input |
| `Pause Input=GUID` | Pausa reprodução (pauseSchedule) |
| Qualquer função HTTP | Via `vmix_action` (configurável pelo operador) |

### Polling duplo

| Tipo | Intervalo | Quando |
|------|-----------|--------|
| Normal | 2s | vMix conectado (status bar, painel de inputs) |
| Fast | 500ms | Durante reprodução ativa (barra de progresso) |

---

## 14. Funcionalidades — checklist v3.0

### ✅ Fase 1 — Motor de playout base
- [x] Playlist manual: criar, editar, reordenar, excluir itens
- [x] Drag & drop de inputs vMix para posição específica
- [x] Sequência automática com GUID-based, wall-clock
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

### ✅ Fase 4 — Ações vMix e Menu de Contexto
- [x] Tipo `vmix_action` na playlist
- [x] Menu de contexto completo (inserir, editar, duplicar, pular)
- [x] INSERT_PLAYLIST_ITEM_AFTER no reducer

### ✅ Fase 5-6 — Grade Semanal + Reestruturação Comercial
- [x] Aba Estrutura: template semanal Dom-Sáb
- [x] Três tipos de slot: Programa, Bloco Musical, Bloco Comercial
- [x] Auto-naming de slots por tipo + horário
- [x] `CommercialBlockItem`: spot_client, vmix_action, vmix_input
- [x] `expandBlockItems()` com round-robin integrado
- [x] Filtro de dias da semana por bloco
- [x] Copiar estrutura entre dias (Seg-Sex, Dom, específicos)
- [x] Cálculo automático de slots musicais por duração do bloco
- [x] Aba Clientes com gerenciamento de spots por anunciante

### ✅ Fase 7 — Programação do Dia como Queue Independente
- [x] dateSchedules: Record<string, PlaylistItem[]>
- [x] Dois queues independentes: playlist vs. grade
- [x] activeQueueRef — controla qual queue runSequence usa
- [x] startSchedule() / startSequence() ativam queues diferentes
- [x] DaySchedulePanel com date picker e pré-visualização de datas

### ✅ Fase 8 — Card-View, Drag-Drop e UX Avançada (v3.0)
- [x] View em cards por bloco (musical/comercial/programa)
- [x] Cards coloridos: indigo (musical), verde (comercial), azul (programa)
- [x] Drag-and-drop com handle ⠿ e feedback visual
- [x] Menu de contexto na Programação:
  - [x] "Iniciar daqui" — pula itens anteriores ao selecionado
  - [x] "Pausar" — para e reseta item atual para pending
  - [x] Ação vMix inline
  - [x] Input vMix inline
  - [x] Duplicar, Pular, Marcar veiculado, Editar horário
- [x] `startScheduleFromNow()` — pula blocos antes do horário atual
- [x] `startScheduleFromItem()` — inicia a partir de item específico
- [x] `pauseSchedule()` — pausa com reset do item para pending
- [x] Skip automático de itens sem arquivo no runSequence
- [x] Modo merge no "Atualizar" (preserva existentes, adiciona faltantes)
- [x] today() corrigido para fuso local (era UTC — bug em Brasil após 21h)
- [x] selectedDate persistido no App.tsx (sobrevive troca de abas)
- [x] Auto-centralizar no bloco atual ao abrir Programação
- [x] Blocos Comerciais com expansão inline (accordion)
- [x] Fix de flex-shrink nos cards (bug visual com muitos blocos)
- [x] "Centralizar Bloco" disponível para qualquer data (não só hoje)

---

## 15. Backlog

### Alta prioridade

| Item | Descrição |
|------|-----------|
| **Cleanup ao excluir anunciante** | clientSpots ficam órfãos ao deletar o cliente |
| **Digitação nos inputs dos modais** | Verificar se onMouseDown stopPropagation resolve em todos os cenários |

### Média prioridade

| Item | Descrição |
|------|-----------|
| **Preview de mídia** | Pré-visualizar clipe antes de adicionar |
| **Importação CSV** | Carregar itens a partir de planilha |
| **Múltiplos blocos no mesmo horário** | Potencial conflito de scheduledTime |

### Baixa prioridade

| Item | Descrição |
|------|-----------|
| **Licenciamento** | Proteção por CNPJ/chave de ativação |
| **Sincronização em rede** | Múltiplos operadores editando simultaneamente |
| **Suporte nativo MIDI/HID** | Hoje via mapeamento de teclas em software externo |
