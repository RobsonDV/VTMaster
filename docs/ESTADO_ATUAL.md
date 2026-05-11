# VTMaster — Estado Atual do Projeto

> Atualizado em **10/05/2026** — Versão pós Fase 3 (Disparo global, Autoplay Comerciais, Pré-carregamento configurável)

---

## Índice

1. [O que o VTMaster faz](#1-o-que-o-vtmaster-faz)
2. [Stack técnico](#2-stack-técnico)
3. [Estrutura de arquivos](#3-estrutura-de-arquivos)
4. [Histórico de fases e correções](#4-histórico-de-fases-e-correções)
5. [Motor de playout — arquitetura atual](#5-motor-de-playout--arquitetura-atual)
6. [Sistema de Blocos Comerciais](#6-sistema-de-blocos-comerciais)
7. [Sistema de Disparo Global (Fase 3)](#7-sistema-de-disparo-global-fase-3)
8. [Tipos de dados completos](#8-tipos-de-dados-completos)
9. [Estado global (AppContext)](#9-estado-global-appcontext)
10. [Persistência de dados](#10-persistência-de-dados)
11. [Integração vMix](#11-integração-vmix)
12. [Rebranding VTMaster](#12-rebranding-vtmaster)
13. [Funcionalidades — checklist completo](#13-funcionalidades--checklist-completo)
14. [Backlog — o que ainda não está implementado](#14-backlog--o-que-ainda-não-está-implementado)

---

## 1. O que o VTMaster faz

O VTMaster é um software desktop para **emissoras de TV** controlarem a veiculação de spots comerciais via integração com o **vMix** (software de produção ao vivo).

### Fluxo principal (Fase 1)

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
        ↓
Ao final: remove todos os inputs criados (câmeras/NDI/gráficos intocados)
```

### Fluxo de blocos comerciais (Fase 2)

```
Operador cadastra anunciantes e seus spots (arquivos de mídia)
        ↓
Cria Blocos Comerciais: horário + lista de clientes (N spots por cliente)
        ↓
Scheduler (30s): X minutos antes do horário (configurável, padrão 5 min),
insere os spots na playlist em rodízio contínuo
        ↓
Se Autoplay Comerciais ON: inicia automaticamente quando o bloco chegar ao ar
Se Autoplay Comerciais OFF: bloco fica aguardando — operador usa Disparo ou Play manual
```

### Fluxo de Disparo (Fase 3)

```
Operador configura tecla de atalho em Configurações → Disparo
Ativa o botão "Disparo ON" na toolbar
        ↓
Pressiona a tecla (teclado, MIDI, controle → qualquer periférico)
  → App parado: inicia sequência a partir do próximo item pendente
  → App tocando: avança para o próximo item (skip do atual)
        ↓
Funciona mesmo com o app minimizado (globalShortcut do Electron)
```

---

## 2. Stack técnico

| Camada | Tecnologia |
|--------|-----------|
| Desktop | Electron 41.x |
| UI | React 19.x + TypeScript 5.x |
| Build | Vite 8 + Rolldown |
| Ícones | lucide-react |
| PDF | jsPDF + jspdf-autotable |
| i18n | Custom (pt.ts / en.ts) |
| Estado | React useReducer + Context API |
| Persistência | JSON files em userData/SpotMaster/ |
| Atalho global | Electron globalShortcut (qualquer tecla, qualquer dispositivo) |

**Comandos:**
```bash
npm run dev          # Abre o app em modo desenvolvimento
npm run build:dist   # Gera instalador .exe (pasta release/)
```

---

## 3. Estrutura de arquivos

```
VTMaster/
├── electron/
│   ├── main.ts              → Processo principal (IPC, janela, protocolos, globalShortcut)
│   ├── preload.ts           → Bridge renderer↔main via contextBridge
│   └── vmix.ts              → Integração HTTP com a API do vMix (polling normal + fast)
│
├── src/
│   ├── main.tsx             → Entry point React
│   ├── App.tsx              → Layout raiz, navegação de painéis, modais globais
│   ├── App.css              → Variáveis CSS, layout, sidebar, scrollbars
│   │
│   ├── types/
│   │   └── index.ts         → TODOS os tipos e interfaces do app
│   │
│   ├── store/
│   │   └── AppContext.tsx   → Estado global, motor de playout, scheduler de blocos, disparo
│   │
│   ├── i18n/
│   │   ├── index.ts         → getTranslations()
│   │   ├── pt.ts            → Strings em Português (fonte da verdade de tipos)
│   │   └── en.ts            → Strings em Inglês
│   │
│   ├── utils/
│   │   └── time.ts          → now(), formatDuration(), parseDuration(), today()
│   │
│   └── components/
│       ├── Toolbar/         → Toolbar: vMix, Disparo ON/OFF, Autoplay Comerc. ON/OFF, tema, idioma
│       ├── StatusBar/       → Rodapé: status vMix, item atual, próximo
│       ├── Playlist/
│       │   ├── PlaylistTable.tsx    → Tabela + controles + indicador "⚡ Aguardando disparo"
│       │   ├── ItemModal.tsx        → Criar/editar item
│       │   └── VmixInputPanel.tsx   → Painel lateral de inputs do vMix
│       ├── AdBreaks/
│       │   ├── AdBreaksPanel.tsx    → Blocos comerciais + config pré-carregamento
│       │   └── AdBreaksPanel.css
│       ├── Clients/         → Cadastro de anunciantes
│       ├── Log/             → Log de veiculação
│       ├── Reports/         → Geração de PDF
│       └── Settings/
│           └── SettingsModal.tsx    → Configurações + seção Disparo (captura de tecla)
│
└── docs/
    ├── DEVELOPMENT.md       → Documentação técnica detalhada
    ├── ESTADO_ATUAL.md      → Este arquivo
    └── INDEX.md             → Índice geral da documentação
```

---

## 4. Histórico de fases e correções

### Fase 1 — Motor de playout base

**Motor original reescrito completamente.** Bugs críticos corrigidos:

| Bug | Causa | Correção |
|-----|-------|---------|
| Sequência parava no item 2 | Array de itens fixo na abertura do loop | `while` loop lendo `stateRef.current.playlist` ao vivo a cada iteração |
| Áudios não avançavam | `waitForInputEnd` detectava posição, mas AudioFile reseta para 0 ao terminar | Detecção por mudança de `state` (Running → Paused) |
| Erros quebravam a sequência | Sem try/catch | Cada `playItem()` envolvido em try/catch; item marcado como `error`, sequência continua |
| Input errado tocava | A/B Slot baseado em número, renumerado pelo vMix após RemoveInput | Migração para **GUID** (`key` attribute do XML, estável) |
| Race condition no preload | loadNewInput concorrente retornava o mesmo GUID para dois itens | Preload estritamente serial |
| último input ficava no vMix | `runSequence` zerava `activeInputRef` antes de `cleanupInputs` | `cleanupInputs` é único responsável por zerar o ref |
| Inputs permanentes deletados | `inputName` armazenado em `activeInputRef` | `activeInputRef` fica `''` para inputs permanentes |
| Inputs fantasmas acumulando | Cleanup individual falhava em caso de erro/abort | `spotmasterGuidsRef` (Set): varre todos os GUIDs no cleanup final |

### Fase 2 — Sistema de Blocos Comerciais

- Cadastro de spots por anunciante com detecção automática de duração
- Blocos comerciais agendados com rodízio round-robin contínuo
- Scheduler de 30s com carga 1 minuto antes do horário (fixo)
- Proteção contra carga dupla no mesmo dia (`lastLoadedDate`)
- Fast polling (500ms) para barra de progresso em tempo real

### Fase 3 — Disparo Global e Automação de Comerciais (10/05/2026)

- **Disparo global** via `globalShortcut` do Electron (funciona minimizado)
- **Autoplay Comerciais** como toggle separado do autoplay geral
- **Pré-carregamento configurável** (padrão 5 min, era fixo em 1 min)
- **Indicador visual** de blocos aguardando disparo (pulso roxo na playlist)
- **Botão "next"** implícito: disparo durante reprodução avança para o próximo item
- `preload.ts` corrigido: fast polling e browseVideoFile agora corretamente expostos

---

## 5. Motor de playout — arquitetura atual

### Princípio: GUID-based, wall-clock

Cada input carregado pelo VTMaster é identificado pelo **GUID** (`key` attribute no XML do vMix). O GUID é estável — nunca muda mesmo quando o vMix renumera. O avanço da sequência é feito exclusivamente por **wall-clock** (`Date.now()`), nunca por polling de estado.

### Refs de controle

```typescript
activeInputRef        // GUID do input atualmente no ar ('' para inputs permanentes)
preloadedInputRef     // { guid, filePath } do próximo input já carregado em background
spotmasterGuidsRef    // Set<string> — todos os GUIDs carregados nesta sessão
abortRef              // true quando stopPlayback() ou disparo-interrupt foi chamado
scheduleInterruptRef  // true quando abort foi pelo scheduler (retoma em vez de parar)
disparoInterruptRef   // true quando abort foi pelo Disparo (retoma em vez de parar)
```

### Dois tipos de item na playlist

| Campo preenchido | Tipo | Comportamento |
|-----------------|------|--------------|
| `filePath` | Arquivo local | VTMaster faz `AddInput` → GUID → toca → `RemoveInput` após uso |
| `inputName` | Input permanente do vMix | Apenas `PlayInput`/`PreviewInput`/`Cut` — **nunca** `RemoveInput` |

### Fluxo completo de `playItem(item, nextFilePath?)`

```
1. UPDATE_PLAYLIST_ITEM → status: 'playing'

2. Se item.filePath:
   a. Verificar preloadedInputRef:
      → filePath bate? Usar GUID já pronto (zero dead air)
      → Stale? RemoveInput no stale, loadNewInput agora
      → Vazio? loadNewInput agora
   b. loadNewInput(filePath):
      - getMaxInputNum() → linha de base
      - AddInput → vMix carrega o arquivo
      - pollForNewInput(prevMax) → aguarda GUID com number > prevMax (até 10s)
      - spotmasterGuidsRef.add(guid) ← cleanup garantido
      - sleep(1000ms) → vMix decodifica/bufferiza
      - SetPosition(0) → rebobina (exceto imagens)
   c. Se vídeo: PlayInput(guid) + sleep(300ms)
   d. PreviewInput(guid) + sleep(100ms) + Cut
   e. Se áudio: sleep(500ms) + PlayInput(guid) + sleep(200ms)
   f. RemoveInput(prevGuid) com 5s de delay (remove o ANTERIOR)
   g. activeInputRef.current = guid

3. Se item.inputName (input permanente):
   a. RemoveInput(prevGuid) com 5s de delay
   b. activeInputRef.current = '' ← NUNCA armazena input permanente
   c. SetPosition(0) + PlayInput + PreviewInput + sleep(100ms) + Cut

4. ADD_LOG → registra veiculação

5. Wall-clock loop:
   - totalMs = Math.max(item.duration * 1000, 3000)
   - Se duration=0: lê duração real do XML do vMix
   - Loop com sleep(300ms), verifica abortRef e disparoInterruptRef
   - Quando remaining ≤ 10s e nextFilePath existe:
     → loadNewInput em background → preloadedInputRef
     → se abort durante preload: RemoveInput imediato

6. UPDATE_PLAYLIST_ITEM → status: 'done'
```

### Limpeza garantida

```
Fim natural de runSequence:
  cleanupInputs(5000)  → remove input ativo com 5s de grace
  para cada GUID no spotmasterGuidsRef: RemoveInput
  Set.clear()

stopPlayback() ou disparo-interrupt:
  preloadedInputRef → RemoveInput imediato
  cleanupInputs(0)
  para cada GUID no spotmasterGuidsRef: RemoveInput
  Set.clear()
```

---

## 6. Sistema de Blocos Comerciais

### Conceitos

| Conceito | Descrição |
|----------|-----------|
| **ClientSpot** | Arquivo de mídia cadastrado para um anunciante: título, caminho, tipo e duração. |
| **CommercialBlock** | Bloco agendado: nome, horário (HH:MM:SS), slots (cliente × N spots), flag enabled. |
| **BlockClientSlot** | Dentro de um bloco: "o anunciante X tem N spots neste bloco". |
| **SpotRotation** | Dicionário `{ clientId → próximo índice }`. Controla o round-robin entre execuções. |

### Round-robin contínuo

Cliente com 3 spots [A, B, C] e 2 spots por bloco:

```
1ª execução: rotation[clientId]=0  →  pega A, B  →  avança para 2
2ª execução: rotation[clientId]=2  →  pega C, A  →  avança para 1
3ª execução: rotation[clientId]=1  →  pega B, C  →  avança para 0
```

O índice nunca "reseta do zero" — é contínuo entre dias e entre execuções.

### Agendamento automático

O scheduler verifica a cada **30s**. Quando o horário atual está dentro da janela de pré-carregamento (configurável, padrão 5 minutos), insere o bloco na playlist **uma vez por dia**:

```typescript
const preloadSecs = (settings.preloadMinutes ?? 5) * 60
const triggerSecs = blockSecs - preloadSecs
if (nowSecs >= triggerSecs && nowSecs < blockSecs) {
  loadBlockIntoPlaylist(b)
}
```

### Autoplay Comerciais

O comportamento após o pré-carregamento depende do toggle **Autoplay Comerciais** na toolbar:

| Estado | Comportamento |
|--------|--------------|
| **ON** | Bloco carrega e dispara automaticamente quando chega no horário (padrão anterior) |
| **OFF** | Bloco carrega e fica aguardando — playlist pulsa em roxo com badge "⚡ Aguardando disparo". O operador inicia via Disparo ou play manual. |

A verificação é feita tanto no `runSequence` quanto no scheduler de autoplay:

```typescript
// Itens com adBreakId só disparam automaticamente se autoplayComerciais for true
const scheduledDue = autoPlay
  ? pending.filter(i =>
      i.scheduledTime <= currentTime &&
      (!i.adBreakId || autoplayComerciais)
    )
  : []
```

---

## 7. Sistema de Disparo Global (Fase 3)

### O que é o Disparo

O **Disparo** é um atalho de teclado global que funciona como um comando "Play / Next" para o VTMaster, mesmo com o app minimizado ou sem foco.

### Configuração

1. Abrir **Configurações** (ícone de engrenagem na toolbar)
2. Seção **Disparo** → clicar em "Capturar Tecla"
3. Pressionar qualquer tecla (F1-F12, letras, combinações com Ctrl/Alt/Shift, teclas de mídia)
4. A tecla é salva e exibida como accelerator do Electron (ex: `F5`, `Ctrl + Space`)
5. Ativar o botão **"Disparo ON"** na toolbar (fica desabilitado sem tecla configurada)

**Suporte a dispositivos:** botões MIDI, controles de vídeo e outros periféricos podem ser mapeados para teclas de teclado via software (ex: MIDI2LR, antimicro). O VTMaster detecta a tecla resultante.

### Comportamento

| Estado do app | Ação do Disparo |
|--------------|----------------|
| **Parado, itens pendentes** | Inicia sequência a partir do próximo item pendente |
| **Tocando** | Avança para o próximo item (interrompe o atual, marca como done) |
| **Parado, sem pendentes** | Nenhuma ação |
| **Disparo OFF** | Atalho não registrado — tecla não é capturada |

### Implementação técnica

**electron/main.ts:**
```typescript
// Registro do atalho global
globalShortcut.register(key, () => {
  mainWindow?.webContents.send('trigger-fired')
})

// Limpeza ao fechar
app.on('will-quit', () => globalShortcut.unregisterAll())
```

**AppContext.tsx — função `disparo()`:**
```typescript
const disparo = () => {
  if (stateRef.current.isSequencePlaying) {
    // Interrompe item atual e avança para o próximo
    disparoInterruptRef.current = true
    abortRef.current = true
  } else {
    startSequence()
  }
}
```

**runSequence — tratamento de `disparoInterruptRef`:**
```typescript
if (abortRef.current) {
  // Para completamente somente se NEM o scheduler NEM o disparo pediram retomada
  if (!scheduleInterruptRef.current && !disparoInterruptRef.current) break
  abortRef.current = false
  scheduleInterruptRef.current = false
  disparoInterruptRef.current = false
  // Continua o while loop: pega o próximo item pendente
}
```

**Registro/cancelamento automático:**
```typescript
// Effect reage a mudanças em triggerEnabled e triggerKey
useEffect(() => {
  if (triggerEnabled && triggerKey) {
    window.spotmaster.registerTrigger(triggerKey)
  } else {
    window.spotmaster.unregisterTrigger()
  }
}, [triggerEnabled, triggerKey])
```

---

## 8. Tipos de dados completos

### PlaylistItem
```typescript
interface PlaylistItem {
  id: string
  order: number             // 1-based
  title: string
  clientId?: string
  clientName?: string
  duration: number          // segundos
  scheduledTime?: string    // HH:MM:SS — autoplay por horário
  inputName?: string        // input vMix pré-existente
  type: SpotType            // 'spot' | 'vinheta' | 'programa' | 'bumper' | 'outros'
  status: SpotStatus        // 'pending' | 'playing' | 'done' | 'skipped' | 'error'
  filePath?: string         // arquivo local → AddInput automático
  mediaType?: 'video' | 'image' | 'audio'
  notes?: string
  adBreakId?: string        // referência ao CommercialBlock que gerou este item
}
```

### AppSettings (atualizado — Fase 3)
```typescript
interface AppSettings {
  vmixHost: string          // padrão: 'localhost'
  vmixPort: number          // padrão: 8088
  stationName: string
  theme: 'dark' | 'light'
  language: 'pt' | 'en'
  autoConnect: boolean      // conectar vMix ao iniciar o app
  autoPlay: boolean         // autoplay geral por horário agendado
  spotmasterInputName?: string
  // Fase 3:
  triggerEnabled: boolean   // se o Disparo está ativo (atalho registrado no OS)
  triggerKey: string | null // accelerator Electron (ex: 'F5', 'CommandOrControl+Space')
  autoplayComerciais: boolean // se blocos comerciais disparam automaticamente
  preloadMinutes: number    // minutos antes do horário para pré-carregar (padrão: 5)
}
```

### CommercialBlock
```typescript
interface CommercialBlock {
  id: string
  name: string              // ex: "Intervalo das 14h"
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
  duration: number          // segundos (detectado automaticamente)
}
```

### SpotMasterAPI (window.spotmaster) — completa
```typescript
interface SpotMasterAPI {
  // Persistência
  saveData(key, data): Promise<void>
  loadData(key): Promise<unknown>
  // App
  getVersion(): Promise<string>
  openExternal(url): Promise<void>
  // Arquivos
  exportPlaylist(data): Promise<string | null>
  importPlaylist(): Promise<unknown>
  exportPDF(filePath, buffer): Promise<boolean>
  browseVideoFile(): Promise<string | null>
  // vMix
  vmixRequest(params): Promise<{ success, data?, error? }>
  vmixStartPolling(host, port): Promise<boolean>
  vmixStopPolling(): Promise<boolean>
  onVmixStatus(callback): void
  removeVmixStatusListener(): void
  vmixStartFastPolling(host, port): Promise<boolean>
  vmixStopFastPolling(): Promise<boolean>
  onVmixFastStatus(callback): void
  removeVmixFastStatusListener(): void
  // Disparo (Fase 3)
  registerTrigger(key): Promise<boolean>
  unregisterTrigger(): Promise<void>
  onTriggerFired(callback): void
  removeTriggerListener(): void
}
```

---

## 9. Estado global (AppContext)

### AppState completo
```typescript
interface AppState {
  playlist:           PlaylistItem[]
  adBreaks:           AdBreak[]
  clients:            Client[]
  playLog:            PlayLog[]
  settings:           AppSettings          // inclui campos Fase 3
  vmixStatus:         VmixStatus
  activePanel:        string
  isLoading:          boolean
  isSequencePlaying:  boolean
  activeItemProgress: { inputNum, position, duration } | null
  commercialBlocks:   CommercialBlock[]
  clientSpots:        ClientSpot[]
  spotRotation:       SpotRotation
}
```

### Funções expostas via Context
```typescript
interface AppContextValue {
  state:                AppState
  dispatch:             React.Dispatch<Action>
  t:                    Translations
  saveToStorage:        (key, data) => void
  playItem:             (item) => Promise<void>
  playSingleItem:       () => void
  startSequence:        () => void
  stopPlayback:         () => Promise<void>
  loadBlockIntoPlaylist:(block) => void
  disparo:              () => void    // Fase 3
}
```

### Actions disponíveis

**Playlist:** `SET_PLAYLIST`, `ADD_PLAYLIST_ITEM`, `UPDATE_PLAYLIST_ITEM`, `DELETE_PLAYLIST_ITEM`, `CLEAR_PLAYLIST`, `REORDER_PLAYLIST`

**Comercial:** `ADD_COMMERCIAL_BLOCK`, `UPDATE_COMMERCIAL_BLOCK`, `DELETE_COMMERCIAL_BLOCK`, `MARK_BLOCK_LOADED`, `ADD_CLIENT_SPOT`, `UPDATE_CLIENT_SPOT`, `DELETE_CLIENT_SPOT`, `SET_SPOT_ROTATION`

**Clientes/Log:** `ADD_CLIENT`, `UPDATE_CLIENT`, `DELETE_CLIENT`, `ADD_LOG`, `SET_LOG`

**App:** `SET_SETTINGS`, `SET_VMIX_STATUS`, `SET_SEQUENCE_PLAYING`, `SET_ACTIVE_ITEM_PROGRESS`, `SET_ACTIVE_PANEL`, `SET_LOADING`, `LOAD_ALL`

---

## 10. Persistência de dados

Todos os dados são salvos em `%APPDATA%\SpotMaster\` (Windows):

| Chave | Arquivo JSON | Conteúdo |
|-------|-------------|----------|
| `settings` | settings.json | Configurações do app (inclui triggerKey, preloadMinutes, etc.) |
| `playlist` | playlist.json | Playlist atual |
| `adBreaks` | adBreaks.json | Blocos legacy (compatibilidade) |
| `clients` | clients.json | Anunciantes cadastrados |
| `playLog` | playLog.json | Histórico de veiculação |
| `commercialBlocks` | commercialBlocks.json | Grade de blocos comerciais |
| `clientSpots` | clientSpots.json | Spots por anunciante |
| `spotRotation` | spotRotation.json | Índices de rodízio |
| `activePanel` | activePanel.json | Último painel ativo |

**Migração de versões:** O carregamento usa `{ ...DEFAULT_SETTINGS, ...savedSettings }`, então novos campos têm seus defaults aplicados automaticamente em arquivos antigos sem os campos novos.

---

## 11. Integração vMix

### Funções utilizadas

| Função | Parâmetros | Uso |
|--------|-----------|-----|
| `AddInput` | `Value=Video\|path` | Carrega vídeo |
| `AddInput` | `Value=Image\|path` | Carrega imagem |
| `AddInput` | `Value=AudioFile\|path` | Carrega áudio |
| `SetPosition` | `Input=GUID&Value=0` | Rebobina |
| `PlayInput` | `Input=GUID` | Inicia reprodução |
| `PreviewInput` | `Input=GUID` | Envia para Preview |
| `Cut` | *(sem parâmetros)* | Corta Preview → Program |
| `RemoveInput` | `Input=GUID` | Remove input |

### Polling duplo

| Polling | Intervalo | Ativo quando |
|---------|-----------|-------------|
| Normal | 2s | vMix conectado (status bar, painel de inputs) |
| Fast | 500ms | Durante execução ativa (barra de progresso em tempo real) |

---

## 12. Rebranding VTMaster

Realizado em 07/05/2026. O produto foi renomeado de **SpotMaster** para **VTMaster**.

| Elemento | Antes | Depois |
|----------|-------|--------|
| Nome | SpotMaster | VTMaster |
| Cor acento | `#e94560` (vermelho) | `#0ea5e9` (azul) |
| Ícone | `icon.png` | `icon.ico` |
| Título janela Electron | "SpotMaster" | "VTMaster" |
| `package.json name` | spotmaster | vtmaster |
| Logo | Texto | `Logo_VTMasterHorizontal.png` |

Crédito exibido em todas as telas: **"VTMaster · Desenvolvido por RobsonCostaDV"**

---

## 13. Funcionalidades — checklist completo

### ✅ Fase 1 — Motor de playout base

- [x] Criar, editar, excluir itens na playlist
- [x] Reordenar com botões ▲▼
- [x] Drag & drop de inputs do vMix para posição específica
- [x] Coluna Término: ao vivo antes do play, ancorada após iniciar
- [x] Exportar/importar playlist como JSON
- [x] Selecionar arquivo via diálogo (vídeo, imagem, áudio)
- [x] Detecção automática de tipo e duração
- [x] Sequência completa automática (while loop lendo playlist ao vivo)
- [x] Corte correto: PlayInput → PreviewInput → Cut
- [x] Slots não-destrutivos (câmeras/NDI/gráficos intocados)
- [x] GUID-based: estável mesmo com renumeração do vMix
- [x] A/B Roll gapless (preload antecipado 10s)
- [x] Limpeza garantida via spotmasterGuidsRef
- [x] Autoplay por scheduledTime
- [x] Try/catch por item: erros não quebram a sequência
- [x] Log automático (horário agendado vs. real)
- [x] Relatório diário e por anunciante em PDF
- [x] Exportar log em CSV
- [x] Tema dark/light, bilíngue PT/EN
- [x] Status bar com item atual, próximo, Recording/Streaming

### ✅ Fase 2 — Sistema de Blocos Comerciais

- [x] Cadastro de spots por anunciante (arquivo + duração + tipo)
- [x] Detecção automática de duração ao selecionar arquivo
- [x] Criação de blocos com horário, slots (cliente × N spots)
- [x] Toggle ativo/inativo por bloco
- [x] Scheduler: verifica a cada 30s, carrega antes do horário
- [x] Round-robin contínuo entre execuções (índice não reseta)
- [x] Proteção contra carga dupla no mesmo dia (lastLoadedDate)
- [x] Botão "Recarregar Agora" (carga manual forçada)
- [x] Badge "Carregado hoje" e "Não disparou" nos cards
- [x] Exibe próximo spot de cada cliente no card do bloco
- [x] Fast polling 500ms para barra de progresso em tempo real
- [x] Interrupt do bloco comercial durante sequência em andamento

### ✅ Fase 3 — Disparo Global e Automação de Comerciais

- [x] Captura de tecla no modal de configurações (qualquer tecla/combinação)
- [x] Conversão para accelerator Electron (F1-F12, letras, Ctrl/Alt/Shift, teclas de mídia)
- [x] Registro global via `globalShortcut` do Electron (funciona minimizado)
- [x] Limpeza automática do atalho ao fechar o app
- [x] Botão "Disparo ON/OFF" na toolbar (desabilitado sem tecla configurada)
- [x] Disparo inicia sequência se app estiver parado
- [x] Disparo avança para próximo item se app estiver tocando (disparoInterruptRef)
- [x] Botão "Autoplay Comerc. ON/OFF" na toolbar
- [x] Pré-carregamento configurável (1–60 min, padrão 5 min) no painel de Blocos
- [x] Indicador visual "⚡ Aguardando disparo" com pulso roxo na playlist
- [x] `preload.ts` corrigido: fast polling e browseVideoFile agora expostos corretamente

---

## 14. Backlog — o que ainda não está implementado

### Alta prioridade

| Item | Descrição |
|------|-----------|
| **Cleanup ao excluir anunciante** | Ao excluir um anunciante, seus `clientSpots` ficam órfãos em clientSpots.json. |
| **Filtro de dias por semana nos blocos** | Hoje os blocos disparam todos os dias. Futuramente: Seg/Ter/Qua/Qui/Sex/Sáb/Dom selecionáveis. |

### Média prioridade

| Item | Descrição |
|------|-----------|
| **Múltiplos blocos no mesmo horário** | Hoje pode haver conflito se dois blocos têm o mesmo `scheduledTime`. |
| **Importação CSV de playlist/spots** | Carregar itens a partir de planilha. |
| **Preview de mídia** | Pré-visualizar clipe antes de adicionar à playlist. |
| **Spots no ClientsPanel** | Os spots são gerenciados no AdBreaksPanel. Adicionar atalho direto no painel de Anunciantes. |

### Baixa prioridade

| Item | Descrição |
|------|-----------|
| **Sistema de licenciamento** | Proteção por CNPJ/chave de ativação. |
| **Sincronização em rede** | Múltiplos operadores editando a grade simultaneamente. |
| **Suporte nativo a MIDI/HID** | Hoje via mapeamento de teclas. Integração direta com dispositivos MIDI/HID eliminaria a dependência de software de mapeamento. |
