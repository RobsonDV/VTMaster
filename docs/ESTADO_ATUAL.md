# VTMaster — Estado Atual do Projeto

> Atualizado em **15/05/2026** — Versão **5.2.0** — Fases 1–13 + Comercial Pro + Grafismos + Banco de Mídia + On Air + Command Palette + Saidas vMix + AutoProg misto AudioPro/VideoPro

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
18. [Comercial Pro — Fase 13](#18-comercial-pro--fase-13)
19. [Correção crítica: Autoplay Comercial](#19-correção-crítica-autoplay-comercial)
20. [Melhorias v5.2.0](#20-melhorias-v520)
21. [Fase 2 — Grafismos (v5.2.0)](#21-fase-2--grafismos-v520)
22. [Fases 7 e 7b — Banco de Mídia, On Air e Command Palette](#22-fases-7-e-7b--banco-de-mídia-on-air-e-command-palette-v520)
23. [Complementos 15/05/2026](#23-complementos-15052026)
24. [Backlog](#24-backlog)

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

#### 9a. Blocos musicais: fallback manual de 1 placeholder
Historicamente, `generatePlaylistFromGrid` passou a criar **exatamente 1 slot vazio** por bloco musical quando não havia automação configurada, em vez do cálculo antigo por duração que criava 10–20 slots. Esse comportamento continua como fallback.

Estado atual: se o bloco musical tiver AutoProg atribuída, o app tenta gerar músicas reais via `generateMusicBlockEngine`; se não houver atribuição, sequência, arquivos ou resultado, cai no placeholder manual.

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
Cada `bloco_musical` pode seguir dois caminhos:
- **Com AutoProg atribuída**: gera uma lista de músicas com `filePath`, `duration = 0` inicialmente, e depois tenta ler as durações reais.
- **Sem AutoProg ou sem resultado**: gera **1 slot vazio** na programação (placeholder). O operador adiciona músicas manualmente via [📁] ou [+ Adicionar música].

Atenção: a UI da AutoProg oferece objetivo por "Duração em minutos" e o motor agora soma durações conhecidas/cacheadas para parar no alvo. Ver a seção "Correção atual — AutoProg e tempos".

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
  campaignId?: string        // Campaign.id — propagado automaticamente pelo expandBlockItems
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
  manuallyAdded?: boolean    // true quando adicionado via UI (não veio da grade)
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

### CommercialBlockItem — atualizado em Fase 13

```typescript
interface CommercialBlockItem {
  id: string
  order: number
  type: 'spot_client' | 'vmix_action' | 'vmix_input'
  title?: string
  // spot_client:
  clientId?: string
  spotsCount?: number
  campaignId?: string   // ← NOVO: Campaign.id quando inserido por distribuição automática
                        // O motor de playout valida se a campanha ainda é válida antes de veicular.
                        // Campanha expirada/pausada → item silenciosamente ignorado no expandBlockItems.
  // vmix_action:
  vmixAction?: VmixActionItem
  // vmix_input:
  inputName?: string
  duration?: number
}
```

### PlayLog — atualizado em Fase 13

```typescript
interface PlayLog {
  id: string
  date: string              // YYYY-MM-DD
  itemId: string
  title: string
  clientId?: string
  clientName?: string
  campaignId?: string       // ← NOVO: propagado do PlaylistItem — permite relatório por campanha
  scheduledTime?: string
  actualTime: string
  duration: number
  status: 'aired' | 'skipped' | 'error'
  inputName?: string
  notes?: string
}
```

### Tipos do Comercial Pro (Fase 13)

```typescript
// ─── Segmentos de mercado ─────────────────────────────────────────────
interface Segment {
  id: string
  name: string              // Ex: "Automóvel", "Banco", "Saúde"
  description?: string
  createdAt: string
}

// ─── Faixas de programação ────────────────────────────────────────────
interface ProgramWindow {
  id: string
  name: string              // Ex: "Jornal das 12h"
  daysOfWeek: number[]      // 0=Dom...6=Sáb
  timeFrom: string          // HH:MM
  timeTo: string            // HH:MM
  notes?: string
  createdAt: string
}

// ─── Campanhas comerciais ─────────────────────────────────────────────
type CampaignModality = 'standard' | 'rotativo'
type CampaignStatus   = 'active' | 'paused' | 'expired' | 'completed'
type CampaignPriority = 1 | 2 | 3  // 1=alta, 2=média, 3=baixa

interface Campaign {
  id: string
  clientId: string
  name: string
  modality: CampaignModality
  startDate: string           // YYYY-MM-DD
  endDate: string             // YYYY-MM-DD
  totalSpots: number          // quantidade contratada
  spotsPerDay?: number        // limite diário (0 ou undefined = sem limite)
  daysOfWeek?: number[]       // dias permitidos (undefined = todos)
  segmentId?: string          // Segment.id — para regra de concorrentes
  programWindowIds?: string[] // ProgramWindow.id[] — janelas elegíveis (vazio = todos)
  priority: CampaignPriority
  status: CampaignStatus
  notes?: string
  createdAt: string
}
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
  preloadMinutes: number        // minutos antes para pré-carregar (padrão: 5) — agora USADO
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
  playlist:             PlaylistItem[]
  dateSchedules:        Record<string, PlaylistItem[]>  // YYYY-MM-DD → programação do dia
  weeklyGrid:           WeeklyProgramGrid               // template semanal Dom-Sáb
  clients:              Client[]
  clientSpots:          ClientSpot[]
  commercialBlocks:     CommercialBlock[]
  spotRotation:         SpotRotation
  campaigns:            Campaign[]        // ← Fase 13
  segments:             Segment[]         // ← Fase 13
  programWindows:       ProgramWindow[]   // ← Fase 13
  playLog:              PlayLog[]
  settings:             AppSettings
  vmixStatus:           VmixStatus
  vmixCommandLog:       VmixCommandLog[]
  activePanel:          string
  isLoading:            boolean
  isSequencePlaying:    boolean
  deletedScheduleSlots: Record<string, DeletedScheduleSlot[]>
  mediaDurationCache:   Record<string, number>
  musicStyles:          MusicStyle[]
  musicSequences:       MusicSequence[]
  autoBlocoAssignments: AutoBlocoAssignment[]
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

### Refs de controle — completos

```typescript
activeInputRef            // GUID do input atualmente no ar
preloadedInputRef         // { guid, filePath } do próximo input já carregado
spotmasterGuidsRef        // Set<string> — todos GUIDs desta sessão (para cleanup)
abortRef                  // true quando stopPlayback() foi chamado
scheduleInterruptRef      // true quando abort veio do scheduler (retoma)
scheduleInterruptTimeRef  // HH:MM:SS do último trigger do scheduler de programas
commInterruptTimeRef      // HH:MM:SS do scheduler de comerciais (SEPARADO — Fase 13 fix)
disparoInterruptRef       // true quando abort veio do Disparo (retoma)
activeQueueRef            // 'playlist' | 'schedule'
sessionStartRef           // HH:MM:SS de quando o app abriu (anti-stale)
schedulerFiringRef        // mutex entre os dois schedulers (evita execução simultânea)
minOrderRef               // high-water mark — comercial avança sem marcar musicais como skipped
stopAfterCurrentRef       // quando true: para após o item atual (Stop Next)
lastFastPosRef            // posição por input — evita regressão na barra de progresso
```

### useEffects críticos em AppContext

| useEffect | Deps | O que faz |
|-----------|------|-----------|
| stateRef sync | `[state]` | `stateRef.current = state` após cada render |
| Auto-load today | `[isLoading]` | Gera grade do dia se não existe ao iniciar |
| Midnight watcher | `[isLoading, ...]` | Detecta virada de dia e gera próximo dia |
| Auto-sync comerciais | `[commercialBlocks]` | Re-sincroniza grade quando blocos são alterados (v3.1) |
| Autoplay scheduler geral | `[isLoading, startSequence, startSchedule]` | A cada 1s: itens sem adBreakId com scheduledTime vencido |
| Autoplay scheduler comercial | `[isLoading, startSchedule]` | A cada 1s: itens com adBreakId vencidos em dateSchedules |
| **Preloader de blocos** | `[isLoading, expandBlockItems, dispatch]` | A cada 20s: lê commercialBlocks direto, injeta em dateSchedules na janela de preloadMinutes ← Fase 13 fix |
| Trigger keyboard | `[triggerEnabled, triggerKey, disparo]` | Registra/cancela globalShortcut |
| MIDI listener | `[triggerEnabled, triggerKey, disparo]` | Web MIDI API |
| Fast status listener | `[]` | Barra de progresso via fast polling vMix |
| vMix status listener | `[]` | Status normal vMix |
| vMix command log listener | `[]` | Log técnico de comandos |
| Update status listener | `[]` | Auto-update via electron-updater |

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
| `playLog` | Histórico de veiculação com `campaignId` por spot |
| `activePanel` | Último painel ativo |
| `campaigns` | Campanhas do Comercial Pro ← Fase 13 |
| `segments` | Segmentos de mercado ← Fase 13 |
| `programWindows` | Faixas de programação ← Fase 13 |
| `vmixCommandLog` | Log técnico de comandos vMix |
| `deletedScheduleSlots` | Deleções intencionais (impede re-geração) |
| `mediaDurationCache` | Cache de durações por filePath |
| `musicStyles` | Estilos musicais do AutoProg |
| `musicSequences` | Sequências musicais do AutoProg |
| `autoBlocoAssignments` | Atribuições AutoProg por dia/bloco |

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

### Fase 12 — v5.0.0 — Stop Next, Correção de Comercial e Duração Eager

#### 12a. Botão "Stop Next"
- Novo botão **Stop Next** na toolbar da Programação (ao lado de Next e Stop).
- Quando ativado (estado _armado_): a sequência termina normalmente o item atual e para ao final — sem cortar o áudio/vídeo na metade.
- Visual: borda e texto em âmbar com animação `pulse-stop-armed` enquanto armado; clique novamente cancela.
- Nova ref `stopAfterCurrentRef` em `AppContext.tsx`. Nova função `setStopAfterCurrent(bool)` exposta via Context.
- Ao parar a sequência por qualquer outro meio (Stop, fim natural), o flag é resetado automaticamente.

#### 12b. Correção de continuidade após bloco comercial (minOrderRef)
- Problema anterior: ao disparar um bloco comercial pelo scheduler, itens musicais de ordem inferior ao comercial eram marcados como `skipped`, impedindo a sequência de continuar após o comercial.
- Solução: nova ref `minOrderRef` (high-water mark). Quando o scheduler dispara um comercial (`adBreakId`), **nenhum item musical é tocado ou pulado** — apenas o ponteiro avança para `max(order dos itens skipped do comercial)`.
- Após o bloco comercial, a sequência retoma a partir do próximo item de maior ordem, nunca voltando a itens anteriores.
- `minOrderRef` é resetado ao parar a sequência e ao iniciar do zero.

#### 12c. Leitura eager de duração de arquivo na geração de grade
- Problema anterior: `generatePlaylistFromGrid` criava todos os itens AutoProg com `duration = 0`. O cabeçalho do bloco (total de tempo) só aparecia correto depois que o `useEffect` lazy de `DaySchedulePanel` terminava de ler os arquivos — e nunca persistia.
- Solução atual: leitura centralizada em `src/utils/mediaDuration.ts`, usando o protocolo `local-media:///`.
- `readMediaDurationBatch` lê em lote com concorrência limitada, evitando criar dezenas de elementos `<video>/<audio>` simultâneos.
- `generatePlaylistFromGrid` chama o batch com `{ concurrency: 4, timeoutMs: 15_000 }` antes do `dispatch SET_DATE_SCHEDULE`.
- `DaySchedulePanel` mantém fallback lazy com pool limitado para itens que ainda ficaram sem duração.
- O botão manual "Ler Tempos" usa `{ concurrency: 2, timeoutMs: 20_000 }`.
- Durações lidas são persistidas em `mediaDurationCache` por `filePath` normalizado.
- Quando o metadata do Chromium falha, expira ou retorna 0, `src/utils/mediaDuration.ts` aciona o fallback nativo `window.spotmaster.readMediaDuration(filePath)`.
- O fallback nativo fica em `electron/main.ts` e lê MP4/MOV/M4V/M4A/3GP pelo contêiner ISO BMFF (`mvhd`). Isso cobre arquivos que existem no disco mas não entregam duração via `<video>/<audio>`.
- Observação importante: a documentação antiga citava `Promise.allSettled`; isso **não é mais o fluxo atual** no código.
- Resultado esperado: cabeçalho do bloco exibe total correto quando a leitura termina. Se muitos itens forem gerados ou arquivos demorarem no metadata, a geração pode parecer lenta porque ainda aguarda a leitura antes do dispatch.

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

### ✅ Fase 12 — v5.0.0

- [x] **Stop Next**: botão na toolbar da Programação — termina item atual e para; estado _armado_ com pulse âmbar; cancela com segundo clique ou stop manual
- [x] **minOrderRef (high-water mark)**: ao disparar comercial, itens musicais anteriores NÃO são marcados como skipped — sequência avança para maior order dos itens do comercial e retoma a partir daí
- [x] **Leitura eager de duração**: `generatePlaylistFromGrid` lê durações reais dos arquivos via `readMediaDurationBatch` com pool limitado antes do dispatch
- [x] **`readMediaDuration`, `readMediaDurationBatch`, `detectMediaType` e `toLocalMediaUrl`** centralizados em `src/utils/mediaDuration.ts`
- [x] **`mediaDurationCache` persistido**: cache por `filePath` normalizado para não reler metadata em toda geração
- [x] **AutoProg por duração real**: `targetMode:'duration'` usa `getDuration(filePath)` e para ao atingir `targetValue * 60`
- [x] **`setStopAfterCurrent`** exposta via Context e consumida por `DaySchedulePanel`
- [x] **`stopAfterCurrentRef` e `minOrderRef`** resetados em `stopPlayback()` e no cleanup de `runSequence`

---

## 18. Comercial Pro — Fase 13

> Implementado em **14/05/2026**. Versão **5.1.6**. Esta é a fase de maior impacto comercial do produto — transforma o VTMaster de um sistema de blocos simples em um sistema completo de gerenciamento de contratos de publicidade.

### Motivação

Antes da Fase 13, o VTMaster tinha:
- Cadastro de anunciantes e spots
- Blocos comerciais com round-robin
- Relatório diário e por anunciante

Faltava:
- Controle de **contrato** (início, fim, quantidade contratada)
- **Distribuição automática** de clientes nos blocos certos
- **Regras de concorrência** (segmentos de mercado)
- **Faixas de programação** para definir onde o comercial pode veicular
- **Modalidade Rotativo** (cliente percorre todos os blocos progressivamente)
- Relatório e log por campanha

### O que foi construído

#### 18.1. Novos tipos de dados

Três novos modelos persistidos:

| Tipo | Propósito |
|------|-----------|
| `Segment` | Categoria de mercado (Automóvel, Banco, Saúde…). Impede concorrentes no mesmo bloco. |
| `ProgramWindow` | Faixa de programação com nome, dias da semana e horário. Define onde uma campanha pode veicular. |
| `Campaign` | Contrato comercial: cliente, modalidade, datas, quantidade, segmento e programas elegíveis. |

`CommercialBlockItem` ganhou campo `campaignId?` — marca itens inseridos por distribuição automática.

`PlaylistItem` e `PlayLog` ganharam `campaignId?` — rastrea o spot da campanha até o log de veiculação.

#### 18.2. Painel "Comercial Pro" — 3 abas

**Aba Campanhas:**
- Lista de campanhas com barra de progresso (veiculados/contratados/%)
- Filtro por status (ativa/pausada/expirada/concluída) e por anunciante
- Alerta visual de conflito de segmento nos blocos
- Badge de expiração próxima (≤ 7 dias)
- Modalidade Rotativo indicada com ícone e cor roxa
- Botão **Distribuir** (campanhas padrão ativas) — abre modal de confirmação

**Aba Segmentos:**
- CRUD de categorias de mercado (nome + descrição)
- Usados como regra de concorrência: dois clientes do mesmo segmento não entram no mesmo bloco

**Aba Programas / Faixas:**
- CRUD de janelas horárias (nome + dias da semana + HH:MM–HH:MM)
- Exemplo: "Jornal das 12h" → Seg-Sex 12:00–13:00
- Selecionadas na campanha para restringir em quais blocos o cliente pode veicular

#### 18.3. Modalidade Padrão vs. Rotativo

| | Padrão | Rotativo |
|--|--------|----------|
| Distribuição | Botão "Distribuir" → insere cliente nos blocos elegíveis | Automática, calculada por data — sem ação do operador |
| Blocos elegíveis | Programas selecionados (ou todos se vazio) | Todos os blocos habilitados |
| Spots por dia | `spotsPerDay` limita quantos blocos recebem o cliente | Sempre 1 bloco por dia |
| Lógica | Randomização justa quando blocos > limite | `daysElapsed % totalBlocks` |
| Segmento | Respeitado | Ignorado (modalidade especial) |
| Template | Inserido no CommercialBlock.items com `campaignId` | Injetado dinamicamente pelo motor no momento da expansão |

**Rotativo — como a posição é calculada:**
```
daysElapsed = daysBetween(campaign.startDate, today)
targetIndex = daysElapsed % totalEnabledBlocks
targetBlock = allEnabledBlocks.sortByTime()[targetIndex]
```
Stateless e determinístico: qualquer dia pode ser recalculado sem guardar estado.

#### 18.4. Gate de campanha no motor de playout (`expandBlockItems`)

Esta é a peça mais importante da Fase 13. O `expandBlockItems` agora valida cada item antes de incluí-lo na playlist:

```
Para cada CommercialBlockItem do tipo spot_client:
  → Se item.campaignId está definido:
      → Busca a campanha pelo id
      → Se campanha não existe, ou status ≠ 'active', ou hoje < startDate, ou hoje > endDate:
          → SKIP — item não entra na playlist
  → Se item.campaignId não está definido (inserido manualmente):
      → Comportamento normal (sem gate)
```

**Consequência prática:** o operador cadastra a campanha, distribui nos blocos uma vez, e o sistema cuida sozinho de parar de veicular quando a campanha expirar. Não precisa remover manualmente do bloco ao término do contrato.

**Renovação:** editar a campanha e estender `endDate` → spots voltam ao ar no próximo dia.

#### 18.5. Distribuição automática (modalidade Padrão)

```
1. Operador clica "Distribuir" na campanha
2. Modal mostra blocos elegíveis com base em:
   - programWindowIds → blocos cujo scheduledTime cai dentro do horário dos programas
   - Se programWindowIds vazio → todos os blocos habilitados
3. Remove blocos onde o cliente já está (sem duplicar)
4. Se blocos elegíveis > spotsPerDay → shuffle aleatório, pega os primeiros N
5. Operador vê a lista e confirma
6. Sistema insere CommercialBlockItem { clientId, campaignId, spotsCount: 1 } em cada bloco alvo
7. Salva commercialBlocks no storage
```

**Regra de concorrência:** futuro — a detecção visual já está no painel (alerta de conflito), mas o bloqueio automático na distribuição ainda não está implementado (ver backlog).

#### 18.6. Visual no painel de Blocos Comerciais

Itens inseridos por campanha mostram ícone 🔊 (Megaphone) em roxo e label "campanha" em vez de "spots". O operador identifica imediatamente o que é automático vs. manual.

#### 18.7. Log e Relatórios por campanha

- **Log de Veiculação:** nova coluna "Campanha" + filtro por campanha no header. CSV exportado inclui a coluna.
- **Relatórios PDF:** novo tipo "Relatório por Campanha" com painel de progresso (contratados / veiculados / restantes / % conclusão). O PDF inclui linhas de resumo do contrato antes da tabela de spots.

#### 18.8. Persistência

Três novas chaves em `BACKUP_KEYS` (`electron/main.ts`):
- `'campaigns'`
- `'segments'`
- `'programWindows'`

Incluídas em todos os backups automáticos e na carga inicial (`LOAD_ALL`).

---

## 19. Correção crítica: Autoplay Comercial

> Implementado em **14/05/2026**. Bug relatado pelo operador: blocos comerciais não disparavam automaticamente no horário configurado — era necessário acionar manualmente.

### Diagnóstico — 3 bugs encontrados

#### Bug 1 — Gap arquitetural (causa principal)

O scheduler de `autoplayComerciais` lia **`dateSchedules[today()]`** — itens já expandidos da Programação do Dia. Se o operador não gerou a programação do dia, `dateSchedules` estava vazio e o scheduler não encontrava nada.

Os blocos em `commercialBlocks` existiam, estavam habilitados e com horário correto, mas **nenhum código os movia para a fila automaticamente**. O `preloadMinutes` estava nas configurações mas nunca era lido por nenhum trecho de código.

#### Bug 2 — `scheduleInterruptTimeRef` compartilhado entre schedulers

O scheduler de `autoPlay` (programas) e o scheduler de `autoplayComerciais` compartilhavam o mesmo `scheduleInterruptTimeRef`. Quando ambos tinham itens no mesmo horário (ex: programa e comercial ambos às `12:00:00`), o primeiro scheduler a rodar definia o ref com `'12:00:00'` e o segundo scheduler verificava `scheduleInterruptTimeRef.current === triggerTime` e retornava sem fazer nada. O comercial era silenciosamente bloqueado.

#### Bug 3 — `sessionStartRef` muito restritivo

O check `triggerTime < sessionStartRef.current` ignorava qualquer bloco cujo horário fosse anterior à abertura do app. Se o operador abria o app às `09:02` e o bloco estava às `09:00`, o comercial nunca disparava — sequer dentro de uma janela de minutos.

### Correções aplicadas

#### Correção 1 — Scheduler de pré-carregamento (fix principal)

Novo `useEffect` rodando a cada **20 segundos** que lê `commercialBlocks` diretamente:

```
Para cada bloco habilitado e com scheduledTime configurado:
  → Se block.lastLoadedDate === today → skip (já carregado)
  → Se dia da semana não compatível → skip
  → Calcula janela: [scheduledTime - preloadMinutes, scheduledTime + 10min grace]
  → Se currentTime fora da janela → skip
  → Verifica se bloco já tem itens pending em dateSchedules → skip se sim (evita duplicata)
  → expandBlockItems() → gera os itens
  → Se items.length === 0 (bloco vazio) → skip silencioso
  → dispatch SET_DATE_SCHEDULE + SET_SPOT_ROTATION + MARK_BLOCK_LOADED
  → saveData para persistir imediatamente
  → log no console: "[SpotMaster] Bloco comercial pré-carregado: ..."
```

**Resultado:** o `autoplayComerciais` agora funciona **sem precisar gerar a Programação do Dia**. O `preloadMinutes` das configurações finalmente tem efeito.

**Blocos vazios:** se o bloco não tiver spots cadastrados, `expandBlockItems` retorna array vazio e o preloader faz `continue` silenciosamente. Nada dispara, nenhum erro. Quando o operador cadastrar spots antes do horário, na próxima varredura (≤ 20s) o bloco será carregado corretamente.

#### Correção 2 — `commInterruptTimeRef` separado

Criada nova ref `commInterruptTimeRef` exclusiva para o scheduler de comerciais:

```typescript
const commInterruptTimeRef = useRef<string>('')
```

O scheduler de programas continua usando `scheduleInterruptTimeRef`. O scheduler de comerciais passa a usar `commInterruptTimeRef`. Os dois não interferem mais entre si, mesmo que um programa e um comercial tenham o mesmo horário.

Resets adicionados em todos os pontos onde `scheduleInterruptTimeRef` era resetado:
- Fim de sequência (`runSequence` cleanup)
- `stopPlayback()`
- Reset inline no `runSequence` quando `scheduledDue.length === 0`

#### Correção 3 — Grace window de 10 minutos

A verificação de `sessionStartRef` foi ajustada de rejeição total para rejeição com margem:

```typescript
// Antes (muito restritivo):
if (triggerTime < sessionStartRef.current) return

// Depois (10 minutos de grace):
const graceSec = 10 * 60
if (triggerSec < sessionSec - graceSec) return
```

Blocos que passaram até 10 minutos antes da abertura do app ainda são disparados. Blocos muito antigos (> 10 min) continuam sendo ignorados corretamente.

### Comportamento consolidado do Autoplay Comercial

| Situação | O que acontece |
|----------|----------------|
| App aberto, bloco no horário certo | Preloader detecta em até 20s → scheduler dispara na hora exata |
| App aberto após o horário (até 10 min) | Grace window → ainda dispara |
| App aberto após o horário (> 10 min) | Ignora — bloco vencido |
| Bloco vazio (sem spots) | Preloader verifica, retorna vazio, silêncio total |
| Campanha expirada no bloco | Motor ignora o item mesmo com bloco na fila |
| Programação do Dia gerada manualmente | Funciona como antes (dateSchedules já tem os itens) |
| Programação do Dia NÃO gerada | Funciona — preloader injeta direto em dateSchedules |
| Programa e comercial no mesmo horário | Sem conflito — cada scheduler usa seu próprio ref |
| Sequência tocando em modo Playlist | Comercial não interrompe (by design — Playlist é manual) |

### O que o operador precisa configurar

1. **Configurações → Autoplay Comerc. → ON** (botão na toolbar da aba Programação)
2. Blocos comerciais habilitados com horário definido
3. Clientes e spots cadastrados nos blocos
4. `preloadMinutes` nas configurações (padrão: 5 min — controla quanto antes o bloco é carregado)

Não é necessário: gerar Programação do Dia, estar na aba Programação, ou fazer qualquer ação manual.

---

### Correção atual — AutoProg e tempos (14/05/2026)

O problema antigo de `Promise.allSettled` disparando todas as leituras em paralelo **não existe mais no código fonte atual**. A leitura de duração está limitada por pool em `readMediaDurationBatch`.

O que foi corrigido:
1. `generateMusicBlockEngine` recebeu `getDuration(filePath)`.
2. `targetMode:'duration'` agora soma duração conhecida e para ao atingir `targetValue * 60`.
3. `generatePlaylistFromGrid` passa uma função que consulta `mediaDurationCache` e, se necessário, lê metadata com `readMediaDuration`.
4. Leituras novas alimentam `mediaDurationCache`, salvo via `saveData('mediaDurationCache')`.
5. O fallback do `DaySchedulePanel` e o botão "Ler Tempos" também atualizam o cache.
6. O merge "Atualizar" não retorna mais antes de tentar completar tempos faltantes.
7. O botão "Ler Tempos" agora tem fallback nativo para MP4/MOV/M4V/M4A/3GP quando o Chromium não consegue obter metadata.

Limite conhecido: se um arquivo estiver corrompido, inacessível ou em formato fora do fallback nativo e cujo metadata o Chromium não consiga ler, o app ainda pode não obter duração real antes do playback. Nesses casos, o item pode ficar sem tempo até o vMix reportar duração durante a execução.

### Auto-update — v5.1.5 (14/05/2026)

- Provider: GitHub Releases do repositório público `RobsonDV/VTMaster`.
- Biblioteca: `electron-updater`, integrada no processo principal Electron.
- O updater só executa no app instalado/empacotado (`app.isPackaged`).
- Auto-update é suportado no instalador NSIS (`Setup.exe`); o `Portable.exe` não aplica update automático.
- Checagem automática: alguns segundos após abrir o app e depois a cada 6 horas.
- Checagem manual: **Configurações → Atualizações → Verificar atualização**.
- Ao concluir o download, o app oferece **Reiniciar agora** ou **Depois**.
- Arquivos necessários em cada release: `VTMaster-x.y.z-Setup.exe`, `VTMaster-x.y.z-Setup.exe.blockmap` e `latest.yml`.
- Versões anteriores à 5.1.5 precisam instalar manualmente uma vez; só depois passam a receber updates automáticos.

### Teste auto-update — v5.1.6 (14/05/2026)

- Release pequena criada para validar o ciclo real 5.1.5 → 5.1.6.
- Não altera regra operacional; objetivo é confirmar detecção, download e instalação via `electron-updater`.
- Teste esperado: instalar a 5.1.5, abrir Configurações → Atualizações → Verificar atualização, baixar 5.1.6 e reiniciar.

---

## 20. Melhorias v5.2.0

> Implementado em **15/05/2026**.

### 20.1. Comercial Pro — complementos

**Bloqueio automático de concorrentes na distribuição (`CampaignsPanel.tsx`):**
O `DistributeModal` agora separa os blocos elegíveis em duas listas: elegíveis (recebem o cliente) e bloqueados por segmento (já têm concorrente). Blocos bloqueados são exibidos com o nome do concorrente e ícone de proibido. Se todos os blocos estiverem bloqueados, o modal explica e não permite confirmar.

**Renovação assistida de campanha:**
Botão "Renovar" aparece em campanhas expiradas, concluídas ou com ≥ 90 % de execução. Abre modal com período anterior visível, novo início/fim pré-preenchidos (mesma duração), opção de marcar a anterior como Concluída. Cria nova campanha herdando todos os parâmetros.

**Relatório financeiro CSV (`ReportsPanel.tsx`):**
Botão "Exportar CSV" ao lado do "Gerar PDF". No modo Campanha sem seleção: uma linha por campanha (Contratado/Veiculado/Falhas/Restante/%). Com campanha selecionada: log detalhado daquela campanha. Arquivo com BOM UTF-8, separador `;` — compatível com Excel e Google Planilhas.

### 20.2. Posição no bloco por campanha (`blockPosition`)

Novo campo `blockPosition?: number` (0–100) na interface `Campaign`. Quando uma campanha tem posição configurada, o motor de playout (`expandBlockItems`) reordena os `spot_client` dentro do bloco por `blockPosition → priority → order`, sem deslocar itens `vmix_action` ou `vmix_input`.

Regra: posição 0 + Alta prioridade = primeiro; posição 0 + Média = segundo; posição 50 = depois dos de posição 0. `vmix_action` e `vmix_input` permanecem na posição manual configurada pelas setas do AdBreaksPanel.

Campo visível no formulário de campanha (Comercial Pro → Campanhas) e no card expandido quando diferente de 0.

### 20.3. Virada automática de meia-noite (`App.tsx`)

**Bug crítico corrigido:** o `scheduleDate` em `App.tsx` era inicializado uma vez e nunca avançava sozinho — ao virar a meia-noite o app ficava travado exibindo o dia anterior mesmo após o `AppContext` gerar a programação do novo dia.

**Correção:** `useRef` + `useEffect` com intervalo de 30 s que verifica se `scheduleDate < today()` e avança para o novo dia. Só avança quando a data exibida ficou no passado — datas futuras escolhidas manualmente pelo operador são preservadas.

---

## 21. Fase 2 — Grafismos (v5.2.0)

> Implementado em **15/05/2026**. Esta fase entrega controle completo de grafismos e títulos vMix diretamente do VTMaster, incluindo GC musical automático, cadastro de inputs, templates de lower third e servidor local de Data Sources.

### Novo painel "Grafismos" (navegação lateral)

Ícone `MonitorPlay`. 4 abas: GC Automático, Meus Títulos, Templates, Data Sources.

### 21.1. GC Automático

Configurações do GC musical (antes no modal de Configurações) agora vivem aqui. Quando uma música começa a tocar num bloco musical (item sem `adBreakId`, com `filePath`, não `vmix_action`, não `pause`), o VTMaster aguarda o delay configurado e envia `SetText` para um input de título do vMix.

**Configurações:**
| Campo | Descrição |
|-------|-----------|
| Delay (s) | Segundos após o início da música (padrão: 5) |
| Input vMix | Nome exato do input GT no vMix |
| Campo linha 1 | Nome do campo de texto para o artista (`Artist.Text`) |
| Campo linha 2 | Nome do campo de texto para a música (`Title.Text`) |
| Modo linha 2 | Dinâmico (parse do arquivo) ou Fixo (texto estático) |
| Canal overlay | 1–4 para ativar `OverlayInputNIn`; 0 = só seta texto |
| Esconder após | Segundos até `OverlayInputNOff`; 0 = manual |

**Nota importante:** títulos GT do vMix exigem o sufixo `.Text` no nome do campo. Exemplo: se o campo no editor GT se chama `Artist`, o valor configurado deve ser `Artist.Text`.

**Botão "Testar GC agora":** dispara com texto fixo de exemplo e exibe o retorno real do vMix — permite diagnóstico imediato de erros no nome do campo ou do input.

**Parse de artista/música:** o arquivo deve ter o formato `ARTISTA - MÚSICA`. O VTMaster separa pelo ` - ` e envia artista na linha 1 e música na linha 2. Se não houver separador, o título inteiro vai para a linha 1 e a linha 2 recebe o texto estático configurado (ou espaço, para limpar o campo).

**Guard de commercial:** se `item.adBreakId` estiver presente, o GC nunca dispara. Blocos comerciais não recebem GC musical.

### 21.2. Meus Títulos

Cadastro de inputs de título do vMix (`GrafismoTitleInput[]`). Para cada input: nome exato no vMix + lista de campos com nome e rótulo. Os campos cadastrados aqui são oferecidos como opções de dropdown na aba Templates, evitando erros de digitação.

**Tipos persistidos:**
```typescript
interface GrafismoField {
  name: string    // nome do campo no vMix (ex: "Artist.Text")
  label: string   // rótulo de exibição no VTMaster
}

interface GrafismoTitleInput {
  id: string
  name: string             // nome exato do input no vMix (ex: "Lower Third")
  fields: GrafismoField[]
  createdAt: string
}
```

Persistido em `grafismoTitleInputs.json`. Incluído no `BACKUP_KEYS`.

### 21.3. Templates

Templates de lower third com botão **"Disparar"** manual. Cada template define:
- Nome (ex: "Agora no ar", "A seguir", "Intervalo comercial", "Hora certa", "Plantão")
- Input de título alvo (selecionado dentre os cadastrados em Meus Títulos)
- Mapeamentos: campo do vMix → fonte dos dados
- Canal de overlay e duração de esconder

**Fontes disponíveis:**

| Fonte | O que envia |
|-------|-------------|
| `now_artist` | Artista do item tocando agora |
| `now_song` | Música do item tocando agora |
| `now_title` | Título completo do item atual |
| `next_artist` | Artista do próximo item pendente |
| `next_song` | Música do próximo item |
| `next_title` | Título completo do próximo item |
| `time` | Hora atual `HH:MM` |
| `station` | Nome da emissora (das Configurações) |
| `static` | Texto fixo configurado no template |

**Tipos persistidos:**
```typescript
type GrafismoFieldSource = 'now_artist' | 'now_song' | 'now_title' | 'next_artist' | 'next_song' | 'next_title' | 'time' | 'station' | 'static'

interface GrafismoTemplateMapping {
  fieldName: string
  source: GrafismoFieldSource
  staticValue?: string
}

interface GrafismoTemplate {
  id: string
  name: string
  inputId: string                   // GrafismoTitleInput.id
  mappings: GrafismoTemplateMapping[]
  overlayChannel?: number           // 1-4, 0 = não ativar
  hideDuration?: number             // segundos, 0 = manual
  createdAt: string
}
```

Persistido em `grafismoTemplates.json`. Incluído no `BACKUP_KEYS`.

### 21.4. Data Sources — servidor HTTP local

Servidor HTTP embutido no processo Electron (Node `http.createServer`). Porta configurável (padrão 7070). Quando ativo, o vMix pode consumir os endpoints como Data Sources Web e atualizar títulos automaticamente sem nenhuma intervenção do operador.

**Endpoints:**

| URL | Conteúdo |
|-----|----------|
| `/vtmaster/now-next` | Item atual + próximo, com `artist`, `song`, `title`, `type`, `duration`, `scheduledTime` |
| `/vtmaster/schedule` | Grade completa do dia (todos os itens com status) |
| `/vtmaster/log-today` | Log de veiculação do dia |

**Como configurar no vMix:** Add Input → Data Source → Web → colar a URL. O vMix consulta periodicamente e atualiza os campos do título mapeados.

**IPC adicionados em `electron/main.ts`:**
- `datasources-update` — renderer envia snapshot de estado quando playlist/schedule/log mudam
- `datasources-start(port)` — inicia o servidor HTTP
- `datasources-stop` — para o servidor
- `datasources-status` — retorna `{ running: boolean }`

**Bridge adicionada em `electron/preload.ts`:**
`updateDataSources`, `startDataSourcesServer`, `stopDataSourcesServer`, `getDataSourcesStatus`

**Tipos adicionados em `SpotMasterAPI`:** os 4 métodos acima.

**AppSettings adicionados:**
```typescript
dataSourcesEnabled: boolean
dataSourcesPort: number    // padrão: 7070
```

**Push automático de estado:** `useEffect` em `AppContext` observa `playlist`, `dateSchedules` e `playLog` — quando `dataSourcesEnabled === true`, envia snapshot ao servidor via IPC automaticamente.

### 21.5. Arquivos adicionados/modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/Grafismos/GrafismosPanel.tsx` | **NOVO** — painel com 4 abas |
| `src/types/index.ts` | `GrafismoField`, `GrafismoTitleInput`, `GrafismoFieldSource`, `GrafismoTemplateMapping`, `GrafismoTemplate`; `dataSourcesEnabled`, `dataSourcesPort` em `AppSettings`; 4 métodos em `SpotMasterAPI` |
| `src/store/AppContext.tsx` | `grafismoTitleInputs`, `grafismoTemplates` em state/actions/reducer/loadAll/saveEffects; push de Data Sources |
| `electron/main.ts` | Servidor HTTP + 4 IPC handlers; `grafismoTitleInputs` e `grafismoTemplates` no `BACKUP_KEYS` |
| `electron/preload.ts` | 4 métodos de Data Sources |
| `src/App.tsx` | Painel `'grafismos'` + ícone `MonitorPlay` |
| `src/components/Settings/SettingsModal.tsx` | Seção GC Musical removida (movida para Grafismos) |
| `src/i18n/pt.ts` e `en.ts` | `nav.grafismos` |
| `package.json` | Versão `5.1.7` → `5.2.0` |

---

## 22. Fases 7 e 7b — Banco de Mídia, On Air e Command Palette (v5.2.0)

### Banco de Mídia (Fase 7b)

Drawer lateral direito (360px) acessível pelo botão `Database` na toolbar (ícone muda para cor primária quando aberto).

**Aba Videos:**
- Pastas de video cadastradas no VideoPro (`state.videoStyles`) e pastas extras (`settings.videoFolders`).
- Botao "Adicionar" -> `browseFolder`.
- Toggle "incluir subpastas".
- Botao "Escanear" -> IPC `scan-video-folder` (escaneia mp4/mov/avi/mkv/wmv/mxf/flv/webm/ts/m2ts).
- Lista agrupada por pasta com busca por nome de arquivo.
- "+" insere como item `programa` no final da playlist ativa.

**Aba Audios:**
- Sub-aba Pastas alimentada pelo AudioPro (`state.audioStyles`) e pastas extras (`settings.audioFolders`).
- Sub-aba Biblioteca alimentada por `state.musicLibrary` (faixas importadas).
- Busca por titulo, artista, genero; filtro por genero na biblioteca.
- "+" insere como item de audio com `mediaType: 'audio'`.

**Aba Inputs:**
- Inputs carregados sob demanda do vMix (botão Refresh).
- Agrupados por categoria: Vídeo, Câmera, Áudio, Gráficos, Mix, Outros.
- Badge PGM/PVW em tempo real via `state.vmixStatus`.
- "+" usa `spotTypeForVmix` para definir o tipo correto.

**Aba Ações:**
- `VMIX_COMMAND_CATALOG` (itens não ocultos) agrupados por categoria.
- Campos inline para Input e Valor quando exigidos pelo catálogo.
- "+" insere `vmix_action` com os campos preenchidos.

**Importar Pasta (LibraryTab / Biblioteca Musical):**
- Botão "Importar Pasta" no PageHeader da aba Biblioteca do AutoProg.
- Abre seletor de pasta → pergunta se inclui subpastas → escaneia `.mp3/.wav/.flac/.m4a/.aac`.
- Lê metadados via `readTrackMetadata` e MD5 via `hashFileMd5`.
- Faz upsert em lote com barra de progresso inline (`importProgress / importTotal`).
- Exibe resumo: "N faixas adicionadas, M já existiam".
- Reconciliar funciona mesmo sem estilos cadastrados (hint no `title` do botão).

### Modo On Air (Fase 7)

Overlay fullscreen (`src/components/OnAir/OnAirPanel.tsx`):
- Ativado pelo botão "On Air" na sidebar (fica vermelho durante transmissão) ou pela Command Palette.
- Exibe: badge AO VIVO/PARADO, nome da emissora, card "Agora no ar" com título grande + barra de progresso em tempo real, lista "A Seguir" (até 4 itens).
- Botões grandes: **INICIAR** (verde) / **PARAR** (vermelho) + **AVANÇAR** (skip).
- ESC fecha o overlay.
- Detecta automaticamente a fila ativa (Playlist ou Programação do Dia) via `state.activePanel`.

### Command Palette (Fase 7)

Sobreposição de busca rápida (`src/components/CommandPalette/CommandPalette.tsx`):
- Ativada por **Ctrl+K** (ou Cmd+K no Mac) a partir de qualquer painel.
- Busca fuzzy em: ferramentas (On Air, Banco de Mídia), painéis de navegação (11 itens), anunciantes, campanhas ativas, camadas AudioPro (disparo direto).
- Navegação por teclado: ↑↓ seleciona, Enter executa, ESC fecha.
- Máximo de 20 resultados; filtrado em tempo real.

### Arquivos criados/modificados

| Arquivo | O que mudou |
|---------|-------------|
| `src/components/MediaBank/MediaBankPanel.tsx` | Container do drawer (novo) |
| `src/components/MediaBank/MediaBankPanel.css` | Estilos do drawer (novo) |
| `src/components/MediaBank/VideosTab.tsx` | Aba de vídeos (novo) |
| `src/components/MediaBank/AudiosTab.tsx` | Aba de áudios (novo) |
| `src/components/MediaBank/InputsTab.tsx` | Aba de inputs vMix (novo) |
| `src/components/MediaBank/ActionsTab.tsx` | Aba de ações vMix (novo) |
| `src/components/OnAir/OnAirPanel.tsx` | Modo On Air (novo) |
| `src/components/OnAir/OnAirPanel.css` | Estilos do On Air (novo) |
| `src/components/CommandPalette/CommandPalette.tsx` | Command Palette (novo) |
| `src/components/CommandPalette/CommandPalette.css` | Estilos da Palette (novo) |
| `src/components/AutoProg/LibraryTab.tsx` | Botão Importar Pasta + progresso |
| `src/components/Toolbar/Toolbar.tsx` | Botão Database + prop `onToggleMediaBank` |
| `src/App.tsx` | Estado `showMediaBank/showOnAir/showCommandPalette`, Ctrl+K, botão On Air na sidebar |
| `src/types/index.ts` | `videoFolders` em `AppSettings`; `scanVideoFolder` em `SpotMasterAPI` |
| `src/store/AppContext.tsx` | `videoFolders: []` em `DEFAULT_SETTINGS` |
| `electron/main.ts` | IPC `scan-video-folder` |
| `electron/preload.ts` | Bridge `scanVideoFolder` |

---

## 23. Complementos 15/05/2026

### Saidas vMix

A Fase 3 do PLANOGPT foi implantada como painel `Saidas vMix` (`src/components/VmixOutputs/VmixOutputsPanel.tsx`). O painel controla Recording, Streaming, External, SRT Output, MultiCorder e Snapshot, com confirmacao antes de parar operacoes criticas.

Perfis de output ficam persistidos em `vmixOutputProfiles`, com destinos Output 2/3/4, Fullscreen 1/2 e External 2. O catalogo de comandos vMix foi ampliado para comandos de Start/Stop/StartStop, Fullscreen, SetOutput, SRT, MultiCorder e Snapshot. A StatusBar exibe REC, STREAM, EXT, FTB e SRT quando o XML do vMix informa esses estados.

Pendencia restante: automacoes por grade ainda sao operacionais/manualizaveis por acoes vMix, nao uma tela completa de regras automaticas por programa.

### Limpeza segura de inputs vMix

A rotina de inputs temporarios foi reforcada para evitar remover entradas permanentes do operador. O VTMaster compara GUIDs antes/depois do `AddInput` e registra apenas o GUID criado por ele. A remocao passa por `removeOwnedInput`, usado em preload antigo, item anterior, abortos, sweeps de sequencia, Stop e sessoes AudioPro.

Regra de seguranca documentada: cameras, NDI, graficos fixos, inputs manuais e qualquer input que nao tenha sido criado pelo VTMaster nao entram na lista de limpeza. Se um input ja existia no vMix antes da execucao, ele nao deve ser removido pelo VTMaster.

### AutoProg misto AudioPro/VideoPro

O modal de sequencias do AutoProg foi atualizado para montar ciclos mistos. Cada linha pode apontar para um estilo de audio do AudioPro ou um estilo de video do VideoPro, permitindo sequencias como video -> audio -> video sem separar programacoes.

`MusicSequenceItem` recebeu `mediaType?: 'audio' | 'video'`. `generateMusicBlock` e `simulateMusicDay` aceitam fontes unificadas (`AutoProgStyleSource`) e usam `scanMusicFolder` para audio e `scanVideoFolder` para video. Os itens gerados preservam `mediaType`, entao a Programacao do Dia consegue distinguir audio/video para cores, placeholders e execucao.

Correcao importante: os estilos antigos em `musicStyles` sao legado de video, pois o VTMaster nasceu como player de video. Por isso aparecem como `Video - Nome (legado)`. Audio so deve vir de `state.audioStyles`; no momento nao ha estilos de audio cadastrados por legado.

### VideoPro e Banco de Midia

VideoPro passou a ter CRUD proprio de `VideoStyle` e deixou de ser apenas wrapper dos estilos musicais antigos. A aba Videos do Banco de Midia le `state.videoStyles`; a aba Audios/Pastas le `state.audioStyles`. AutoProg/MusicStyles antigos ficam apenas como compatibilidade de video legado para geracao.

Arquivos principais envolvidos: `src/utils/autoprog.ts`, `src/utils/autoprogStyles.ts`, `src/components/AutoProg/SequencesTab.tsx`, `src/components/AutoProg/SimulatorTab.tsx`, `src/components/VideoPro/VideoProPanel.tsx`, `src/components/MediaBank/VideosTab.tsx`, `src/store/AppContext.tsx` e `src/types/index.ts`.

### Fechamento P0 do backlog

O fluxo de exclusao de anunciante foi reforcado em `src/store/AppContext.tsx`. Ao remover um cliente, o reducer agora limpa tambem spots do cliente, campanhas, itens pendentes na playlist/programacao, itens de blocos comerciais, slots legados e o indice de `spotRotation`. Isso evita referencias comerciais orfas depois da exclusao.

Foi criado o painel dedicado `Saude vMix` em `src/components/VmixHealth/VmixHealthPanel.tsx`, com CSS proprio. Ele aparece na sidebar e na Command Palette. O painel mostra conexao, edicao, Program/Preview, estados operacionais (REC, STREAM, EXT, SRT, MultiCorder e FTB), inputs por tipo, inputs em estado suspeito e ultimos comandos vMix com latencia ou erro.

### Correcao de autoplay comercial apos 24h parado

Detectado em 15/05/2026: se o VTMaster ficasse aberto e parado atravessando a meia-noite, `sessionStartRef` continuava guardando apenas o horario de abertura do app, sem data. Assim, um comercial de hoje as 21:00 podia ser tratado como "anterior" a uma sessao aberta ontem as 22:00 e ser bloqueado pelo guard de seguranca.

Correcao aplicada em `src/store/AppContext.tsx`: no watcher de virada de dia, `sessionStartRef` volta para `00:00:00`, os refs de interrupcao sao limpos e `minOrderRef` retorna para `-1` antes de gerar a programacao do novo dia. O preloader de comerciais tambem deixou de confiar apenas em `lastLoadedDate`; se o bloco esta marcado como carregado hoje mas nao existe item dele em `dateSchedules[today]`, ele pode ser injetado novamente dentro da janela de preload/grace. O loop do preloader agora usa `workingSchedule`/`workingRotation`, evitando perda de itens quando mais de um bloco entra na mesma varredura.

## 24. Backlog

### Alta prioridade

| Item | Descrição |
|------|-----------|
| **Prévia de mídia** | Pré-visualizar clipe antes de adicionar à programação |
| **Edição inline de título/duração** | Editar diretamente na linha do card sem abrir modal |

### Média prioridade — Comercial Pro

| Item | Descrição |
|------|-----------|
| **Regra de separação mínima** | Não veicular dois spots do mesmo cliente em intervalos muito próximos no mesmo dia |
| **Comprovante por campanha com evidencia** | Snapshot vMix (`SnapshotInput`) capturado no inicio de cada spot, agora com Fase 3 disponivel como base tecnica |
| **Alerta de campanha quase vencendo** | Notificação quando restam menos de X dias e ainda há spots pendentes |

### Média prioridade — Geral

| Item | Descrição |
|------|-----------|
| **TCP/TALLY bridge** | Fase 1 do PLANOGPT (pendente deliberada) — porta 8099, `SUBSCRIBE TALLY`, fallback HTTP |
| **Regras automaticas para saidas** | Evolucao da Fase 3: regras por grade/programa para Recording, Streaming, Outputs, clean feed e MultiCorder |
| **Importação CSV** | Carregar itens a partir de planilha |
| **Múltiplos blocos no mesmo horário** | Potencial conflito de scheduledTime |
| **Resetar programação do dia** | Botão para regerar do zero descartando edições manuais |

### Baixa prioridade

| Item | Descrição |
|------|-----------|
| **Musical Pro** | Fase 5 do PLANOGPT — biblioteca musical com tags, scanner, simulador de grade |
| **Prévia de mídia (player)** | Player interno para visualizar clipe antes de adicionar — `<video>` ou modal com playback local |
| **GC com relógio em tempo real** | Template "Hora certa" que atualiza a cada minuto enquanto ativo |
| **Licenciamento** | Proteção por CNPJ/chave de ativação |
| **Sincronização em rede** | Múltiplos operadores editando simultaneamente |

### Problemas conhecidos e limitações

| Problema | Impacto | Workaround |
|----------|---------|------------|
| GC musical exige sufixo `.Text` no nome do campo GT | Campo não muda no vMix se o operador não incluir `.Text` | Botão "Testar GC" mostra o erro do vMix — usar `NomeDoCampo.Text` |
| Rotativo não bloqueia duplicata se cliente já está no template manual | Spot pode aparecer duas vezes no mesmo bloco | Não adicionar manualmente cliente que já tem campanha rotativa |
| Campanha expirada continua visível no bloco no AdBreaks | Visual confuso — o item aparece mas não é veiculado | Gate no motor garante que não veicula; visual é cosmético |
| Distribuição aleatória pode mudar entre cliques | Cada clique no botão "Distribuir" faz novo shuffle | Confirmar na primeira tentativa |
| `preloadMinutes` afeta apenas o preloader de 20s, não o scheduler de 1s | Bloco pode entrar na fila até 20s depois do preloadMinutes | Margem desprezível na prática |
| Data Sources serve apenas `127.0.0.1` | vMix na mesma máquina funciona; máquinas diferentes na rede não acessam | Previsto para a Fase 7 (multiestação) |
