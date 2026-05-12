# VTMaster — Documentação Técnica de Desenvolvimento

> Software de playout e grade de programação para emissoras de TV/Rádio
> Stack: **Electron 41 + React 19 + TypeScript 6 + Vite 8**
> Desenvolvido por **RobsonCostaDV** — Versão **3.3.0** — Atualizado: 12/05/2026

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Estrutura de Arquivos](#2-estrutura-de-arquivos)
3. [Stack Técnico](#3-stack-técnico)
4. [Configuração e Build](#4-configuração-e-build)
5. [Pipeline do preload.cjs](#5-pipeline-do-preloadcjs)
6. [Processo Principal — Electron (main.ts)](#6-processo-principal--electron-maints)
7. [API window.spotmaster (preload.ts)](#7-api-windowspotmaster-preloadts)
8. [Protocolo local-media://](#8-protocolo-local-media)
9. [API do vMix](#9-api-do-vmix)
10. [Motor de Playout (AppContext.tsx)](#10-motor-de-playout-appcontexttsx)
11. [Sistema de Grade e Programação](#11-sistema-de-grade-e-programação)
12. [Sistema de Blocos Comerciais](#12-sistema-de-blocos-comerciais)
13. [autoplayComerciais — comportamento correto](#13-autoplaycomercias--comportamento-correto)
14. [Ponto de Pausa](#14-ponto-de-pausa)
15. [Export / Import de Estrutura](#15-export--import-de-estrutura)
16. [Sistema de Disparo Global](#16-sistema-de-disparo-global)
17. [Gerenciamento de Estado](#17-gerenciamento-de-estado)
18. [Componentes](#18-componentes)
19. [Tipos de Dados](#19-tipos-de-dados)
20. [Internacionalização](#20-internacionalização)
21. [Persistência de Dados](#21-persistência-de-dados)

---

## 1. Visão Geral

O **VTMaster** é um software desktop para emissoras controlarem veiculação via **vMix**.

**Pilares técnicos:**
- **GUID-based**: inputs identificados por GUID estável, não por número
- **Wall-clock**: timing por `Date.now()`, não por polling de estado do vMix
- **Limpeza garantida**: `spotmasterGuidsRef` rastreia todos os inputs e limpa ao final
- **Dois queues**: playlist manual (`playlist`) e grade do dia (`dateSchedules[date]`)
- **Disparo global**: `globalShortcut` do Electron, funciona minimizado

---

## 2. Estrutura de Arquivos

```
VTMaster/
├── electron/
│   ├── main.ts              → Processo principal: janela, IPC, protocolos, globalShortcut
│   ├── preload.ts           → Bridge renderer↔main via contextBridge (FONTE — não carregado diretamente)
│   └── vmix.ts              → Integração HTTP com vMix (polling normal 2s + fast 500ms)
│
├── scripts/
│   └── build-preload-cjs.cjs → Converte dist-electron/preload.js (ESM) → preload.cjs (CJS)
│                               Executado automaticamente por npm run electron:compile
│
├── dist-electron/           → Saída compilada do Electron (não editar manualmente)
│   ├── main.js              → main.ts compilado (ESM)
│   ├── preload.js           → preload.ts compilado (ESM) — gerado por tsc
│   ├── preload.cjs          → preload.js convertido (CJS) — gerado por build-preload-cjs.cjs
│   │                          ← Electron CARREGA ESTE ARQUIVO
│   └── vmix.js              → vmix.ts compilado (ESM)
│
├── src/
│   ├── main.tsx             → Entry point React (StrictMode + AppProvider + App)
│   ├── App.tsx              → Layout raiz, navegação de painéis, modais globais
│   ├── App.css              → Variáveis CSS, layout, sidebar, tema dark/light
│   │
│   ├── types/index.ts       → TODOS os tipos e interfaces do app
│   │
│   ├── store/
│   │   └── AppContext.tsx   → Estado global (useReducer), motor de playout, schedulers
│   │
│   ├── i18n/
│   │   ├── index.ts         → getTranslations(language)
│   │   ├── pt.ts            → Strings PT-BR (fonte da verdade dos tipos)
│   │   └── en.ts            → Strings EN (deve espelhar pt.ts)
│   │
│   ├── utils/
│   │   └── time.ts          → now(), today() (local TZ!), formatDuration(), parseDuration()
│   │
│   └── components/
│       ├── Toolbar/         → Toolbar: playlist, vMix, Disparo ON/OFF, Autoplay Comerc.
│       ├── StatusBar/       → Rodapé: badge ON AIR, countdown −44:32, barra de progresso, status vMix
│       ├── Grade/
│       │   ├── GradePanel.tsx       → Estrutura semanal + Export/Import (.vtgrid)
│       │   └── ProgramSlotModal.tsx → Criar/editar slot (Programa/Musical/Comercial)
│       ├── DaySchedule/
│       │   ├── DaySchedulePanel.tsx → Programação do Dia (card-view, drag-drop, seleção, BlockPickerModal, copiar/colar)
│       │   └── DaySchedulePanel.css
│       ├── AdBreaks/
│       │   ├── AdBreaksPanel.tsx    → UI dos Blocos Comerciais (accordion inline)
│       │   └── AdBreaksPanel.css
│       ├── Clients/         → Cadastro de anunciantes + spots com detecção de duração
│       ├── Playlist/
│       │   ├── PlaylistTable.tsx    → Tabela, controles de transporte, coluna Término
│       │   ├── ContextMenu.tsx      → Menu de contexto (botão direito) — listeners estáveis
│       │   ├── ItemModal.tsx        → Criar/editar item (mídia ou ação vMix)
│       │   ├── ItemModal.css
│       │   ├── VmixInputPanel.tsx   → Painel lateral de inputs do vMix (drag & drop, dual-mode via onAddInput)
│       │   └── VmixInputPickerModal.tsx
│       ├── Log/             → Histórico de veiculação com filtros e exportação CSV
│       ├── Reports/         → Geração de PDF (diário e por anunciante)
│       └── Settings/        → Modal de configurações + seção Disparo
│
├── docs/
│   ├── ESTADO_ATUAL.md      → Estado do produto, fases, backlog
│   ├── DEVELOPMENT.md       → Este arquivo
│   └── INDEX.md             → Índice geral
│
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.electron.json   → Compila electron/ → dist-electron/ (ESM)
├── tsconfig.node.json
└── vite.config.ts
```

---

## 3. Stack Técnico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Desktop | Electron | 41.x |
| UI | React | 19.x |
| Linguagem | TypeScript | 6.x |
| Build frontend | Vite + Rolldown | 8.x |
| Build Electron | tsc + script CJS | — |
| Ícones | lucide-react | 1.14.x |
| PDF | jsPDF + jspdf-autotable | — |
| i18n | Custom | — |
| Atalho global | Electron globalShortcut | — |

---

## 4. Configuração e Build

### Scripts

```bash
# Desenvolvimento
npm run dev
# = electron:compile + vite dev (5173) + wait-on + electron .

# Build completo
npm run build
# = tsc -b + vite build + electron:compile

# Compilar apenas Electron (main + preload)
npm run electron:compile
# = tsc -p tsconfig.electron.json + node scripts/build-preload-cjs.cjs

# Empacotamento
npm run build:dist
# = npm run build + electron-builder → release/
```

### tsconfig.electron.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "outDir": "dist-electron",
    "rootDir": "electron"
  }
}
```

Gera arquivos `.js` em ESM. O script de conversão cuida de produzir o `.cjs`.

### Fluxo de dev

```
1. tsc -p tsconfig.electron.json   → dist-electron/main.js, preload.js, vmix.js
2. node scripts/build-preload-cjs  → dist-electron/preload.cjs (CJS para Electron)
3. vite dev → http://localhost:5173
4. wait-on tcp:5173
5. electron .                      → carrega http://localhost:5173
                                     preload: dist-electron/preload.cjs
```

---

## 5. Pipeline do preload.cjs

### Por que existe

O Electron carrega o preload como **CommonJS** (`preload.cjs`). O `tsc` com `"module": "ESNext"` gera `preload.js` em formato ESM, que o Electron não pode carregar diretamente como preload com `contextIsolation: true`.

### Problema original

O `preload.cjs` era um arquivo legado escrito manualmente. Toda vez que um método era adicionado ao `preload.ts`, precisava ser manualmente duplicado no `preload.cjs`. Isso levou ao bug onde `exportGrid` e `importGrid` existiam em `preload.ts` mas não chegavam ao `window.spotmaster`.

### Solução: scripts/build-preload-cjs.cjs

```javascript
const fs = require('fs')
const path = require('path')
const src  = 'dist-electron/preload.js'
const dest = 'dist-electron/preload.cjs'

let content = fs.readFileSync(src, 'utf8')
// 1. Substituir import ESM por require CJS
content = content.replace(
  /^import\s*\{([^}]+)\}\s*from\s*['"]electron['"];?\s*/m,
  (_, names) => `"use strict";\n...\nconst electron_1 = require("electron");\n`
)
// 2. Prefixar identificadores com electron_1.
for (const name of ['contextBridge', 'ipcRenderer']) {
  content = content.replace(new RegExp(`\\b${name}\\b`, 'g'), `electron_1.${name}`)
}
fs.writeFileSync(dest, content, 'utf8')
```

O script é executado automaticamente após `tsc`:
```json
"electron:compile": "tsc -p tsconfig.electron.json && node scripts/build-preload-cjs.cjs"
```

**Regra:** Para adicionar um novo método ao bridge:
1. Adicionar em `electron/preload.ts`
2. Adicionar handler em `electron/main.ts`
3. Declarar tipo em `src/types/index.ts` (SpotMasterAPI)
4. Rodar `npm run build` — o `.cjs` é atualizado automaticamente

---

## 6. Processo Principal — Electron (main.ts)

### Criação da janela

```typescript
mainWindow = new BrowserWindow({
  width: 1280, height: 800,
  webPreferences: {
    preload: join(__dirname, 'preload.cjs'),  // CJS obrigatório
    contextIsolation: true,
    nodeIntegration: false,
  },
})
```

### IPC Handlers completos

| Handler | Descrição |
|---------|-----------|
| `save-data` | Grava JSON em `userData/SpotMaster/{key}.json` |
| `load-data` | Lê JSON do userData |
| `get-version` | Retorna `app.getVersion()` |
| `open-external` | Abre URL no browser do sistema |
| `export-playlist` | Diálogo "Salvar" → grava JSON (diálogo: "Exportar Playlist") |
| `import-playlist` | Diálogo "Abrir" → retorna JSON |
| `export-grid` | Diálogo "Salvar" → grava JSON como `.vtgrid` (diálogo: "Exportar Estrutura de Grade") |
| `import-grid` | Diálogo "Abrir" `.vtgrid` → retorna JSON |
| `export-pdf` | Diálogo "Salvar" → grava buffer PDF e abre o arquivo |
| `browse-video-file` | Diálogo de abrir arquivo de mídia (vídeo/imagem/áudio) |
| `vmix-request` | Requisição HTTP para a API do vMix |
| `vmix-start-polling` | Inicia polling 2s → envia `vmix-status` via IPC push |
| `vmix-stop-polling` | Para o polling |
| `vmix-start-fast-polling` | Inicia polling 500ms → envia `vmix-fast-status` |
| `vmix-stop-fast-polling` | Para o fast polling |
| `register-trigger` | Registra `globalShortcut` → envia `trigger-fired` ao pressionar |
| `unregister-trigger` | Cancela o globalShortcut registrado |

### Protocolo local-media

Registrado antes do `app.whenReady()` (obrigatório):
```typescript
protocol.registerSchemesAsPrivileged([{
  scheme: 'local-media',
  privileges: { secure: true, stream: true, supportFetchAPI: true, corsEnabled: true }
}])
```

---

## 7. API window.spotmaster (preload.ts)

Interface completa do bridge renderer↔main:

```typescript
interface SpotMasterAPI {
  // Persistência
  saveData(key: string, data: unknown): Promise<void>
  loadData(key: string): Promise<unknown>
  getVersion(): Promise<string>
  openExternal(url: string): Promise<void>

  // Arquivos — Playlist
  exportPlaylist(data: unknown): Promise<string | null>
  importPlaylist(): Promise<unknown>

  // Arquivos — Grade de Estrutura (v3.1)
  exportGrid(data: unknown): Promise<string | null>
  importGrid(): Promise<unknown>

  // PDF e Mídia
  exportPDF(filePath: string, buffer: number[]): Promise<boolean>
  browseVideoFile(): Promise<string | null>

  // vMix — requisição direta
  vmixRequest(params: Record<string, string>): Promise<{
    success: boolean; data?: string; error?: string
  }>

  // vMix — polling normal (2s)
  vmixStartPolling(host: string, port: number): Promise<boolean>
  vmixStopPolling(): Promise<boolean>
  onVmixStatus(callback: (status: VmixStatus) => void): void
  removeVmixStatusListener(): void

  // vMix — fast polling (500ms) para progresso em tempo real
  vmixStartFastPolling(host: string, port: number): Promise<boolean>
  vmixStopFastPolling(): Promise<boolean>
  onVmixFastStatus(callback: (status: VmixStatus) => void): void
  removeVmixFastStatusListener(): void

  // Disparo global
  registerTrigger(key: string): Promise<boolean>
  unregisterTrigger(): Promise<void>
  onTriggerFired(callback: () => void): void
  removeTriggerListener(): void
}
```

---

## 8. Protocolo local-media://

### Problema
Em dev, o renderer serve de `http://localhost:5173`. Carregar `file:///` é bloqueado por CSP/CORS — impede leitura de duração via HTML5.

### Uso no renderer

```typescript
function toLocalMediaUrl(filePath: string): string {
  return 'local-media:///' + filePath.replace(/\\/g, '/')
}
// 'C:\Videos\spot.mp4' → 'local-media:///C:/Videos/spot.mp4'

// Detecta duração:
const el = document.createElement('video')
el.preload = 'metadata'
el.onloadedmetadata = () => resolve(Math.round(el.duration))
el.src = toLocalMediaUrl(filePath)
```

Timeout de 10s por segurança para arquivos corrompidos ou inacessíveis.

---

## 9. API do vMix

**Arquivo:** `electron/vmix.ts`

### Endpoint

```
GET http://{host}:{port}/api/?{params}
GET http://{host}:{port}/api/           ← sem parâmetros → XML de status completo
```

> **ATENÇÃO:** A barra antes do `?` é obrigatória: `/api/?Function=...`

### Sequência correta de corte

```
❌ ERRADO:  Cut&Input=GUID   (parâmetro Input é ignorado no Cut HTTP)

✅ CORRETO:
1. PlayInput(GUID)      → inicia reprodução (vídeo)
2. sleep(300ms)         → vMix começa decodificação
3. PreviewInput(GUID)   → coloca no Preview
4. sleep(100ms)
5. Cut                  → Preview vai ao Program
```

Para **áudio**: `PreviewInput` + `sleep(100ms)` + `Cut` + `sleep(500ms)` + `PlayInput` + `sleep(200ms)`.

Para **imagens**: `PreviewInput` + `sleep(100ms)` + `Cut` (sem PlayInput).

### Polling duplo

| Modo | Intervalo | Uso |
|------|-----------|-----|
| Normal | 2s | Status bar, conexão, lista de inputs |
| Fast | 500ms | Barra de progresso durante reprodução ativa |

---

## 10. Motor de Playout (AppContext.tsx)

### Refs de controle

```typescript
activeInputRef            // GUID atualmente no ar ('' para inputs permanentes)
preloadedInputRef         // { guid, filePath } — próximo já carregado
spotmasterGuidsRef        // Set<string> — todos os GUIDs desta sessão (cleanup)
abortRef                  // true → playItem para, runSequence verifica
scheduleInterruptRef      // interrupt pelo scheduler → runSequence retoma
scheduleInterruptTimeRef  // HH:MM:SS do último trigger (anti re-trigger)
disparoInterruptRef       // interrupt pelo Disparo → runSequence retoma
activeQueueRef            // 'playlist' | 'schedule'
```

### loadNewInput(filePath) → GUID

```
1. Detecta tipo: Video | AudioFile | Image (por extensão)
2. getMaxInputNum() → linha de base
3. AddInput Value=Tipo|filePath
4. pollForNewInput(prevMax) → aguarda GUID (50 tentativas × 200ms = 10s max)
5. spotmasterGuidsRef.add(guid)  ← cleanup garantido
6. sleep(1000ms) → vMix bufferiza
7. SetPosition(guid, 0)          ← rebobina (exceto imagens)
```

### playItem(item, nextFilePath?)

```typescript
async function playItem(item, nextFilePath?) {
  // 1. NOVO v3.1: Skip imediato se sem conteúdo
  if (!item.filePath && !item.inputName && item.type !== 'vmix_action' && item.type !== 'pause') {
    updateQueueItem({ ...item, status: 'skipped' })
    return
  }

  // 2. Marca como playing
  updateQueueItem({ ...item, status: 'playing' })

  // 3. vmix_action: executa comando, 150ms, log, done, return
  if (item.type === 'vmix_action') { ... return }

  // 4. filePath: loadNewInput (ou usa preload), PlayInput+PreviewInput+Cut
  // 5. inputName: SetPosition+PlayInput+PreviewInput+Cut (nunca Remove)
  // 6. ADD_LOG

  // 7. Wall-clock loop (300ms ticks):
  //    - Verifica abortRef
  //    - Quando remaining ≤ 10s: preload do próximo em background
  //    - Fast polling atualiza SET_ACTIVE_ITEM_PROGRESS

  // 8. SET_ACTIVE_ITEM_PROGRESS → null
  // 9. UPDATE item → done
}
```

### runSequence() — fluxo completo

```typescript
async function runSequence() {
  while (true) {
    // Handle abort/interrupt
    if (abortRef.current) {
      if (!scheduleInterruptRef.current && !disparoInterruptRef.current) break
      // Interrupt: limpa refs, continua (não para)
    }

    const pending = getQueue().filter(i => i.status === 'pending')
    if (pending.length === 0) break

    const currentTime = now()
    const { autoPlay, autoplayComerciais } = stateRef.current.settings

    // scheduledDue: itens com hora vencida conforme as flags
    const scheduledDue = pending.filter(i => {
      if (!i.scheduledTime || i.scheduledTime > currentTime) return false
      if (i.adBreakId) return autoplayComerciais
      return autoPlay
    }).sort(byTimeThenOrder)

    // Pula itens antes do primeiro due (sempre avança)
    if (scheduledDue.length > 0) {
      const firstDueOrder = scheduledDue[0].order
      const toSkip = pending.filter(i => i.order < firstDueOrder)
      if (toSkip.length > 0) { skipAll(toSkip); continue }
    }

    // NOVO v3.1: Se autoplay ativo E nothing due E foi trigger automático → para
    if (
      activeQueueRef.current === 'schedule' &&
      (autoPlay || autoplayComerciais) &&
      scheduledDue.length === 0 &&
      scheduleInterruptTimeRef.current !== ''
    ) break

    const next = scheduledDue[0] ?? firstByOrder(pending)

    // Ponto de pausa → done + break (vMix limpo)
    if (next.type === 'pause') {
      updateQueueItem({ ...next, status: 'done' })
      break
    }

    // Sem conteúdo → skip instantâneo (musicas sem arquivo etc.)
    if (!next.filePath && !next.inputName && next.type !== 'vmix_action') {
      updateQueueItem({ ...next, status: 'skipped' })
      continue
    }

    await playItem(next, afterNext?.filePath)
    await sleep(200)
  }

  // Cleanup final
  scheduleInterruptTimeRef.current = ''
  dispatch(SET_SEQUENCE_PLAYING, false)
  cleanupInputs(5000)
  for (const g of spotmasterGuidsRef.current) RemoveInput(g)
}
```

---

## 11. Sistema de Grade e Programação

### generatePlaylistFromGrid(targetDate?, merge?)

**Fresh mode** (merge=false, padrão):
1. Percorre `weeklyGrid[dayOfWeek]` ordenado por scheduledTime
2. Para `bloco_musical`: cria **1 item placeholder** (sem arquivo)
3. Para `bloco_comercial`: chama `expandBlockItems` → itens reais com `adBreakId`
4. Para `programa`/outros: adiciona item com filePath/inputName
5. Para blocos não-vinculados (`blocksForDay`): expande itens
6. Substitui `dateSchedules[date]` completo

**Merge mode** (merge=true, botão "Atualizar"):

Regras de `keptExisting`:
```
item NÃO tem adBreakId → mantém sempre (conteúdo manual)
item TEM adBreakId, tempo não está em freshCommercialTimes → mantém
item TEM adBreakId, tempo em freshCommercialTimes:
  → status='pending'  → REMOVE (será substituído por dado fresco)
  → sem conteúdo real (placeholder) → REMOVE independente de status
  → tem conteúdo E status='done'/'skipped' → MANTÉM (já veiculou)
```

### Auto-sync em AppContext

```typescript
// Observa mudanças em commercialBlocks
useEffect(() => {
  if (state.isLoading) return
  const todayStr = today()
  const schedule = stateRef.current.dateSchedules[todayStr]
  if (!schedule || schedule.length === 0) return  // fresh generation cuida de dias novos
  if (stateRef.current.isSequencePlaying) return  // nunca durante playback ativo
  generatePlaylistFromGrid(todayStr, true)
}, [state.commercialBlocks])
```

### Placeholders de blocos comerciais

Quando `expandBlockItems` retorna `[]` (bloco sem spots), cria um placeholder:
```typescript
{ type: 'spot', status: 'pending', adBreakId: block.id, duration: 0, /* sem filePath */ }
```

O placeholder é **visível** na programação (informa ao operador que o bloco existe mas está vazio) mas:
- Nunca causa silêncio (`runSequence` e `playItem` pulam itens sem conteúdo)
- É automaticamente substituído quando o bloco recebe spots (auto-sync)

---

## 12. Sistema de Blocos Comerciais

### expandBlockItems(block, startOrder, rotation) → [items, newRotation]

Para cada `CommercialBlockItem`:
- `spot_client`: filtra `clientSpots` do cliente, pega `spotsCount` a partir do índice de rotação (com wrap)
- `vmix_action`: cria item com `type:'vmix_action'`
- `vmix_input`: cria item com `inputName`, `duration`

Retorna novos índices de rotação — round-robin contínuo nunca reseta.

### Scheduler de pré-carregamento (30s)

```typescript
// Cada 30s verifica blocos não carregados hoje
commercialBlocks
  .filter(b => b.enabled && b.lastLoadedDate !== today && diasCombina(b.daysOfWeek))
  .forEach(b => {
    const triggerSecs = blockTimeSecs - preloadMinutes * 60
    if (nowSecs >= triggerSecs && nowSecs < blockTimeSecs) {
      loadBlockIntoPlaylist(b)  // carrega na PLAYLIST (não na grade)
    }
  })
```

### loadBlockIntoPlaylist(block)

Expande itens e adiciona ao final da **playlist manual** (`ADD_PLAYLIST_ITEM`). Marca o bloco como carregado para hoje (`MARK_BLOCK_LOADED`).

---

## 13. autoplayComerciais — comportamento correto

### O problema original (v3.0)
Com `autoplayComerciais = ON`, a sequência rodava continuamente — após o bloco comercial, continuava para o próximo bloco (musical vazio → pulado rapidamente → próximo comercial → tocava antes do horário). Resultado: toda a grade tocava em segundos.

### A solução (v3.1)

Em `runSequence`, após processar todos os itens devidos:

```typescript
if (
  activeQueueRef.current === 'schedule' &&
  (autoPlay || autoplayComerciais) &&
  scheduledDue.length === 0 &&
  scheduleInterruptTimeRef.current !== ''  // ← chave
) break
```

A condição `scheduleInterruptTimeRef.current !== ''` distingue:

| Situação | scheduleInterruptTimeRef | Comportamento |
|----------|-------------------------|---------------|
| Scheduler disparou (auto) | `'10:00:00'` (não-vazio) | Para após o bloco → espera próximo trigger |
| Operador clicou "Iniciar" | `''` (vazio) | Corre livremente — sem parada forçada |
| Scheduler interrompeu sequência em curso | `'10:00:00'` | Para após o bloco comercial |

### Fluxo completo do autoplay

```
09:59:59 — scheduler: comercial '10:00:00' ainda não venceu → nada
10:00:00 — scheduler: venceu! scheduleInterruptTimeRef='10:00:00', startSchedule()
           runSequence inicia, activeQueue='schedule'
           scheduledDue = [comercial 10:00] → não faz break
           Pula itens antes do comercial (musicais)
           Toca comercial 10:00 (duração real ~2min)
10:02:00 — comercial termina, next → musicais 11:00
           scheduledDue = [] (11:00 não venceu)
           scheduleInterruptTimeRef = '10:00:00' (não-vazio)
           → BREAK
10:02:01 — runSequence cleanup: scheduleInterruptTimeRef = ''
10:02:xx — scheduler ticks: comercial 10:00 está 'done' → scheduledDue vazio → nada
10:59:59 — scheduler: comercial '11:00:00' ainda não venceu → nada
11:00:00 — scheduler: scheduleInterruptTimeRef = '' ≠ '11:00:00' → DISPARA!
```

---

## 14. Ponto de Pausa

### Tipo

```typescript
type SpotType = ... | 'pause'   // adicionado em v3.1
```

### Inserção

Menu de contexto na Programação (botão direito em qualquer item) → seção "Inserir após" → **Ponto de Pausa**:

```typescript
insertAfterItem(afterItem, {
  title: 'Pausa',
  type: 'pause',
  status: 'pending',
  scheduledTime: afterItem.scheduledTime,
  duration: 0,
})
```

### Tratamento em runSequence

```typescript
if (next.type === 'pause') {
  updateQueueItem({ ...next, status: 'done' })
  break  // cleanup normal: remove inputs vMix, isSequencePlaying=false
}
```

O `break` cai no cleanup padrão do `runSequence`:
- `scheduleInterruptTimeRef.current = ''`
- `dispatch(SET_SEQUENCE_PLAYING, false)`
- `cleanupInputs(5000)` (abortRef=false → delay de 5s)
- Sweep de todos os GUIDs da sessão

### Tratamento em playItem

`type: 'pause'` é exceção na verificação de "sem conteúdo":
```typescript
if (!item.filePath && !item.inputName && item.type !== 'vmix_action' && item.type !== 'pause') {
  // skip...
}
// → item pause chega ao runSequence onde é tratado ANTES desta verificação
```

### Visual

```css
.block-item-title.pause-marker {
  color: #f59e0b;
  font-style: italic;
  font-weight: 600;
}
/* Exibe: ⏸ Pausa automática */
```

---

## 15. Export / Import de Estrutura

### Formato .vtgrid

```typescript
interface GridExportFile {
  version: '1'
  type: 'vtmaster-grade'
  exportedAt: string           // YYYY-MM-DD
  grid: WeeklyProgramGrid      // Record<0-6, ProgramSlot[]>
}

function isValidGridExport(data: unknown): data is GridExportFile {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.type === 'vtmaster-grade' && d.version === '1' && !!d.grid
}
```

### Export

```typescript
const exportData: GridExportFile = {
  version: '1', type: 'vtmaster-grade',
  exportedAt: new Date().toISOString().slice(0, 10),
  grid: state.weeklyGrid,
}
await window.spotmaster.exportGrid(exportData)
```

### Import — ImportGridModal

1. `importGrid()` → retorna dados ou null
2. Valida com `isValidGridExport()`
3. Exibe modal com checkbox por dia (mostra contagem de slots)
4. Ao confirmar:
   ```typescript
   for (const dow of selectedDays) {
     newGrid[dow] = importedGrid[dow].map((s, i) => ({
       ...s, id: crypto.randomUUID(), order: i + 1  // novos IDs
     }))
   }
   dispatch({ type: 'SET_WEEKLY_GRID', payload: newGrid })
   ```

### IPC

```typescript
// main.ts
ipcMain.handle('export-grid', async (_event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar Estrutura de Grade',
    defaultPath: `grade-${date}.vtgrid`,
    filters: [{ name: 'VTMaster Grade', extensions: ['vtgrid'] }, { name: 'JSON', extensions: ['json'] }],
  })
  if (!result.canceled) writeFileSync(result.filePath, JSON.stringify(data, null, 2))
  return result.filePath || null
})

ipcMain.handle('import-grid', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar Estrutura de Grade',
    filters: [{ name: 'VTMaster Grade', extensions: ['vtgrid'] }, { name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (!result.canceled) return JSON.parse(readFileSync(result.filePaths[0], 'utf-8'))
  return null
})
```

---

## 16. Sistema de Disparo Global

### Configuração da tecla (SettingsModal)

```typescript
const handler = (e: KeyboardEvent) => {
  e.preventDefault()
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
  set('triggerKey', keyEventToAccelerator(e))
}
window.addEventListener('keydown', handler, true)
```

`keyEventToAccelerator`: converte `KeyboardEvent` → accelerator Electron (`'F5'`, `'CommandOrControl+Space'`, etc.)

### Registro automático (AppContext)

```typescript
useEffect(() => {
  if (!triggerEnabled || !triggerKey) {
    window.spotmaster.unregisterTrigger(); return
  }
  // Gamepad e MIDI: tratados no renderer, não via globalShortcut
  if (!triggerKey.startsWith('GAMEPAD:') && !triggerKey.startsWith('MIDI:')) {
    window.spotmaster.registerTrigger(triggerKey)
  }
}, [triggerEnabled, triggerKey, isLoading])
```

### Gamepad (polling 50ms no renderer)

```typescript
const gpIndex = parseInt(parts[1])
const btnIndex = parseInt(parts[3])
setInterval(() => {
  const pressed = navigator.getGamepads()[gpIndex]?.buttons[btnIndex]?.pressed
  if (pressed && !wasPressed) disparo()
  wasPressed = pressed
}, 50)
```

### MIDI (Web MIDI API)

```typescript
navigator.requestMIDIAccess().then(access => {
  access.inputs.forEach(input => {
    input.onmidimessage = (event) => {
      // Note On (0x90) ou CC (0xB0) → disparo()
    }
  })
})
```

---

## 17. Gerenciamento de Estado

### Padrão stateRef (anti-stale-closure)

```typescript
const stateRef = useRef(state)
useEffect(() => { stateRef.current = state })
// Sempre usar stateRef.current em callbacks async, setInterval, setTimeout
```

### Padrão de context menus estáveis (v3.1)

Antes (bug): `useEffect([onClose])` com `onClose` sendo nova arrow a cada render do pai → re-registra listeners a cada 300ms durante playback.

Depois (fix):
```typescript
const onCloseRef = useRef(onClose)
useEffect(() => { onCloseRef.current = onClose })  // sync ref

useEffect(() => {
  const handleClick = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current()
  }
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onCloseRef.current()
  }
  document.addEventListener('mousedown', handleClick)
  document.addEventListener('keydown', handleKey)
  return () => {
    document.removeEventListener('mousedown', handleClick)
    document.removeEventListener('keydown', handleKey)
  }
}, [])  // ← deps vazia: registra apenas uma vez por mount/unmount
```

### Padrão de foco em modais (v3.1)

Antes (bug): `autoFocus` falha silenciosamente no Electron quando a janela perdeu foco.

Depois (fix):
```typescript
const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)
useEffect(() => { inputRef.current?.focus() }, [])
// <input ref={el => { if (condition) firstFieldRef.current = el }} />
```

### Actions do reducer

**Schedule/Grade:**
`SET_DATE_SCHEDULE`, `UPDATE_SCHEDULE_ITEM`, `DELETE_SCHEDULE_ITEM`, `REORDER_DATE_SCHEDULE`,
`SET_WEEKLY_GRID`, `ADD_PROGRAM_SLOT`, `UPDATE_PROGRAM_SLOT`, `DELETE_PROGRAM_SLOT`, `REORDER_PROGRAM_SLOTS`

**Playlist:**
`SET_PLAYLIST`, `ADD_PLAYLIST_ITEM`, `UPDATE_PLAYLIST_ITEM`, `DELETE_PLAYLIST_ITEM`,
`CLEAR_PLAYLIST`, `REORDER_PLAYLIST`, `INSERT_PLAYLIST_ITEM_AFTER`

**Comercial:**
`ADD_COMMERCIAL_BLOCK`, `UPDATE_COMMERCIAL_BLOCK`, `DELETE_COMMERCIAL_BLOCK`, `MARK_BLOCK_LOADED`,
`ADD_CLIENT_SPOT`, `UPDATE_CLIENT_SPOT`, `DELETE_CLIENT_SPOT`, `SET_SPOT_ROTATION`

**App:**
`SET_SETTINGS`, `SET_VMIX_STATUS`, `SET_SEQUENCE_PLAYING`, `SET_ACTIVE_ITEM_PROGRESS`,
`SET_ACTIVE_PANEL`, `SET_LOADING`, `LOAD_ALL`

---

## 18. Componentes

### StatusBar (Rodapé) — v3.3

O rodapé redesenhado em v3.3 tem dois estados visuais:

**Estado parado** (`height: 34px`): exibe `status-label "Atual:"` sem badge, sem barra inferior.

**Estado tocando** (`height: 48px`, transição 0,2s):
- `.on-air-badge` — `◉ ON AIR` (vermelho, pulsa com `box-shadow` a cada 1,2s)
- `.current-title` — título do item tocando
- `.on-air-countdown` — `−MM:SS` em Courier New verde (calculado de `activeItemProgress`)
- `.statusbar-progress-track` (3px) — barra gradiente `--error → --accent` pinned ao bottom

```typescript
// Cálculo do countdown
const remaining = activeItemProgress && activeItemProgress.duration > 0
  ? Math.max(0, Math.round((activeItemProgress.duration - activeItemProgress.position) / 1000))
  : null

// Porcentagem de progresso
const progressPct = activeItemProgress && activeItemProgress.duration > 0
  ? Math.min(100, (activeItemProgress.position / activeItemProgress.duration) * 100)
  : null
```

Quando `progressPct === null` (nenhum `activeItemProgress` disponível), a barra usa animação `statusbar-progress-anim` como fallback.

### GradePanel (Aba Estrutura)

Funcionalidades v3.1:
- Template semanal Dom-Sáb com tabs de dia
- Botões por tipo: + Programa, + Bloco Musical, + Bloco Comercial
- Lista de slots com badge de conteúdo, ações ↑↓ editar/excluir
- **Copiar para...**: copia slots do dia atual para outros dias
- **Exportar**: salva grade como `.vtgrid`
- **Importar**: carrega `.vtgrid`, modal `ImportGridModal` com seleção de dias
- **Aplicar no Ar**: regenera programação do dia atual

### DaySchedulePanel (Aba Programação)

Cards por bloco (musical/comercial/programa). Operações:
- Date picker com persistência entre abas
- "Centralizar Bloco" → scroll para o bloco do horário atual
- "Atualizar" → merge mode (preserva existentes)
- "Iniciar Programação" → `startScheduleFromNow()`
- "Parar" → `stopPlayback()`
- Drag-and-drop com handle ⠿ e feedback visual `drag-over`
- **Drag entre blocos (v3.2)**: `handleDrop` compara `dragItem.scheduledTime?.slice(0,5)` com `targetItem.scheduledTime?.slice(0,5)`. Se diferente, cria `movedItem = { ...dragItem, scheduledTime: targetItem.scheduledTime }` antes de reordenar.
- **Seleção visual (v3.2)**: `selectedItemId: string | null` — clicar numa linha seta o ID; CSS `.block-item-row.selected` aplica borda accent e fundo translúcido.
- **Sub-toolbar (v3.2)**: botões "+Adicionar item" (accent, sempre ativo) e "Inputs vMix" (sempre ativo, sem verificação de conexão).
- Menu de contexto: Iniciar daqui, Pausar, **Ponto de Pausa**, Ação vMix, Input vMix, Horário, Duplicar, Pular, Marcar veiculado, **Copiar item**, **Colar abaixo**

#### BlockPickerModal (v3.2)

Componente local definido antes do export principal em `DaySchedulePanel.tsx`. Props:

```typescript
interface BlockPickerModalProps {
  groups: BlockGroup[]
  onClose: () => void
  onPick: (g: BlockGroup) => void
}
```

Renderizado quando `showBlockPicker === true`. Exibe cada bloco como `btn-add-choice` com ícone `Clock`, `g.time`, `g.slot?.title` e contagem de itens. Ao selecionar, fecha o picker e abre o `AddItemModal` para aquele grupo.

#### ScheduleCtxMenu — Copiar / Colar (v3.2)

Novos props adicionados a `ScheduleCtxMenu`:

```typescript
onCopy: () => void
onPaste: () => void
canPaste: boolean
```

Botão "Copiar item" sempre visível na seção "Editar". Botão "Colar abaixo" renderizado apenas quando `canPaste === true`. Estado `copiedItem: PlaylistItem | null` no componente pai (`DaySchedulePanel`). O paste herda o `scheduledTime` do item alvo (não do item copiado), garantindo que o item colado pertença ao bloco correto.

### VmixInputPanel — Modo Dual (v3.2)

O painel de inputs do vMix é compartilhado entre Playlist e Programação do Dia. O comportamento do botão `+` é controlado pela prop:

```typescript
interface VmixInputPanelProps {
  onClose: () => void
  onAddInput?: (inp: VmixInput) => void  // ← opcional (v3.2)
}
```

| Contexto | Prop | Comportamento do `+` | Hint text |
|----------|------|----------------------|-----------|
| Playlist | não fornecida | `addToEnd(inp)` → `dispatch ADD_PLAYLIST_ITEM` | `Arraste para a playlist · + Adiciona ao final` |
| Programação | fornecida | `onAddInput(inp)` | `Arraste para a programação · + Adiciona abaixo do item selecionado` |

Em `DaySchedulePanel`, `onAddInput` verifica `selectedItemId`:
- **Com seleção**: `insertAfterItem(selectedItem, newItem)` — insere no mesmo bloco do item selecionado
- **Sem seleção**: `insertItemAtGroupEnd(groups[0], newItem)` — appenda ao primeiro bloco

### ItemModal (Criar/Editar Item da Playlist)

Dois modos (toggle na criação):
- **Mídia / Input**: arquivo (browse), inputName, duração, horário, notas, cliente
- **Ação vMix**: select de função, input, valor, preview do comando gerado

Fix v3.1: `onMouseDown={e => e.stopPropagation()}` no modal-box. Foco via `useRef+useEffect`.

### ContextMenu (Playlist — botão direito)

Listeners estáveis via `onCloseRef` + `useEffect([], [])`. Opções:
- Inserir: Pausa (5s, tipo 'outros'), Ação vMix, Input vMix
- Editar: Horário Agendado
- Duplicar, Pular, Marcar Veiculado

---

## 19. Tipos de Dados

### SpotType (v3.1)

```typescript
type SpotType = 'spot' | 'vinheta' | 'programa' | 'bumper' | 'outros' | 'vmix_action' | 'pause'
```

`'pause'` — item de parada automática da sequência. Sem filePath, sem inputName. Tratado antes do check de "sem conteúdo" em `runSequence`. Exibe como "⏸ Pausa automática" na programação.

### PlaylistItem

```typescript
interface PlaylistItem {
  id: string
  order: number
  title: string
  clientId?: string
  clientName?: string
  duration: number            // segundos (0 para vmix_action, pause, placeholders)
  scheduledTime?: string      // HH:MM:SS
  inputName?: string          // input vMix pré-existente (nunca Remove)
  type: SpotType
  status: SpotStatus
  filePath?: string           // arquivo de mídia local
  mediaType?: 'video' | 'image' | 'audio'
  notes?: string
  adBreakId?: string          // presente em itens gerados de CommercialBlock
  vmixAction?: VmixActionItem // presente apenas quando type='vmix_action'
}
```

**Regra de conteúdo reproduzível:**
```
filePath   → VTMaster faz AddInput, PlayInput, PreviewInput, Cut, depois Remove
inputName  → VTMaster faz SetPosition, PlayInput, PreviewInput, Cut — NUNCA Remove
vmix_action → executa função HTTP no vMix — sem input
pause      → para a sequência — sem ação no vMix
Nenhum dos acima → skip imediato (sem silêncio)
```

### CommercialBlock (v3.1)

```typescript
interface CommercialBlock {
  id: string
  name: string
  scheduledTime: string       // HH:MM:SS
  items: CommercialBlockItem[]
  enabled: boolean
  createdAt: string
  lastLoadedDate?: string     // YYYY-MM-DD — proteção carga dupla
  daysOfWeek?: number[]       // 0-6; undefined = todos os dias
}
```

---

## 20. Internacionalização

**Arquivos:** `src/i18n/pt.ts` (fonte de verdade), `en.ts`, `index.ts`

O tipo `Translations` é inferido de `pt.ts`. Adicionar chave em `pt.ts` → TypeScript exige a mesma em `en.ts`.

Chaves adicionadas em v3.1:
- `types.pause`: `'Pausa'` (PT) / `'Pause'` (EN)

---

## 21. Persistência de Dados

**Localização:** `%APPDATA%\SpotMaster\` (Windows)

| Chave | Conteúdo |
|-------|---------|
| `settings` | AppSettings (tema, vMix, disparo, autoplay, preload) |
| `playlist` | Playlist manual |
| `weeklyGrid` | Grade semanal Dom-Sáb |
| `dateSchedules` | Programações por data `YYYY-MM-DD → PlaylistItem[]` |
| `commercialBlocks` | Blocos com `CommercialBlockItem[]` |
| `clientSpots` | Spots por anunciante |
| `spotRotation` | Índices de rodízio |
| `clients` | Anunciantes |
| `playLog` | Histórico de veiculação |
| `activePanel` | Último painel ativo |

> **Nota (v3.3):** A chave `adBreaks` foi removida do estado e do storage. Instalações antigas que possuam esse arquivo em `%APPDATA%\SpotMaster\adBreaks.json` podem ignorá-lo com segurança.

**Startup:** `Promise.all` carrega 10 arquivos simultaneamente → `LOAD_ALL` único dispatch. (`adBreaks` removido em v3.3)

**Migração:** `settings: { ...DEFAULT_SETTINGS, ...settingsRaw }` garante que campos novos recebem defaults em instalações antigas.

**Auto-save:** cada campo tem `useEffect` próprio, nunca dispara durante `isLoading`.
