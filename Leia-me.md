# VTMaster — Guia Completo do Operador

> **Versão 5.0.0** — Software de playout e grade de programação para emissoras de TV e rádio  
> Desenvolvido por **RobsonCostaDV** — Atualizado em 12/05/2026

---

## O que é o VTMaster?

O **VTMaster** é um software desktop para **Windows** que permite a emissoras de TV e rádio controlarem toda a execução da sua grade de programação diária de forma automatizada, integrado ao **vMix**.

Com ele, o operador monta a grade semanal uma única vez, cadastra os anunciantes e seus comerciais, e o sistema cuida de colocar tudo no ar na hora certa — gerenciando a sequência de vídeos, áudios, vinhetas, programas, blocos comerciais e ações do vMix, tudo com precisão wall-clock.

### Para quem é?

- Emissoras de TV que usam o vMix como switcher/playout
- Rádios que transmitem pelo vMix e precisam de automação de comerciais
- Produtoras e veículos que precisam programar e automatizar grade diária
- Operadores que querem ter controle visual completo do que vai ao ar

---

## Telas e Painéis

O VTMaster é organizado em **seis abas principais**, acessadas pela barra lateral:

| Aba | Ícone | O que você encontra |
|-----|-------|---------------------|
| **Playlist** | ▶ | Fila manual de reprodução — monte e execute uma sequência avulsa |
| **Estrutura** | 📅 | Grade semanal — defina o esqueleto de programação de cada dia da semana |
| **Programação** | 🗓 | Programação do dia — visualize, edite e execute a grade do dia selecionado |
| **Blocos Comerciais** | 💰 | Cadastre e gerencie os intervalos comerciais |
| **Clientes** | 🏢 | Cadastre anunciantes e os arquivos de spots de cada um |
| **Log / Relatórios** | 📋 | Histórico de veiculação e geração de relatórios PDF e CSV |

---

## Funcionalidades Detalhadas

### 1. Playlist Manual

A aba **Playlist** é o modo mais simples: você monta uma fila de arquivos e clica em Iniciar.

**O que você pode fazer:**
- Adicionar arquivos de vídeo, áudio, imagem ou ações do vMix
- Reordenar itens por drag-and-drop
- Definir horário agendado (`scheduledTime`) para cada item
- Arrastar inputs do vMix diretamente para a fila
- Usar o menu de contexto (botão direito) para inserir, duplicar, pular ou excluir
- Ver o progresso do item atual na StatusBar (barra inferior)
- Exportar e importar playlists como arquivo

**Sequência automática:**  
Ao clicar **Iniciar Playlist**, o VTMaster executa cada item em sequência:
1. Carrega o arquivo como input no vMix
2. Rebobina para o início
3. Envia para Preview
4. Realiza o corte para o Program (vai ao ar)
5. Aguarda o tempo do arquivo (wall-clock)
6. Pré-carrega o próximo item em background (10s antes do fim)
7. Avança para o próximo

---

### 2. Estrutura Semanal

A aba **Estrutura** é onde você define o **template de programação da semana**. Você cria slots para cada dia (Domingo a Sábado) com três tipos:

| Tipo de slot | O que é | Como preencher |
|-------------|---------|---------------|
| **Bloco Musical** | Sequência de músicas | Preenchido na aba Programação por arquivo [📁] |
| **Bloco Comercial** | Intervalo de spots de anunciantes | Configurado na aba Blocos Comerciais |
| **Programa** | Vídeo, câmera, vinheta ou ação vMix | Arquivo ou input vMix definido diretamente na Estrutura |

**Operações disponíveis:**
- Adicionar, editar e remover slots por dia
- Copiar a estrutura de um dia para outros (Seg–Sex, Fim de semana, ou dias específicos)
- **Exportar** a grade completa como arquivo `.vtgrid`
- **Importar** uma grade `.vtgrid` com seleção de quais dias aplicar

Ao clicar **"Aplicar no Ar"** (ou quando o app inicia sem programação do dia), a Estrutura é usada para gerar automaticamente a **Programação do Dia**.

---

### 3. Programação do Dia

A aba **Programação** é o **cockpit operacional** do dia. Aqui você enxerga e gerencia tudo que vai ao ar.

#### O que aparece na tela

- **Cockpit superior**: mostra o que está no ar agora, o próximo bloco/item e um resumo do dia
- **Lista de cards por bloco**: cada bloco aparece como um card colorido
  - 🎵 **Musical** — indigo: músicas do bloco com botão [📁] para adicionar arquivo
  - 💰 **Comercial** — verde: spots expandidos do bloco comercial
  - 📺 **Programa** — azul: vídeo ou câmera configurada

#### Operações de operação

| O que fazer | Como |
|------------|------|
| Adicionar arquivo a um slot vazio | Botão [📁] no item |
| Inserir nova música no bloco | Botão [+ Adicionar música] no card |
| Reordenar itens dentro do bloco | Drag-and-drop pelo handle ⠿ |
| Mover item para outro bloco | Drag-and-drop entre cards (hora agenda atualiza) |
| Selecionar item | Clique na linha (clique novamente deseleciona) |
| Adicionar item (arquivo, ação vMix ou input) | Botão "**+ Adicionar item**" na toolbar |
| Abrir painel de inputs do vMix | Botão "**Inputs vMix**" na toolbar |
| Iniciar a partir do horário atual | Botão "**Iniciar Programação**" |
| Iniciar a partir de um item específico | Menu de contexto → **"Iniciar daqui"** |
| Pausar (retomada possível) | Menu de contexto → **"Pausar"** |
| Parar após item atual (sem cortar) | Botão **"Stop Next"** na toolbar |
| Pular item | Menu de contexto → **"Pular"** |
| Copiar item | Menu de contexto → **"Copiar item"** |
| Colar abaixo | Menu de contexto → **"Colar abaixo"** |
| Duplicar item | Menu de contexto → **"Duplicar Item"** |
| Inserir ponto de pausa automática | Menu de contexto → **"Ponto de Pausa"** |
| Inserir ação vMix | Menu de contexto → **"Ação vMix"** |
| Sincronizar com a Estrutura | Botão **"Atualizar"** (modo merge — preserva o que está preenchido) |

#### Botão "Stop Next" _(novo em v5.0)_

Clique em **Stop Next** para armar a parada: o item atual termina normalmente (sem cortar o áudio ou vídeo) e a sequência para ao final. O botão pisca em âmbar enquanto armado. Clique novamente para cancelar.

#### Ponto de Pausa

Insira um **Ponto de Pausa** via menu de contexto para pré-programar onde a sequência deve parar automaticamente. Quando a reprodução chega no ponto de pausa, o vMix é limpo e a sequência aguarda o operador reiniciar manualmente.

#### "Iniciar Programação"

Ao clicar, o sistema identifica o bloco atual pelo horário e pula todos os blocos anteriores (marcando-os como concluídos). A sequência começa pelo bloco correto para o momento.

---

### 4. Blocos Comerciais

A aba **Blocos Comerciais** é onde você configura os intervalos comerciais que aparecem na grade.

**Cada bloco contém:**
- Nome e horário de disparo (`HH:MM:SS`)
- Filtro de dias da semana (ex: só de Segunda a Sexta)
- Mini-playlist de itens: spots de clientes (round-robin), ações vMix ou inputs vMix

**Round-robin por anunciante:**  
Cada cliente tem seus spots cadastrados na aba Clientes. Quando o bloco dispara, o sistema seleciona a quantidade configurada de spots de cada cliente em rodízio — nunca repete o mesmo spot duas vezes seguidas, e o índice é contínuo entre dias.

**Auto-sync:**  
Quando você salva alterações em um bloco, a programação de hoje é atualizada automaticamente (modo merge), sem precisar clicar em "Atualizar".

**Comportamento correto de comercial na sequência _(melhorado em v5.0)_:**  
Quando um bloco comercial é disparado automaticamente, os itens musicais que ficaram para trás **não são pulados** — eles continuam com status pendente visualmente. A sequência simplesmente avança para o próximo item de maior ordem após o comercial, garantindo continuidade correta da programação.

---

### 5. Clientes (Anunciantes)

A aba **Clientes** é o cadastro central dos anunciantes e seus materiais.

**O que você cadastra:**
- Nome do anunciante
- Spots: arquivo de áudio ou vídeo de cada peça publicitária
- Duração detectada automaticamente por arquivo

Os spots cadastrados ficam disponíveis para os Blocos Comerciais. O round-robin usa o índice de cada cliente de forma persistente entre sessões.

---

### 6. Log e Relatórios

A aba **Log** registra automaticamente tudo que foi veiculado.

**O que você encontra:**
- Histórico completo com data, hora, título, cliente, duração e status
- Filtros por data e tipo
- Exportação para **CSV** para abrir no Excel
- Geração de **relatório PDF** diário (todos os itens do dia)
- Geração de **relatório PDF por anunciante** (apenas os spots de um cliente específico)

---

## StatusBar — Barra Inferior

A barra inferior fica visível em todas as telas e mostra:

| Informação | O que é |
|-----------|---------|
| **◉ ON AIR** | Badge pulsante vermelho quando há reprodução ativa |
| **−MM:SS** | Countdown do item atual (tempo restante) |
| **Barra de progresso** | Faixa de 3px na base da janela, avança em tempo real |
| **Status vMix** | Conectado / Desconectado + host:porta |
| **Nome da emissora** | Configurado nas Configurações |

---

## Disparo Global

O **Disparo** é uma tecla configurável que controla a reprodução de qualquer lugar — mesmo com o VTMaster minimizado.

| Situação | O que o Disparo faz |
|---------|---------------------|
| App parado, há itens pendentes | **Inicia** a sequência |
| App tocando | **Avança** para o próximo item (interrompe o atual) |
| App parado, sem pendentes | Nenhuma ação |

**Configurar:**  
Abra **Configurações** → seção **Disparo** → clique em **"Capturar Tecla"** → pressione a tecla desejada (F1–F12, letras, combinações, teclas multimídia).

O Disparo também funciona com:
- **Gamepad**: qualquer botão do controle conectado via USB
- **MIDI**: qualquer dispositivo MIDI conectado ao computador

---

## Autoplay e Automação

### Autoplay por horário agendado

Items com `scheduledTime` definido são iniciados automaticamente quando o relógio do sistema chega na hora marcada (verificação a cada 1 segundo).

### Autoplay de Comerciais

Habilite **"Autoplay Comerciais"** para que os blocos comerciais sejam disparados automaticamente no horário configurado — sem precisar clicar em nada.

Quando ativado em modo automático, a sequência para entre blocos e aguarda o scheduler disparar o próximo. Em starts manuais, a sequência corre livremente sem parar entre blocos.

---

## Integração com vMix

O VTMaster se integra ao vMix via **API HTTP** (porta padrão `8088`).

**Configure em:** Configurações → vMix Host / Porta

### O que o VTMaster faz no vMix

| Operação | Quando |
|---------|--------|
| `AddInput` (vídeo/áudio/imagem) | Ao carregar cada item |
| `SetPosition` (rebobina) | Antes de cada reprodução |
| `PlayInput` | Para iniciar a reprodução |
| `PreviewInput` + `Cut` | Para colocar no ar |
| `RemoveInput` | Após o item terminar (por GUID — nunca por número) |
| `Pause` | Ao pausar a sequência |
| Qualquer função HTTP | Via item do tipo **"Ação vMix"** |

### Polling duplo

- **Normal** (2 segundos): mantém o status da conexão e lista de inputs
- **Fast** (500ms): só durante reprodução ativa — atualiza barra de progresso em tempo real

### Inputs permanentes

Câmeras, NDI, fontes virtuais e outros inputs permanentes do vMix **não são removidos** pelo VTMaster. Você pode usá-los na grade pelo nome do input.

---

## Configurações

Abra as **Configurações** pelo ícone de engrenagem na toolbar.

| Seção | O que configurar |
|-------|-----------------|
| **vMix** | Host, porta e autoconectar |
| **Emissora** | Nome da emissora (aparece na StatusBar e nos PDFs) |
| **Disparo** | Capturar tecla, habilitar/desabilitar |
| **Autoplay** | Autoplay geral e Autoplay de Comerciais |
| **Pré-carregamento** | Quantos minutos antes pré-carregar próximo item (1–60) |
| **Tema** | Escuro (padrão) ou Claro |
| **Idioma** | Português ou English |

---

## Tipos de Arquivo Suportados

| Tipo | Extensões |
|------|----------|
| **Vídeo** | MP4, MOV, AVI, MKV, WMV, FLV, WEBM, M4V e outros |
| **Áudio** | MP3, WAV, AAC, OGG, FLAC, M4A, WMA, OPUS, AIFF |
| **Imagem** | JPG, JPEG, PNG, GIF, BMP, WEBP, TIFF, ICO |

Arquivos de áudio são tratados como itens de áudio (sem vídeo) no vMix. Imagens ficam na tela pelo tempo de duração configurado.

---

## Fluxo de Trabalho Recomendado

### Configuração inicial (uma vez)

1. Abra **Configurações** → configure host/porta do vMix
2. Na aba **Clientes**: cadastre os anunciantes e adicione os spots de cada um
3. Na aba **Blocos Comerciais**: crie os intervalos (nome, horário, dias da semana, spots de cada cliente)
4. Na aba **Estrutura**: monte a grade semanal com blocos musicais, comerciais e programas
5. Opcionalmente, exporte a grade como `.vtgrid` para backup

### Operação diária

1. Abra a aba **Programação** → selecione a data de hoje
2. Clique **"Atualizar"** para sincronizar com a Estrutura (se necessário)
3. Preencha os slots musicais com arquivos [📁] ou [+ Adicionar música]
4. Verifique o cockpit superior (o que está programado para começar)
5. Clique **"Iniciar Programação"** para começar a partir do bloco atual

### Durante a transmissão

- A StatusBar mostra o que está no ar e o countdown
- O cockpit da Programação indica o bloco atual e o próximo
- Use o **Disparo** para controle sem mouse
- Use **Stop Next** para parar de forma suave no fim do item atual
- Insira um **Ponto de Pausa** onde quiser que a sequência aguarde o operador

---

## Atalhos e Dicas Rápidas

| Ação | Como |
|------|------|
| Iniciar/avançar | Tecla do Disparo (configurável) |
| Parar suavemente | Botão **Stop Next** (termina o item atual) |
| Parar imediatamente | Botão **Stop** |
| Pausar e retomar | Menu de contexto → Pausar / Iniciar daqui |
| Pausa pré-programada | Menu de contexto → Ponto de Pausa |
| Pular item | Menu de contexto → Pular |
| Mover item de bloco | Arrastar o handle ⠿ para outro card |
| Sincronizar comerciais | Automático ao salvar o bloco; ou botão Atualizar |

---

## Instalação

### Requisitos

- **Windows 10 ou 11** — 64 bits
- **vMix 20+** instalado e rodando (necessário para playout)
- Tela com resolução mínima de **1280×720**

### Instalar

1. Execute o arquivo `VTMaster-5.0.0-Setup.exe`
2. Siga o assistente de instalação
3. Abra o VTMaster
4. Configure o host e porta do vMix em **Configurações**

### Dados e backup

Todos os dados (grade, anunciantes, spots, configurações, log) ficam em:

```
%APPDATA%\SpotMaster\
```

Para fazer backup, copie essa pasta. Para restaurar, substitua a pasta antes de abrir o app.

---

## Perguntas Frequentes

**O VTMaster funciona sem o vMix?**  
Sim para montar e gerenciar a grade. Para colocar itens no ar, o vMix precisa estar rodando e acessível na rede local.

**Os dados ficam na nuvem?**  
Não. Tudo é armazenado localmente em `%APPDATA%\SpotMaster\`. O VTMaster não envia dados para a internet.

**Posso usar em duas emissoras?**  
Cada instalação é independente. Você pode exportar a grade como `.vtgrid` e importar em outra máquina.

**O Disparo funciona com o app minimizado?**  
Sim. O Disparo usa `globalShortcut` do Electron, que captura a tecla no sistema operacional independente do foco da janela.

**E se um arquivo não for encontrado?**  
O item é marcado como `erro` e a sequência avança automaticamente para o próximo, sem travar.

**Posso reordenar itens enquanto a sequência está rodando?**  
Sim. Itens com status `pending` (ainda não reproduzidos) podem ser reordenados livremente por drag-and-drop. O item em reprodução (`playing`) não pode ser movido.

**O que é "Atualizar" na aba Programação?**  
Sincroniza a programação do dia com a Estrutura Semanal em **modo merge**: itens já preenchidos (com arquivo ou já veiculados) são preservados; apenas stubs vazios e spots desatualizados são substituídos.

---

## Histórico de Versões

| Versão | Destaques |
|--------|-----------|
| **5.0.0** | Stop Next, correção de continuidade pós-comercial, leitura eager de duração de arquivos |
| **4.0.0** | Design system, cockpit da Programação, Fase 11 de robustez, redesign StatusBar |
| **3.3.0** | Fase 11: error handling no runSequence, log de arquivo não encontrado, polimento visual |
| **3.2.0** | Seleção visual de item, copiar/colar, arrastar entre blocos, BlockPickerModal |
| **3.1.0** | Ponto de Pausa, Export/Import de grade (.vtgrid), auto-sync de comerciais |
| **3.0.0** | Card-view por bloco, drag-drop, menu de contexto completo na Programação |
| **2.0.0** | Grade semanal, Programação do Dia como queue independente |
| **1.0.0** | Motor de playout GUID-based, blocos comerciais, Disparo global |

---

## Suporte e Desenvolvimento

Desenvolvido por **RobsonCostaDV**  
Repositório: [github.com/RobsonDV/VTMaster](https://github.com/RobsonDV/VTMaster)

Para relatar problemas ou sugerir melhorias, abra uma _issue_ no repositório.

---

*VTMaster v5.0.0 — 12/05/2026*
