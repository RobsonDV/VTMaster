# SpotMaster — Documentação de Desenvolvimento

> Software de veiculação comercial para emissoras de TV.  
> Stack: **Electron 41 + React 19 + TypeScript + Vite 8**

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Estrutura de Arquivos](#2-estrutura-de-arquivos)
3. [Stack Técnico](#3-stack-técnico)
4. [Configuração e Build](#4-configuração-e-build)
5. [Processo Principal — Electron](#5-processo-principal--electron)
6. [Protocolo local-media://](#6-protocolo-local-media)
7. [API do vMix](#7-api-do-vmix)
8. [Motor de Playout](#8-motor-de-playout)
9. [Gerenciamento de Estado](#9-gerenciamento-de-estado)
10. [Componentes](#10-componentes)
11. [Tipos de Dados](#11-tipos-de-dados)
12. [Internacionalização](#12-internacionalização)
13. [Persistência de Dados](#13-persistência-de-dados)
14. [Funcionalidades Implementadas](#14-funcionalidades-implementadas)

---

## 1. Visão Geral

O SpotMaster é um software desktop para emissoras de TV controlarem a veiculação de spots comerciais via integração com o software de produção ao vivo **vMix**.

**Fluxo principal:**
1. Operador monta uma playlist com itens (spots de arquivo, câmeras, gráficos)
2. Clica em **Iniciar Playlist**
3. SpotMaster adiciona cada clipe ao vMix automaticamente, dá play e corta para o ar — um a um, sem intervenção manual
4. Ao final, remove todos os inputs criados (gerenciamento não-destrutivo)

---

## 2. Estrutura de Arquivos

```
spotmaster/
├── electron/
│   ├── main.ts          → Processo principal Electron (IPC, janela, protocolos)
│   ├── preload.cts      → Bridge renderer↔main via contextBridge (DEVE ser CJS)
│   ├── preload.ts       → Arquivo auxiliar de tipos (não compilado diretamente)
│   └── vmix.ts          → Integração HTTP com a API do vMix
│
├── src/
│   ├── main.tsx         → Entry point React
│   ├── App.tsx          → Layout raiz, navegação de painéis, modais globais
│   ├── App.css          → Variáveis CSS, layout, sidebar, scrollbars
│   ├── types/
│   │   └── index.ts     → Todas as interfaces e tipos do app
│   ├── store/
│   │   └── AppContext.tsx → Estado global (useReducer), motor de playout, vMix
│   ├── i18n/
│   │   ├── index.ts     → Função getTranslations()
│   │   ├── pt.ts        → Strings em Português Brasileiro
│   │   └── en.ts        → Strings em Inglês
│   ├── utils/
│   │   └── time.ts      → now(), formatDuration(), parseDuration(), today()
│   └── components/
│       ├── Toolbar/     → Barra de ferramentas principal
│       ├── StatusBar/   → Rodapé: status vMix, item atual, próximo
│       ├── Playlist/
│       │   ├── PlaylistTable.tsx    → Tabela principal + controles de transporte
│       │   ├── PlaylistTable.css
│       │   ├── ItemModal.tsx        → Criar/editar item da playlist
│       │   ├── ItemModal.css
│       │   ├── VmixInputPanel.tsx   → Painel lateral inline de inputs do vMix
│       │   └── VmixInputPanel.css
│       ├── AdBreaks/    → Blocos comerciais (templates reutilizáveis)
│       ├── Clients/     → Cadastro de anunciantes
│       ├── Log/         → Log de veiculação (comprovante)
│       ├── Reports/     → Geração de relatórios PDF
│       └── Settings/    → Modal de configurações
│
├── docs/
│   └── DEVELOPMENT.md   → Este arquivo
├── dist/                → Build do React (gerado por Vite)
├── dist-electron/       → Build do Electron (gerado por tsc)
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.electron.json
└── package.json
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
| Internacionalização | Custom (pt.ts / en.ts) |

---

## 4. Configuração e Build

### Scripts disponíveis

```bash
npm run dev           # Compilar Electron + iniciar Vite + abrir Electron em dev
npm run build         # Build completo para produção (tsc + vite build + electron:compile)
npm run build:dist    # Build + empacotamento (electron-builder → pasta release/)
npm run electron:compile  # Apenas compilar TypeScript do Electron
```

### Como o `dev` funciona

```
tsc -p tsconfig.electron.json   → compila electron/ → dist-electron/
vite (dev server em :5173)
wait-on tcp:5173 && electron .  → abre janela carregando http://localhost:5173
```

> O Vite pode usar porta 5174 se 5173 já estiver em uso. Isso é normal.

### tsconfig.electron.json

Compila apenas `electron/**/*`:
- `target: ES2022`, `module: ESNext`, `outDir: dist-electron`
- `preload.cts` → `dist-electron/preload.cjs` — Electron não carrega preload ESM, portanto o arquivo DEVE ser `.cts` (TypeScript CJS)

### vite.config.ts

- `base: './'` — importante para que o build de produção resolva caminhos corretamente
- `outDir: 'dist'`
- Dev server fixado em porta 5173

---

## 5. Processo Principal — Electron

**Arquivo:** `electron/main.ts`

### Criação da janela

```typescript
mainWindow = new BrowserWindow({
  width: 1280, height: 800,
  webPreferences: {
    preload: join(__dirname, 'preload.cjs'),  // DEVE ser .cjs
    contextIsolation: true,
    nodeIntegration: false,
  },
})
```

Em desenvolvimento carrega `http://localhost:5173`. Em produção carrega `dist/index.html`.

### preload.cts

Bridge de segurança entre o renderer (React) e o processo principal via `contextBridge`.

**CRÍTICO:** deve ser `.cts` para compilar para `.cjs`. O Electron não carrega preload em formato ESM.

API exposta em `window.spotmaster`:

| Método | Descrição |
|--------|-----------|
| `saveData(key, data)` | Salva JSON em arquivo no userData |
| `loadData(key)` | Carrega JSON do userData |
| `getVersion()` | Versão do app |
| `exportPlaylist(data)` | Salva playlist como arquivo JSON |
| `importPlaylist()` | Abre diálogo e importa JSON |
| `exportPDF(filePath, buffer)` | Salva PDF no disco |
| `browseVideoFile()` | Diálogo de abertura de arquivo de mídia |
| `vmixRequest(params)` | Requisição HTTP para a API do vMix |
| `vmixStartPolling(host, port)` | Inicia polling de status do vMix (2s) |
| `vmixStopPolling()` | Para o polling |
| `onVmixStatus(callback)` | Listener para status enviado pelo processo principal |
| `removeVmixStatusListener()` | Remove o listener |
| `openExternal(url)` | Abre URL no browser do sistema |

### Armazenamento de dados

Arquivos JSON gravados em `app.getPath('userData')/SpotMaster/`:
`settings.json`, `playlist.json`, `adBreaks.json`, `clients.json`, `playLog.json`

---

## 6. Protocolo local-media://

### Problema

O renderer React é servido de `http://localhost:5173` em dev. Carregar arquivos locais via `file:///` a partir dessa origem é bloqueado por CSP/CORS — isso impede a leitura de duração de vídeos/áudios via HTML5.

### Solução

Um protocolo customizado `local-media://` é registrado no Electron:

```typescript
// Antes do app.whenReady() — OBRIGATÓRIO:
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
// ItemModal.tsx
function toLocalMediaUrl(filePath: string): string {
  return 'local-media:///' + filePath.replace(/\\/g, '/')
}
// 'C:\Videos\spot.mp4' → 'local-media:///C:/Videos/spot.mp4'
```

A função `readMediaDuration()` cria um elemento `<video>` ou `<audio>` com essa URL e lê `element.duration` via `onloadedmetadata`. Timeout de 10s.

---

## 7. API do vMix

**Arquivo:** `electron/vmix.ts`

### Endpoint

```
GET http://{host}:{port}/api/?{params}
GET http://{host}:{port}/api/           ← sem parâmetros retorna o XML de status completo
```

> **ATENÇÃO:** a barra antes do `?` é obrigatória: `/api/?Function=...`

### Funções utilizadas pelo SpotMaster

| Função vMix | Parâmetros | Descrição |
|-------------|-----------|-----------|
| `AddInput` | `Value=Video\|C:\path\file.mp4` | Adiciona vídeo como novo input |
| `AddInput` | `Value=Image\|C:\path\img.png` | Adiciona imagem |
| `AddInput` | `Value=AudioFile\|C:\path\audio.mp3` | Adiciona áudio |
| `SetPosition` | `Input=N&Value=0` | Rebobina para posição 0 |
| `PlayInput` | `Input=N` | Inicia reprodução do input N |
| `PreviewInput` | `Input=N` | Envia input N para o Preview |
| `Cut` | *(sem parâmetros)* | Corta o Preview para o Program |
| `RemoveInput` | `Input=N` | Remove o input N |

### Sequência correta para ir ao ar — IMPORTANTE

```
❌ ERRADO:  Cut&Input=N   (o parâmetro Input é ignorado no Cut HTTP)

✅ CORRETO:
1. PlayInput&Input=N       → inicia reprodução
2. sleep(300ms)            → vMix começa o decode
3. PreviewInput&Input=N    → coloca no Preview
4. sleep(100ms)
5. Cut                     → Preview vai ao Program
```

O `Cut` da API HTTP do vMix sempre corta o que **já está no Preview**. Por isso é obrigatório usar `PreviewInput` antes.

### Polling

`startVmixPolling(host, port, callback)` consulta `/api/` a cada **2 segundos**, parseia o XML e envia o status para o renderer via IPC (`vmix-status`).

---

## 8. Motor de Playout

**Arquivo:** `src/store/AppContext.tsx` — função `playItem()`

### Princípio: Slots Não-Destrutivos

O SpotMaster **nunca remove nem sobrescreve** inputs pré-existentes no vMix. Câmeras, gráficos NDI e outros inputs manuais ficam intocados. Cada clipe de arquivo recebe o próximo número disponível:

```
vMix tem inputs 1, 2, 3 (câmera, gráfico, NDI)
SpotMaster carrega spot.mp4    → cria input 4
SpotMaster carrega vinheta.mp4 → cria input 5
Ao final da playlist: remove inputs 4 e 5 (5s de graça)
Inputs 1, 2, 3 intocados
```

### Refs de controle (evitam stale closures)

```typescript
activeInputNumRef    // número do input atualmente no ar
preloadedRef         // { itemId, inputNum } do próximo clipe já pré-carregado
createdInputNumsRef  // todos os inputs criados pelo SpotMaster (para cleanup)
```

### Fluxo completo de playItem(item)

```
1. UPDATE_PLAYLIST_ITEM → status: 'playing'

2. Se item.filePath (arquivo local):

   a. Verificar preloadedRef:
      → itemId bate E inputNum != ''?
        Sim: usar número já disponível (zero dead air)
        Não: chamar loadNewInput(filePath) agora

   b. loadNewInput(filePath):
      - Detectar tipo: Video| / Image| / AudioFile|
      - getMaxInputNum() → número mais alto atual no vMix
      - AddInput → vMix carrega o arquivo
      - pollForNewInput() → aguarda até 8s (40 tentativas × 200ms)
        por qualquer novo input (número > prevMax)
      - sleep(600ms) → vMix inicializa o input
      - SetPosition(0) → vídeos/áudios voltam ao frame 0
        (imagens: ignorado, são estáticas)
      - Retorna o número do novo input

   c. PlayInput(inputNum) → inicia reprodução do vídeo/áudio
      (imagens: pula este passo)
   d. sleep(300ms)
   e. PreviewInput(inputNum) → coloca no Preview
   f. sleep(100ms)
   g. Cut → Program recebe o input

3. Se item.inputName (input pré-existente):
   - SetPosition(0) + PlayInput → rebobina e inicia
   - PreviewInput → coloca no Preview
   - Cut → vai ao ar

4. Cleanup A/B roll (1,5s após o Cut):
   - Se havia um input SpotMaster anterior → RemoveInput
   - Remove do createdInputNumsRef

5. ADD_LOG → registra veiculação (horário real, duração, input usado)

6. schedulePreload(próximo):
   - Carrega próximo arquivo em background enquanto atual está no ar
   - Armazena em preloadedRef para uso imediato quando chegar a vez

7. setTimeout(item.duration * 1000):
   - UPDATE_PLAYLIST_ITEM → status: 'done'
   - Se isSequencePlaying: playItem(próximo) ← sequência contínua até o fim
   - Se não há próximo: cleanupInputs() com 5s de delay
```

### Detecção de tipo de mídia

```typescript
IMAGE_EXTS = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','ico']
AUDIO_EXTS = ['mp3','wav','aac','ogg','flac','m4a','wma','opus','aiff']
// qualquer outra extensão → Video
```

### Ciclo A/B Roll (gapless)

```
Item A no ar
  → imediatamente inicia preload de B em background
  → A termina → B já está carregado → Cut para B sem dead air
```

### Cleanup automático

5 segundos após o fim da playlist (ou ao pressionar Parar):
```typescript
RemoveInput para cada num em createdInputNumsRef
createdInputNumsRef = []
```

---

## 9. Gerenciamento de Estado

**Arquivo:** `src/store/AppContext.tsx`

### AppState

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
}
```

### Actions principais

| Action | Payload | Descrição |
|--------|---------|-----------|
| `ADD_PLAYLIST_ITEM` | `PlaylistItem` | Adiciona ao final |
| `UPDATE_PLAYLIST_ITEM` | `PlaylistItem` | Atualiza por id |
| `DELETE_PLAYLIST_ITEM` | `string` (id) | Remove e renumera orders |
| `REORDER_PLAYLIST` | `PlaylistItem[]` | Substitui array completo |
| `CLEAR_PLAYLIST` | — | Esvazia a playlist |
| `SET_SEQUENCE_PLAYING` | `boolean` | Liga/desliga sequência |
| `SET_VMIX_STATUS` | `VmixStatus` | Atualiza conexão vMix |
| `SET_SETTINGS` | `AppSettings` | Atualiza configurações |
| `ADD_LOG` | `PlayLog` | Adiciona ao log de veiculação |

### Padrão stateRef (anti-stale-closure)

```typescript
const stateRef = useRef(state)
useEffect(() => { stateRef.current = state })
```

Dentro de `setTimeout`, `setInterval` e callbacks assíncronos use sempre `stateRef.current` em vez de `state` direto — caso contrário o valor ficará "congelado" no momento em que o callback foi criado.

### Autoplay por horário

```typescript
setInterval(() => {
  if (!stateRef.current.settings.autoPlay) return
  const currentTime = now() // HH:MM:SS
  stateRef.current.playlist
    .filter(i => i.status === 'pending' && i.scheduledTime === currentTime)
    .forEach(item => playItem(item))
}, 1000)
```

---

## 10. Componentes

### PlaylistTable

Tabela principal da playlist com controles de transporte.

**Colunas:** `# | Horário | Título | Anunciante | Tipo | Duração | Término | Input vMix | Status | Ações`

**Coluna Término:**

| Estado | Comportamento |
|--------|--------------|
| Playlist parada | Estimativa ao vivo: calcula com base no relógio atual (tick 1s) |
| Playlist iniciada | Congela no horário exato em que Iniciar foi pressionado |
| Após parar | Volta ao modo estimativa ao vivo |

Lógica: `calcEndTimes(playlist, anchor)` — percorre itens ordenados, acumula `duration` a partir do cursor. Se item tem `scheduledTime`, ancora o cursor naquele horário. Itens `done`/`skipped` são ignorados.

**Coluna Input vMix:**
- Items com `filePath`: badge `📁 Auto`
- Items com `inputName`: mostra o número/nome direto

**Controles de transporte:**
- `▶ Iniciar Playlist` → `startSequence()` — executa todos os `pending` em ordem até o final
- `⏹ Parar` → `stopPlayback()` — para a sequência (item atual termina naturalmente no vMix)
- Badge `● Executando` quando `isSequencePlaying === true`
- Checkbox **Autoplay por Horário**

**Drag & Drop (receber do VmixInputPanel):**
- Cada `<tr>` é drop target para tipo `application/vmix-input`
- Linha `.playlist-drop-end` no final aceita drop após o último item
- CSS `.drag-insert-above`: linha azul de indicação de inserção
- Ao soltar: `insertVmixInput(inp, atIndex)` — insere na posição e renumera todos os `order`

---

### VmixInputPanel

Painel lateral inline exibido ao lado da PlaylistTable.

**Abertura:** botão `MonitorPlay` na Toolbar → toggle `showVmixPanel` no `App.tsx`

**Funcionalidades:**
- Lista todos os inputs existentes no vMix
- Ícone por tipo: Camera→câmera, NDI→WiFi, Video→Film, Image→ImageIcon, AudioFile→Music, GT/Browser/Xaml→Monitor, Mix→Layers, Colour→Radio
- Estado do input: Running (verde), Paused (amarelo), outros (cinza)
- Busca em tempo real por nome, número ou tipo
- Botão ↺ atualiza sem fechar o painel
- Cada item é `draggable`: `dataTransfer.setData('application/vmix-input', JSON.stringify(inp))`
- Botão `+` adiciona ao final da playlist

**Mapeamento de tipo vMix → SpotType:**

| Tipo vMix | SpotType |
|-----------|---------|
| Camera, NDI | `programa` |
| Video, VideoList | `spot` |
| GT, Browser, Xaml | `vinheta` |
| demais | `outros` |

---

### ItemModal

Modal para criar ou editar item da playlist.

**Campos:** Título, Anunciante, Tipo, Duração, Horário Agendado, Notas, Arquivo de Mídia, Input vMix

**Arquivo de mídia:**
1. Botão Browse → `browseVideoFile()` → diálogo nativo
2. Preenche título pelo nome do arquivo
3. Detecta tipo pela extensão
4. Lê duração automaticamente via `readMediaDuration()` (protocolo `local-media://`)
5. Imagens: duração padrão 10s, editável manualmente
6. Exibe badge "Gerenciado automaticamente pelo SpotMaster" no campo Input vMix

---

### StatusBar

Rodapé fixo com:
- Status vMix: ponto verde/vermelho + edição + badges Recording/Streaming
- Item atualmente no ar
- Próximo item pendente
- Contagem total da playlist

---

### Toolbar

- Botões: Nova Playlist, Importar, Exportar, Adicionar Item, Inserir Bloco Comercial
- Toggle Tema dark/light
- Toggle Idioma PT/EN
- Botão Conectar/Desconectar vMix (com indicador de status)
- Botão **Inputs do vMix** (ícone MonitorPlay) — desabilitado quando não conectado

---

## 11. Tipos de Dados

### PlaylistItem

```typescript
interface PlaylistItem {
  id:            string      // UUID
  order:         number      // posição (1-based)
  title:         string
  clientId?:     string
  clientName?:   string
  duration:      number      // segundos
  scheduledTime?: string     // HH:MM:SS — autoplay
  inputName?:    string      // número/nome de input vMix pré-existente
  type:          SpotType    // 'spot' | 'vinheta' | 'programa' | 'bumper' | 'outros'
  status:        SpotStatus  // 'pending' | 'playing' | 'done' | 'skipped' | 'error'
  filePath?:     string      // caminho absoluto do arquivo local
  mediaType?:    'video' | 'image' | 'audio'
  notes?:        string
  adBreakId?:    string
}
```

**Regra de uso:**
- `filePath` presente → SpotMaster faz `AddInput` automaticamente no vMix
- `inputName` presente (sem filePath) → SpotMaster usa o input pré-existente diretamente
- Nunca devem causar conflito: se o usuário selecionar um arquivo, `inputName` fica vazio

### AppSettings

```typescript
interface AppSettings {
  vmixHost:    string   // padrão: 'localhost'
  vmixPort:    number   // padrão: 8088
  stationName: string
  theme:       'dark' | 'light'
  language:    'pt' | 'en'
  autoConnect: boolean  // conectar vMix ao iniciar o app
  autoPlay:    boolean  // autoplay por horário agendado
}
```

---

## 12. Internacionalização

**Arquivos:** `src/i18n/pt.ts`, `src/i18n/en.ts`, `src/i18n/index.ts`

```typescript
// Acesso nos componentes via useApp():
const { t } = useApp()
t.playlist.playSequence    // 'Iniciar Playlist' / 'Start Playlist'
t.statuses.playing         // 'Executando' / 'Playing'
t.types.spot               // 'Spot'
t.toolbar.browseVmixInputs // 'Inputs do vMix'
```

O tipo `Translations` é derivado de `pt.ts`. Ao adicionar uma chave em `pt.ts`, o TypeScript exige que ela exista em `en.ts` também.

---

## 13. Persistência de Dados

| Chave | Arquivo | Conteúdo |
|-------|---------|----------|
| `settings` | settings.json | Configurações do app |
| `playlist` | playlist.json | Itens da playlist atual |
| `adBreaks` | adBreaks.json | Blocos comerciais salvos |
| `clients` | clients.json | Anunciantes cadastrados |
| `playLog` | playLog.json | Histórico de veiculação |

Salvar: `saveToStorage(key, data)` → `window.spotmaster.saveData(key, data)` → `writeFileSync` no main process  
Carregar: executado no startup em `loadAll()` via `Promise.all` de cinco `loadData()` simultâneos

---

## 14. Funcionalidades Implementadas

### Playlist
- [x] Criar, editar, excluir itens
- [x] Reordenar com botões ▲▼
- [x] Drag & drop de inputs do vMix direto para posição específica na playlist
- [x] Coluna Término: ao vivo antes do play; ancorada no horário exato após iniciar
- [x] Exportar/importar playlist como JSON
- [x] Inserir bloco comercial completo na playlist

### Mídia
- [x] Selecionar arquivo de vídeo, imagem ou áudio via diálogo nativo
- [x] Detecção automática do tipo de mídia pela extensão
- [x] Leitura automática de duração via `local-media://` + HTML5
- [x] Imagens: duração padrão 10s, editável
- [x] Auto-preenchimento do título pelo nome do arquivo

### Veiculação (vMix)
- [x] Conexão HTTP com vMix (host/porta configuráveis)
- [x] Polling de status a cada 2s
- [x] Slots não-destrutivos: cada clipe recebe o próximo slot disponível sem afetar inputs existentes
- [x] A/B Roll gapless: próximo item pré-carregado em background
- [x] Sequência completa automática: Iniciar → executa todos até o final sem intervenção
- [x] Corte correto: `PlayInput` → `PreviewInput` → `Cut` (sem parâmetro Input no Cut)
- [x] Suporte a vídeos (`Video|`), imagens (`Image|`) e áudios (`AudioFile|`)
- [x] Limpeza automática 5s após o fim da playlist
- [x] Input pré-existente: `PreviewInput` + `Cut` sem criar novo slot
- [x] Autoplay por horário agendado (campo `scheduledTime`)

### Painel de Inputs vMix
- [x] Lista todos os inputs existentes com ícone por tipo e estado
- [x] Filtro por nome, número ou tipo
- [x] Botão ↺ atualiza sem fechar
- [x] Drag & drop para inserir em posição específica na playlist
- [x] Botão `+` para adicionar ao final

### Log e Relatórios
- [x] Log automático de cada item veiculado (horário agendado vs. horário real)
- [x] Relatório diário em PDF
- [x] Relatório por anunciante com período
- [x] Exportar PDF via diálogo nativo de salvar

### Interface
- [x] Tema escuro e claro (toggle na toolbar)
- [x] Internacionalização PT/EN
- [x] Barra de status inferior (vMix, item atual, próximo)
- [x] Badges Recording/Streaming na StatusBar
- [x] Layout split: PlaylistTable + VmixInputPanel lado a lado
