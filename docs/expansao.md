# VTMaster — Plano de Expansão do Ecossistema

> Documento estratégico — 31/05/2026
> Baseado na análise do código atual (v5.5.39) e no mercado brasileiro de broadcast.

---

## 1. A ideia é louca?

Não. É ambiciosa — e ancorada em algo real.

Você já tem um produto funcional em produção com clientes. O código-base tem módulos maduros que são exatamente a base de outros produtos da lista. A diferença entre "louco" e "viável" aqui é a ordem de execução e a decisão de não construir tudo de uma vez.

O mercado existe. Há mais de 4.500 rádios comunitárias no Brasil, a maioria usando planilha ou software pirata/desatualizado. Nenhum player nacional com suporte decente em português domina esse segmento. Esse é o buraco.

---

## 2. O que já existe no código (diagnóstico real)

Antes de falar do que falta, o que você já tem é mais do que parece:

| Módulo de código | Tamanho | O que faz |
|---|---|---|
| `DaySchedulePanel.tsx` | 2.199 linhas | Motor completo de programação do dia — base de qualquer produto de playout |
| `Campaigns/CampaignsPanel.tsx` | 1.097 linhas | Gestão de campanhas com distribuição automática e janelas de programação |
| `AdBreaks/AdBreaksPanel.tsx` | 601 linhas | Blocos comerciais com rodízio, preload, catch-up — motor comercial completo |
| `Playlist/PlaylistTable.tsx` | 613 linhas | Playlist com drag-drop, context menu, progress bar — reutilizável em qualquer player |
| `utils/autoprog.ts` | 450 linhas | Gerador de blocos musicais: cooldown, janela de artista, seleção ponderada |
| `utils/vmixCommandService.ts` | 88 linhas | Executor genérico de comandos com retry — não é acoplado ao vMix especificamente |
| `utils/vmixCommandCatalog.ts` | 132 linhas | 89+ comandos catalogados com nível de risco e validação |
| `utils/mediaDuration.ts` | 138 linhas | Lê duração de mídia (FFprobe + Windows API + fallback) |
| `Reports/ReportsPanel.tsx` | 463 linhas | Relatórios por período e cliente — base do CRM e da contabilidade |
| `Grade/GradePanel.tsx` | 421 linhas | Grade semanal com import/export — totalmente reutilizável |

**Conclusão:** você já tem 35-60% do código necessário para os módulos Opec, Audio e NDI. Não é partir do zero.

---

## 3. Análise por produto

### VTMaster vMix — o que temos hoje
**Status: estável, não mexer como produto principal**

Foque em manter e corrigir. É sua âncora comercial. Qualquer mudança estrutural aqui pode quebrar clientes em produção. Os novos produtos crescem a partir dele, não dentro dele.

O que pode migrar para os outros produtos (via monorepo): `autoprog.ts`, `vmixCommandService.ts`, tipos de dados, componentes UI base.

---

### VTMaster Opec — módulo comercial de emissoras
**Complexidade: Média | Reuso do código atual: ~40%**

A ideia é certa. Toda emissora precisa de um sistema de gestão comercial separado do operador de playout. O operador não precisa ver a parte financeira. O comercial não precisa mexer no playout.

**O que já existe e migra:**
- `Campaigns` completo (distribuição automática, janelas, renovação)
- `AdBreaks` com rodízio por anunciante
- `Clients` com CRUD de clientes e spots
- `Reports` com log de veiculação por cliente

**O que precisa ser construído:**
- Interface de roteiro (ordem dos programas, scripts de apresentação)
- Workflow editorial (aprovação de spots antes de entrar em veiculação)
- Geração de relatório de comprovante para o anunciante (prova de veiculação com timestamp)
- Integração de saída para o player (VTMaster vMix ou Audio)

**Mercado:** toda emissora que já usa o vMix vai querer o Opec junto. É o produto de upsell natural.

---

### VTMaster Audio — player de rádio
**Complexidade: Média-Alta | Reuso do código atual: ~35% | Maior potencial de mercado**

Este é o produto com maior alcance de mercado. Rádio comunitária não precisa de vMix. Precisa de um player estável, barato e brasileiro.

**O maior ativo que você já tem: `autoprog.ts`**

Esse arquivo de 450 linhas já faz exatamente o que qualquer player de rádio precisa:
- Seleção de músicas com cooldown de artista (evita repetir o mesmo artista cedo)
- Janela configurável (nunca repete a mesma faixa em X horas)
- Seleção ponderada por peso/estilo
- Fallback configurável quando a pasta não tem músicas novas

A diferença entre o VTMaster Audio e um player de rádio profissional moderno seria basicamente a interface e o scheduler horário. O motor já está pronto.

**O que precisa ser construído:**
- Interface de grade horária (diferente de DaySchedule — mais focada em rádio: drive time, tarde, madrugada)
- Crossfade de áudio nativo (sem vMix — via Web Audio API ou FFmpeg no Electron)
- Vinhetas automáticas entre blocos (já tem lógica no autoprog)
- Sincronização de hora com NTP (fundamental para rádio)
- RDS (RadioData System) para transmissoras FM que precisam enviar metadados ao transmissor
- Exportação para gravação (backup de veiculação por hora)

**Concorrentes diretos:** Jazler (espanhol, caro), RadioBoss (russo, caro), Wavecore (descontinuado), AzuraCast (open-source, web). Nenhum com suporte nativo em português e preço para comunitária.

**Precificação sugerida:** R$ 79-149/mês por emissora. 200 emissoras = R$ 16.000-30.000/mês recorrente.

---

### VTMaster NDI — o próximo passo técnico
**Complexidade: Alta | Reuso: ~25% | Maior diferencial técnico**

Sua intuição está certa: o NDI é o passo que desacopla você do vMix.

**O que seria:**
- Um mixer de vídeo interno com saída via NDI para qualquer software (vMix, OBS, vMixH, etc.)
- O vMix/OBS recebe um único input NDI (o VTMaster NDI) e não precisa saber nada sobre o que está dentro
- Toda a programação, transições, grafismos, áudio e mixagem acontecem dentro do VTMaster NDI

**Por que isso importa:**
- OBS é gratuito — abre um mercado enorme de produtoras, streamers e emissoras que não têm budget para vMix
- OBS tem 100M+ downloads. vMix tem talvez 50.000 usuários. O mercado potencial multiplica por 1.000
- Você controla 100% da stack, não depende das APIs do vMix mudarem

**O que precisa ser construído (e é difícil):**
- Integração com SDK NDI (NewTek/Vizrt — gratuito para dev, mas tem requisitos de licença para distribuição)
- Motor de composição de vídeo (precisaria de algo como WebGL, FFmpeg pipe, ou Electron + canvas nativo)
- Mixer de áudio multi-canal
- Transições (dissolve, wipe, push) renderizadas internamente

**Recomendação:** começar pela parte mais simples — um sender NDI que pega a saída do Chromium (Electron) e transmite como stream NDI. Isso sozinho já tem valor para produtoras.

**Biblioteca sugerida:** `grandiose` (Node.js binding para o SDK NDI) — já tem suporte a Windows.

---

### VTMaster CRM — gestão da carteira comercial
**Complexidade: Alta | Reuso: ~20% | Mas faça como web, não desktop**

A ideia faz sentido mas há uma decisão de arquitetura importante aqui: **não faça como app Electron.**

O time comercial não está na mesma máquina que o playout. Eles estão no celular em reunião, no notebook em casa, ou no tablet durante uma visita. Um CRM precisa ser acessível de qualquer lugar.

**Recomendação de arquitetura:**
- Backend: API Node.js/Fastify que o VTMaster Opec já expõe localmente
- Frontend CRM: Next.js hospedado (Vercel ou servidor próprio) — acesso via browser
- Mobile: PWA do Next.js (sem publicar na App Store inicialmente)

**O que reutiliza do código atual:**
- Modelo de dados de `Client` e `Campaign` — migra direto para o schema do banco
- Lógica de distribuição de spots — vira uma API route
- `Reports` — vira o dashboard do gerente

**O que precisa ser construído:**
- Pipeline de vendas (kanban: prospecção → proposta → fechamento → vigente → encerrado)
- Agenda de follow-up com notificação
- Metas por vendedor com dashboard de performance
- Integração de e-mail (nodemailer) e WhatsApp Business API
- Conexão bidirecional com Opec (spot aprovado no CRM → entra em veiculação no Opec)

---

### VTMaster Contabilidade — financeiro
**Complexidade: Muito Alta | Reuso: ~5% | Não construa do zero**

Seja realista aqui: contabilidade com NF-e, obrigações fiscais, SPED, folha de pagamento, conciliação bancária é um ERP. Empresas inteiras existem há 20 anos fazendo só isso.

**Construir isso do zero seria um erro estratégico.** Você perderia 2-3 anos e concorreria com Conta Azul, Omie, Totvs e Sage — que têm centenas de desenvolvedores.

**Recomendação: integração, não construção**

O VTMaster Opec gera o relatório de veiculação com valor e cliente. Esse dado é o input que o contador precisa. Exporte isso para:
- **Conta Azul** (via API REST — já tem documentação pública)
- **Omie** (API pública, muito usado por PMEs)
- **Tiny ERP** (API pública, popular em pequenas emissoras)

Isso resolve 80% da demanda "contabilidade" sem construir nada. O cliente importa o arquivo no sistema que ele já usa.

Se no futuro quiser ir além: uma tela simples de fluxo de caixa (entradas de contratos × saídas fixas × inadimplência) já seria "contabilidade suficiente" para rádio comunitária — isso sim vale construir, e é 3-4 semanas de trabalho.

---

## 4. Ordem de execução recomendada

```
Agora       →  VTMaster vMix (manter e corrigir)
Fase 1      →  VTMaster Audio (maior mercado, motor existe)
Fase 2      →  VTMaster NDI (maior diferencial, abre OBS)
Fase 3      →  VTMaster Opec (extrai o comercial do vMix)
Fase 4      →  VTMaster CRM (web, sobre o Opec)
Fase 5      →  Integração contábil (API para Conta Azul/Omie)
```

Por que Audio antes de NDI? Porque Audio gera receita mais rápido (mercado maior, complexidade menor) e financia o desenvolvimento do NDI, que é mais longo e incerto.

---

## 5. Arquitetura do ecossistema

Para que os produtos compartilhem código sem duplicar:

```
VTMaster-ecosystem/
├── packages/
│   └── shared/                  ← núcleo compartilhado
│       ├── types/               ← PlaylistItem, Client, Campaign, etc.
│       ├── autoprog/            ← motor de blocos musicais
│       ├── vmix/                ← vmixCommandService + catalog
│       ├── media/               ← mediaDuration, detecção de tipo
│       └── ui/                  ← Button, Modal, Badge, Field, etc.
├── apps/
│   ├── vtmaster-vmix/           ← produto atual
│   ├── vtmaster-audio/          ← player de rádio
│   ├── vtmaster-ndi/            ← mixer NDI
│   ├── vtmaster-opec/           ← módulo comercial
│   └── vtmaster-crm/            ← web (Next.js)
```

Cada `app` é um projeto Electron independente (ou Next.js para o CRM) que importa de `packages/shared`. Mudança no motor de autoprog beneficia todos os players ao mesmo tempo.

**Migração:** não precisa fazer tudo de uma vez. Começa extraindo o `packages/shared` do VTMaster atual, sem quebrar nada. Depois cada novo produto já nasce usando o shared.

---

## 6. Rebranding

"VTMaster" como marca guarda-chuva funciona bem. É técnico, memorável e já tem reconhecimento.

Sugestão de identidade visual:
- Logo principal: **VTMaster** (marca mãe)
- Cada produto: **VTMaster Audio**, **VTMaster NDI**, etc. — mesma tipografia, cor de acento diferente
- Paleta de cores por produto (Audio = frequência/onda sonora, NDI = sinal de vídeo, Opec = gráfico comercial)

O que **não** mudar: o nome VTMaster. Ele já está nos documentos dos clientes, nos e-mails de contrato, no boca-a-boca. Rebranding completo agora seria desperdiçar autoridade de marca que você já tem.

---

## 7. Riscos reais que você precisa conhecer

**1. Fragmentação de suporte**
Seis produtos = seis bases de usuários com problemas diferentes ao mesmo tempo. Um bug no Audio não é o mesmo que um bug no vMix, mas você vai receber o suporte dos dois simultaneamente. Planeje uma equipe de suporte antes de lançar o segundo produto.

**2. O NDI tem licença complexa**
O SDK NDI da Vizrt é gratuito para desenvolvimento, mas a redistribuição comercial em produto requer acordo com eles. Leia o NDI SDK License Agreement antes de começar esse produto. Há alternativas open-source (protocolo SRT + composição manual) mas perdem em compatibilidade.

**3. Rádio comunitária tem budget baixo**
O mercado é grande em volume mas cada cliente paga pouco. Você precisa de um produto quase zero-touch de suporte — onboarding via vídeo, documentação excelente, poucos bugs. Não dá para dar suporte 1:1 para 500 rádios comunitárias.

**4. Concorrência no Audio**
AzuraCast é open-source, roda em qualquer servidor Linux por R$ 0. Você precisa de um diferencial claro: melhor UX, suporte em português, instalador Windows sem precisar de servidor, integração com Opec. Se for só "player de rádio", vai perder para o gratuito.

---

## 8. Próximos passos concretos

1. **Essa semana:** Decidir se o VTMaster Audio ou NDI entra como Fase 1 (recomendo Audio)
2. **Mês 1:** Extrair `packages/shared` do VTMaster atual — sem quebrar nada, só organizar
3. **Mês 2-3:** Protótipo do VTMaster Audio com crossfade nativo e grade horária básica
4. **Mês 4:** Beta fechado com 3-5 rádios comunitárias (feedback de campo antes de lançar)
5. **Mês 5-6:** Lançamento do Audio com precificação, landing page e onboarding
6. **Mês 7+:** Iniciar NDI em paralelo com receita do Audio financiando

---

*Documento gerado em 31/05/2026 com base na análise do código v5.5.39 e no contexto de mercado brasileiro.*
