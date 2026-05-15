# PLANOGPT - Plano de evolucao do VTMaster

> Levantamento feito em 2026-05-14, estudando a documentacao local do projeto, a estrutura de codigo e a documentacao oficial do vMix.
> Objetivo: transformar o VTMaster em um playout de video mais robusto, mais previsivel em operacao ao vivo e mais rico em integracoes com vMix.

## 1. Resumo executivo

O VTMaster ja esta no caminho certo: ele nao e apenas uma playlist. Ele ja funciona como uma central de programacao para video, com grade semanal, programacao do dia, blocos comerciais, cadastro de anunciantes, AutoProg musical, logs, relatorios, gatilho global, integracao HTTP com vMix, auto-update e um motor de playout orientado por GUID.

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
- AutoProg musical com estilos, sequencias, cooldown, janela de artista e alvo por quantidade ou duracao.
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
- O AutoProg musical abre um caminho muito bom para programacao tipo radio em video.
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
- Nao ha painel dedicado para Outputs 2-4, NDI/OMT/SRT, Fullscreen, External, Recording, Streaming e MultiCorder.
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

### Fase 6 - Experiencia do operador

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

Pendencias desta fase: Modo "On Air" simplificado (tela dedicada com agora/proximo/5 proximos/botoes grandes) nao implementado; command palette nao implementado; previa de midia (player interno/thumbnail/waveform) nao implementada; atalhos configuraveis por acao (alem do disparo global) nao implementados; VmixInputPanel ainda nao agrupa por tipo nem mostra PGM/PVW em tempo real.

### Fase 7 - Produto multiestacao e continuidade

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

- Preflight da programacao.
- Backup automatico e escrita atomica dos JSONs.
- Catalogo tipado de comandos vMix.
- Logs tecnicos de comandos vMix.
- Validacao de `vmix_action`.
- Cleanup de `clientSpots` ao excluir anunciante.
- Tela de saude do vMix.

### P1 - Alto impacto

- TCP/TALLY bridge.
- Titulos e overlays com `SetText`/`SetImage`.
- Data Source JSON local para vMix.
- Painel de Outputs/Recording/Streaming.
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

Se for escolher uma unica proxima entrega, eu faria:

1. Preflight da Programacao.
2. Catalogo tipado de acoes vMix.
3. Log tecnico de comandos vMix.
4. Painel de saude do vMix.

Isso melhora a confianca do operador imediatamente e prepara o terreno para todo o resto.

Checklist dessa entrega:

- Criar `src/utils/preflight.ts`.
- Criar `src/services/vmixCommandCatalog.ts`.
- Expandir `VmixActionItem` com parametros opcionais.
- Migrar `ItemModal`, `VmixActionModal` e `AdBreaksPanel` para usar o mesmo construtor de acao.
- Adicionar `vmixCommandLog` no estado/persistencia.
- Criar modal "Validacao da Programacao".
- Criar painel pequeno "Saude vMix" na toolbar/status.
- Atualizar docs.
- Rodar `npm run lint` e `npm run build`.

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
