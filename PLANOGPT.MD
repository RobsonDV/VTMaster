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
