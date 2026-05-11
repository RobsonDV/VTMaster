# VTMaster — Índice de Documentação

> Última atualização: 10/05/2026

---

## Por perfil

### Operação (emissora / playout)
1. [release/LEIA-ME.md](../release/LEIA-ME.md) — Manual do operador
2. [docs/ESTADO_ATUAL.md](ESTADO_ATUAL.md) — Funcionalidades disponíveis

### Desenvolvimento
1. [README.md](../README.md) — Início rápido
2. [docs/DEVELOPMENT.md](DEVELOPMENT.md) — Documentação técnica completa
3. [docs/ESTADO_ATUAL.md](ESTADO_ATUAL.md) — Estado do produto, fases, backlog

### Release e distribuição
1. [README.md](../README.md) — Scripts de build
2. [release/LEIA-ME.md](../release/LEIA-ME.md) — Manual do instalador

---

## Conteúdo de cada documento

### [README.md](../README.md)
- Visão geral e instalação
- Como executar em desenvolvimento
- Scripts npm
- Build de distribuição
- Licença

### [docs/DEVELOPMENT.md](DEVELOPMENT.md)
- Arquitetura completa (Electron, React, IPC, estado global)
- Motor de playout: GUID-based, wall-clock, limpeza garantida
- Sistema de Disparo global (globalShortcut, captura de tecla, disparoInterruptRef)
- Sistema de Blocos Comerciais (scheduler, round-robin, autoplayComerciais)
- API `window.spotmaster` completa (preload.ts)
- Protocolo local-media://
- API do vMix (funções, sequência de corte, polling)
- Componentes: Toolbar, PlaylistTable, SettingsModal, AdBreaksPanel
- Tipos de dados, i18n, persistência

### [docs/ESTADO_ATUAL.md](ESTADO_ATUAL.md)
- Histórico de fases (Fase 1, 2 e 3)
- Bugs corrigidos e decisões técnicas
- Fluxos de negócio (playlist, blocos comerciais, disparo)
- Tipos de dados completos com comentários
- Estado global (AppState, AppContextValue, Actions)
- Persistência de dados e migração de versões
- Checklist de funcionalidades implementadas por fase
- Backlog — o que ainda não está implementado

### [release/LEIA-ME.md](../release/LEIA-ME.md)
- Manual para o operador de emissora
- Primeiros passos e configuração
- Como usar o Disparo
- Como configurar blocos comerciais
- Integração com vMix

---

## Ordem recomendada de leitura

**Para desenvolvedores:**
1. [README.md](../README.md) — rodar o projeto
2. [DEVELOPMENT.md](DEVELOPMENT.md) — entender a arquitetura
3. [ESTADO_ATUAL.md](ESTADO_ATUAL.md) — estado, decisões e backlog

**Para operadores:**
1. [release/LEIA-ME.md](../release/LEIA-ME.md) — instalar e usar
2. [ESTADO_ATUAL.md](ESTADO_ATUAL.md) seção 13 — lista do que funciona

---

## Histórico de versões

| Fase | Data | O que foi feito |
|------|------|----------------|
| Fase 1 | antes de 07/05/2026 | Motor de playout GUID-based, wall-clock, A/B Roll, limpeza garantida |
| Fase 2 | 07/05/2026 | Sistema de Blocos Comerciais, round-robin, scheduler, fast polling |
| Rebranding | 07/05/2026 | SpotMaster → VTMaster, logo, cor azul |
| Fase 3 | 10/05/2026 | Disparo global, Autoplay Comerciais, pré-carregamento configurável, indicador visual |
