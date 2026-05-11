# VTMaster — Documentação de Desenvolvimento

> Software de veiculação comercial para emissoras de TV.
> Stack: **Electron 41 + React 19 + TypeScript + Vite 8**
> Desenvolvido por **RobsonCostaDV** — Última atualização: 10/05/2026 — **v2.0.0**

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Estrutura de Arquivos](#2-estrutura-de-arquivos)
3. [Stack Técnico](#3-stack-técnico)
4. [Configuração e Build](#4-configuração-e-build)
5. [Processo Principal — Electron](#5-processo-principal--electron)
6. [API window.spotmaster (preload.ts)](#6-api-windowspotmaster-preloadts)
7. [Protocolo local-media://](#7-protocolo-local-media)
8. [API do vMix](#8-api-do-vmix)
9. [Motor de Playout](#9-motor-de-playout)
10. [Sistema de Blocos Comerciais](#10-sistema-de-blocos-comerciais)
11. [Sistema de Disparo Global](#11-sistema-de-disparo-global)
12. [Gerenciamento de Estado](#12-gerenciamento-de-estado)
13. [Componentes](#13-componentes)
14. [Tipos de Dados](#14-tipos-de-dados)
15. [Internacionalização](#15-internacionalização)
16. [Persistência de Dados](#16-persistência-de-dados)
17. [Funcionalidades Implementadas](#17-funcionalidades-implementadas)

---

## 1. Visão Geral

O **VTMaster** é um software desktop para emissoras de TV controlarem a veiculação de spots comerciais via integração com o **vMix**.

**Fluxo principal:**
1. Operador monta playlist com itens (spots, vinhetas, câmeras, gráficos)
2. Inicia a sequência via botão, autoplay por horário, ou **Disparo** (atalho global)
3. VTMaster carrega cada clipe no vMix via HTTP, dá play e corta para o ar — automaticamente
4. Ao final, remove todos os inputs criados sem afetar câmeras/NDI/gráficos existentes

**Pilares técnicos:**
- **GUID-based**: inputs identificados por GUID estável, não por número (evita conflito ao renumerar)
- **Wall-clock**: timing por `Date.now()`, não por polling de estado do vMix
- **Limpeza garantida**: `spotmasterGuidsRef` rastreia todos os inputs e limpa ao final
- **Disparo global**: `globalShortcut` do Electron funciona mesmo com app minimizado

---

## 2. Estrutura de Arquivos

```
VTMaster/
├── electron/
│   ├── main.ts              → Processo principal: janela, IPC, protocolos, globalShortcut
│   ├── preload.ts           → Bridge renderer↔main via contextBridge (window.spotmaster)
│   └── vmix.ts              → Integração HTTP com vMix (polling normal 2s + fast 500ms)
│
├── src/
│   ├── main.tsx             → Entry point React
│   ├── App.tsx              → Layout raiz, navegação, modais globais
│   ├── App.css              → Variáveis CSS, layout, sidebar, scrollbars, tema
│   │
│   ├── types/
│   │   └── index.ts         → Todos os tipos e interfaces do app
│   │
│   ├── store/
│   │   └── AppContext.tsx   → Estado global (useReducer), motor de playout, schedulers
│   │
│   ├── i18n/
│   │   ├── index.ts         → getTranslations(language)
│   │   ├── pt.ts            → Strings PT-BR (fonte da verdade dos tipos)
│   │   └── en.ts            → Strings EN
│   │
│   ├── utils/
│   │   └── time.ts          → now(), formatDuration(), parseDuration(), today()
│   │
│   └── components/
│       ├── Toolbar/
│       │   ├── Toolbar.tsx          → Toolbar: playlist, vMix, Disparo, Autoplay Comerciais, tema, idioma
│       │   └── Toolbar.css
│       ├── StatusBar/
│       │   ├── StatusBar.tsx        → Rodapé: vMix status, item atual, próximo, Recording/Streaming
│       │   └── StatusBar.css
│       ├── Playlist/
│       │   ├── PlaylistTable.tsx    → Tabela + controles de transporte + indicador de disparo
│       │   ├── PlaylistTable.css
│       │   ├── ItemModal.tsx        → Criar/editar item da playlist
│       │   ├── ItemModal.css
│       │   ├── VmixInputPanel.tsx   → Painel lateral de inputs do vMix (drag & drop)
│       │   └── VmixInputPanel.css
│       ├── AdBreaks/
│       │   ├── AdBreaksPanel.tsx    → Blocos comerciais + config pré-carregamento
│       │   └── AdBreaksPanel.css
│       ├── Clients/
│       │   ├── ClientsPanel.tsx     → Cadastro de anunciantes
│       │   └── ClientsPanel.css
│       ├── Log/
│       │   ├── LogPanel.tsx         → Histórico de veiculação com filtros e exportação CSV
│       │   └── LogPanel.css
│       ├── Reports/
│       │   ├── ReportsPanel.tsx     → Geração de PDF (diário e por anunciante)
│       │   └── ReportsPanel.css
│       └── Settings/
│           └── SettingsModal.tsx    → Modal de configurações + seção Disparo
│
└── docs/
    ├── DEVELOPMENT.md       → Este arquivo
    ├── ESTADO_ATUAL.md      → Estado do produto, fases, backlog
    └── INDEX.md             → Índice geral da documentação
```

---

## 3. Stack Técnico

| Camada | Tecnologia |
|--------|-----------|
| Desktop | Electron 41.x |
| UI | React 19.x |
| Linguagem | TypeScript 5.x |
| Build | Vite 8 + Rolldown |
| Ícones | lucide-react |
| PDF | jsPDF + jspdf-autotable |
| i18n | Custom (pt.ts / en.ts) |
| Atalho global | Electron globalShortcut |

---

## 4. Configuração e Build

### Scripts disponíveis

```bash
npm run dev           # Compilar Electron + Vite dev server + abrir janela
npm run build         # Build completo (tsc + vite build + electron:compile)
npm run build:dist    # Build + empacotamento (electron-builder → pasta release/)
npm run electron:compile  # Apenas compilar TypeScript do Electron
```

### Como o `dev` funciona

```
tsc -p tsconfig.electron.json   → dist-electron/
vite dev (porta 5173)
wait-on tcp:5173 → electron .   → carrega http://localhost:5173
```

### Arquivo preload

O arquivo `preload.ts` é compilado pelo tsconfig como `preload.cts` → `dist-electron/preload.cjs`. O Electron não carrega preload em formato ESM — **o arquivo DEVE resultar em CJS**.

---

## 5. Processo Principal — Electron

**Arquivo:** `electron/main.ts`

### Criação da janela

```typescript
mainWindow = new BrowserWindow({
  width: 1280, height: 800,
  webPreferences: {
    preload: join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
  },
})
```

### Registro do Disparo global

```typescript
import { globalShortcut } from 'electron'
let registeredTriggerKey: string | null = null

// IPC: registrar atalho
ipcMain.handle('register-trigger', (_event, key: string) => {
  if (registeredTriggerKey) globalShortcut.unregister(registeredTriggerKey)
  const success = globalShortcut.register(key, () => {
    mainWindow?.webContents.send('trigger-fired')
  })
  registeredTriggerKey = success ? key : null
  return success
})

// IPC: cancelar atalho
ipcMain.handle('unregister-trigger', () => {
  if (registeredTriggerKey) {
    globalShortcut.unregister(registeredTriggerKey)
    registeredTriggerKey = null
  }
})

// Limpar ao fechar o app
app.on('will-quit', () => globalShortcut.unregisterAll())
```

### IPC Handlers completos

| Handler | Descrição |
|---------|-----------|
| `save-data` | Grava JSON em userData/SpotMaster/{key}.json |
| `load-data` | Lê JSON do userData |
| `get-version` | Retorna app.getVersion() |
| `open-external` | Abre URL no browser do sistema |
| `export-playlist` | Diálogo de salvar → grava JSON |
| `import-playlist` | Diálogo de abrir → retorna JSON |
| `export-pdf` | Diálogo de salvar → grava buffer PDF |
| `browse-video-file` | Diálogo de abrir arquivo de mídia |
| `vmix-request` | Requisição HTTP para a API do vMix |
| `vmix-start-polling` | Inicia polling 2s → envia `vmix-status` via IPC |
| `vmix-stop-polling` | Para o polling |
| `vmix-start-fast-polling` | Inicia polling 500ms → envia `vmix-fast-status` |
| `vmix-stop-fast-polling` | Para o fast polling |
| `register-trigger` | Registra globalShortcut → envia `trigger-fired` |
| `unregister-trigger` | Cancela o globalShortcut registrado |

---

## 6. API window.spotmaster (preload.ts)

Bridge de segurança entre renderer (React) e processo principal via `contextBridge`.

```typescript
interface SpotMasterAPI {
  // Persistência
  saveData(key: string, data: unknown): Promise<void>
  loadData(key: string): Promise<unknown>
  getVersion(): Promise<string>
  openExternal(url: string): Promise<void>

  // Arquivos
  exportPlaylist(data: unknown): Promise<string | null>
  importPlaylist(): Promise<unknown>
  exportPDF(filePath: string, buffer: number[]): Promise<boolean>
  browseVideoFile(): Promise<string | null>

  // vMix — polling normal (2s)
  vmixRequest(params: Record<string, string>): Promise<{ success: boolean; data?: string; error?: string }>
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

## 7. Protocolo local-media://

### Problema

Em desenvolvimento, o renderer é servido de `http://localhost:5173`. Carregar arquivos via `file:///` é bloqueado por CSP/CORS, impedindo a leitura de duração de vídeos/áudios via HTML5.

### Solução

```typescript
// Antes de app.whenReady() — OBRIGATÓRIO ser antes:
protocol.registerSchemesAsPrivileged([{
  scheme: 'local-media',
  privileges: { secure: true, stream: true, supportFetchAPI: true, corsEnabled: true }
}])

// Dentro de app.whenReady():
protocol.handle('local-media', (request) => {
  const path = request.url.slice('local-media:///'.length)
  return net.fetch(`file:///${path}`)
})
```

### Uso no renderer

```typescript
function toLocalMediaUrl(filePath: string): string {
  return 'local-media:///' + filePath.replace(/\\/g, '/')
}
// 'C:\Videos\spot.mp4' → 'local-media:///C:/Videos/spot.mp4'

// Detecta duração via HTML5:
const el = document.createElement('video')
el.src = toLocalMediaUrl(filePath)
el.onloadedmetadata = () => resolve(Math.round(el.duration))
```

---

## 8. API do vMix

**Arquivo:** `electron/vmix.ts`

### Endpoint

```
GET http://{host}:{port}/api/?{params}
GET http://{host}:{port}/api/           ← sem parâmetros → XML de status completo
```

> **ATENÇÃO:** a barra antes do `?` é obrigatória: `/api/?Function=...`

### Funções utilizadas

| Função | Parâmetros | Descrição |
|--------|-----------|-----------|
| `AddInput` | `Value=Video\|C:\path\file.mp4` | Carrega vídeo |
| `AddInput` | `Value=Image\|C:\path\img.png` | Carrega imagem |
| `AddInput` | `Value=AudioFile\|C:\path\audio.mp3` | Carrega áudio |
| `SetPosition` | `Input=GUID&Value=0` | Rebobina para posição 0 |
| `PlayInput` | `Input=GUID` | Inicia reprodução |
| `PreviewInput` | `Input=GUID` | Envia para o Preview |
| `Cut` | *(sem parâmetros)* | Corta Preview → Program |
| `RemoveInput` | `Input=GUID` | Remove o input |

### Sequência correta de corte

```
❌ ERRADO:  Cut&Input=GUID   (parâmetro Input é ignorado no Cut HTTP)

✅ CORRETO:
1. PlayInput(GUID)      → inicia reprodução (necessário para vídeos)
2. sleep(300ms)         → vMix começa decodificação
3. PreviewInput(GUID)   → coloca no Preview
4. sleep(100ms)
5. Cut                  → Preview vai ao Program
```

O `Cut` do vMix HTTP sempre corta o que **já está no Preview**.

### Polling duplo

| Modo | Intervalo | Uso |
|------|-----------|-----|
| Normal | 2s | Status bar, conexão, lista de inputs |
| Fast | 500ms | Barra de progresso durante reprodução ativa |

---

## 9. Motor de Playout

**Arquivo:** `src/store/AppContext.tsx`

### Princípio: GUID-based, wall-clock, limpeza garantida

```
vMix tem inputs 1 (câmera), 2 (NDI), 3 (gráfico)
VTMaster carrega spot.mp4    → GUID_A = "{abc-123}"
VTMaster carrega vinheta.mp4 → GUID_B = "{def-456}"
vMix renumera (RemoveInput de outro) → spots viram 4 e 5
VTMaster usa GUID_A e GUID_B — nunca os números → zero erro
Ao final: Remove GUID_A e GUID_B. Inputs 1, 2, 3 intocados.
```

### Refs de controle

```typescript
activeInputRef        // GUID do input atualmente no ar ('' para inputs permanentes)
preloadedInputRef     // { guid, filePath } do próximo input já carregado em background
spotmasterGuidsRef    // Set<string> — todos os GUIDs desta sessão (cleanup garantido)
abortRef              // true quando stopPlayback() ou um interrupt foi chamado
scheduleInterruptRef  // interrupt foi pelo scheduler → runSequence retoma em vez de parar
disparoInterruptRef   // interrupt foi pelo Disparo → runSequence retoma em vez de parar
```

### loadNewInput(filePath)

```typescript
const guid = await loadNewInput(filePath)
// Internamente:
// 1. Detecta tipo: Video | AudioFile | Image (por extensão)
// 2. getMaxInputNum() → linha de base para pollForNewInput
// 3. AddInput → vMix carrega o arquivo
// 4. pollForNewInput(prevMax) → aguarda GUID (até 10s, 50 tentativas × 200ms)
// 5. spotmasterGuidsRef.add(guid) ← cleanup garantido ao final da sessão
// 6. sleep(1000ms) → vMix decodifica/bufferiza
// 7. SetPosition(0) → rebobina (exceto imagens)
```

### playItem(item, nextFilePath?)

```typescript
// 1. UPDATE_PLAYLIST_ITEM → status: 'playing'
// 2. Se item.filePath:
//    - Usar preloadedInputRef se filePath bate (zero dead air)
//    - Ou loadNewInput agora
//    - PlayInput (vídeo) + PreviewInput + Cut
//    - RemoveInput(prevGuid) com 5s de delay
// 3. Se item.inputName (permanente):
//    - activeInputRef = '' (nunca armazenado)
//    - PlayInput + PreviewInput + Cut
// 4. ADD_LOG
// 5. Wall-clock loop (300ms ticks):
//    - Verifica abortRef e disparoInterruptRef
//    - Quando remaining ≤ 10s e nextFilePath: loadNewInput em background → preloadedInputRef
// 6. UPDATE_PLAYLIST_ITEM → status: 'done'
```

### runSequence()

Loop `while(true)` que lê a playlist ao vivo a cada iteração:

```typescript
while (true) {
  // Handle abort / interrupt
  if (abortRef.current) {
    if (!scheduleInterruptRef.current && !disparoInterruptRef.current) break
    // Interrupt: limpa refs e continua (não para)
    abortRef.current = false
    scheduleInterruptRef.current = false
    disparoInterruptRef.current = false
  }

  // Lê playlist ao vivo
  const pending = stateRef.current.playlist.filter(i => i.status === 'pending')
  if (pending.length === 0) break

  // Determina próximo item (scheduledDue tem prioridade)
  const { autoPlay, autoplayComerciais } = stateRef.current.settings
  const scheduledDue = autoPlay
    ? pending.filter(i =>
        i.scheduledTime <= currentTime &&
        (!i.adBreakId || autoplayComerciais)   // blocos só auto-disparam se ON
      ).sort(...)
    : []
  const next = scheduledDue[0] ?? firstByOrder(pending)

  // Preload antecipado: próximo arquivo-based após next
  const afterNext = pending.find(i => i.order > next.order && !!i.filePath)

  await playItem(next, afterNext?.filePath)
}

// Limpeza final
cleanupInputs(5000)
for (const g of spotmasterGuidsRef.current) RemoveInput(g)
spotmasterGuidsRef.current.clear()
```

### disparo()

```typescript
const disparo = () => {
  if (stateRef.current.isSequencePlaying) {
    // Avança para o próximo item (interrupt seguro)
    disparoInterruptRef.current = true
    abortRef.current = true
  } else {
    startSequence()
  }
}
```

---

## 10. Sistema de Blocos Comerciais

### Scheduler (30s)

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    const preloadSecs = (stateRef.current.settings.preloadMinutes ?? 5) * 60
    commercialBlocks
      .filter(b => b.enabled && b.lastLoadedDate !== today)
      .forEach(b => {
        const blockSecs   = parseTime(b.scheduledTime)
        const triggerSecs = blockSecs - preloadSecs
        if (nowSecs >= triggerSecs && nowSecs < blockSecs) {
          loadBlockIntoPlaylist(b)
        }
      })
  }, 30_000)
}, [state.isLoading, loadBlockIntoPlaylist])
```

### loadBlockIntoPlaylist(block)

1. Para cada `BlockClientSlot` do bloco:
   - Filtra spots do cliente em `clientSpots`
   - A partir do índice em `spotRotation[clientId]`, pega `spotsCount` spots (com wrap)
   - `ADD_PLAYLIST_ITEM` para cada spot (status `pending`, `scheduledTime = block.scheduledTime`)
   - Avança o índice de rotação
2. `MARK_BLOCK_LOADED` com a data de hoje
3. `SET_SPOT_ROTATION` com índices atualizados

### Autoplay Comerciais

O toggle `autoplayComerciais` controla se itens com `adBreakId` disparam automaticamente:

```typescript
// Scheduler de autoplay (verifica a cada 1s):
const scheduledDue = playlist.filter(i =>
  i.status === 'pending' &&
  i.scheduledTime <= currentTime &&
  (!i.adBreakId || autoplayComerciais)   // ← a chave
)
```

Quando **OFF**: bloco carrega na playlist mas fica `pending` com indicador visual roxo pulsante. O operador dispara manualmente ou via Disparo.

---

## 11. Sistema de Disparo Global

### Configuração da tecla (SettingsModal.tsx)

```typescript
// Modo captura: escuta o próximo keydown
useEffect(() => {
  if (!isCapturing) return
  const handler = (e: KeyboardEvent) => {
    e.preventDefault()
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
    set('triggerKey', keyEventToAccelerator(e))
    setIsCapturing(false)
  }
  window.addEventListener('keydown', handler, true)
  return () => window.removeEventListener('keydown', handler, true)
}, [isCapturing])

// Conversão de KeyboardEvent para accelerator Electron
function keyEventToAccelerator(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey)  parts.push('CommandOrControl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const keyMap = { ' ': 'Space', 'ArrowUp': 'Up', 'Enter': 'Return', /* ... */ }
  parts.push(keyMap[e.key] ?? e.key.toUpperCase())
  return parts.join('+')
}
```

### Registro automático (AppContext.tsx)

```typescript
// Reage a mudanças em triggerEnabled e triggerKey
useEffect(() => {
  if (state.isLoading || !window.spotmaster?.registerTrigger) return
  if (triggerEnabled && triggerKey) {
    window.spotmaster.registerTrigger(triggerKey)
  } else {
    window.spotmaster.unregisterTrigger()
  }
}, [state.settings.triggerEnabled, state.settings.triggerKey, state.isLoading])

// Listener do evento (vem do processo principal via IPC)
useEffect(() => {
  window.spotmaster.onTriggerFired(() => {
    if (stateRef.current.settings.triggerEnabled) disparo()
  })
  return () => window.spotmaster.removeTriggerListener()
}, [disparo])
```

### Suporte a dispositivos externos

O VTMaster suporta qualquer dispositivo que possa ser mapeado para uma tecla de teclado:

| Dispositivo | Como mapear |
|-------------|-------------|
| Teclado | Direto — qualquer tecla |
| Controle MIDI | Software como MIDI2LR, Bome MIDI Translator |
| Gamepad/joystick | Software como antimicro, JoyToKey |
| Botão USB HID | Drivers do fabricante ou AutoHotkey |

---

## 12. Gerenciamento de Estado

**Arquivo:** `src/store/AppContext.tsx`

### AppState

```typescript
interface AppState {
  playlist:           PlaylistItem[]
  adBreaks:           AdBreak[]            // legacy
  clients:            Client[]
  playLog:            PlayLog[]
  settings:           AppSettings
  vmixStatus:         VmixStatus
  activePanel:        string
  isLoading:          boolean
  isSequencePlaying:  boolean
  activeItemProgress: { inputNum: string; position: number; duration: number } | null
  commercialBlocks:   CommercialBlock[]
  clientSpots:        ClientSpot[]
  spotRotation:       SpotRotation
}
```

### AppSettings (completo)

```typescript
interface AppSettings {
  vmixHost:            string   // 'localhost'
  vmixPort:            number   // 8088
  stationName:         string
  theme:               'dark' | 'light'
  language:            'pt' | 'en'
  autoConnect:         boolean
  autoPlay:            boolean  // autoplay geral por scheduledTime
  spotmasterInputName?: string
  // Fase 3:
  triggerEnabled:      boolean  // atalho global registrado e ativo
  triggerKey:          string | null  // accelerator Electron ou null
  autoplayComerciais:  boolean  // blocos comerciais disparam automaticamente
  preloadMinutes:      number   // minutos antes do horário para pré-carregar (padrão: 5)
}
```

### Padrão stateRef (anti-stale-closure)

```typescript
const stateRef = useRef(state)
useEffect(() => { stateRef.current = state })

// Em callbacks assíncronos, setTimeout, setInterval → sempre stateRef.current
// Nunca usar `state` diretamente (valor congelado no momento da criação do closure)
```

---

## 13. Componentes

### Toolbar

Botões disponíveis (da esquerda para a direita):

| Grupo | Botões (só na aba Playlist) |
|-------|---------------------------|
| Playlist | Nova, Importar, Exportar, + Adicionar Item, Inputs vMix, Inserir Bloco, Limpar |
| vMix | Conectar/Desconectar vMix |
| Disparo *(sempre visível)* | **Disparo ON/OFF** (cinza=off, verde=on; desabilitado sem tecla configurada) |
| Comerciais *(sempre visível)* | **Autoplay Comerc. ON/OFF** (cinza=off, verde=on) |
| Utilitários | Tema dark/light, Idioma PT/EN, Configurações |

### PlaylistTable

**Controles de transporte:**
- `▶ Play` — toca apenas o primeiro item pendente
- `▶▶ Iniciar Playlist` — executa toda a sequência
- `⏹ Parar` — interrompe a sequência
- Badge `● Executando` quando `isSequencePlaying`
- Checkbox **Autoplay por Horário**

**Coluna Status — estados especiais:**
- `⚡ Aguardando disparo` (roxo pulsante) — item com `adBreakId` e `status: pending` quando `autoplayComerciais = false`
- `● Veiculando` (verde) — item atualmente no ar
- `✓ Veiculado`, `⏭ Pulado`, `⚠ Erro`, `⧗ Pendente`

**CSS da animação de disparo:**
```css
@keyframes trigger-pulse {
  0%, 100% { box-shadow: inset 0 0 0 1px transparent; }
  50%       { box-shadow: inset 0 0 0 1px rgba(168,85,247,0.5); }
}
.row-awaiting-trigger {
  animation: trigger-pulse 2s ease-in-out infinite;
  background: color-mix(in srgb, #a855f7 5%, transparent) !important;
}
```

**Coluna Término:**
- Parado: estimativa ao vivo (tick 1s a partir do relógio atual)
- Tocando: ancorado no horário exato em que a sequência iniciou
- Itens com `scheduledTime` re-ancoram o cursor naquele horário

**Drag & Drop:**
- Cada linha é drop target para `application/vmix-input`
- Linha `.playlist-drop-end` aceita drop após o último item
- Ao soltar: `insertVmixInput(inp, atIndex)` — insere e renumera todos os `order`

### SettingsModal

Seções:
1. **Dados da Emissora** — nome da emissora
2. **Integração vMix** — host, porta, autoConnect, autoPlay, testar conexão
3. **Disparo** — captura de tecla, exibição do accelerator configurado, botão limpar
4. **Aparência** — tema, idioma

**Seção Disparo:**
- Campo de exibição da tecla configurada (ou "Nenhuma tecla configurada")
- Botão "Capturar Tecla" → entra em modo captura (borda azul pulsante)
- Em modo captura: próximo `keydown` (exceto modificadores puros) é capturado e salvo
- Botão "Limpar" remove a tecla configurada (aparece somente se há tecla)

### AdBreaksPanel

**Aba Grade de Blocos:**
- Campo de pré-carregamento no topo: "Pré-carregar blocos [X] min antes do horário agendado"
- Lista de blocos ordenados por horário
- Cada card: horário, nome, duração estimada, badges "Carregado hoje" / "Não disparou"
- Linha de slots: `[Anunciante] × N → próximo spot`
- Botões: ↺ Recarregar, toggle ativo/inativo, editar, excluir

**Aba Spots dos Clientes:**
- Lista de anunciantes expansível
- Cada anunciante: lista de spots com ícone de tipo, título, duração
- Formulário de spot: browse arquivo → detecção automática de tipo e duração

---

## 14. Tipos de Dados

### PlaylistItem
```typescript
interface PlaylistItem {
  id: string
  order: number             // 1-based
  title: string
  clientId?: string
  clientName?: string
  duration: number          // segundos
  scheduledTime?: string    // HH:MM:SS
  inputName?: string        // input vMix pré-existente
  type: SpotType            // 'spot' | 'vinheta' | 'programa' | 'bumper' | 'outros'
  status: SpotStatus        // 'pending' | 'playing' | 'done' | 'skipped' | 'error'
  filePath?: string
  mediaType?: 'video' | 'image' | 'audio'
  notes?: string
  adBreakId?: string        // referência ao CommercialBlock gerador
}
```

**Regra de exclusividade:**
- `filePath` → VTMaster faz `AddInput` automaticamente
- `inputName` (sem filePath) → VTMaster usa input pré-existente (nunca remove)
- Nunca os dois juntos: o modal limpa `inputName` quando o usuário seleciona arquivo

### CommercialBlock
```typescript
interface CommercialBlock {
  id: string
  name: string
  scheduledTime: string     // HH:MM:SS
  slots: BlockClientSlot[]
  enabled: boolean
  createdAt: string
  lastLoadedDate?: string   // YYYY-MM-DD — evita carga dupla no mesmo dia
}
```

### ClientSpot
```typescript
interface ClientSpot {
  id: string
  clientId: string
  title: string
  filePath: string
  mediaType: 'video' | 'audio' | 'image'
  duration: number
}
```

### SpotRotation
```typescript
interface SpotRotation {
  [clientId: string]: number  // próximo índice de round-robin (0-based)
}
```

---

## 15. Internacionalização

**Arquivos:** `src/i18n/pt.ts` (fonte da verdade), `en.ts`, `index.ts`

```typescript
const { t } = useApp()
t.toolbar.disparoOn          // 'Disparo ON'
t.adBreaks.awaitingTrigger   // 'Aguardando disparo'
t.settings.disparoCapturing  // '⚡ Pressione qualquer tecla...'
```

O tipo `Translations` é inferido de `pt.ts`. Ao adicionar uma chave em `pt.ts`, o TypeScript exige a mesma chave em `en.ts` — checagem em tempo de compilação.

**Chaves adicionadas na Fase 3:**

| Seção | Chaves |
|-------|--------|
| `toolbar` | `disparoOn`, `disparoOff`, `autoplayComerciaisOn`, `autoplayComerciaisOff` |
| `settings` | `disparo`, `disparoKey`, `disparoCaptureBtn`, `disparoCancelBtn`, `disparoClearBtn`, `disparoCapturing`, `disparoNone`, `disparoHint` |
| `adBreaks` | `preloadMinutes`, `awaitingTrigger` |

---

## 16. Persistência de Dados

**Localização:** `%APPDATA%\SpotMaster\` (Windows)

| Chave | Arquivo | Conteúdo |
|-------|---------|----------|
| `settings` | settings.json | AppSettings completo (inclui Fase 3) |
| `playlist` | playlist.json | Playlist atual |
| `adBreaks` | adBreaks.json | Blocos legacy (compatibilidade) |
| `clients` | clients.json | Anunciantes |
| `playLog` | playLog.json | Histórico de veiculação |
| `commercialBlocks` | commercialBlocks.json | Grade de blocos |
| `clientSpots` | clientSpots.json | Spots por anunciante |
| `spotRotation` | spotRotation.json | Índices de rodízio |
| `activePanel` | activePanel.json | Último painel ativo |

**Estratégia de migração:**
```typescript
// Startup: merge com defaults garante retrocompatibilidade
settings: { ...DEFAULT_SETTINGS, ...(settingsRaw as AppSettings) }
// Campos novos (Fase 3) recebem seus defaults em instalações antigas
```

**Auto-save:** cada campo tem `useEffect` próprio que dispara ao mudar (não durante `isLoading`).

**Startup:** `loadAll()` usa `Promise.all` para carregar os 9 arquivos simultaneamente → `LOAD_ALL` único dispatch.

---

## 16b. Ações vMix na Playlist (Fase 4)

### O que são

Itens do tipo `vmix_action` executam um comando HTTP direto no vMix sem carregar mídia. São instantâneos (150ms) e não afetam o input atualmente no ar.

### Funções suportadas

| Função | Parâmetros | Efeito |
|--------|-----------|--------|
| `AudioOff` | `Input` | Muta o áudio do input |
| `AudioOn` | `Input` | Restaura o áudio do input |
| `SetVolume` | `Input`, `Value` (0–100) | Ajusta o volume |
| `Fade` | `Value` (duração ms) | Executa fade |
| `OverlayInput1` | `Input` | Abre overlay 1 |
| `OverlayInput1Out` | — | Fecha overlay 1 |

### Fluxo em playItem()

```typescript
// Early return para vmix_action — antes de qualquer lógica de mídia:
if (item.type === 'vmix_action' && item.vmixAction) {
  const params = { Function: fn, Input?: input, Value?: value }
  await window.spotmaster.vmixRequest(params)
  await sleep(150)
  dispatch(ADD_LOG)
  dispatch(UPDATE_PLAYLIST_ITEM → 'done')
  return   // ← não entra no loop de wall-clock
}
```

### Caso de uso: Controle de Áudio em Bloco Comercial

```
1. ⚡ AudioOff → Camera1        (silencia ao vivo antes dos comerciais)
2. 🎬 Spot 1 — Coca-Cola 30s
3. 🎬 Spot 2 — Brahma 30s
4. ⚡ AudioOn  → Camera1        (restaura ao vivo após os comerciais)
5. 🎬 Câmera ao Vivo
```

### ItemModal — dois modos

O modal de criação de item tem toggle **Mídia / Ação vMix**:
- **Mídia**: comportamento original (arquivo, input vMix, duração)
- **Ação vMix**: seletor de função + input + valor + preview do comando gerado

### Menu de Contexto (botão direito na playlist)

Componente `ContextMenu.tsx` renderizado no `PlaylistTable` ao clicar com botão direito:

| Opção | Ação |
|-------|------|
| Inserir Pausa após | Cria item `type:'outros'` com `duration:5`, sem comandos vMix |
| Inserir Ação vMix após | Abre ItemModal no modo vmix_action com `insertAfterOrder` |
| Inserir Input vMix após | Abre VmixInputPanel com posição de destino |
| Editar Horário Agendado | Mini-modal `ScheduleEditModal` com `<input type="time">` |
| Duplicar | `INSERT_PLAYLIST_ITEM_AFTER` com cópia do item |
| Pular / Marcar como Veiculado | Status direto sem confirmação |

### INSERT_PLAYLIST_ITEM_AFTER (reducer)

```typescript
case 'INSERT_PLAYLIST_ITEM_AFTER': {
  const sorted = [...state.playlist].sort((a, b) => a.order - b.order)
  const insertIdx = sorted.findIndex(i => i.order === action.payload.afterOrder)
  const spliced = [
    ...sorted.slice(0, insertIdx + 1),
    action.payload.item,
    ...sorted.slice(insertIdx + 1),
  ].map((i, idx) => ({ ...i, order: idx + 1 }))
  return { ...state, playlist: spliced }
}
```

---

## 17. Funcionalidades Implementadas

### Playlist
- [x] Criar, editar, excluir itens
- [x] Reordenar com ▲▼
- [x] Drag & drop de inputs do vMix para posição específica
- [x] Coluna Término: estimativa ao vivo / ancorada ao iniciar
- [x] Exportar/importar como JSON
- [x] Inserir bloco comercial na playlist

### Mídia
- [x] Selecionar arquivo (vídeo, imagem, áudio) via diálogo nativo
- [x] Detecção automática de tipo pela extensão
- [x] Leitura de duração via `local-media://` + HTML5 (timeout 10s)
- [x] Imagens: duração padrão 10s, editável
- [x] Auto-preenchimento do título pelo nome do arquivo

### Veiculação
- [x] Sequência completa automática (while loop lendo playlist ao vivo)
- [x] Corte correto: PlayInput → PreviewInput → Cut
- [x] Slots não-destrutivos (câmeras/NDI/gráficos intocados)
- [x] GUID-based (estável após renumeração do vMix)
- [x] A/B Roll gapless (preload antecipado 10s antes do fim)
- [x] Limpeza garantida via spotmasterGuidsRef
- [x] Autoplay por `scheduledTime`
- [x] Try/catch por item: erros não quebram a sequência
- [x] Fast polling 500ms para barra de progresso em tempo real
- [x] Suporte a vídeo, áudio e imagem

### Disparo Global (Fase 3)
- [x] Captura de qualquer tecla/combinação no modal de configurações
- [x] Registro via `globalShortcut` do Electron (funciona minimizado)
- [x] Inicia sequência se parado
- [x] Avança para próximo item se tocando (`disparoInterruptRef`)
- [x] Limpeza automática ao fechar o app
- [x] Botão ON/OFF na toolbar (desabilitado sem tecla)
- [x] Suporte a dispositivos MIDI/controle via mapeamento de tecla

### Automação de Comerciais (Fase 3)
- [x] Toggle "Autoplay Comerciais" na toolbar
- [x] Pré-carregamento configurável (1–60 min) no painel de Blocos
- [x] Indicador visual `⚡ Aguardando disparo` com pulso roxo na playlist
- [x] Blocos comerciais respeitam o toggle para auto-disparo

### Ações vMix na Playlist (Fase 4)
- [x] Tipo `vmix_action` com VmixActionItem (function, input, value)
- [x] AudioOff, AudioOn, SetVolume, Fade, OverlayInput1/Out
- [x] Early return em playItem() — 150ms, sem loop de wall-clock
- [x] ItemModal com toggle Mídia / Ação vMix e preview do comando
- [x] Visual diferenciado: fundo roxo, ícone ⚡, preview inline do comando
- [x] Registro no Log com detalhes da ação executada

### Menu de Contexto (Fase 4)
- [x] Botão direito em qualquer linha da playlist abre ContextMenu
- [x] Inserir Pausa, Ação vMix, Input vMix (com posição específica)
- [x] Editar Horário Agendado via mini-modal
- [x] Duplicar item, Pular, Marcar como Veiculado

### Blocos Comerciais
- [x] Cadastro de spots por anunciante
- [x] Criação de blocos com horário e slots
- [x] Scheduler 30s: carga X min antes do horário (configurável)
- [x] Round-robin contínuo entre execuções
- [x] Proteção contra carga dupla no mesmo dia
- [x] Botão "Recarregar Agora"
- [x] Interrupt de bloco durante sequência em andamento

### Painel vMix
- [x] Lista inputs com ícone por tipo e estado
- [x] Filtro por nome/número/tipo
- [x] Drag & drop para posição específica na playlist
- [x] Botão + para adicionar ao final

### Log e Relatórios
- [x] Log automático (horário agendado vs. real)
- [x] Filtros por data, anunciante, status
- [x] Exportar CSV
- [x] Relatório diário em PDF
- [x] Relatório por anunciante com período

### Interface
- [x] Tema dark/light (toggle)
- [x] Bilíngue PT-BR / EN
- [x] Status bar: vMix, item atual, próximo, Recording, Streaming
- [x] Identidade visual VTMaster (logo, azul `#0ea5e9`)
