# MEMORY.md — Diário vivo do VTMaster

> **O que é:** este arquivo é a memória do projeto entre sessões. A cada passo que damos
> (correção, feature, release, decisão), registramos aqui — assim nunca perdemos onde
> estamos. É um complemento curto e cronológico aos docs detalhados em `docs/`.
>
> **Como manter:** ao terminar um passo relevante, atualize **Estado atual** e adicione
> uma entrada no topo do **Registro** (mais recente primeiro). Seja conciso: o quê, por
> quê, e onde ficou no código/release. Detalhes técnicos profundos vão para
> `docs/ESTADO_ATUAL.md`.

---

## Estado atual

- **Versão:** 5.5.42 (botão "Regenerar do zero" na Programação do Dia)
- **Branch:** `main` (fluxo de release direto na main)
- **Última data:** 02/06/2026
- **Build/qualidade:** `eslint .` 0 problemas · `tsc -b --noEmit` 0 erros · `vite build` OK
- **Onde mora a lógica:** motor de playout e schedulers em `src/store/AppContext.tsx`

### Funções/conceitos-chave para lembrar
- **Autostart** (`settings.autoStart`): cold-start independente. Liga a programação no
  horário do bloco com o app parado, janela de tolerância **5 min**. Dono único do início
  a partir do idle (o `autoplayComerciais` não faz mais cold-start quando Autostart ON).
- **Autoplay Comercial** (`settings.autoplayComerciais`): dispara/interrompe para blocos
  comerciais **com a sequência já tocando**.
- **Playlist Contínua** (`settings.continuousPlayback`): após o bloco, segue a playlist.
- **Pausa** (`type: 'pause'`): quebra a sequência e volta ao idle (espera novo disparo).
- **Input no ar preservado:** Stop e Pause NÃO removem o input em PGM (não pula pra input
  aleatório); ele sai só na transição do próximo item.
- **Release:** `GH_TOKEN=$(gh auth token); npm run release:github` publica Setup/Portable/
  blockmap/latest.yml. Conferir com `gh release view vX.Y.Z`.

---

## Próximos passos / em aberto

- [ ] (Sugestão) Tornar a janela de tolerância do Autostart configurável nas Configurações
      (hoje fixa em 5 min, hardcoded em `AppContext.tsx` e `StatusBar.tsx`).
- [ ] Validar o Autostart e as correções de Stop/Pause em produção real com vMix.
- [ ] (Opcional) Validar o auto-update num cliente de teste (5.5.39 → 5.5.40).

---

## Registro (mais recente primeiro)

### 2026-06-02 — v5.5.42: botão "Regenerar do zero" (limpa o dia já executado)
- **Motivo:** o dia que JÁ abriu marcado como executado não era corrigido por "Atualizar"
  nem "Regerar" — ambos usam *merge*, que preserva `done`/`skipped` de propósito. Faltava
  uma ação de reset manual; e mesmo zerando os status, o *fired set* do dia ainda bloquearia
  os comerciais.
- **Fix:** nova ação `regenerateScheduleFresh(date)` no `AppContext` (exposta no contexto):
  REPLACE (tudo `pending`) + limpa o fired set comercial do dia (`localStorage
  spotmaster_fired_<data>` e o ref em memória se for hoje). Botão **"Regenerar do zero"**
  (ícone RotateCcw) na barra de ações da Programação do Dia, com confirmação; bloqueado se a
  sequência estiver tocando. Diferente de "Atualizar" (merge), que preserva o que tocou.
- **Uso:** quando o dia abrir "já executado", clicar **Regenerar do zero** → volta tudo a
  pendente e os comerciais podem disparar de novo.
- **Validação:** `eslint .` 0 · `tsc -b --noEmit` 0.

### 2026-06-02 — v5.5.41: dia não abre mais "já executado"
- **Sintoma reportado:** ao abrir o app, a Programação do Dia vinha com itens já
  marcados como concluídos (na imagem: 96/189 concluídos, blocos da noite "OK") com
  **0 veiculado** — o motor "achava" que já tinha rodado e pulava os blocos comerciais.
- **Causa raiz:** o efeito de startup só gerava programação nova se a data **não existisse**
  em `dateSchedules`; o `loadAll` só reseta `playing → pending` (mantém `done`/`skipped`).
  Status executados antigos persistiam e bleeded para o novo dia.
- **Fix (`AppContext.tsx`, efeito de auto-load no startup):** marcador
  `localStorage['vtmaster_last_active_date']` + heurística de carryover (há `done`/`skipped`
  mas **nenhuma** veiculação no playLog de hoje). Se o dia mudou desde a última sessão, ou
  na 1ª execução pós-fix com status órfão, regenera a programação do zero (REPLACE → tudo
  `pending`) e limpa o fired set do dia. Mesmo dia + itens realmente veiculados (playLog com
  entradas) = preserva (resume intacto). O midnight watcher também grava o marcador.
- **Resultado:** a cada novo dia a programação vem fresca (do template/AutoProg), sem itens
  marcados como executados. Same-day reopen continua preservando o que tocou (resume).
- **Validação:** `eslint .` 0 · `tsc -b --noEmit` 0.

### 2026-06-02 — v5.5.40 publicada
- **Autostart** (novo): toggle independente na Toolbar; scheduler dedicado (1s) que inicia
  a programação a partir do idle no horário do bloco, reusando `startScheduleFromNow`.
  Janela de tolerância de **5 min** — bloco vencido há mais de 5 min é ignorado (não toca
  material fora de hora), espera o próximo. Guarda anti-corrida desliga o cold-start do
  scheduler comercial quando Autostart ON. Countdown "AUTOSTART @HH:MM" na StatusBar.
- **Stop e Pause preservam o input no ar:** o full-sweep do fim do `runSequence` e do
  `stopPlayback` agora exclui o GUID que está no PGM. Antes, remover o input ativo fazia o
  vMix pular para um input aleatório. (Pause tinha o mesmo sintoma do Stop — mesma raiz.)
- **Disparo de comercial correto:** `loadNewInput` serializado por mutex (`loadLockRef`) e
  `pollForNewInput` casa o input novo por `filePath` — fim do "input aleatório" que ia ao
  ar segundos antes do comercial quando arming + preload concorriam.
- **Retomada de sessão global:** detecção casa o snapshot por `filePath` (fallback `id`) e
  aceita `pending`, sobrevivendo à regeneração de UUIDs do auto-sync. Banner virou global
  (`src/components/ResumeBanner/ResumeBanner.tsx` no `App.tsx`), visível em qualquer aba.
- **Arquivos tocados:** `src/store/AppContext.tsx`, `src/types/index.ts`,
  `src/components/Toolbar/Toolbar.tsx`, `src/components/StatusBar/StatusBar.tsx`,
  `src/App.tsx`, `src/components/DaySchedule/DaySchedulePanel.tsx`,
  `src/components/ResumeBanner/*` (novo), `src/i18n/pt.ts`, `src/i18n/en.ts`.
- **Release:** commit `feat(v5.5.40)` na main → push → `release:github`. Assets confirmados
  no GitHub: `latest.yml`, `Setup.exe`, `Setup.exe.blockmap`, `Portable.exe` (assinados).
- **Docs:** `docs/ESTADO_ATUAL.md` (Seção 30), `README.md`, `docs/INDEX.md` atualizados.
- **Convenção nova:** a partir de hoje mantemos este `MEMORY.md` como diário vivo.

### Antes de 2026-06-02
- Histórico completo de versões anteriores (v5.5.x e fases) está em `docs/ESTADO_ATUAL.md`
  e na tabela de versões de `docs/INDEX.md`. Este diário começa na v5.5.40.
