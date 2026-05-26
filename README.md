# VTMaster v5.5.36

Software desktop de playout para emissoras de TV e rádio com integração nativa ao vMix.

## Sobre o projeto

O VTMaster automatiza a execução da grade de programação diária, incluindo:

- Grade semanal de programação (Estrutura): blocos musicais, blocos comerciais e programas
- Programação do Dia com view em cards por bloco, drag-and-drop entre blocos e menu de contexto
- Sequência automática de playout no vMix (PreviewInput → Cut → PlayInput) com crossfade Fade/Merge opcional
- Blocos comerciais com round-robin por anunciante, expansão inline de spots e **Pausa pré-programada** (v5.5.29)
- Banco de Mídia (vídeos/áudios/inputs/ações vMix) com pin no layout e drag-and-drop para a programação
- StatusBar com badge ON AIR, countdown e barra de progresso em tempo real (fast polling 500 ms)
- Disparo global via tecla configurável (funciona minimizado), Gamepad e MIDI
- Autoplay por horário agendado (programas e comerciais separados) com **failsafe** que injeta blocos overdue mesmo sem preload (v5.5.30)
- **Playlist Contínua** (v5.5.30): após o bloco comercial, a playlist musical retoma automaticamente
- **Pre-arming de bloco comercial** (v5.5.31): 30s antes do horário, o app carrega o primeiro item em PVW do vMix com banner visual
- **Scheduler comercial robusto** (v5.5.36): `firedCommercialTimesRef` (Set persistido no localStorage por dia) elimina disparos duplos após crash/reinício; `catchUpGraceMinutes` configurável
- **Widget de diagnóstico do scheduler** (v5.5.36): painel colapsável com os últimos 60 eventos (info/warn/error), exportação .txt para suporte
- Comercial Pro: campanhas (padrão e rotativo), distribuição automática, relatório por campanha
- Log de veiculação, relatórios PDF/CSV
- Auto-update via GitHub Releases (electron-updater)
- **Retomada de sessão após queda de luz** (v5.5.26) com reload + seek no vMix
- Backups automáticos diários, escrita atômica de JSONs, factory reset

Stack principal:

- Electron 41
- React 19
- TypeScript 6
- Vite 8

## Documentação

- [docs/INDEX.md](docs/INDEX.md): índice central e trilhas por perfil
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): arquitetura e detalhes técnicos
- [docs/ESTADO_ATUAL.md](docs/ESTADO_ATUAL.md): status funcional — v5.5.36
- [docs/ATUALIZACOES.md](docs/ATUALIZACOES.md): como publicar releases e testar atualização automática

## Requisitos

- Windows 10/11 64-bit
- Node.js 20+
- npm 10+
- vMix 20+ (para uso em produção)

## Instalar dependências

```bash
npm install
```

## Rodar em desenvolvimento

```bash
npm run dev
```

## Scripts disponíveis

| Script | Ação |
|--------|------|
| `npm run dev` | Ambiente de desenvolvimento completo |
| `npm run electron:compile` | Compila apenas código Electron + reescreve `preload.cjs` |
| `npm run build` | Build de produção (frontend + Electron) |
| `npm run build:dist` | Gera instaladores via electron-builder |
| `npm run release:github` | Publica release no GitHub via electron-builder (`GH_TOKEN` necessário) |
| `npm run lint` | Executa ESLint |

## Build de distribuição

```bash
npm run build:dist
```

Artefatos gerados em `release/`:

- `VTMaster-x.y.z-Setup.exe` — instalador NSIS (assinado)
- `VTMaster-x.y.z-Portable.exe` — executável portátil (assinado)
- `VTMaster-x.y.z-Setup.exe.blockmap` — delta-patch para auto-update incremental
- `latest.yml` — metadata consumida pelo auto-update

## Atualização automática

Desde a v5.1.5, o VTMaster instalado via `Setup.exe` verifica novas versões em GitHub Releases.
- Check inicial 12 s após o startup
- Intervalo recorrente: 6 h
- Diálogo nativo "Reiniciar agora / Depois" quando o download termina
- Botão **Configurações → Verificar atualização** força a checagem imediata

Passo a passo completo em [docs/ATUALIZACOES.md](docs/ATUALIZACOES.md).

## Estrutura principal

```
VTMaster/
  electron/              # main process, preload e integração vMix
    main.ts              # 40 IPC handlers, autoUpdater, backups, datasources HTTP
    preload.ts           # bridge contextBridge → spotmaster.*
    vmix.ts              # polling + fast polling, parser XML
  src/
    store/
      AppContext.tsx     # estado global, motor de playout, schedulers, resume
      playbackProgress.ts# store externo para barra de progresso (fast poll)
    components/
      Grade/             # Estrutura semanal (template de programação)
      DaySchedule/       # Programação do Dia (card-view, drag-and-drop)
      AdBreaks/          # Blocos comerciais com expansão inline + Pausa
      Campaigns/         # Comercial Pro (campanhas, segmentos, janelas)
      Clients/           # Cadastro de anunciantes e spots
      Playlist/          # Playlist manual
      MediaBank/         # Vídeos / Áudios / Inputs / Ações vMix
      AutoProg/          # Geração automática de bloco musical
      AudioPro/          # Camadas de áudio (round-robin/fixed input)
      VideoPro/          # Estilos de vídeo
      Grafismos/         # Templates GC + inputs de título
      VmixOutputs/       # Configuração de saídas (Rec/Stream/FTB/EXT/SRT)
      VmixHealth/        # Status e log de comandos vMix
      Log/               # Log de veiculação
      Reports/           # Relatórios PDF/CSV
      StatusBar/         # Footer com ON AIR/countdown/progresso
      Toolbar/           # Barra superior + Disparo
      OnAir/             # Modo fullscreen de operação
      CommandPalette/    # Ctrl+K, navegação rápida
      Settings/          # Modal de configurações (vMix, GC, Triggers, AutoUpdate)
      ui/                # Botões, modais, badges, fields
    types/index.ts       # Todos os tipos TypeScript
    i18n/                # PT e EN
    utils/               # time, mediaDuration, autoprog, preflight, vmixCommandCatalog
  scripts/               # build-preload-cjs, run-electron-dev
  docs/                  # Documentação técnica
  release/               # Artefatos de distribuição
```

## Persistência local

Dados salvos em `%APPDATA%/SpotMaster/` (Windows). 27 chaves whitelistadas em `BACKUP_KEYS`:

- `settings.json` — configurações
- `playlist.json` — playlist manual
- `commercialBlocks.json` — blocos comerciais
- `clientSpots.json` — spots por anunciante
- `clients.json` — anunciantes
- `campaigns.json` — campanhas (Comercial Pro)
- `segments.json` — segmentos de público
- `programWindows.json` — janelas de programação
- `weeklyGrid.json` — grade semanal (Estrutura)
- `dateSchedules.json` — programações por data (pruned a 30 dias)
- `spotRotation.json` — índices de rodízio por cliente
- `playLog.json` — histórico de veiculação (cap 2000 entradas)
- `vmixCommandLog.json` — log de comandos vMix (cap 1000)
- `musicLibrary.json` — biblioteca musical (cap 50000)
- `musicStyles.json`, `musicSequences.json`, `autoBlocoAssignments.json` — AutoProg
- `audioLayers.json`, `audioStyles.json`, `videoStyles.json` — AudioPro/VideoPro
- `grafismoTitleInputs.json`, `grafismoTemplates.json` — Grafismos
- `vmixOutputProfiles.json` — perfis de saída vMix
- `deletedScheduleSlots.json` — slots intencionalmente apagados pelo operador
- `mediaDurationCache.json` — cache de durações lidas (cap 15000)
- `lastPlaybackSnapshot.json` — snapshot para retomada após restart

**Escrita atômica**: cada save usa `tmpfile + rename` para garantir consistência. Falha no meio nunca corrompe o JSON.
**Backups diários**: pasta `backups/` em `%APPDATA%/SpotMaster/`, máximo 30 backups, prune automático.

## Licença

Este projeto está licenciado sob GNU AGPL v3.
Veja [LICENSE](LICENSE).
