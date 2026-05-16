# PLANOGPT - Plano de evolucao do VTMaster

> Levantamento feito em 2026-05-14, estudando a documentacao local do projeto, a estrutura de codigo e a documentacao oficial do vMix.
> Objetivo: transformar o VTMaster em um playout de video mais robusto, mais previsivel em operacao ao vivo e mais rico em integracoes com vMix.

## 1. Resumo executivo

O VTMaster ja esta no caminho certo: ele nao e apenas uma playlist. Ele ja funciona como uma central de programacao para video, com grade semanal, programacao do dia, blocos comerciais, cadastro de anunciantes, AutoProg de midia, VideoPro, AudioPro, Banco de Midia, Saidas vMix, logs, relatorios, gatilho global, integracao HTTP com vMix, auto-update e um motor de playout orientado por GUID.

O proximo salto nao deveria ser "mais uma tela solta". O melhor caminho e criar uma camada profissional de operacao:

- preflight antes de colocar no ar;
- monitoramento mais preciso do vMix por eventos;
- controle mais amplo de titulos, overlays, audio, outputs, gravacao e streaming;
- comprovacao comercial mais forte;
- programacao musical mais inteligente;
- recuperacao e auditoria para operacoes longas.

Minha recomendacao principal: fazer uma "Fase vMix 2.0" antes de grandes telas novas. Ela criaria uma base unica de comandos vMix, assinaturas via TCP/TALLY, validacao de acoes, catalogo de funcoes e logs detalhados. Depois disso, fica muito mais seguro adicionar titulos, overlays, outputs, audio, gravacao e Data Sources.

## 2. O que o app ja tem hoje

Pelo codigo e docs, o VTMaster ja possui:

- Playout manual em `playlist`.
- Grade semanal em `weeklyGrid`.
- Programacao do dia em `dateSchedules`.
- Motor de playout em `src/store/AppContext.tsx`.
- Integracao vMix HTTP em `electron/vmix.ts`.
- Polling normal de vMix a cada 2s e fast polling a cada 500ms durante playback.
- Carga de midia via `AddInput`, corte por `PreviewInput` + `Cut`, reproducao via `PlayInput`, limpeza por `RemoveInput` usando GUID.
- Inputs permanentes do vMix por `inputName`, sem remover cameras, NDI ou graficos fixos.
- Blocos comerciais com mini-playlist: spot de cliente, acao vMix e input vMix.
- Rodizio round-robin por anunciante.
- Cadastro de clientes e spots.
- AutoProg de midia com sequencias mistas: estilos de video do VideoPro, estilos de audio do AudioPro, cooldown e alvo por quantidade ou duracao.
- VideoPro com estilos proprios de video; AudioPro com estilos proprios de audio e placeholder visual opcional.
- Painel Saidas vMix para Recording, Streaming, External, SRT Output, MultiCorder, Snapshot e perfis de output.
- Leitura de duracao de midia com cache e fallback nativo para MP4/MOV/M4V/M4A/3GP.
- Stop Next, ponto de pausa, skip, copiar/colar e drag-and-drop.
- Disparo global por teclado, gamepad e MIDI.
- Logs de veiculacao e relatorios PDF/CSV.
- Auto-update via GitHub Releases.
- Design system inicial com `Button`, `Modal`, `Field`, `SegmentedControl`, `Badge` e `PageHeader`.

## 3. Pontos fortes atuais

- O motor GUID-based e uma boa decisao tecnica. Evita remover input errado quando o vMix renumera entradas.
- O uso de wall-clock evita depender somente do estado do vMix para concluir itens.
- A separacao entre Playlist e Programacao do Dia esta correta para operacao real.
- O fluxo de comerciais com round-robin ja resolve uma dor importante de emissoras.
- O AutoProg misto abre um caminho muito bom para programacao tipo radio/TV, alternando video, audio e futuras vinhetas no mesmo ciclo.
- O auto-update ja coloca o produto em uma trilha de entrega continua.

## 4. Lacunas mais importantes

### Operacao ao vivo

- Falta uma tela de preflight antes de iniciar: arquivos ausentes, duracoes zeradas, blocos vazios, vMix offline, inputs permanentes nao encontrados, comandos vMix incompletos.
- Falta um "painel de saude" do vMix: status de recording, streaming, external, fade to black, active/preview, inputs em erro/loading, latencia dos comandos.
- O app ainda usa polling HTTP como principal forma de estado. Funciona, mas pode ser melhorado com TCP/TALLY.

### Integracao vMix

- A lista de acoes vMix na UI e pequena e hardcoded.
- Ainda nao ha modelagem propria para titulos GT/XAML: `SetText`, `SetImage`, `SetTextVisible`, `SetCountdown`, etc.
- Ainda nao ha uma camada para Data Sources do vMix.
- Ja existe painel dedicado para Saidas vMix, Recording, Streaming, External, SRT Output, MultiCorder e perfis basicos de output; ainda falta automatizar regras por grade e detectar com mais precisao recursos indisponiveis por edicao do vMix.
- Nao ha controle avancado de audio bus, ducking, volumes por item, matriz ou presets.

### Comercial e comprovacao

- Nao ha contrato/campanha com validade, quantidade contratada, faixa de horario, prioridade e separacao entre concorrentes.
- O relatorio comprova veiculacao por log interno, mas ainda pode evoluir para auditoria com snapshot, input GUID, horario real confirmado e estado do vMix.
- Ao excluir anunciante, ha risco de `clientSpots` orfaos conforme backlog local.

### Musica

- AutoProg ja existe, mas ainda falta biblioteca musical com metadados editaveis, tags, energia, ano, idioma, BPM, separacao por artista/titulo e historico mais granular.
- Falta simulacao de grade inteira com conflitos, buracos, excesso de duracao e avisos antes de gerar o dia.

### Engenharia

- Nao encontrei suite de testes automatizados no projeto.
- Persistencia ainda e JSON simples. Isso e bom para simplicidade, mas pede backup automatico, escrita atomica, versao de schema e restauracao.
- Ainda ha muitas telas com estilos inline, principalmente Clientes, Log, Reports, AutoProg e partes de AdBreaks/DaySchedule.

## 5. O que podemos usar mais do vMix

| Recurso vMix | O que o vMix oferece | Como incorporar no VTMaster | Valor para o operador |
|---|---|---|---|
| TCP API + TALLY | Porta 8099, comandos `FUNCTION`, `XML`, `XMLTEXT`, `SUBSCRIBE TALLY`, `SUBSCRIBE ACTS` | Criar `electron/vmixTcp.ts` para eventos em tempo real e fallback HTTP | Menos polling, tally imediato, preview/program mais confiavel |
| Shortcut Function Reference | Quase todas as funcoes de shortcut podem ser chamadas pela API | Criar catalogo tipado de funcoes e templates de acao | Acoes vMix muito mais ricas e menos erro manual |
| Titulos GT/XAML | `SetText`, `SetImage`, `SetTextColour`, `SetTextVisible`, `SetCountdown`, animacoes | Tela "Grafismos" com modelos: Agora, Proximo, Comercial, Logo, Clock | Visual no ar integrado a grade |
| Data Sources | Google Sheets, Excel, CSV, XML, Text, JSON e atualizacao automatica em titulos | VTMaster expor JSON local ou CSV com grade atual, proximo item, comerciais e logs | Titulos do vMix atualizam sem operador digitar |
| Overlays 1-8 | `OverlayInput1..8`, `OverlayInputAllOff`, preview de overlay | Presets de lower third, bug de patrocinador, logo, tarja de horario | Operacao visual mais profissional |
| Outputs 2-4 / Fullscreen / External | `SetOutput2/3/4`, Fullscreen, External, NDI/OMT/SRT conforme edicao | Painel "Saida" com perfis: Program, Clean Feed, MultiView, Input especifico | Controle de exibicao, streaming, retorno e gravação limpa |
| Recording / Streaming / SRT | Funcoes Start/Stop/StartStop para gravacao, streaming e SRT | Botoes de seguranca e automacoes por grade | Menos passos manuais no vMix |
| MultiCorder | Gravacao de multiplas fontes/outputs em edicoes especificas | Acionar/monitorar MultiCorder e registrar no log | Prova tecnica e backup de producao |
| Audio buses | Buses M/A-G, volume, gain, mute, plugins e send to master | Regras por item: ducking, mute de entrada, volume por bloco | Playout mais parecido com radio profissional |
| Layers/MultiView | `SetLayer*`, `SetMultiViewOverlay`, posicoes/crops/zoom | Templates de composicao: clipe + logo + chamada + camera | Layouts dinamicos sem mexer manualmente no vMix |
| Scripting | `ScriptStart`, scripts locais/globais em edicoes 4K/Pro/Max | Biblioteca de scripts aprovados e chamada por item | Automacoes complexas sem expor codigo ao operador |
| Triggers | OnCompletion, OnPlaybackRemaining, OnTransitionIn, etc. | Usar com cautela para eventos curtos; nao substituir o scheduler do VTMaster | Complementa a automacao no preset vMix |
| Browser inputs | `BrowserNavigate`, reload e controle de browser | Painel para abrir URLs de placar, noticias, agenda ou tela web local | Grafismos web e paineis remotos |
| Snapshot | `Snapshot` e `SnapshotInput` | Capturar evidencias de comerciais e erros | Comprovacao visual e troubleshooting |

Observacao de edicoes: alguns recursos dependem da edicao do vMix. Outputs 2-4, MultiCorder, scripts e overlays ampliados podem nao existir em todas as licencas. O VTMaster deve detectar a edicao no XML/status e esconder, bloquear ou avisar quando um recurso nao estiver disponivel.

## 6. Roadmap recomendado

### Fase 0 - Preflight e robustez operacional

Objetivo: reduzir risco antes de aumentar escopo.

Entregas:

- Botao "Validar Programacao" na aba Programacao.
- Checklist com severidade: erro, alerta, informacao.
- Validacoes:
  - vMix conectado;
  - arquivos existem;
  - duracoes zeradas;
  - inputs vMix permanentes encontrados;
  - blocos comerciais vazios;
  - anunciantes sem spot;
  - acoes vMix sem input/valor obrigatorio;
  - horarios duplicados ou blocos sobrepostos;
  - itens pendentes antes do horario atual;
  - espaco vazio entre blocos;
  - dia gerado a partir da grade atual.
- Snapshot automatico de backup antes de regenerar programacao.
- Escrita atomica dos JSONs: salvar em `.tmp`, validar e renomear.
- Backup local diario de `settings`, `weeklyGrid`, `dateSchedules`, `commercialBlocks`, `clients`, `clientSpots` e `playLog`.

Arquivos provaveis:

- `src/store/AppContext.tsx`
- `src/types/index.ts`
- `electron/main.ts`
- novo `src/utils/preflight.ts`
- novo painel/modal em `src/components/DaySchedule`

Status de implantacao em 2026-05-14:

- Escrita atomica dos JSONs implementada em `electron/main.ts`.
- Backup diario local implementado, com retencao automatica dos ultimos 60 snapshots.
- Backup preventivo antes de regerar/mesclar programacao existente e antes de excluir item do roteiro.
- IPC `create-backup` e `file-exists` expostos ao renderer.
- Preflight criado em `src/utils/preflight.ts`, validando vMix offline, arquivos ausentes, duracoes zeradas, inputs vMix, blocos comerciais, acoes vMix e conflitos basicos de horario.
- Botao `Validar` e modal de preflight adicionados na Programacao do Dia.
- Botao `vMix` com painel de saude/log dos comandos recentes adicionado na Programacao do Dia.
- Log persistente dos comandos vMix implementado em `vmixCommandLog`.

Complemento P0 em 2026-05-15:

- Exclusao de anunciante ficou transacional no reducer: remove cliente, spots do cliente, campanhas do cliente, itens pendentes na playlist/programacao, itens de blocos comerciais, slots legados e indice de `spotRotation`.
- Painel dedicado "Saude vMix" criado em `src/components/VmixHealth/VmixHealthPanel.tsx` e adicionado na sidebar/Command Palette.
- A tela de saude mostra conexao, edicao, Program/Preview, REC/STREAM/EXT/SRT/MultiCorder/FTB, inputs por tipo, inputs em estado suspeito e ultimos comandos com latencia/falha.
- Autoplay comercial reforcado para operacao 24h+: ao virar o dia com o app aberto, `sessionStartRef` e refs de interrupcao sao resetados antes de gerar a nova programacao; o preloader tambem reinjeta blocos se `lastLoadedDate` diz "carregado hoje" mas nao ha item do bloco em `dateSchedules[today]`.

### Fase 1 - vMix Bridge 2.0

Objetivo: centralizar e profissionalizar a integracao vMix.

Entregas:

- Criar uma camada `VmixCommandService` em vez de espalhar `window.spotmaster.vmixRequest`.
- Criar catalogo tipado de funcoes vMix:
  - nome;
  - categoria;
  - parametros exigidos;
  - suporte a `Input`, `Value`, `Duration`, `SelectedName`, `Mix`;
  - risco operacional;
  - edicao minima quando aplicavel.
- Evoluir `vmix_action` para suportar:
  - `duration`;
  - `selectedName`;
  - `selectedIndex`;
  - `mix`;
  - presets salvos.
- Validar acoes antes de salvar.
- Logar cada comando vMix com:
  - timestamp;
  - parametros;
  - resposta;
  - tempo de resposta;
  - item de origem.
- Adicionar retry/backoff para comandos criticos.
- Iniciar estudo/implementacao de TCP API:
  - conectar na porta 8099;
  - `SUBSCRIBE TALLY`;
  - `SUBSCRIBE ACTS`;
  - fallback para HTTP polling.

Resultado esperado: qualquer funcionalidade futura do vMix entra por uma base confiavel, com log e validacao.

Status de implantacao em 2026-05-14:

- Catalogo tipado de comandos criado em `src/utils/vmixCommandCatalog.ts`, com categoria, risco operacional, parametros obrigatorios e retry.
- Servico central criado em `src/utils/vmixCommandService.ts`, com `executeVmixCommand`, `executeVmixAction` e `requestVmixXml`.
- `vmix_action` evoluido para aceitar `duration`, `selectedName`, `selectedIndex` e `mix` sem quebrar os dados existentes.
- Preflight passou a validar acoes usando o catalogo central de comandos.
- Telas de acao vMix em Playlist, Programacao do Dia e Blocos Comerciais passaram a usar o catalogo compartilhado.
- IPC `vmix-request` passou a aceitar metadata operacional.
- Log `vmixCommandLog` passou a registrar origem, categoria, risco, item, roteiro, horario, fila, tentativa e resposta resumida.
- Fluxo critico do playout foi migrado para o servico central:
  - `AddInput`;
  - `SetPosition`;
  - `PreviewInput`;
  - `PlayInput`;
  - `Cut`;
  - `Pause`;
  - `RemoveInput`;
  - acoes vMix inseridas no roteiro.
- Comandos retryable agora passam pela politica de retry do servico.
- Consulta XML de status usada pelo motor foi isolada em `requestVmixXml`.

Pendencia deliberada desta fase: TCP/TALLY ainda deve entrar como uma subfase propria, porque exige teste com vMix real aberto na porta TCP para validar reconexao, framing de mensagens e fallback sem afetar operacao ao vivo.

### Fase 2 - Grafismos, titulos e Data Sources

Objetivo: fazer o VTMaster "falar no video", nao apenas tocar midia.

Entregas:

- Aba ou secao "Grafismos".
- Cadastro de inputs de titulo do vMix:
  - input/GUID/nome;
  - campos disponiveis;
  - presets de mapeamento.
- Acoes de titulo:
  - `SetText`;
  - `SetImage`;
  - `SetTextVisibleOn/Off`;
  - `SetImageVisibleOn/Off`;
  - `SetCountdown`;
  - `StartCountdown`;
  - `TitleBeginAnimation`.
- Templates prontos:
  - "Agora no ar";
  - "A seguir";
  - "Intervalo comercial";
  - "Patrocinador do bloco";
  - "Hora certa";
  - "Logo/bug da emissora";
  - "Plantao".
- Servidor local opcional do VTMaster para Data Sources:
  - `/data/now-next.json`;
  - `/data/schedule.json`;
  - `/data/commercials.json`;
  - `/data/log-today.json`.
- Botao para copiar URL local e instrucoes curtas para mapear no vMix Data Sources.

Valor: o operador passa a montar uma programacao que tambem alimenta tarjas, lower thirds, bugs e clocks no vMix.

Status de implantacao em 2026-05-15:

- Painel "Grafismos" criado em `src/components/Grafismos/GrafismosPanel.tsx` com 4 abas: GC Automático, Meus Títulos, Templates e Data Sources.
- **GC Automático**: configuracoes movidas do modal de Configuracoes para o novo painel. Dispara `SetText` para um input GT do vMix apos delay configuravel (padrao 5s). Parse do titulo do arquivo no formato `ARTISTA - MUSICA`. Dois modos: dinamico (linha 1 = artista, linha 2 = musica) e fixo (linha 2 = texto estatico). Ativacao de overlay por canal (1-4) com esconder automatico. Botao "Testar GC agora" que exibe o retorno real do vMix. Nota: API HTTP do vMix exige sufixo `.Text` no nome do campo GT (ex: `Artist.Text`). Guard: nunca dispara em itens com `adBreakId` (blocos comerciais).
- **Cadastro de inputs de titulo** (`GrafismoTitleInput`): nome do input no vMix + lista de campos com nome e rotulo. Campos cadastrados aparecem como dropdown ao criar templates.
- **Templates** (`GrafismoTemplate`): CRUD completo com botao "Disparar" manual. Mapeamento campo → fonte: `now_artist`, `now_song`, `now_title`, `next_artist`, `next_song`, `next_title`, `time`, `station`, `static`. Canal de overlay e duracao de esconder configuravel por template.
- **Data Sources**: servidor HTTP local no processo Electron (Node `http.createServer`), porta configuravel (padrao 7070). Endpoints: `/vtmaster/now-next`, `/vtmaster/schedule`, `/vtmaster/log-today`. CORS habilitado para acesso local do vMix. Botoes para copiar URLs com feedback visual. Push automatico de estado via `useEffect` no AppContext. IPC handlers: `datasources-update`, `datasources-start`, `datasources-stop`, `datasources-status`. Metodos adicionados no `SpotMasterAPI` e `preload.ts`.
- Novos tipos persistidos: `grafismoTitleInputs` e `grafismoTemplates` (incluidos no `BACKUP_KEYS`). `dataSourcesEnabled` e `dataSourcesPort` em `AppSettings`.

Pendencias desta fase: acoes `SetImage`, `SetCountdown`, `StartCountdown`, `TitleBeginAnimation` e `SetTextVisibleOn/Off` ainda nao implementadas como acoes de template (apenas `SetText` via Templates e GC); templates pre-construidos ("Agora no ar" etc.) nao existem como presets — o operador cria seus proprios; "Hora certa" nao atualiza em tempo real enquanto ativo (dispara uma vez); Data Sources serve apenas `127.0.0.1` — acesso de outras maquinas na rede previsto para a Fase 7.

### Fase 3 - Saida, gravacao, streaming e clean feed

Objetivo: transformar o VTMaster no painel de controle operacional da exibicao.

Entregas:

- Painel "Saidas vMix":
  - Output 1/2/3/4;
  - Fullscreen 1/2;
  - External;
  - Recording;
  - Streaming;
  - SRT Output;
  - MultiCorder.
- Perfis de output:
  - Program;
  - Preview;
  - MultiView;
  - Clean Feed;
  - Input especifico;
  - Mix especifico.
- Automacoes por grade:
  - iniciar gravacao no começo do programa;
  - parar gravacao no fim;
  - snapshot em comerciais;
  - ativar/desativar streaming;
  - trocar Output 2 para clean feed durante comerciais.
- Indicadores na StatusBar:
  - REC;
  - STREAM;
  - EXTERNAL;
  - FTB;
  - SRT.

Cuidados:

- Sempre exigir confirmacao para parar stream/gravacao em operacao.
- Respeitar edicao do vMix.
- Registrar tudo no log tecnico.

Status de implantacao em 2026-05-15:

- Painel "Saidas vMix" criado em `src/components/VmixOutputs/VmixOutputsPanel.tsx`, com abas Controle, Perfis e Automacoes.
- Controle ao vivo implementado para Recording, Streaming, External, SRT Output, MultiCorder e Snapshot, usando `executeVmixCommand` para registrar tudo no log tecnico central.
- Confirmacao obrigatoria via modal antes de parar Recording, Streaming, External, SRT Output e MultiCorder.
- Perfis de output persistidos em `vmixOutputProfiles`, com destino Output 2/3/4, Fullscreen 1/2 e External 2. Fontes suportadas: Program, Preview, MultiView, Clean Feed, Input especifico e Mix especifico.
- Catalogo vMix expandido com `StartStopRecording`, `StartStopStreaming`, `StartExternal`, `StopExternal`, `StartStopExternal`, `FullscreenOn/Off`, `SetOutputExternal2`, `SetOutputFullscreen`, `SetOutputFullscreen2`, `Start/Stop/StartStopSRTOutput`, `Start/Stop/StartStopMultiCorder`, `Snapshot` e `SnapshotInput`.
- StatusBar passou a exibir indicadores REC, STREAM, EXT, FTB e SRT quando o status do vMix informa esses estados.
- Parser de status vMix passou a carregar `external`, `srtOutput` e `multiCorder` quando essas tags existem no XML.
- Painel adicionado na sidebar e na Command Palette.
- Build validado com `npm run build` sem erros TypeScript/Vite/Electron.

Pendencias desta fase: automacoes por grade ainda ficam como receitas operacionais e acoes vMix inseriveis no roteiro, nao como uma tela dedicada de regras automaticas por programa; deteccao/ocultacao por edicao do vMix ainda depende do operador, porque o app so recebe a edicao textual do XML; o estado SRT/MultiCorder depende da tag existir no XML do vMix usado em operacao.

Complemento de seguranca em 2026-05-15:

- A limpeza de inputs temporarios do vMix foi reforcada para evitar apagar entradas permanentes criadas pelo operador.
- O VTMaster agora compara GUIDs existentes antes/depois do `AddInput` para descobrir qual input foi realmente criado, em vez de confiar em numero/ordem do vMix.
- Todos os caminhos de limpeza de preload, item anterior, abortos, sweep de sequencia, Stop e sessoes AudioPro passam por `removeOwnedInput`.
- `removeOwnedInput` so remove GUIDs rastreados como criados pelo proprio VTMaster; cameras, NDI, graficos fixos, inputs manuais e qualquer input nao adicionado pelo VTMaster nao entram nessa lista de limpeza.

### Fase 4 - Comercial Pro

Objetivo: sair de "lista de spots" para "campanha comercial".

Entregas:

- Cadastro de campanhas:
  - cliente;
  - nome da campanha;
  - data inicial/final;
  - spots vinculados;
  - quantidade contratada;
  - quantidade por dia;
  - faixas de horario;
  - dias da semana;
  - prioridade;
  - concorrencia/exclusao por categoria.
- Regras:
  - nao tocar dois concorrentes no mesmo bloco;
  - separacao minima entre spots do mesmo cliente;
  - limite por hora/dia;
  - compensacao automatica quando um spot falha;
  - alerta de campanha vencida.
- Relatorios:
  - comprovante por campanha;
  - saldo contratado x veiculado;
  - falhas e compensacoes;
  - exportacao para financeiro.
- Evidencia:
  - opcionalmente snapshot do Output no inicio do spot;
  - GUID do input usado;
  - status real do vMix no momento.

Status de implantacao em 2026-05-14:

- Tres novos tipos persistidos: `Segment`, `ProgramWindow` e `Campaign` em `src/types/index.ts`.
- Painel `src/components/Campaigns/CampaignsPanel.tsx` com 3 abas: Campanhas, Segmentos e Programas/Faixas.
- Cadastro completo de campanhas: cliente, nome, modalidade, data inicial/final, quantidade contratada, spots por dia, dias da semana, segmento, faixas de horario elegiveis, prioridade e status.
- Duas modalidades implementadas:
  - Padrao: botao "Distribuir" insere o cliente nos blocos elegiveis com shuffle aleatorio limitado por `spotsPerDay`.
  - Rotativo: posicao calculada de forma stateless por `daysElapsed % totalBlocks`, sem acao do operador.
- Gate de campanha em `expandBlockItems` (AppContext.tsx): se `bi.campaignId` definido, valida se campanha esta ativa e dentro das datas antes de incluir o item. Campanha expirada ou pausada e silenciosamente ignorada.
- `CommercialBlockItem`, `PlaylistItem` e `PlayLog` ganharam campo `campaignId?` para rastreabilidade completa ate o log de veiculacao.
- Detecao visual de conflito de segmento no painel de campanhas: alerta quando dois clientes do mesmo segmento estao no mesmo bloco.
- Badge de expiracao proxima (7 dias) e indicador de campanha rotativa com icone e cor roxa.
- LogPanel: coluna Campanha e filtro por campanha no historico de veiculacao.
- ReportsPanel: novo tipo "Relatorio por Campanha" com painel de progresso (contratados/veiculados/restantes/%).
- Novas chaves em `BACKUP_KEYS`: `campaigns`, `segments`, `programWindows` (total 16 chaves).
- i18n atualizado em `src/i18n/pt.ts` e `en.ts` para todos os novos termos.

Complemento em 2026-05-15:

- Bloqueio automatico de concorrentes na distribuicao implementado no `DistributeModal`: ao clicar "Distribuir", blocos que ja contem um cliente do mesmo segmento sao separados em lista "bloqueados por concorrencia de segmento" e excluidos da selecao automaticamente. O modal exibe os blocos bloqueados com o nome do concorrente e o icone de proibido. Se todos os blocos ficarem bloqueados, o modal exibe mensagem especifica sem permitir confirmar.
- Renovacao assistida implementada: botao "Renovar" aparece em campanhas expiradas, concluidas ou com mais de 90% de execucao. Abre modal com periodo anterior visivel, campos de novo inicio/fim pre-preenchidos (inicio = dia seguinte ao fim anterior, duracao preservada), opcao de marcar a anterior como Concluida e cria nova campanha com os mesmos parametros.
- Relatorio financeiro exportavel em CSV implementado no `ReportsPanel`: botao "Exportar CSV" ao lado do "Gerar PDF". No tipo "Campanha" sem campanha selecionada exporta resumo com uma linha por campanha (Contratado/Veiculado/Falhas/Restante/% Conclusao). Com campanha selecionada exporta log detalhado daquela campanha. Arquivo abre corretamente no Excel e Planilhas (BOM UTF-8, separador ponto-e-virgula).

Pendencia deliberada: snapshot de evidencia (captura de tela do Output no inicio do spot) depende da Fase 3 do PLANOGPT (Outputs/Recording/Streaming) e nao foi implementado.

### Fase 5 - Musical Pro

Objetivo: tornar o modo musical comparavel a automacao de radio, mas com saida de video.

Entregas:

- Biblioteca musical persistente:
  - arquivo;
  - titulo;
  - artista;
  - album;
  - ano;
  - estilo;
  - energia;
  - idioma;
  - BPM;
  - tags;
  - ultima veiculacao.
- Scanner com reconciliacao:
  - novos arquivos;
  - arquivos removidos;
  - arquivos renomeados;
  - duplicados por hash/tamanho/duracao.
- Regras de rotacao:
  - separacao por artista;
  - separacao por titulo;
  - teto de repeticao por dia;
  - vinheta a cada N musicas;
  - hora certa;
  - chamadas institucionais.
- Simulador:
  - gerar previa do dia inteiro;
  - mostrar repeticoes e conflitos;
  - recalcular bloco sem alterar programacao salva.

Status de implantacao em 2026-05-14:

- AutoProg implementado em versao anterior ao PLANOGPT: `src/utils/autoprog.ts` com motor de geracao de blocos musicais por estilos, sequencias, cooldown de artista e alvo por quantidade ou duracao.
- Tipos persistidos: `MusicStyle`, `MusicSequence`, `AutoBlocoAssignment` em `src/types/index.ts`.
- Painel AutoProg acessivel pela navegacao lateral com CRUD de estilos, sequencias e atribuicao por dia/bloco.
- `generateMusicBlockEngine` usa `getDuration(filePath)` para respeitar `targetMode: 'duration'`.
- Duracoes lidas pelo AutoProg alimentam `mediaDurationCache` persistido.

Pendencias desta fase: biblioteca musical com metadados editaveis (artista, album, ano, energia, idioma, BPM, tags) ainda nao existe — atualmente o AutoProg usa apenas estilos e sequencias de pastas/arquivos sem metadados ricos; scanner de reconciliacao (novos/removidos/renomeados/duplicados) nao implementado; simulador de grade inteira nao implementado.

Complemento em 2026-05-15:

- Tipo `MusicTrack` criado em `src/types/index.ts` com campos completos: `title`, `artist`, `album`, `year`, `genre`, `energy` (escala 1–5), `language`, `bpm`, `tags`, `lastAiredDate`, `playCount`, `duration`, `md5`, `missing`.
- `LibraryTab.tsx` adicionado ao painel AutoProg: CRUD de faixas, modal com edicao de todos os metadados, exibicao de energia como dots visuais, badge de faixa ausente e contador de veiculacoes.
- Scanner de reconciliacao via IPC `reconcileMusicFolders`: percorre as pastas dos estilos cadastrados, adiciona faixas novas, marca como `missing` as removidas e detecta duplicatas por MD5.
- `SimulatorTab.tsx` + funcao `simulateMusicDay()` em `autoprog.ts`: simula a grade musical de qualquer dia da semana, exibindo blocos gerados, faixas selecionadas, duracoes e avisos de regra (cooldown, artista repetido, etc.).
- `musicLibrary` incluida no `BACKUP_KEYS`, carregamento no `LOAD_ALL` e persistencia via `saveToStorage`.
- Actions `SET_MUSIC_LIBRARY` e `UPSERT_MUSIC_TRACK` adicionadas ao reducer do AppContext.

### Fase 6 - AudioPro

Objetivo: permitir o disparo manual de camadas de audio em paralelo ou substituindo o video em ar, com controle de round-robin de fontes e integracao direta com o motor vMix.

Entregas:

- Painel "AudioPro" na navegacao lateral (icone Volume2) com duas abas: Controle e Camadas.
- Cadastro de camadas de audio:
  - nome;
  - modo padrao: `replace` (vai ao PGM via PreviewInput+Cut) ou `parallel` (toca em paralelo, opcionalmente via overlay vMix);
  - tipo de fonte: `fixed_input` (input permanente do vMix) ou `round_robin` (lista de fontes rotativa);
  - canal de overlay 1–4 para modo paralelo;
  - volume padrao 0–100 (opcional);
  - lista de placeholders (fontes de audio).
- Placeholders de audio:
  - tipo `file`: arquivo em disco (MP3, WAV, AAC, OGG, FLAC, M4A, WMA, OPUS, AIFF ou video);
  - tipo `vmix_input`: input permanente do vMix pelo nome;
  - duracao opcional em segundos para timing do round-robin;
  - modo individual que sobrescreve o modo padrao da camada.
- Motor de disparo (`triggerAudioLayer`):
  - modo `fixed_input + replace`: PreviewInput > Cut > PlayInput > SetVolume;
  - modo `fixed_input + parallel`: PlayInput > OverlayInputN > SetVolume;
  - modo `round_robin + file`: usa `loadNewInput` do AppContext (AddInput + pollForNewInput + waitForInputReady + SetPosition) antes de play/overlay;
  - pre-carregamento proativo: proximo item agendado 2s antes do fim do atual;
  - limpeza automatica por GUID 200ms apos o fim;
  - sessoes independentes por camada: multiplas camadas ativas simultaneamente sem conflito;
  - indice round-robin persistido no estado global e restaurado ao reabrir o app.
- Motor de parada (`stopAudioLayer`): cancela todos os timers, remove input ativo por GUID, fecha overlay se canal configurado.
- Aba "Controle": card por camada com indicador de status ativo/inativo, dots de round-robin mostrando proximo, botoes Disparar/Parar/Proximo e tabela de historico de disparos da sessao.
- Aba "Camadas": CRUD completo com modal de camada (nome, modo, tipo, input fixo, overlay, volume) e modal de placeholder (nome, tipo, caminho/input, duracao, modo).
- Novo `SpotType` `'audio_trigger'` e campo `audioLayerId?` em `PlaylistItem` para integracao futura com o motor de playout.
- Persistencia: `audioLayers` em `BACKUP_KEYS`, carregamento no `LOAD_ALL` e auto-save via `saveToStorage`.

Arquivos criados ou modificados:

- `src/types/index.ts` — AudioLayer, AudioPlaceholder, AudioLayerMode, AudioLayerSourceType, AudioPlaceholderType; `audio_trigger` em SpotType; `audioLayerId?` em PlaylistItem
- `src/store/AppContext.tsx` — `audioLayers` em AppState e initialState; actions UPSERT_AUDIO_LAYER, DELETE_AUDIO_LAYER, ADVANCE_AUDIO_LAYER_INDEX no reducer; `audioLayerActive` (useState), `audioSessionsRef`, `triggerAudioLayer`, `stopAudioLayer` no Provider; AppContextValue estendido
- `electron/main.ts` — `'audioLayers'` em BACKUP_KEYS
- `src/App.tsx` — import AudioProPanel, Volume2; Panel type `'audiopro'`; navItem; rendering condicional
- `src/components/AudioPro/AudioProPanel.tsx` — container com abas Controle e Camadas
- `src/components/AudioPro/AudioProPanel.css` — estilos do painel inteiro
- `src/components/AudioPro/AudioLayersTab.tsx` — UI de configuracao de camadas e placeholders
- `src/components/AudioPro/AudioControlTab.tsx` — UI de controle ao vivo
- `src/i18n/pt.ts` e `en.ts` — chave `audio_trigger` adicionada

Status de implantacao em 2026-05-15:

- Implementacao completa. Build validado com 0 erros TypeScript e Vite.
- Motor de disparo usa `loadNewInput` do AppContext (mesmo fluxo do motor principal de playout): AddInput + poll de GUID + waitForInputReady + SetPosition antes de PlayInput. Garante que o arquivo esteja decodificado antes de qualquer comando de reproducao.
- Sessoes sao independentes por camada: multiplas camadas podem estar ativas ao mesmo tempo sem conflito de GUID ou timer.
- Indice round-robin persistido no estado e restaurado ao reabrir o app.
- Metadata `source: 'audiopro'` registrada em todos os comandos vMix para rastreabilidade no log de comandos.
- Todos os comandos vMix usam a assinatura correta do servico central: `executeVmixCommand(functionName: string, { input?, value?, meta?, validate? })`.

Pendencias desta fase: integracao do tipo `audio_trigger` no motor de playout (`playItem`) para disparo automatico de camada AudioPro durante a reproducao da playlist nao implementada — o disparo e manual via painel Controle; historico de disparos nao e persistido (resetado ao fechar o app); fade in/out entre itens do round-robin nao implementado.

### Fase 7 - Experiencia do operador

Objetivo: reduzir clique, ansiedade e erro.

Entregas:

- Modo "On Air" com tela simplificada:
  - agora;
  - proximo;
  - proximos 5;
  - tempo restante;
  - botoes grandes: Start, Next, Stop Next, Stop, FTB/Panic.
- Command palette:
  - buscar cliente, bloco, input vMix, acao vMix, data, relatorio.
- Atalhos configuraveis por acao:
  - Next;
  - Stop Next;
  - abrir overlay;
  - iniciar bloco comercial;
  - snapshot.
- Previa de midia:
  - player interno antes de adicionar;
  - thumbnail;
  - waveform simples para audio, se viavel.
- Melhor painel de inputs vMix:
  - agrupar por tipo;
  - mostrar PGM/PVW;
  - filtrar;
  - acionar preview sem adicionar na grade;
  - bloquear inputs criticos.

Status de implantacao em 2026-05-14:

- Botao "Stop Next" implementado na toolbar da Programacao (Fase 12/v5.0.0): termina o item atual e para a sequencia; estado armado com animacao pulse ambar; cancela com segundo clique ou stop manual. Ref `stopAfterCurrentRef` em `AppContext.tsx`.
- Cockpit operacional da aba Programacao implementado (Interface 2): bloco atual, proximo bloco/item, resumo do dia e acoes principais em destaque visual.
- Selecao visual de item: clicar no card o seleciona com borda e fundo accent; segundo clique deseleciona.
- Arrastar itens entre blocos diferentes: `scheduledTime` do item atualizado para o bloco de destino no drop.
- Copiar / Colar no menu de contexto: "Copiar item" e "Colar abaixo" com heranca de `scheduledTime` do bloco de destino.
- `BlockPickerModal`: lista de blocos para selecao quando nenhum item esta selecionado ao adicionar item.
- `VmixInputPanel` com prop `onAddInput` para uso na Programacao (insere abaixo do item selecionado).
- Painel lateral de inputs vMix (`VmixInputPanel`) disponivel na Programacao e na Playlist.
- Disparo global por teclado, gamepad e MIDI ja implementados desde Fase 3 (anterior ao PLANOGPT).
- Design system base em producao: `Button`, `Modal`, `Field`, `SegmentedControl`, `Badge` e `PageHeader` nos fluxos principais.

Complemento em 2026-05-15:

- Modo "On Air" implementado (`src/components/OnAir/OnAirPanel.tsx`): overlay fullscreen com Agora/A Seguir (4 itens), barra de progresso em tempo real, botoes grandes INICIAR/PARAR/AVANCAR, badge AO VIVO/PARADO. Ativado pelo botao "On Air" na sidebar (fica vermelho durante transmissao) ou pela Command Palette. ESC fecha.
- Command Palette implementada (`src/components/CommandPalette/CommandPalette.tsx`): Ctrl+K abre sobreposicao de busca fuzzy. Itens: ferramentas (On Air, Banco de Midia), todos os paineis de navegacao, anunciantes, campanhas ativas, camadas de audio. Navegacao por teclado (setas + Enter). ESC fecha.

Pendencias desta fase: previa de midia (player interno/thumbnail/waveform) nao implementada; atalhos configuraveis por acao (alem do disparo global) nao implementados; VmixInputPanel ainda nao agrupa por tipo nem mostra PGM/PVW (InputsTab do Banco de Midia mostra PGM/PVW via badge).

### Fase 7B - Banco de Midia e Gestao de Pastas

Objetivo: dar ao operador um painel lateral sempre acessivel com toda a midia disponivel (videos, audios, inputs vMix e acoes vMix), com insercao por "+" abaixo do item selecionado ou por drag-and-drop diretamente nas listas de Playlist e Programacao do Dia.

Entregas:

Biblioteca Musical — correcoes e importacao em massa:

- Botao "Importar Pasta" na LibraryTab, independente de ter estilos cadastrados:
  - abre seletor de pasta;
  - pergunta se inclui subpastas;
  - escaneia arquivos .mp3 / .wav / .flac / .m4a / .aac;
  - le metadados e calcula MD5 em paralelo;
  - faz upsert em lote na musicLibrary com barra de progresso;
  - exibe resumo: "N faixas importadas, M ja existiam".
- Reconciliacao melhorada:
  - quando nenhum estilo esta cadastrado, exibir callout "Use Importar Pasta para adicionar faixas sem precisar de estilos" em vez de desabilitar o botao;
  - apos reconciliar, botao "Importar todos os novos (N)" para upsert em lote das faixas novas encontradas.

Banco de Midia — drawer lateral direito (360px):

- Botao "Banco de Midia" na Toolbar (icone Database) abre/fecha o drawer; permanece aberto em qualquer painel.
- Quatro abas com icone e busca propria:
  - Videos: pastas de video cadastradas (salvas em `settings.videoFolders`); botao "Adicionar pasta" abre seletor de pasta; lista de arquivos por pasta com scan sob demanda (mp4 / mov / avi / mkv / wmv / mxf); busca por nome de arquivo.
  - Audios: `state.musicLibrary` com busca por titulo / artista / genero e filtro por estilo.
  - Inputs: `state.vmixStatus?.inputs` com filtro por tipo (VideoList, Camera, NDI, Audio); estado vazio se vMix desconectado.
  - Acoes: `VMIX_COMMAND_CATALOG` (itens nao ocultos) agrupados por categoria; campos de input/value inline por linha.
- Comportamento ao clicar "+":
  - insere o item abaixo do item atualmente selecionado no painel ativo (mesmo padrao do `VmixInputPanel`);
  - se nenhum item estiver selecionado, abre `BlockPickerModal` ja existente;
  - sem modal de escolha de destino — o operador controla o destino pela selecao visual.
- Drag and drop (Audios e Videos):
  - cards de audio e video no drawer sao `draggable`;
  - ao arrastar sobre a Playlist ou Programacao do Dia, aparece indicador de insercao entre os itens;
  - ao soltar, o item e inserido na posicao exata;
  - reutiliza o padrao `dragItem` / `dropItem` ja existente na Playlist e na Programacao;
  - inputs vMix e acoes vMix: apenas "+" (drag nao necessario para esses tipos).

Arquivos principais:

- `src/components/MediaBank/MediaBankPanel.tsx` — container do drawer (novo)
- `src/components/MediaBank/MediaBankPanel.css` — estilos (novo)
- `src/components/MediaBank/VideosTab.tsx` — aba de videos (novo)
- `src/components/MediaBank/AudiosTab.tsx` — aba de audios (novo)
- `src/components/MediaBank/InputsTab.tsx` — aba de inputs vMix (novo)
- `src/components/MediaBank/ActionsTab.tsx` — aba de acoes vMix (novo)
- `src/components/AutoProg/LibraryTab.tsx` — botao Importar Pasta + reconciliacao melhorada
- `src/types/index.ts` — `videoFolders?: string[]` em AppSettings
- `src/store/AppContext.tsx` — DEFAULT_SETTINGS.videoFolders: []
- `src/components/Toolbar/Toolbar.tsx` — botao Database + prop onToggleMediaBank
- `src/App.tsx` — estado showMediaBank + render MediaBankPanel como drawer

Status de implantacao em 2026-05-15: implementado completamente.

- Drawer lateral direito (360px) abre/fecha pelo botao "Database" na toolbar (ativo = cor primaria).
- Quatro abas:
  - **Videos**: pastas de video cadastradas em `settings.videoFolders`; botao "Adicionar" (browse); botao "Escanear" (scan sob demanda); toggle subpastas; busca por nome de arquivo; agrupado por pasta; "+" insere como item tipo `programa`.
  - **Audios**: lista `state.musicLibrary` com busca por titulo/artista/genero e filtro por genero; "+" insere como tipo `spot` com caminho e duracao da biblioteca.
  - **Inputs**: inputs do vMix carregados sob demanda (botao Refresh); agrupados por tipo (Video, Camera, Audio, Graficos, Mix, Outros); badge PGM/PVW em tempo real; "+" insere respeitando `spotTypeForVmix`.
  - **Acoes**: `VMIX_COMMAND_CATALOG` agrupado por categoria; campos inline para Input e Valor quando necessario; "+" insere `vmix_action`.
- Insercao detecta painel ativo: se `programacao`, insere em `dateSchedules[scheduleDate]` abaixo do item selecionado via `REORDER_DATE_SCHEDULE`; se `playlist`, usa `INSERT_PLAYLIST_ITEM_AFTER`; sem selecao, adiciona no final.
- Selecao de item levantada para App.tsx via `onSelectedItemChange` em PlaylistTable e DaySchedulePanel; armazenada em `selectedItemRef`.
- **Banco de Midia — Library Import**: botao "Importar Pasta" adicionado na aba Biblioteca do AutoProg. Abre seletor de pasta, pergunta sobre subpastas, escaneia arquivos de audio (.mp3/.wav/.flac/.m4a/.aac), le metadados via `readTrackMetadata`, calcula MD5, faz upsert em lote com barra de progresso inline e exibe resumo "N faixas adicionadas, M ja existiam". Botao Reconciliar agora funciona mesmo sem estilos (callout removido — aviso no title do botao).
- `videoFolders: string[]` e `audioFolders: string[]` adicionados em `AppSettings` e `DEFAULT_SETTINGS` (pastas extras alem das do AutoProg).
- IPC `scan-video-folder` adicionado em `electron/main.ts` e `preload.ts`.
- `SpotMasterAPI.scanVideoFolder` adicionado em `src/types/index.ts`.

Modularização 2026-05-15 (VideoPro + AudioPro expandido):

- **VideoPro** (novo painel na sidebar, `src/components/VideoPro/VideoProPanel.tsx`): CRUD de `VideoStyle` (nome, pasta, subpastas, cor). Estilos cadastrados aqui alimentam o Banco de Midia → Aba Videos. AutoProg/MusicStyles nao aparecem mais na aba Videos.
- **AudioPro** expandido: nova aba "Estilos" (`AudioStylesTab.tsx`) para CRUD de `AudioStyle`. Cada estilo tem pasta + configuracao de **placeholder visual**: tipo (`none | image | vmix_input`), arquivo de imagem, nome do input vMix e canal de overlay. Estilos cadastrados aqui alimentam o Banco de Midia → Aba Audios.
- **Motor de placeholder** em `AppContext.playItem`: quando um item com `mediaType === 'audio'` inicia, detecta o `AudioStyle` cuja `folderPath` e prefixo do `filePath` do item. Se o estilo tem `placeholderType !== 'none'` e `overlayChannel`, dispara `OverlayInputNIn` (com `SetImage` se tipo for `image`). Quando o item termina ou a reproducao para (`stopPlayback`), dispara `OverlayInputNOff`. Referencia armazenada em `activeAudioPlaceholderRef`.
- **Cores na programacao**: itens com `mediaType === 'audio'` recebem classe `row-audio` (PlaylistTable) e `audio-item` (DaySchedulePanel) — barra amarela na esquerda (`#f59e0b`), fundo levemente amarelado.
- **Novos tipos** em `src/types/index.ts`: `VideoStyle`, `AudioStyle`, `AudioStylePlaceholderType`.
- **AppState**: `videoStyles: VideoStyle[]`, `audioStyles: AudioStyle[]`.
- **Actions**: `ADD/UPDATE/DELETE_VIDEO_STYLE`, `ADD/UPDATE/DELETE_AUDIO_STYLE`.
- **BACKUP_KEYS** (`electron/main.ts`): `'videoStyles'`, `'audioStyles'`.
- **Banco de Midia**: `VideosTab` le de `state.videoStyles`; `AudiosTab (Pastas)` le de `state.audioStyles`. AutoProg/MusicStyles desacoplados dos dois.
- **AutoProg misto**: sequencias agora podem misturar estilos de audio e video no mesmo ciclo. `MusicSequenceItem` recebeu `mediaType?: 'audio' | 'video'`; o motor usa `scanMusicFolder` para audio e `scanVideoFolder` para video.
- **Legado corrigido**: estilos antigos em `musicStyles` representam o historico do VTMaster como player de video. Por isso entram como `Video - Nome (legado)`, nunca como audio. Audio so vem de `audioStyles`.
- **Geracao da programacao**: `generateMusicBlock` e `simulateMusicDay` usam fontes unificadas (`buildAutoProgStyleSources`) e preservam `mediaType` nos itens gerados, permitindo cor/placeholder correto na playlist e na Programacao do Dia.

Redesign anterior (pos-entrega inicial):

- **VideosTab**: agora exibe um **grid de cards de pasta** em vez de lista plana. Fontes atuais: estilos cadastrados no VideoPro (`state.videoStyles`) + pastas de video extras (`settings.videoFolders`). Ao clicar num card, entra no modo **browser** da pasta: escaneia arquivos de video (mp4/mov/avi/mkv/wmv/mxf/ts etc), mostra lista com extensor de arquivo e botao "+". Toggle de subpastas e botao de reescanear. Estilos de video sao geridos pelo VideoPro.

- **AudiosTab**: dividida em duas sub-abas:
  - **Pastas**: mesmo grid de cards que Videos, mas filtrando arquivos de audio (mp3/wav/flac/m4a/aac/ogg/opus). Fontes atuais: estilos cadastrados no AudioPro (`state.audioStyles`) + `settings.audioFolders`. Browser com auto-scan ao abrir.
  - **Biblioteca**: gestao completa de faixas cadastradas (`musicLibrary`). Botao "Importar Pasta" (lote com progresso), "Adicionar Arquivo" (individual com leitura de metadados), busca, botao de edicao rapida de metadados (titulo/artista/genero/duracao) via modal inline, botao "+" para inserir na programacao.

### Fase 8 - Produto multiestacao e continuidade

Objetivo: preparar uso por emissoras maiores.

Entregas:

- Perfis de emissora:
  - nome;
  - logo;
  - host vMix;
  - presets de outputs;
  - pastas de midia.
- Backup/restauracao assistidos.
- Exportar pacote de programacao com midias.
- Importar CSV/Excel de grade e comerciais.
- Controle de usuarios:
  - operador;
  - programador;
  - administrador.
- Modo remoto/tablet via web controller local do VTMaster.
- Sincronizacao em rede, quando a base local estiver madura.

## 7. Backlog priorizado

### P0 - Fazer primeiro

- [x] Preflight da programacao.
- [x] Backup automatico e escrita atomica dos JSONs.
- [x] Catalogo tipado de comandos vMix.
- [x] Logs tecnicos de comandos vMix.
- [x] Validacao de `vmix_action`.
- [x] Cleanup de anunciante ao excluir: `clientSpots`, campanhas, blocos comerciais, slots legados, playlist/programacao e rotacao.
- [x] Tela dedicada de saude do vMix.

### P1 - Alto impacto

- TCP/TALLY bridge.
- Titulos e overlays com `SetText`/`SetImage`.
- Data Source JSON local para vMix.
- Regras automaticas por grade para Saidas vMix/Recording/Streaming.
- Campanhas comerciais com validade e metas.
- Relatorio por campanha.
- Previa de midia.

### P2 - Diferenciacao

- Audio ducking e regras de bus.
- Biblioteca musical com tags.
- Simulador da grade inteira.
- Snapshots como evidencia.
- Templates de layer/multiview.
- Command palette.
- Painel On Air simplificado.

### P3 - Futuro

- Multiusuario.
- Sincronizacao em rede.
- Controle remoto web/tablet.
- Licenciamento por CNPJ/chave.
- Pacotes de midia transferiveis.

## 8. Melhorias especificas de UX/UI

- Concluir migracao do design system em Clientes, Log, Reports, AutoProg e AdBreaks.
- Remover gradualmente `style={{ ... }}` dos componentes operacionais.
- Padronizar todos os headers com `PageHeader`.
- Substituir `window.confirm` e `alert` por modais do design system.
- Criar estados vazios com acao direta:
  - "Cadastrar primeiro anunciante";
  - "Criar primeiro bloco";
  - "Conectar ao vMix";
  - "Validar programacao".
- Criar painel lateral "Inspector" para item selecionado:
  - arquivo;
  - duracao;
  - cliente;
  - comandos vMix;
  - historico;
  - status de validacao.
- Melhorar o fluxo "Adicionar item":
  - buscar arquivo;
  - escolher input vMix;
  - escolher acao vMix;
  - escolher grafismo;
  - escolher campanha.

## 9. Modelo tecnico sugerido para a Fase vMix 2.0

### Novos tipos

```ts
type VmixCommandRisk = 'safe' | 'live' | 'destructive'

interface VmixCommandTemplate {
  id: string
  functionName: string
  label: string
  category: 'input' | 'audio' | 'overlay' | 'title' | 'output' | 'recording' | 'data' | 'script' | 'other'
  requiresInput?: boolean
  requiresValue?: boolean
  supportsDuration?: boolean
  supportsSelectedName?: boolean
  supportsMix?: boolean
  risk: VmixCommandRisk
  editionHint?: string
}

interface VmixCommandLog {
  id: string
  at: string
  source: 'playout' | 'operator' | 'scheduler' | 'preflight'
  itemId?: string
  functionName: string
  params: Record<string, string>
  success: boolean
  latencyMs: number
  error?: string
}
```

### Nova camada

- `electron/vmix.ts`: continuar com HTTP.
- `electron/vmixTcp.ts`: TCP/TALLY/eventos.
- `src/services/vmixCommandCatalog.ts`: catalogo e validacao.
- `src/services/vmixCommandRunner.ts`: executor com log/retry.
- `src/components/Vmix/VmixHealthPanel.tsx`: painel de saude.
- `src/components/Vmix/VmixActionBuilder.tsx`: construtor de acao reutilizavel.

## 10. Regras de seguranca recomendadas

- Comandos de risco alto devem pedir confirmacao:
  - parar streaming;
  - parar gravacao;
  - remover input que nao foi criado pelo VTMaster;
  - `OverlayInputAllOff`;
  - `FadeToBlack`;
  - abrir preset;
  - executar script.
- Comandos de grade devem ser salvos como presets validados.
- O operador nao deve precisar digitar parametros vMix crus no fluxo comum.
- Sempre que possivel, usar GUID para inputs conhecidos.
- Para inputs permanentes, manter comportamento atual: nunca remover automaticamente.
- Se TCP cair, usar HTTP polling como fallback.
- Recursos dependentes de edicao do vMix precisam de aviso claro.

## 11. Primeira entrega recomendada

Entrega concluida como base P0:

1. Preflight da Programacao.
2. Catalogo tipado de acoes vMix.
3. Log tecnico de comandos vMix.
4. Painel dedicado de saude do vMix.

Isso melhora a confianca do operador imediatamente e prepara o terreno para todo o resto.

Checklist dessa entrega:

- [x] Criar `src/utils/preflight.ts`.
- [x] Criar catalogo tipado em `src/utils/vmixCommandCatalog.ts`.
- [x] Expandir `VmixActionItem` com parametros opcionais.
- [x] Migrar telas principais para usar o catalogo/construtor compartilhado.
- [x] Adicionar `vmixCommandLog` no estado/persistencia.
- [x] Criar modal "Validacao da Programacao".
- [x] Criar painel dedicado "Saude vMix" na sidebar/Command Palette.
- [x] Atualizar docs.
- [x] Rodar build.

## 12. O que eu nao priorizaria agora

- Reescrever persistencia para banco de dados antes de criar backup/escrita atomica.
- Multiusuario antes de resolver preflight, comandos vMix e auditoria.
- Controle remoto web antes de estabilizar seguranca operacional local.
- Replay/Instant Replay, a menos que o publico-alvo tenha demanda esportiva clara.
- PTZ completo, a menos que o VTMaster passe a ser tambem operador de cameras.

## 13. Fontes oficiais vMix consultadas

- HTTP Web API: https://www.vmix.com/help29/DeveloperAPI.html
- TCP API: https://www.vmix.com/help29/TCPAPI.html
- Shortcut Function Reference: https://www.vmix.com/help29/ShortcutFunctionReference.html
- Data Sources: https://www.vmix.com/help29/DataSources.html
- Types of Data Sources: https://www.vmix.com/help29/DataSourcesTypes.html
- Outputs / NDI / OMT / SRT: https://www.vmix.com/help29/SettingsOutputs.html
- NDI and OMT: https://www.vmix.com/help29/NDIandOMT1.html
- Scripting and Automation: https://www.vmix.com/help29/ScriptingandAutomation.html
- Triggers: https://www.vmix.com/help29/Triggers.html
- MultiCorder: https://www.vmix.com/help29/MultiCorder.html

## 14. Arquivos locais observados

- `README.md`
- `Leia-me.md`
- `docs/ESTADO_ATUAL.md`
- `docs/DEVELOPMENT.md`
- `docs/Melhoriadeinterface.md`
- `electron/vmix.ts`
- `electron/main.ts`
- `electron/preload.ts`
- `src/store/AppContext.tsx`
- `src/types/index.ts`
- `src/components/DaySchedule/DaySchedulePanel.tsx`
- `src/components/Playlist/ItemModal.tsx`
- `src/components/AdBreaks/AdBreaksPanel.tsx`
- `src/components/AutoProg/*`
- `src/components/Clients/ClientsPanel.tsx`
- `src/components/Log/LogPanel.tsx`
- `src/components/Reports/ReportsPanel.tsx`
- `src/components/Settings/SettingsModal.tsx`
