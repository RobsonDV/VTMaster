# VTMaster

Software desktop de veiculacao comercial para emissoras de TV com integracao nativa ao vMix.

## Sobre o projeto

O VTMaster automatiza a execucao de playlists comerciais, incluindo:

- Sequencia automatica de playout (PlayInput -> PreviewInput -> Cut)
- Autoplay por horario agendado
- Blocos comerciais com round-robin por anunciante
- Painel de inputs do vMix com arrastar e soltar para a playlist
- Log de veiculacao e geracao de relatorios PDF

Stack principal:

- Electron 41
- React 19
- TypeScript 6
- Vite 8

## Documentacao

Use este mapa para navegar na documentacao oficial do projeto:

- [docs/INDEX.md](docs/INDEX.md): indice central e trilhas por perfil
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): arquitetura e detalhes tecnicos completos
- [docs/ESTADO_ATUAL.md](docs/ESTADO_ATUAL.md): status funcional e backlog
- [release/LEIA-ME.md](release/LEIA-ME.md): guia de uso para operador final

## Requisitos

- Windows 10/11 64-bit
- Node.js 20+
- npm 10+
- vMix 20+ (para uso em producao)

## Instalar dependencias

```bash
npm install
```

## Rodar em desenvolvimento

```bash
npm run dev
```

Esse comando:

1. Compila o processo Electron (pasta electron -> dist-electron)
2. Sobe o servidor Vite (porta 5173)
3. Abre a janela Electron apontando para o frontend em dev

## Scripts disponiveis

- `npm run dev`: ambiente de desenvolvimento completo
- `npm run electron:compile`: compila apenas codigo Electron
- `npm run build`: build de producao (frontend + Electron)
- `npm run build:dist`: gera instaladores via electron-builder
- `npm run lint`: executa ESLint
- `npm run preview`: preview local do build web

## Build de distribuicao

```bash
npm run build:dist
```

Artefatos sao gerados em `release/`, incluindo:

- `VTMaster-1.0.0-Setup.exe`
- `VTMaster-1.0.0-Portable.exe`

## Estrutura principal

```text
spotmaster/
  electron/              # main process, preload e integracao com vMix
  src/                   # app React (UI, estado, componentes)
  docs/                  # documentacao tecnica e estado do projeto
  release/               # artefatos de distribuicao
  dist/                  # build frontend
  dist-electron/         # build Electron
```

## Persistencia local

Os dados do usuario ficam em `%APPDATA%/SpotMaster/` (Windows), incluindo:

- configuracoes
- playlist
- blocos comerciais
- anunciantes
- spots por anunciante
- log de veiculacao

## Licenca

Este projeto esta licenciado sob GNU AGPL v3.
Veja [LICENSE](LICENSE).
