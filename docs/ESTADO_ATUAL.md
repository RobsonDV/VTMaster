# VTMaster — Estado Atual do Projeto
> Documento atualizado em 07/05/2026 — Versão após refatoração completa do motor de playout (GUID, wall-clock, preload antecipado, limpeza total) + rebranding VTMaster

---

## Índice

1. [O que o VTMaster faz](#1-o-que-o-vtmaster-faz)
2. [Stack técnico](#2-stack-técnico)
3. [Estrutura de arquivos](#3-estrutura-de-arquivos)
4. [Bugs corrigidos — Refatoração do motor de playout](#4-bugs-corrigidos--refatoração-do-motor-de-playout)
5. [Motor de playout — arquitetura atual](#5-motor-de-playout--arquitetura-atual)
6. [Motor de playout — como funciona](#6-motor-de-playout--como-funciona)
7. [Sistema de Blocos Comerciais — como funciona](#7-sistema-de-blocos-comerciais--como-funciona)
8. [Tipos de dados completos](#8-tipos-de-dados-completos)
9. [Estado global (AppContext)](#9-estado-global-appcontext)
10. [Persistência de dados](#10-persistência-de-dados)
11. [Rebranding VTMaster — alterações visuais](#11-rebranding-vtmaster--alterações-visuais)
12. [Integração vMix](#12-integração-vmix)
13. [Funcionalidades — checklist completo](#13-funcionalidades--checklist-completo)
14. [O que ainda não está implementado](#14-o-que-ainda-não-está-implementado)

---

## 4. Bugs corrigidos — Refatoração do motor de playout

### 4.1 Spots pulando em 1-2 segundos (`waitForInputEnd` removido)

**Problema:** Cada spot avançava imediatamente, especialmente durante Cut/Preview.

**Causa:** `waitForInputEnd` fazia polling do XML do vMix. Durante a transição de corte, o vMix reportava estado `Paused` ou `Buffering` temporariamente, disparando saída falsa.

**Correção:** `waitForInputEnd` **removido completamente**. O avanço da sequência agora é exclusivamente por wall-clock (`Date.now()`). Se `item.duration` for 0 ou ausente, o SpotMaster lê a duração real do XML do vMix após o buffer. Mínimo absoluto de 3 segundos.

### 4.2 Input errado tocava / sequência parava no item 2

**Problema:** O item 2 tocava no lugar do item 1, ou a sequência parava após 2 itens.

**Causa:** O sistema A/B Slot usava **número** do input (renumerado pelo vMix após cada `RemoveInput`). Após o `RemoveInput` do slot A, o vMix renumerava os inputs e o número do slot B apontava para o input errado.

**Correção:** O A/B Slot Engine foi **removido**. Cada input é identificado por **GUID** (`key` attribute do XML do vMix), que é estável e nunca muda mesmo quando o vMix renumera os inputs.

### 4.3 Race condition no preload concorrente

**Problema:** Item 2 tocava no lugar do item 1 (mesmo com GUIDs).

**Causa:** O `runSequence` disparava `loadNewInput` do item 2 em background enquanto `playItem(item1)` também chamava `loadNewInput`. Ambas chamavam `getMaxInputNum()` antes de qualquer `AddInput` completar — retornavam o mesmo `prevMax` — e `pollForNewInput` retornava o mesmo GUID para os dois.

**Correção:** Preload concorrente **removido**. `loadNewInput` é estritamente serial. O preload antecipado (10s) foi reimplementado de forma segura — veja seção 5.

### 4.4 `cleanupInputs` não removia o último input

**Problema:** O último input da sequência ficava permanentemente no projeto vMix.

**Causa:** `runSequence` zerava `activeInputRef.current = ''` **antes** de chamar `cleanupInputs`, que lê o ref internamente. Com `''`, não havia nada para remover.

**Correção:** `cleanupInputs` é o único responsável por zerar `activeInputRef`. O caminho de abort usa `else activeInputRef.current = ''`.

### 4.5 Inputs permanentes do vMix sendo deletados

**Problema:** Câmeras, gráficos e outros inputs do projeto vMix eram deletados pelo SpotMaster.

**Causa:** O bloco `else if (item.inputName)` em `playItem` armazenava o nome do input permanente em `activeInputRef.current`. Ao fim da sequência (ou no Stop), `cleanupInputs` chamava `RemoveInput` nele.

**Correção:** Para inputs permanentes, `activeInputRef.current` é mantido como `''`. Se havia um GUID de arquivo carregado anteriormente, ele é removido com 5s de grace antes do input permanente entrar no ar.

### 4.6 Inputs fantasmas acumulando no projeto vMix

**Problema:** Após várias sessões, o projeto vMix acumulava inputs carregados pelo SpotMaster que não foram removidos (por abort, erro ou crash).

**Causa:** Cada input tinha remoção individual (`prevGuid`, `cleanupInputs`), mas qualquer erro no caminho deixava o input órfão.

**Correção:** `spotmasterGuidsRef` — um `Set<string>` que registra **todo GUID** retornado por `loadNewInput`. Ao fim de `runSequence` e em `stopPlayback`, o Set é varrido completamente e `RemoveInput` é chamado em todos. Inputs permanentes do vMix nunca passam por `loadNewInput`, logo nunca entram no Set.

---

## 5. Motor de playout — arquitetura atual

### Princípio: GUID-based, wall-clock

Cada input carregado pelo SpotMaster é identificado pelo seu **GUID** (`key` attribute no XML do vMix). O GUID é estável — nunca muda mesmo quando o vMix renumera os inputs após um `RemoveInput`. O avanço da sequência é feito exclusivamente por wall-clock (`Date.now()`), nunca por polling do estado do vMix.

### Refs de controle

```typescript
activeInputRef        // GUID do input atualmente no ar
preloadedInputRef     // { guid, filePath } do próximo input já carregado em background
spotmasterGuidsRef    // Set<string> — todos os GUIDs carregados por esta sessão
abortRef              // true quando stopPlayback() foi chamado
scheduleInterruptRef  // true quando o abort foi pelo scheduler (retoma em vez de parar)
```

### Dois tipos de item na playlist

| Campo preenchido | Tipo | Comportamento |
|-----------------|------|--------------|
| `filePath` | Arquivo local | SpotMaster faz `AddInput` → obtém GUID → toca → remove após uso |
| `inputName` | Input permanente do vMix | SpotMaster chama apenas `PlayInput`/`PreviewInput`/`Cut` — **nunca** `RemoveInput` |

### Fluxo completo de `playItem(item, nextFilePath?)`

```
1. UPDATE_PLAYLIST_ITEM → status: 'playing'

2. Se item.filePath:
   a. Verificar preloadedInputRef:
      → filePath bate? Usar GUID já pronto (zero dead air)
      → Stale (filePath diferente)? RemoveInput no stale, loadNewInput agora
      → Vazio? loadNewInput agora
   b. loadNewInput(filePath):
      - getMaxInputNum() → marca linha de base
      - AddInput → vMix carrega o arquivo
      - pollForNewInput(prevMax) → aguarda até 10s por GUID com number > prevMax
      - spotmasterGuidsRef.add(guid) ← registra para cleanup garantido
      - sleep(1000ms) → vMix decodifica/bufferiza
      - SetPosition(0) → rebobina (exceto imagens)
      - retorna GUID
   c. Se vídeo: PlayInput(guid) + sleep(300ms)
   d. PreviewInput(guid) + sleep(100ms) + Cut
   e. Se áudio: sleep(500ms) + PlayInput(guid) + sleep(200ms)
   f. RemoveInput(prevGuid) com 5s de delay (remove o ANTERIOR)
   g. activeInputRef.current = guid

3. Se item.inputName (input permanente):
   a. RemoveInput(prevGuid) com 5s de delay (se havia GUID de arquivo anterior)
   b. activeInputRef.current = '' ← NUNCA armazena o input permanente
   c. SetPosition(0) + PlayInput + PreviewInput + sleep(100ms) + Cut

4. ADD_LOG → registra veiculação

5. Wall-clock loop (substitui waitForInputEnd):
   - totalMs = Math.max(item.duration * 1000, 3000)
   - Se duration=0: lê duração real do XML do vMix
   - Loop com sleep(300ms) até elapsed >= totalMs ou abortRef=true
   - Quando remaining <= 10s e nextFilePath existe:
     → dispara loadNewInput(nextFilePath) em background (sem await)
     → resultado guardado em preloadedInputRef para uso imediato no próximo item
     → se abort ocorrer durante o preload: RemoveInput no guid preloadado

6. UPDATE_PLAYLIST_ITEM → status: 'done'
```

### Limpeza garantida — spotmasterGuidsRef

```
Ao fim de runSequence (sequência terminou naturalmente):
  cleanupInputs(5000)            ← remove input ativo com 5s de grace
  para cada GUID no Set:
    RemoveInput(GUID)            ← varre tudo que possa ter escapado
  Set.clear()

Ao stopPlayback():
  preloadedInputRef → RemoveInput imediato
  cleanupInputs(0)               ← remove input ativo imediatamente
  para cada GUID no Set:
    RemoveInput(GUID)
  Set.clear()
```

Inputs permanentes do vMix (câmeras, gráficos) **nunca** passam por `loadNewInput`, logo nunca entram no Set — 100% protegidos.

---

## 11. Rebranding VTMaster — alterações visuais

Realizado em 07/05/2026. O produto foi renomeado de **SpotMaster** para **VTMaster**.

### Identidade visual

| Elemento | Antes | Depois |
|----------|-------|--------|
| Nome do produto | SpotMaster | **VTMaster** |
| Cor de acento | `#e94560` (vermelho) | `#0ea5e9` (azul VTMaster) |
| Ícone da janela | `public/icon.png` | `public/icon.ico` (icone_VTmaster.ico) |
| Título da janela Electron | "SpotMaster" | "VTMaster" |
| `<title>` HTML | "SpotMaster" | "VTMaster" |
| `package.json name` | spotmaster | vtmaster |

### Arquivos de logo adicionados

- `src/assets/Logo_VTMasterHorizontal.png` — logo com ícone + texto, usado na Toolbar e PDF
- `src/assets/Logo_VTMaster.png` — ícone isolado
- `public/icon.ico` — ícone do executável Windows

### Componentes alterados

| Arquivo | Alteração |
|---------|----------|
| `Toolbar.tsx` | Logo horizontal substitui texto "SpotMaster" + ícone `LayoutList` |
| `Toolbar.css` | `.brand-logo` (height 38px, drop-shadow azul); removidos `.brand-icon` / `.brand-name` |
| `App.tsx` | Loading screen com logo VTMaster + animação glow; sidebar footer com crédito |
| `App.css` | `--accent: #0ea5e9`; `--accent-hover: #0284c7`; `--accent-glow`; keyframes `pulse-glow`; `.dev-credit` |
| `SettingsModal.tsx` | Footer "VTMaster · Desenvolvido por **RobsonCostaDV**" |
| `ReportsPanel.tsx` | Cabeçalho PDF: logo VTMaster via `addImage()` (fallback text); footer atualizado |
| `electron/main.ts` | `title: 'VTMaster'`, `icon: '../public/icon.ico'` |
| `index.html` | `<title>VTMaster</title>` |
| `package.json` | `name: vtmaster`, `author: RobsonCostaDV`, description atualizado |

### Crédito de autoria

Em todas as telas o produto exibe: **"VTMaster · Desenvolvido por RobsonCostaDV"**
- Sidebar (rodapé da navegação lateral)
- Modal de Configurações (rodapé)
- PDF de Relatórios (cabeçalho e rodapé de cada página)

---



## 1. O que o VTMaster faz

O VTMaster é um software desktop para **emissoras de TV** controlarem a veiculação de spots comerciais via integração com o **vMix** (software de produção ao vivo).

### Fluxo principal

```
Operador monta playlist
        ↓
Clica "Iniciar Playlist"
        ↓
VTMaster carrega cada clipe como novo input no vMix
PlayInput → PreviewInput → Cut (vai ao ar)
Aguarda o clipe terminar
        ↓
Próximo clipe — sem intervenção manual
        ↓
Ao final: remove todos os inputs criados (não afeta câmeras/NDI/etc)
```

### Fluxo de blocos comerciais (NOVO — Fase 2)

```
Operador cadastra anunciantes (Anunciantes)
        ↓
Para cada anunciante, cadastra seus spots (arquivos de mídia) na aba Spots
        ↓
Cria Blocos Comerciais: nome + horário + lista de clientes (quantos spots cada um)
        ↓
Scheduler verifica a cada 30s:
  → 1 minuto antes do horário do bloco, insere os spots na playlist automaticamente
  → Round-robin contínuo: cada chamada avança o índice de onde parou na última
        ↓
Spots aparecem na playlist prontos para veicular
(se sequência estiver ativa, já entram no ar sem intervenção)
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

**Comandos:**
```bash
npm run dev          # Abre o app em modo desenvolvimento
npm run build:dist   # Gera instalador .exe (pasta release/)
```

---

## 3. Estrutura de arquivos

```
spotmaster/
├── electron/
│   ├── main.ts              → Processo principal (IPC, janela, protocolos, diálogos)
│   ├── preload.cts          → Bridge renderer↔main via contextBridge (DEVE ser .cts → .cjs)
│   └── vmix.ts              → Integração HTTP com a API do vMix (polling, parsing XML)
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
│   │   └── AppContext.tsx   → Estado global, motor de playout, scheduler de blocos
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
│       ├── Toolbar/         → Barra de ferramentas principal
│       ├── StatusBar/       → Rodapé: status vMix, item atual, próximo
│       ├── Playlist/
│       │   ├── PlaylistTable.tsx    → Tabela + controles de transporte
│       │   ├── ItemModal.tsx        → Criar/editar item da playlist
│       │   └── VmixInputPanel.tsx   → Painel lateral de inputs do vMix
│       ├── AdBreaks/
│       │   ├── AdBreaksPanel.tsx    → Blocos comerciais + Spots dos clientes (REESCRITO)
│       │   └── AdBreaksPanel.css
│       ├── Clients/         → Cadastro de anunciantes
│       ├── Log/             → Log de veiculação
│       ├── Reports/         → Geração de PDF
│       └── Settings/        → Modal de configurações
│
└── docs/
    ├── DEVELOPMENT.md       → Documentação técnica original (Fase 1)
    └── ESTADO_ATUAL.md      → Este arquivo (estado pós Fase 2)
```

---

## 4. Bugs corrigidos nesta fase

### Bug 1 — Sequência parava no item 2

**Causa:** O `runSequence` original usava um array fixo de itens capturado no início da execução. Quando um item era marcado como `done`, o próximo era buscado no array estático — que não refletia mudanças em tempo real.

**Correção:** Reescrita completa do `runSequence` como `while (!abortRef.current)`. A cada iteração do loop, lê `stateRef.current.playlist` ao vivo, sempre pegando o primeiro `pending` em ordem. Itens adicionados durante a execução (inclusive pelo scheduler de blocos) são detectados automaticamente.

```typescript
// Novo padrão
while (!abortRef.current) {
  const next = [...stateRef.current.playlist]
    .filter(i => i.status === 'pending')
    .sort((a, b) => a.order - b.order)[0]
  if (!next) break
  await playItem(next)  // serial — nunca concorrente
}
```

### Bug 2 — Áudios não avançavam na sequência

**Causa:** O `waitForInputEnd` usava apenas `position >= duration - 500` para detectar o fim do clipe. Para inputs do tipo `AudioFile` no vMix, quando o áudio termina a posição **reseta para 0** (não fica em `duration`). Portanto a condição nunca era verdadeira e o SpotMaster ficava esperando o timeout de 5s extras para cada áudio.

**Correção:** Adicionado o flag `hasSeenRunning` + segunda condição de saída:

```typescript
let hasSeenRunning = false

// EXIT 1: posição chegou ao fim (vídeos/imagens)
if (dur > 0 && pos >= dur - 500) return

// EXIT 2: estava Running, agora parou (AudioFile: state vai Paused ao terminar)
if (hasSeenRunning && currentState !== '' && currentState !== 'Running') return
```

### Bug 3 — Erros silenciosos quebravam a sequência

**Causa:** Qualquer exceção dentro do antigo loop de sequência (vMix offline, timeout de rede) matava a sequência completamente, sem aviso.

**Correção:** Cada `playItem()` dentro do `while` é envolvido em `try/catch`. Erros são logados, o item é marcado como `error`, e a sequência continua para o próximo.

---

## 5. Motor de playout — como funciona

### Princípio: slots não-destrutivos

SpotMaster **nunca sobrescreve** inputs pré-existentes no vMix. Cada arquivo recebe o próximo número disponível:

```
vMix tem inputs 1 (câmera), 2 (NDI), 3 (gráfico)
SpotMaster carrega spot.mp4    → input 4
SpotMaster carrega vinheta.mp4 → input 5
Fim da playlist → remove 4 e 5 (5s de delay)
Inputs 1, 2, 3 intocados
```

### Sequência de corte (ordem obrigatória)

```
1. AddInput → vMix carrega o arquivo
2. pollForNewInput() → aguarda até 10s o novo número aparecer no XML
3. sleep(600ms) → vMix inicializa/decodifica o buffer
4. SetPosition(0) → rebobina ao frame inicial
5. PlayInput(N) → inicia reprodução
6. sleep(300ms)
7. PreviewInput(N) → coloca no Preview
8. sleep(100ms)
9. Cut → Preview vai ao Program (NÃO usar Cut&Input=N — parâmetro ignorado)
10. RemoveInput(anterior) com 2s de delay → cleanup A/B roll
```

### Detecção de fim de clipe (waitForInputEnd)

Polling a cada 300ms do XML do vMix. Três condições de saída:

| Condição | Quando ocorre |
|----------|--------------|
| `pos >= dur - 500` | Vídeos: posição chega perto do fim |
| `hasSeenRunning && state !== 'Running'` | Áudios: state muda de Running → Paused |
| Input desapareceu do XML | vMix removeu o input (caso extremo) |
| Deadline: `duration + 5s` | Fallback de segurança para qualquer situação |

### Controle de abort

`abortRef.current = true` é verificado em **todos** os pontos de espera (antes e depois de cada `await sleep`, antes de cada requisição vMix). Isso garante que `stopPlayback()` interrompe a sequência no menor intervalo possível.

---

## 6. Sistema de Blocos Comerciais — como funciona

### Conceitos

| Conceito | Descrição |
|----------|-----------|
| **ClientSpot** | Um arquivo de mídia cadastrado para um anunciante. Tem título, caminho do arquivo, tipo de mídia e duração. |
| **CommercialBlock** | Um bloco agendado: nome, horário (HH:MM:SS), lista de slots (cliente + nº de spots), flag enabled. |
| **BlockClientSlot** | Dentro de um bloco: "o anunciante X deve ter N spots neste bloco". |
| **SpotRotation** | Dicionário `{ clientId → próximo índice }`. Controla o round-robin contínuo entre execuções. |

### Round-robin contínuo

Cliente com 3 spots [A, B, C] e 2 spots por bloco:

```
1ª execução: rotation[clientId] = 0  →  pega spots[0]=A, spots[1]=B  →  avança para 2
2ª execução: rotation[clientId] = 2  →  pega spots[2]=C, spots[0]=A  →  avança para 1
3ª execução: rotation[clientId] = 1  →  pega spots[1]=B, spots[2]=C  →  avança para 0
```

O índice nunca "reseta do zero" — é contínuo entre dias e entre execuções do mesmo dia.

### Agendamento automático

```typescript
// Verifica a cada 30s
setInterval(() => {
  const nowSecs = hora * 3600 + min * 60 + seg
  blocks.filter(b => b.enabled && b.lastLoadedDate !== today).forEach(b => {
    const blockSecs   = h * 3600 + m * 60 + s
    const triggerSecs = blockSecs - 60  // 1 minuto antes
    if (nowSecs >= triggerSecs && nowSecs < blockSecs) {
      loadBlockIntoPlaylist(b)
    }
  })
}, 30_000)
```

### loadBlockIntoPlaylist(block)

1. Para cada `BlockClientSlot` do bloco:
   - Filtra `clientSpots` do cliente
   - A partir do índice atual em `spotRotation[clientId]`, pega `spotsCount` spots (com wrap)
   - Despacha `ADD_PLAYLIST_ITEM` para cada spot (status `pending`, order sequencial)
   - Avança o índice no mapa de rotação
2. Despacha `MARK_BLOCK_LOADED` com a data de hoje (evita carga dupla no mesmo dia)
3. Despacha `SET_SPOT_ROTATION` com os índices atualizados

### "Carregar Agora" (botão manual)

Limpa o `lastLoadedDate` do bloco e chama `loadBlockIntoPlaylist` imediatamente. Usado quando o operador quer inserir o bloco fora do horário ou repetir a carga no mesmo dia.

---

## 7. Tipos de dados completos

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
  inputName?: string        // input vMix pré-existente (sem filePath)
  type: SpotType            // 'spot' | 'vinheta' | 'programa' | 'bumper' | 'outros'
  status: SpotStatus        // 'pending' | 'playing' | 'done' | 'skipped' | 'error'
  filePath?: string         // arquivo local → AddInput automático
  mediaType?: 'video' | 'image' | 'audio'
  notes?: string
  adBreakId?: string        // referência ao CommercialBlock que gerou este item
}
```

### Client
```typescript
interface Client {
  id: string
  name: string
  contact?: string
  email?: string
  phone?: string
  notes?: string
  createdAt: string
}
```

### ClientSpot (NOVO — Fase 2)
```typescript
interface ClientSpot {
  id: string
  clientId: string          // referência ao Client
  title: string             // ex: "Spot Verão 30s"
  filePath: string          // caminho absoluto do arquivo
  mediaType: 'video' | 'audio' | 'image'
  duration: number          // segundos (detectado automaticamente)
}
```

### CommercialBlock (NOVO — Fase 2)
```typescript
interface CommercialBlock {
  id: string
  name: string              // ex: "Intervalo das 14h"
  scheduledTime: string     // HH:MM:SS
  slots: BlockClientSlot[]  // quais clientes e quantos spots
  enabled: boolean          // false = bloco ignorado pelo scheduler
  createdAt: string
  lastLoadedDate?: string   // YYYY-MM-DD — evita carga dupla no mesmo dia
}
```

### BlockClientSlot (NOVO — Fase 2)
```typescript
interface BlockClientSlot {
  clientId: string
  spotsCount: number        // quantos spots deste cliente entram no bloco
}
```

### SpotRotation (NOVO — Fase 2)
```typescript
interface SpotRotation {
  [clientId: string]: number  // próximo índice (0-based) para o round-robin
}
```

### AdBreak (mantido para compatibilidade)
```typescript
interface AdBreak {
  id: string
  name: string
  items: PlaylistItem[]
  totalDuration: number
  createdAt: string
}
```

### AppSettings
```typescript
interface AppSettings {
  vmixHost: string          // padrão: 'localhost'
  vmixPort: number          // padrão: 8088
  stationName: string
  theme: 'dark' | 'light'
  language: 'pt' | 'en'
  autoConnect: boolean
  autoPlay: boolean
}
```

### PlayLog
```typescript
interface PlayLog {
  id: string
  date: string              // YYYY-MM-DD
  itemId: string
  title: string
  clientId?: string
  clientName?: string
  scheduledTime?: string
  actualTime: string        // HH:MM:SS — horário real de veiculação
  duration: number
  status: 'aired' | 'skipped' | 'error'
  inputName?: string
}
```

---

## 8. Estado global (AppContext)

### AppState completo
```typescript
interface AppState {
  playlist:          PlaylistItem[]
  adBreaks:          AdBreak[]
  clients:           Client[]
  playLog:           PlayLog[]
  settings:          AppSettings
  vmixStatus:        VmixStatus
  activePanel:       string
  isLoading:         boolean
  isSequencePlaying: boolean
  activeItemProgress: { inputNum: string; position: number; duration: number } | null
  // Fase 2:
  commercialBlocks: CommercialBlock[]
  clientSpots:      ClientSpot[]
  spotRotation:     SpotRotation
}
```

### Funções expostas via Context
```typescript
interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  t: Translations
  saveToStorage: (key: string, data: unknown) => void
  playItem: (item: PlaylistItem) => Promise<void>
  playSingleItem: () => void
  startSequence: () => void
  stopPlayback: () => Promise<void>
  loadBlockIntoPlaylist: (block: CommercialBlock) => void  // Fase 2
}
```

### Actions disponíveis

**Playlist:**
`SET_PLAYLIST`, `ADD_PLAYLIST_ITEM`, `UPDATE_PLAYLIST_ITEM`, `DELETE_PLAYLIST_ITEM`, `CLEAR_PLAYLIST`, `REORDER_PLAYLIST`

**Ad Breaks (legacy):**
`ADD_AD_BREAK`, `UPDATE_AD_BREAK`, `DELETE_AD_BREAK`

**Clientes:**
`ADD_CLIENT`, `UPDATE_CLIENT`, `DELETE_CLIENT`

**Log:**
`ADD_LOG`, `SET_LOG`

**vMix / App:**
`SET_VMIX_STATUS`, `SET_SETTINGS`, `SET_SEQUENCE_PLAYING`, `SET_ACTIVE_ITEM_PROGRESS`, `SET_ACTIVE_PANEL`, `SET_LOADING`, `LOAD_ALL`

**Fase 2 — Commercial:**
`ADD_COMMERCIAL_BLOCK`, `UPDATE_COMMERCIAL_BLOCK`, `DELETE_COMMERCIAL_BLOCK`, `MARK_BLOCK_LOADED`
`ADD_CLIENT_SPOT`, `UPDATE_CLIENT_SPOT`, `DELETE_CLIENT_SPOT`
`SET_SPOT_ROTATION`

---

## 9. Persistência de dados

Todos os dados são salvos em `%APPDATA%\SpotMaster\` (Windows):

| Chave | Arquivo JSON | Conteúdo |
|-------|-------------|----------|
| `settings` | settings.json | Configurações do app |
| `playlist` | playlist.json | Playlist atual |
| `adBreaks` | adBreaks.json | Blocos legacy (compatibilidade) |
| `clients` | clients.json | Anunciantes cadastrados |
| `playLog` | playLog.json | Histórico de veiculação |
| `commercialBlocks` | commercialBlocks.json | Grade de blocos comerciais (**Fase 2**) |
| `clientSpots` | clientSpots.json | Spots por anunciante (**Fase 2**) |
| `spotRotation` | spotRotation.json | Índices de rodízio (**Fase 2**) |

**Auto-save:** cada campo tem seu próprio `useEffect` que dispara sempre que o valor muda (exceto durante `isLoading`).

**Startup:** `loadAll()` faz `Promise.all` de todos os 8 arquivos simultaneamente e despacha `LOAD_ALL` uma única vez.

---

## 10. Componente AdBreaksPanel

Reescrito completamente na Fase 2. Possui duas abas:

### Aba "Grade de Blocos"

- Lista todos os `CommercialBlock` ordenados por horário
- Cada card mostra: horário, nome do bloco, duração estimada total, badge "Carregado hoje"
- Linha de slots: `[Nome do Anunciante] × N → próximo spot`
- Botões por card:
  - **↺ Recarregar**: limpa `lastLoadedDate` e chama `loadBlockIntoPlaylist` imediatamente
  - **Toggle ativo/inativo**: alterna `enabled` (bloco desativado é ignorado pelo scheduler)
  - **Editar**: abre o formulário preenchido
  - **Excluir**: remove o bloco
- Botão **Novo Bloco** no header

**Formulário de bloco:**
- Campo nome + campo horário (input type=time) + toggle ativo
- Lista de slots: select de anunciante + campo numérico de quantidade
- Botão "Adicionar Cliente" acrescenta uma nova linha de slot
- Salvar → `ADD_COMMERCIAL_BLOCK` ou `UPDATE_COMMERCIAL_BLOCK`

### Aba "Spots dos Clientes"

- Lista todos os anunciantes cadastrados, expansível por clique
- Cada anunciante mostra seus spots com: número, ícone de tipo, título, duração
- Botão **+ Spot** no header de cada anunciante
- Botões de editar e excluir por spot

**Formulário de spot (inline):**
- Campo título
- File picker: botão "Procurar..." chama `browseVideoFile()`
  - Preenche título automaticamente pelo nome do arquivo
  - Detecta tipo de mídia pela extensão
  - Para vídeo e áudio: detecta duração via `local-media://` + HTML5 (timeout 10s)
  - Para imagem: duração fica 10s padrão
- Campo duração em segundos (editável manualmente, preenchido automaticamente)
- Salvar → `ADD_CLIENT_SPOT` ou `UPDATE_CLIENT_SPOT`

---

## 11. Integração vMix

### Endpoint
```
GET http://{host}:{port}/api/?{Function=X&Input=N&Value=V}
GET http://{host}:{port}/api/   ← sem params → retorna XML de status completo
```

> **Atenção:** a barra antes do `?` é obrigatória: `/api/?Function=...`

### Funções utilizadas

| Função | Parâmetros | Uso |
|--------|-----------|-----|
| `AddInput` | `Value=Video\|path` | Carrega vídeo |
| `AddInput` | `Value=Image\|path` | Carrega imagem |
| `AddInput` | `Value=AudioFile\|path` | Carrega áudio |
| `SetPosition` | `Input=N&Value=0` | Rebobina |
| `PlayInput` | `Input=N` | Inicia reprodução |
| `PreviewInput` | `Input=N` | Envia para Preview |
| `Cut` | *(sem parâmetros)* | Corta Preview → Program |
| `RemoveInput` | `Input=N` | Remove input |

### XML de status — campos relevantes para o motor

```xml
<input number="4" type="Video" state="Running" duration="30000" position="15423" />
```

- `state`: `Running` = tocando, `Paused` = parado/terminado
- `duration`: em milissegundos
- `position`: em milissegundos. **Para AudioFile: reseta para 0 ao terminar** (não fica em `duration`)

### Polling duplo

| Polling | Intervalo | Ativo quando |
|---------|-----------|-------------|
| Normal | 2s | vMix conectado |
| Fast | 500ms | Durante execução ativa |

O fast polling é ativado por `vmixStartFastPolling()` antes de `startSequence()` ou `playSingleItem()`, e desativado por `vmixStopFastPolling()` ao final.

---

## 12. Funcionalidades — checklist completo

### ✅ Fase 1 — Implementado e funcionando

**Playlist:**
- [x] Criar, editar, excluir itens
- [x] Reordenar com botões ▲▼
- [x] Drag & drop de inputs do vMix para posição específica
- [x] Coluna Término: estimativa ao vivo antes do play, ancorada após iniciar
- [x] Exportar/importar playlist como JSON

**Mídia:**
- [x] Selecionar arquivo via diálogo nativo (vídeo, imagem, áudio)
- [x] Detecção automática do tipo pela extensão
- [x] Leitura de duração via `local-media://` + HTML5
- [x] Auto-preenchimento de título pelo nome do arquivo

**Veiculação:**
- [x] Slots não-destrutivos (não afeta câmeras/NDI/gráficos)
- [x] Sequência completa automática (while loop lendo playlist ao vivo)
- [x] Corte correto: `PlayInput → PreviewInput → Cut`
- [x] Suporte a vídeo, imagem e áudio
- [x] Limpeza automática 5-10s após o fim
- [x] Autoplay por `scheduledTime`
- [x] Try/catch por item: erros não matam a sequência

**Motor de detecção de fim:**
- [x] Vídeos: por posição (`pos >= dur - 500`)
- [x] Áudios: por mudança de state (`Running → Paused`)
- [x] Fallback: deadline `duration + 5s`
- [x] Abort imediato ao `stopPlayback()`

**Painel vMix:**
- [x] Lista inputs com ícone e estado
- [x] Filtro por nome/número/tipo
- [x] Drag & drop para playlist
- [x] Botão `+` para adicionar ao final

**Log e Relatórios:**
- [x] Log automático com horário real vs. agendado
- [x] Relatório diário PDF
- [x] Relatório por anunciante com período
- [x] Exportar CSV

**Interface:**
- [x] Tema dark/light
- [x] Bilíngue PT/EN
- [x] Status bar com item atual/próximo

### ✅ Fase 2 — Implementado nesta sessão

**Correções de motor:**
- [x] Sequência não para mais no item 2 (while loop ao vivo)
- [x] Áudios avançam corretamente na sequência (detecção por state change)
- [x] Erros por item não quebram a sequência (try/catch)

**Sistema de spots por anunciante:**
- [x] Cadastro de spots por cliente (arquivo + duração + tipo)
- [x] Detecção automática de duração ao selecionar arquivo
- [x] Persistência em `clientSpots.json`

**Sistema de blocos comerciais com agendamento:**
- [x] Criação de blocos com horário, nome, slots (cliente × quantidade)
- [x] Toggle ativo/inativo por bloco
- [x] Scheduler: 30s de verificação, carga 1 minuto antes do horário
- [x] Round-robin contínuo entre execuções (índice nunca reseta)
- [x] Proteção contra carga dupla no mesmo dia (`lastLoadedDate`)
- [x] Botão "Recarregar Agora" para carga manual forçada
- [x] Indicador "Carregado hoje" no card do bloco
- [x] Exibe próximo spot de cada cliente no card
- [x] Persistência em `commercialBlocks.json`, `spotRotation.json`

---

## 13. O que ainda não está implementado

Itens planejados para fases futuras, por ordem de prioridade sugerida:

### Alta prioridade

| Item | Descrição |
|------|-----------|
| **Spots por cliente no ClientsPanel** | A aba de anunciantes ainda não exibe a seção de spots do cliente. Os spots são gerenciados exclusivamente pelo AdBreaksPanel → Aba "Spots dos Clientes". |
| **Confirmação de exclusão de anunciante** | Ao excluir um anunciante, seus spots cadastrados ficam "órfãos" em `clientSpots` (sem cleanup automático). |

### Média prioridade

| Item | Descrição |
|------|-----------|
| **Drag & drop na playlist** | Reordenar itens por arrastar, além dos botões ▲▼ atuais. |
| **Importação CSV** | Carregar playlist ou spots a partir de planilha. |
| **Progresso visual durante sequência** | Barra de progresso por item está implementada internamente via `SET_ACTIVE_ITEM_PROGRESS`, mas precisa de UI visível na PlaylistTable. |
| **Filtro de dias nos blocos** | Hoje os blocos disparam todo dia. Futuramente: dias da semana selecionáveis. |
| **Múltiplos blocos por horário** | Suporte a mais de um bloco com o mesmo `scheduledTime`. |

### Baixa prioridade

| Item | Descrição |
|------|-----------|
| **Sistema de licenciamento** | Proteção de uso por CNPJ/chave de ativação. |
| **Sincronização via rede** | Múltiplos operadores editando a grade simultaneamente. |
| **Preview de mídia** | Pré-visualizar o clipe antes de adicionar à playlist. |
| **Tempo real no log** | Atualização ao vivo do log durante a sequência. |
