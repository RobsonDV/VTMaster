# SpotMaster — Estado Atual do Projeto
> Documento atualizado em 06/05/2026 — Versão após Fase 3 (A/B Slot Engine + Blindagens + UX)

---

## Índice

1. [O que o SpotMaster faz](#1-o-que-o-spotmaster-faz)
2. [Stack técnico](#2-stack-técnico)
3. [Estrutura de arquivos](#3-estrutura-de-arquivos)
4. [Bugs corrigidos — Fase 3](#4-bugs-corrigidos--fase-3)
5. [A/B Slot Engine — arquitetura](#5-ab-slot-engine--arquitetura)
6. [Motor de playout — como funciona](#6-motor-de-playout--como-funciona)
7. [Sistema de Blocos Comerciais — como funciona](#7-sistema-de-blocos-comerciais--como-funciona)
8. [Tipos de dados completos](#8-tipos-de-dados-completos)
9. [Estado global (AppContext)](#9-estado-global-appcontext)
10. [Persistência de dados](#10-persistência-de-dados)
11. [Componentes alterados na Fase 3](#11-componentes-alterados-na-fase-3)
12. [Integração vMix](#12-integração-vmix)
13. [Funcionalidades — checklist completo](#13-funcionalidades--checklist-completo)
14. [O que ainda não está implementado](#14-o-que-ainda-não-está-implementado)

---

## 4. Bugs corrigidos — Fase 3

### 4.1 Tracks sendo puladas (3 causas)

**Problema:** Faixas eram puladas imediatamente na sequência, especialmente arquivos de áudio.

**Causa 1 — `waitForInputEnd` disparava com `dur=100` falso:**
- A API do vMix retorna `dur=100` temporariamente durante o carregamento do input
- A condição era `dur > 0 && pos >= dur - 500` → `dur - 500 = -400` → `pos >= -400` sempre verdadeiro
- **Correção:** Adicionada guarda `dur > 500` antes de qualquer verificação de posição (EXIT 1)

**Causa 2 — EXIT 2 disparava em transição momentânea de estado:**
- Qualquer poll não-Running (buffering, corte) disparava saída imediata
- **Correção:** `nonRunningCount >= 2` — exige 2 polls consecutivos não-Running

**Causa 3 — EXIT 3 disparava em posição zero inicial:**
- Input recém carregado tem `pos=0` na 1ª consulta
- **Correção:** `lowPosCount >= 2` — exige 2 polls consecutivos com posição próxima de zero
- Também adicionado `lastHighPos` tracking para reset correto do contador

**Causa 4 — Race condition em `runSequence`:**
- Após `await playItem(next)`, o React não havia processado o dispatch `'done'`
- O loop lia o mesmo item do stateRef e tocava novamente
- **Correção:** `await sleep(50)` após cada `playItem` em `runSequence`

### 4.2 vMix acumulando inputs sem limite

**Problema:** Cada `playItem` criava um novo `AddInput` permanente no projeto vMix.

**Causa:** `createdInputNumsRef[]` crescia ilimitado; a remoção era frágil.

**Correção:** Ver seção 5 — A/B Slot Engine.

### 4.3 AdBreakSelectModal vazia

**Problema:** Modal de seleção de bloco comercial aparecia sem conteúdo.

**Causa:** Usava `state.adBreaks` (tipo `AdBreak[]` legado) em vez de `state.commercialBlocks` (`CommercialBlock[]`).

**Correção:** Componente reescrito para usar `commercialBlocks` + `loadBlockIntoPlaylist`.

### 4.4 `playSingleItem` podia disparar reprodução dupla

**Problema:** Sem guarda de `isSequencePlaying`, clicar duas vezes disparava duas reproduções paralelas.

**Correção:** Adicionado `dispatch({ type: 'SET_SEQUENCE_PLAYING', payload: true })` no início e `false` no `.then()` de `playSingleItem`.

### 4.5 `activePanel` não era persistido

**Problema:** Ao reiniciar o app, sempre abria na aba padrão (Playlist).

**Correção:** `LOAD_ALL` carrega `activePanel` de storage; `useEffect` persiste qualquer mudança.

---

## 5. A/B Slot Engine — arquitetura

### Conceito

Em vez de criar inputs ilimitados no vMix, o SpotMaster mantém exatamente **2 slots fixos** (A e B) que se alternam durante a sequência. Isso mantém o projeto vMix limpo.

### Refs de controle

```typescript
const slotARef = useRef<number | null>(null)   // número do input vMix ocupando slot A
const slotBRef = useRef<number | null>(null)   // número do input vMix ocupando slot B
const activeSlotRef = useRef<'A' | 'B' | 'none'>('none')
```

### Fluxo por item

```
Item 1:
  activeSlot = 'none' → targetSlot = 'A'
  AddInput → num=42 → slotA=42
  PlayInput 42 → PreviewInput 42 → Cut
  activeSlot = 'A'
  slotToRelease = null (nada a liberar)

Item 2:
  activeSlot = 'A' → targetSlot = 'B'
  AddInput → num=43 → slotB=43
  PlayInput 43 → PreviewInput 43 → Cut
  setTimeout(1500ms): RemoveInput slotA (42) → slotA=null
  activeSlot = 'B'

Item 3:
  activeSlot = 'B' → targetSlot = 'A'
  AddInput → num=44 → slotA=44
  PlayInput 44 → PreviewInput 44 → Cut
  setTimeout(1500ms): RemoveInput slotB (43) → slotB=null
  activeSlot = 'A'
```

### cleanupInputs (ao parar)

Remove slotA e slotB, reseta todos os refs. Não remove inputs de câmera/NDI.

### Inputs com `inputName` (nomeados)

Inputs já existentes no vMix (referenciados por nome, não número) não passam pelo A/B engine — seguem o fluxo `SetPosition` → `PlayInput` → `PreviewInput` → `Cut` normalmente, sem `AddInput`/`RemoveInput`.

---

## 11. Componentes alterados na Fase 3

### `AppContext.tsx`

- A/B Slot Engine (slotA/B/activeSlot refs)
- `cleanupInputs`: remove apenas slotA e slotB
- `playItem`: lógica A/B completa
- `stopPlayback`: reseta `activeSlotRef`
- `playSingleItem`: guard `SET_SEQUENCE_PLAYING`
- `waitForInputEnd`: 3 blindagens (dur>500, 2x non-running, 2x low-pos)
- `runSequence`: `sleep(50)` anti-race
- `LOAD_ALL`: carrega `activePanel`
- `useEffect`: persiste `activePanel`

### `AdBreakSelectModal.tsx`

Reescrito para usar `commercialBlocks` + `loadBlockIntoPlaylist`. Exibe blocos com horário agendado, badge "✓ Carregado hoje" e contagem de spots.

### `LogPanel.tsx`

Novos filtros:
- **Intervalo de datas** (De / Até) substituindo filtro de data única
- **Busca por título** (campo de texto)
- **Filtro de status** (aired / skipped / error)
- **Filtro por anunciante** (select)
- Botão "Limpar filtros" aparece quando qualquer filtro está ativo

### `ClientsPanel.tsx`

Campo de busca por nome de anunciante adicionado ao cabeçalho da lista. Filtragem em tempo real.

### `VmixInputPanel.tsx`

Badge "✓ na playlist" em inputs que já estão presentes na playlist. Item recebe classe CSS `vip-in-playlist` com borda/fundo destacados.

### `AdBreaksPanel.tsx`

Badge **"⚠ Não disparou"** (laranja) exibido em blocos cujo horário agendado já passou no dia corrente e que não foram carregados hoje (`lastLoadedDate !== today`).

---



## 1. O que o SpotMaster faz

O SpotMaster é um software desktop para **emissoras de TV** controlarem a veiculação de spots comerciais via integração com o **vMix** (software de produção ao vivo).

### Fluxo principal

```
Operador monta playlist
        ↓
Clica "Iniciar Playlist"
        ↓
SpotMaster carrega cada clipe como novo input no vMix
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
