# Melhoria de Interface - VTMaster

> Documento de referencia para manter as decisoes de UX/UI vivas durante a evolucao do VTMaster.

## Diagnostico

O VTMaster ja tem uma base funcional forte: programacao do dia, estrutura semanal, blocos comerciais, anunciantes, playlist manual, vMix, log e relatorios. A sensacao atual de interface menos refinada vem principalmente de quatro pontos:

- A interface foi crescendo por fases, entao algumas telas parecem pertencer a familias visuais diferentes.
- Existem muitos estilos inline, o que dificulta manter botoes, campos, cards e modais consistentes.
- A identidade VTMaster ainda convive com resquicios de SpotMaster em textos, assets e nomenclatura.
- A hierarquia visual da operacao ao vivo pode ficar mais clara, principalmente na aba Programacao.

## Objetivo

Transformar a interface em uma experiencia mais coesa, profissional e segura para operador de TV/radio, priorizando leitura rapida, baixa chance de erro operacional e identidade visual consistente.

## Principios

- Operacao primeiro: o que esta no ar, o proximo item e os controles de play/stop/disparo precisam estar sempre claros.
- Densidade com ordem: telas operacionais devem ser compactas, mas escaneaveis.
- Cores com significado: verde para sucesso/play, vermelho para erro/on air/parar, amarelo para alerta, azul/ciano como identidade, laranja como apoio da marca.
- Icones para acoes recorrentes: botoes pequenos devem usar simbolos conhecidos com tooltip.
- Componentes reutilizaveis: evitar estilos inline em novos trabalhos.
- Marca limpa: usar versoes da logo adequadas para toolbar, icone, favicon, PDF e instalador.

## Etapas

### Fase 1 - Polimento rapido e coesao

Escopo:

- Corrigir sincronizacao da aba ativa entre estado persistido e layout.
- Atualizar textos visiveis que ainda dizem SpotMaster para VTMaster.
- Trocar favicon de template por uma marca VTMaster simples.
- Melhorar sidebar com icones e grupos visuais mais claros.
- Reorganizar a toolbar para separar acoes globais de acoes da tela atual.
- Criar pequenas bases CSS reutilizaveis onde fizer sentido, sem mexer no motor de playout.

Resultado esperado:

- Abertura do app volta para a ultima aba correta.
- Toolbar e conteudo concordam sobre a tela ativa.
- A marca VTMaster fica mais consistente.
- Navegacao fica mais rapida de reconhecer.

Status:

- Implementada.
- `App.tsx` passou a respeitar `activePanel` persistido.
- Sidebar recebeu icones e melhor proporcao visual.
- Toolbar foi reorganizada em acoes globais e acoes contextuais.
- Favicon VTMaster substituiu o icone de template.
- Textos visiveis principais foram alinhados com a marca VTMaster.

### Fase 2 - Redesenho operacional da Programacao

Escopo:

- Transformar a aba Programacao em cockpit operacional.
- Destacar bloco atual, proximo bloco e progresso de forma mais evidente.
- Criar uma linha/indicador de horario atual.
- Melhorar contraste entre bloco musical, comercial e programa.
- Deixar acoes de operacao sempre acessiveis.
- Revisar selecao, drag-and-drop, menu de contexto e painel de inputs vMix.

Resultado esperado:

- O operador entende em segundos o que esta no ar, o que vem depois e o que pode fazer.

Status:

- Implementado cockpit inicial da aba Programacao.
- Topo agora destaca Agora no ar/Bloco atual, Proximo e resumo do dia.
- Acoes principais da Programacao ficaram no cockpit: centralizar, atualizar, adicionar item, Inputs vMix, iniciar/parar.
- Lista de blocos agora marca visualmente bloco atual e proximo bloco.
- O cabecalho antigo foi mantido no DOM temporariamente e ocultado por CSS para reduzir risco nesta fase.

Pendencias para refinamento:

- Extrair o cockpit para componentes menores quando o design system da Fase 3 comecar.
- Revisar visual em maquina real com muitos blocos e nomes longos.
- Adicionar indicador de horario atual mais preciso dentro da lista, se necessario.
- Melhorar o painel de Inputs vMix dentro do novo contexto visual.

### Fase 3 - Design system interno

Escopo:

- Criar componentes base: Button, IconButton, PageHeader, Modal, Badge, Field e SegmentedControl.
- Migrar telas com muitos estilos inline para classes/componentes reutilizaveis.
- Unificar modais e formularios.
- Definir tokens de espacamento, raio, cor, borda, hover, focus e estados.

Resultado esperado:

- Novas telas ficam mais faceis de construir e a interface para de variar entre componentes.

Status:

- Implementado nucleo inicial do design system.
- Criados componentes base em `src/components/ui/`: `Button`, `Modal`, `Field`, `SegmentedControl` e `Badge`.
- Criado tambem `PageHeader` para padronizar cabecalhos operacionais.
- Criados tokens e classes compartilhadas em `src/components/ui/ui.css`.
- Migrados para a nova base:
  - `ItemModal`
  - `SettingsModal`
  - `ProgramSlotModal`
  - mini modal de horario em `App.tsx`
- Base aplicada tambem em:
  - `Toolbar`
  - `GradePanel`
  - `AdBreaksPanel`
- Fluxo de adicao na Programacao refinado:
  - `AddItemModal`
  - `BlockPickerModal`
  - modais de `Acao vMix`, `Input vMix` e `Horario Agendado`
- Reduzimos a dependencia de estilos inline justamente nos modais e formularios mais usados.

Pendencias para refinamento:

- Aplicar os componentes base nas telas restantes de operacao, principalmente Clientes, Relatorios e pontos do DaySchedule que ainda usam estilos locais.
- Expandir o uso de `PageHeader` e consolidar o mesmo padrao de cabecalho nos paineis restantes.
- Consolidar variantes visuais que ainda estao espalhadas em CSS local.

### Fase 4 - Marca e entrega

Escopo:

- Criar versoes da logo: horizontal, icone, monocromatica, favicon e splash.
- Aplicar marca em PDF, janela Electron, instalador e tela de loading.
- Revisar paleta oficial do produto.
- Remover resquicios visiveis de nomes antigos, mantendo compatibilidade tecnica quando necessario.

Resultado esperado:

- O VTMaster passa a parecer um produto unico, nao uma soma de telas.

## Backlog Visual

- Sidebar com icones e possivel agrupamento por Operacao, Planejamento, Cadastros e Comprovacao.
- Header padrao por painel com titulo, resumo e acoes.
- Botao de acao primaria unico por tela.
- Estados vazios mais uteis, com acao direta.
- Reducao gradual de estilos inline.
- Relatorios com identidade visual alinhada ao app.
- Tema claro revisado depois do tema escuro estar maduro.

## Observacoes Tecnicas

- A persistencia ainda usa caminhos e API `SpotMaster` por compatibilidade. Isso pode continuar internamente por enquanto.
- Textos visiveis para usuario devem preferir VTMaster.
- Mudancas visuais nao devem alterar o motor de playout, scheduler, vMix ou persistencia sem necessidade explicita.
