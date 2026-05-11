# VTMaster v3.0

Software desktop de playout para emissoras de TV e rádio com integração nativa ao vMix.

## Sobre o projeto

O VTMaster automatiza a execução da grade de programação diária, incluindo:

- Grade semanal de programação (Estrutura): blocos musicais, blocos comerciais e programas
- Programação do Dia com view em cards por bloco, drag-and-drop e menu de contexto
- Sequência automática de playout no vMix (PlayInput → PreviewInput → Cut)
- Blocos comerciais com round-robin por anunciante e expansão inline de spots
- Disparo global via tecla configurável (funciona minimizado)
- Autoplay por horário agendado
- Log de veiculação e geração de relatórios PDF

Stack principal:

- Electron 41
- React 19
- TypeScript 6
- Vite 8

## Documentação

- [docs/INDEX.md](docs/INDEX.md): índice central e trilhas por perfil
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): arquitetura e detalhes técnicos
- [docs/ESTADO_ATUAL.md](docs/ESTADO_ATUAL.md): status funcional — v3.0
- [release/LEIA-ME.md](release/LEIA-ME.md): guia de uso para operador

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
| `npm run electron:compile` | Compila apenas código Electron |
| `npm run build` | Build de produção (frontend + Electron) |
| `npm run build:dist` | Gera instaladores via electron-builder |
| `npm run lint` | Executa ESLint |

## Build de distribuição

```bash
npm run build:dist
```

Artefatos gerados em `release/`:

- `VTMaster-3.0.0-Setup.exe` — instalador NSIS
- `VTMaster-3.0.0-Portable.exe` — executável portátil

## Estrutura principal

```
VTMaster/
  electron/              # main process, preload e integração vMix
  src/
    store/               # AppContext — estado global, motor de playout, scheduler
    components/
      Grade/             # Estrutura semanal (template de programação)
      DaySchedule/       # Programação do Dia (card-view, drag-and-drop)
      AdBreaks/          # Blocos comerciais com expansão inline
      Clients/           # Cadastro de anunciantes e spots
      Playlist/          # Playlist manual
      Log/               # Log de veiculação
      Reports/           # PDF
    types/               # Todos os tipos TypeScript
    i18n/                # PT e EN
    utils/               # time.ts
  docs/                  # Documentação técnica
  release/               # Artefatos de distribuição
```

## Persistência local

Dados salvos em `%APPDATA%/SpotMaster/` (Windows):

- `settings.json` — configurações
- `playlist.json` — playlist manual
- `commercialBlocks.json` — blocos comerciais
- `clientSpots.json` — spots por anunciante
- `weeklyGrid.json` — grade semanal (Estrutura)
- `dateSchedules.json` — programações por data
- `spotRotation.json` — índices de rodízio
- `playLog.json` — histórico de veiculação

## Licença

Este projeto está licenciado sob GNU AGPL v3.
Veja [LICENSE](LICENSE).
