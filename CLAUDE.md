# CLAUDE.md — SBK Capital | Plataforma FIDC/Factoring

> Este é o documento-mestre do projeto. Ele une a **visão de produto e design** com a **base de dados e regras de negócio** que sustentam a plataforma. Qualquer sessão de Claude Code neste repositório deve ler este arquivo por completo antes de tocar em qualquer tela, componente ou query.

---

## 1. O que estamos construindo

Uma plataforma web premium para a **SBK Capital**, empresa especializada em antecipação de recebíveis, operações estruturadas, crédito e soluções financeiras personalizadas para o mercado de **Factoring/FIDC**.

O produto nasceu como um painel em Power BI — já maduro, com mais de 60 medidas DAX, 9 fontes SQL e um conjunto de regras de negócio testadas em produção. Ele está sendo reconstruído como **aplicação web nativa**, conectada diretamente a um banco **SQL Server**, com dois pilares:

1. **Dashboard executivo e operacional** — exposição de carteira, comportamento de títulos, comissões, liquidez, risco, vencidos, relatórios analíticos e consultas operacionais.
2. **Interação por IA (RAG)** — uma área conversacional, no espírito de um ChatGPT financeiro, que responde perguntas em linguagem natural sobre os dados do cliente, usando este documento e o banco SQL Server como fonte de verdade.

O objetivo não é entregar "mais um sistema de gestão de recebíveis". O objetivo é o **efeito UAU**: um produto com aparência de software enterprise sofisticado, forte presença visual, acabamento impecável, navegação intuitiva e arquitetura pronta para crescer — em nível visivelmente acima do que o mercado de fomento mercantil está acostumado a ver.

### 1.1 Relação com a WBA — parceira potencial, não concorrente

O **WBA** (wba.com.br) é o sistema mais usado hoje no segmento por empresas de Factoring, Securitizadoras e FIDCs: no mercado há mais de 30 anos, modular, robusto em integrações (bancos, bureaus, custodiantes) e consolidado como ERP do setor. É também, hoje, quem opera o sistema e detém a base de dados da SBK Capital — ou seja, a fonte SQL Server deste projeto (seção 16) roda sobre a infraestrutura de um cliente WBA.

**Isso não faz da WBA uma concorrente. É o contrário: é uma parceira em potencial.** A plataforma que estamos construindo não substitui o ERP da WBA — ela se conecta aos dados que já existem nele e entrega uma camada analítica e de IA que o WBA hoje não oferece. Duas frentes comerciais futuras decorrem disso:

1. **SaaS complementar** — oferecer esta plataforma diretamente aos clientes da WBA (empresas de factoring/FIDC), como camada analítica + IA sobre os dados que eles já têm no WBA.
2. **Parceria com a própria WBA** — a WBA passa a oferecer este produto aos seus próprios clientes, rentabilizando com o serviço.

Isso muda o objetivo de design: não estamos tentando "vencer" o WBA em completude de ERP (cadastro, borderô, cobrança, integrações bancárias — isso continua sendo função do WBA). Estamos entregando **o que falta**: uma experiência visual e analítica premium, com IA conversacional nativa, que se encaixa ao lado do WBA em vez de competir com ele.

| Eixo | WBA (ERP operacional, parceiro de dados) | SBK Capital (camada analítica premium + IA) |
|---|---|---|
| Papel no ecossistema | Sistema de gestão/operação (cadastro, borderô, cobrança, integrações bancárias) | Camada complementar de analytics + IA sobre os mesmos dados |
| Percepção visual | ERP tradicional, denso, utilitário | Produto premium, "efeito UAU", visualmente irresistível |
| Interação com dados | Telas de consulta e relatórios fixos | Camada analítica + IA conversacional (RAG) em linguagem natural |
| Arquitetura | Legado modular consolidado | Web nativa, moderna, API-first, pronta para escalar |
| Modelo comercial futuro | Fonte de dados / parceiro de distribuição | SaaS oferecido a clientes WBA, ou white-label via a própria WBA |

Toda decisão de design e de produto deve reforçar esse posicionamento: somos o complemento premium e inteligente que se conecta à base de um cliente WBA (ou de qualquer outro ERP do setor) — não uma alternativa que compete pelo mesmo espaço.


---

## 2. Papel do Claude Code neste projeto

Ao trabalhar neste repositório, aja como uma combinação de:

- **Product Designer sênior**
- **UI Engineer premium**
- **Front-end engineer** especialista em dashboards corporativos e financeiros
- **Arquiteto de interfaces** para sistemas analíticos
- **Engenheiro de dados/backend**, fiel às regras de negócio documentadas na Parte II deste arquivo
- **Copiloto técnico** para evolução incremental do produto

Você constrói uma plataforma visualmente impressionante, tecnicamente organizada, e pronta para integração real com SQL Server, APIs, autenticação, segurança e o assistente conversacional.

**Regra central de decisão:** sempre que houver dúvida entre "comum" e "premium", escolha a solução mais refinada, limpa, elegante e impactante — desde que preserve a usabilidade. Se uma solução parecer "boa o suficiente", refine. Se parecer comum, eleve. Se parecer genérica, reprojete.

---

## PARTE I — Produto, Design e Experiência

### 3. Contexto de negócio

A SBK Capital atua com antecipação de recebíveis, financiamentos, operações estruturadas, investimentos e crédito personalizado. A plataforma deve refletir esse contexto com linguagem visual corporativa, segura, sofisticada e confiável — transmitindo inteligência financeira, solidez institucional, agilidade operacional e tecnologia aplicada ao negócio.

A interface deve comunicar, **sem precisar explicar**:

- confiança
- controle
- inteligência analítica
- velocidade operacional
- clareza na leitura de risco
- sofisticação institucional
- tecnologia orientada ao crédito

### 4. Referência visual do projeto

Os prints de referência do produto atual (Power BI) mostram um dashboard branco, corporativo, com forte uso de azul escuro institucional, áreas bem delimitadas, filtros no topo, botões segmentados, blocos analíticos, números grandes e tabelas operacionais densas.

Essas referências são **base estrutural de negócio**, não limite estético. O novo produto deve manter a clareza e organização desses layouts, mas **elevar fortemente** o nível de design, profundidade, microinterações, sofisticação visual e percepção de valor.

### 5. Sistema visual

**Estética geral:** a interface deve ser **premium, memorável e impecável**. Nada pode parecer genérico, improvisado, simples demais ou com "cara de dashboard admin padrão".

**A experiência visual deve transmitir:**
produto enterprise de alto valor · sofisticação institucional · segurança e credibilidade · tecnologia financeira moderna · clareza de leitura · refinamento visual · impacto comercial.

**O que evitar:**
aparência de template pronto · visual infantil · excesso de cores sem hierarquia · excesso de brilho gratuito · poluição visual · cards sem refinamento · tabelas com cara de sistema antigo · soluções comuns de backoffice sem personalidade.

#### 5.1 Paleta principal (oficial — paleta_sbk_v2)

Esta é a paleta de cores **oficial e definitiva** do projeto. Toda variável de cor no código (CSS custom properties, tokens do design system, Tailwind config etc.) deve derivar diretamente destes valores — não aproximar, não "chutar de olho".

| Token | Hex | Papel no produto |
|---|---|---|
| `--color-azul-marca` | `#12183F` | **Exclusivo da logomarca** — reproduzir a identidade visual (badge/ícone da SBK, painel de marca em telas de login/splash). Não usar como cor de UI geral |
| `--color-azul-escuro` | `#1A2347` | Cor primária institucional de UI — sidebar, topbar, headers, textos de maior peso, botões primários |
| `--color-azul-medio` | `#2E3F7F` | Estados ativos, links, hover, destaque e profundidade (equivalente ao "azul petróleo/aço" do briefing original) |
| `--color-cinza-prata` | `#C8CDD6` | Bordas, divisores, fundos neutros de apoio, texto secundário sobre fundo escuro |
| `--color-verde-escuro` | `#2D5C3A` | Positivo/aprovado forte — títulos pagos, situação regular, indicadores de saúde da carteira |
| `--color-verde-claro` | `#4A8C5C` | Positivo secundário — variações leves de sucesso, disponível, tags e badges |
| `--color-vermelho-risco` | `#B3495A` | **Semântica de risco** — vencidos, risco crítico, alertas negativos |
| `--color-ambar-alerta` | `#C99A3E` | **Semântica de atenção** — a vencer próximo do limite, pendências, avisos |

**Regra de uso:** `--color-azul-marca` (`#12183F`) é o tom exato da logomarca oficial (arquivo `Logomarca.jpeg`) e só deve aparecer onde a marca está sendo reproduzida literalmente — o badge/ícone da SBK, painéis de marca em telas de login, splash screens, materiais institucionais. Todo o restante da interface (sidebar, topbar, botões, textos) usa `--color-azul-escuro` (`#1A2347`). São dois tons propositalmente próximos, não intercambiáveis: um é "cor de marca", o outro é "cor de produto".

Branco e off-white (`#FFFFFF` / `#F7F8FA` sugeridos) seguem como fundo padrão das superfícies, como já era no briefing original.

`--color-vermelho-risco` e `--color-ambar-alerta` foram calibradas para dialogar com a paleta v2 (mesma saturação contida, mesmo tom "institucional desaturado") — não são vermelho/âmbar "de alerta de trânsito", são versões sóbrias, coerentes com o restante da paleta.

Roxo/violeta sutil deixa de ser cor padrão da paleta; só deve ser considerado no futuro se surgir uma necessidade funcional muito específica sem cor livre disponível nesta tabela.

#### 5.2 Superfícies

Fundos claros premium · cartões com leve profundidade · bordas sutis e refinadas · sombras elegantes e suaves · separação visual por camadas, nunca por peso excessivo.

#### 5.3 Tipografia

Extremamente limpa, corporativa e moderna · ótima hierarquia de títulos, subtítulos, labels e números · números sempre com leitura privilegiada · títulos curtos e firmes · sem excesso de pesos tipográficos desnecessários.

#### 5.4 Ícones

Finos, elegantes, consistentes · linha leve com acabamento premium · nunca caricatos ou pesados.

### 6. Direção de layout

**Estrutura principal esperada:**
sidebar ou navegação principal bem resolvida · topbar institucional/refinada · área de filtros e contexto · área central para módulos e indicadores · zonas específicas para tabelas, análises e IA · composição forte e equilibrada.

**Hierarquia de leitura da tela:**
1. navegação principal
2. contexto/filtros
3. indicadores/resumo
4. visão analítica detalhada
5. exploração operacional

**Espaçamento:** muito bem distribuído · sensação de organização e luxo corporativo · respiro suficiente para valorizar os componentes · evitar compressão visual.

### 7. Motion e interatividade

**Deve ter:** hover premium · transições suaves · sensação de profundidade · resposta visual elegante ao foco e clique · animações discretas, porém presentes · entrada de elementos com fluidez · sensação de produto vivo.

**Não deve ter:** animações nervosas · exagero de movimento · efeitos chamativos sem propósito · lag visual · teatralidade excessiva.

**Regra:** toda interação deve parecer pensada por um product designer sênior.

### 8. Componentes esperados

- **Botões e segmentações** — premium, estados ativos muito claros, boa leitura, feedback elegante no hover, sensação tátil refinada.
- **Filtros** — aparência limpa e poderosa, selects e inputs com excelente acabamento, foco muito bem resolvido, organização clara.
- **Cards analíticos** — números grandes, suporte a subtítulos e indicadores auxiliares, aparência de "painel executivo" (não de card genérico), valor visual alto mesmo quando simples.
- **Tabelas** — precisam ser um ponto forte do produto: leitura muito clara, cabeçalhos fortes, linhas limpas, densidade controlada, ações bem posicionadas, sem aparência de grid antigo.
- **Abas e menus** — destaque muito claro do item ativo, animação sutil, linha/glow/realce elegante, excelente legibilidade.
- **Área conversacional com IA** — experiência inspirada em ChatGPT, adaptada ao universo financeiro: clean, sofisticada, confiável, com foco em pergunta → contexto → resposta → ações → histórico. Deve parecer uma ferramenta séria de análise financeira e documental, não um chat casual.

### 9. Módulos do sistema

Considere estes módulos como o universo funcional recorrente do produto — mapeados diretamente para os grupos de dados e medidas descritos na Parte II:

| Módulo do produto | Base de dados / medidas equivalentes (Parte II) |
|---|---|
| Dashboard | 3.1 Valores e Totais, 3.2 Cards de Risco, 3.3 Contagens |
| Comercial | 2.2 COD_OPERADOR_INDICANTE, 3.7 Grupo Econômico, SIGVEN |
| Comportamental | 3.12 Comportamental (Acumulado), Dcalendario |
| Comissões | 2.9 SIGFIDC (M) — Módulo Comissões, 3.18 Comissões |
| Títulos Vencidos | STATUS_PAGTO, ATRASO_VENCIDOS, DIAS_ATRASO (1.1 SIGFIDC) |
| Exposição Cedente | 1.6 CADCRED, 3.4 Cedentes, 3.13 Risco Sacado e Concentração |
| Exposição Sacado | 3.13 Risco Sacado e Concentração |
| Liquidez | 3.9 Liquidez, 3.10 Recompra |
| Tarifa/Tarifário | 1.9 cadtarfidc, 3.14 Tarifário |
| Operações | 3.8 Tranche, 3.11 VOP, 3.15 Operações Bordero |
| Relatórios analíticos | Conjunto completo da Parte II |
| Cadastro de entidades e parâmetros | 1.2 SIGCAD, 1.6 CADCRED, 1.7 cadGrupoEmpresarial |
| Repositório documental | A definir na migração Web (sem equivalente Power BI ainda) |
| Aprovações | A definir na migração Web (sem equivalente Power BI ainda) |
| Configurações | A definir na migração Web |
| Integrações | A definir — ver seção 13 (SQL Server) |
| Interação por IA | Ver seção 12 (RAG) |

Ao criar qualquer tela, respeite a coerência com esse universo funcional e, sempre que o módulo já tiver equivalente na Parte II, **reutilize a regra de negócio documentada em vez de reinventá-la**.

### 10. Integração com dados

O banco principal é **SQL Server** (mesma instância já usada pelo Power BI: `10.0.0.213` / banco `FACTORING`) — essa base roda hoje sobre a infraestrutura operada pela WBA (ver seção 1.1). A plataforma se conecta a esses dados como camada complementar, não como substituta do sistema que os gera. Toda modelagem de interface deve considerar que haverá integração com: consultas SQL otimizadas, APIs internas, autenticação, perfis de usuário, filtros persistentes, drill-down operacional e explicações analíticas por IA.

**Regra técnica importante:** mesmo ao criar mockups ou protótipos front-end, a interface deve parecer pronta para dados reais. Não crie layouts fantasiosos desconectados da realidade operacional descrita na Parte II.

### 11. Regras de branding

Respeitar a identidade da SBK Capital quando presente na solução visual · manter linguagem institucional e corporativa · transmitir inteligência financeira · evitar qualquer estética incompatível com o mercado financeiro.

**Logomarca oficial:** badge arredondado em `#12183F` (ver `--color-azul-marca`, seção 5.1), com símbolo de cana-de-açúcar em tom esverdeado, wordmark "SBK" em branco, e a assinatura "SBKANA . FIAGRO" em caixa alta espaçada abaixo. Usar o arquivo de logo original (ideal: versão PNG/SVG com fundo transparente) — não recriar a marca com CSS/ícone em nenhuma tela final de produção; a reprodução com ícone é aceitável apenas em protótipos rápidos antes do asset estar disponível no projeto.

### 12. Interação por IA com dados (RAG)

A área de IA é uma parte estratégica do produto — não um recurso secundário. Ela deve permitir perguntas em linguagem natural sobre os dados da empresa, gerando respostas, análises, relatórios resumidos e explicações de indicadores com base no SQL Server, **usando a Parte II deste documento como base de contexto/regras de negócio**.

**Essa área deve transmitir:** inteligência · confiabilidade · clareza · contexto de negócio · apoio à tomada de decisão.

**Exemplos de uso esperados:**
- "Quais sacados concentram maior risco hoje?"
- "Qual cedente aumentou mais a exposição nos últimos 30 dias?"
- "Explique por que os títulos vencidos subiram este mês."
- "Mostre um resumo da carteira por comercial."
- "Quais clientes têm maior atraso médio?"
- "Qual o valor total de comissão do comercial X neste mês?"

**Regra de UX:** a resposta da IA deve parecer executiva, útil e orientada a negócio — nunca apenas técnica ou um despejo de dados brutos.

**Requisito de fundação para o RAG:** como definido na seção 5.13 da Parte II, esta documentação (nomenclatura, entidades, regras de negócio, relacionamentos) é a fonte de contexto candidata para alimentar o sistema de RAG. Nomes de colunas, medidas e regras devem permanecer descritivos e consistentes, evitando abreviações ambíguas, para facilitar indexação e recuperação semântica.

### 13. Como trabalhar neste projeto

**Antes de implementar qualquer tela, sempre:**
1. Entenda o objetivo de negócio da tela (consulte a Parte II se envolver dado ou regra de cálculo).
2. Preserve a identidade premium do sistema.
3. Pense na hierarquia visual antes dos detalhes.
4. Verifique como a tela conversa com as demais.
5. Priorize clareza + sofisticação.

**Ao propor soluções, sempre que possível:**
proponha uma direção visual consistente · preserve o padrão do produto · melhore o acabamento · evite regressão estética · entregue algo apresentável para cliente.

**Ao editar arquivos existentes:**
não destrua a estrutura boa já construída · altere apenas o necessário quando solicitado · preserve a identidade visual já consolidada · mantenha código limpo e escalável.

### 14. Regras de implementação

**Front-end:** HTML, CSS e JavaScript (ou framework adotado) organizados · estrutura escalável · sem código bagunçado · nomes claros · componentes reutilizáveis quando fizer sentido · responsividade obrigatória.

**Qualidade:** design impecável · código limpo · ótima legibilidade · boa performance · consistência entre telas · foco em produto real.

**Responsividade:** mesmo em telas desktop-first, a interface deve se adaptar bem. Não pode quebrar em resoluções menores.

**Estilo de resposta esperado do Claude Code:** seja objetivo · proponha soluções de alto nível · aja como especialista · descreva rapidamente o conceito antes de implementar quando a tarefa envolver design significativo · depois implemente com excelência · pense sempre em impressionar positivamente o cliente final.

### 15. Filosofia final do projeto

Este produto precisa parecer: exclusivo · premium · financeiramente robusto · tecnologicamente avançado · visualmente irresistível · pronto para encantar o cliente em demonstrações.

> **Referência final: criar uma plataforma financeira de alto impacto visual, com experiência premium, inteligência analítica e presença executiva, digna de efeito UAU — o complemento premium que qualquer ERP tradicional do setor, incluindo o WBA, hoje não oferece aos seus clientes.**

---

## PARTE II — Fundação de Dados e Regras de Negócio

> Esta parte é o "cérebro" do produto: veio da documentação técnica do projeto Power BI (SQL Server, Power Query/M, DAX) e deve ser tratada como **fonte de verdade das regras de negócio**, tanto para as telas do dashboard quanto para o assistente de IA (RAG). Regras de negócio vivem no **SQL** sempre que possível — não em recursos exclusivos de ferramenta — justamente para serem reaproveitadas diretamente pela API/backend Web, sem reescrita.

### 16. Banco de dados

SQL Server em `10.0.0.213`, banco `FACTORING`. Todos os scripts abaixo consideram apenas os códigos de operação `WHERE F.CODIGO IN (040, 041, 042, 046)`.

### 17. Entidades principais

| Tabela | Papel | Observação |
|---|---|---|
| **SIGFIDC** | Fato principal — todos os títulos do FIDC | Concentra a maior parte das regras de negócio calculadas via `CASE`/`CROSS APPLY`/CTEs |
| **SIGCAD** | Cadastro de cedentes e sacados | Relacionada via `CLIFOR`/`SACADO`. Traz `TAXA` (`FATORFIDC / 100.0`) |
| **SIGFLS** | Títulos/NFs | Relacionada via `CTRL_ID`. Contém `JUROS`, `JUROS_MENSAL` |
| **SIGBORS** | Borderôs | Fonte de `COD_OPERADOR_INDICANTE` (prioridade: `INDICANTE` > `OPERADOR`) e `prazo_medio` |
| **SIGVEN** | Cadastro de vendedores/comerciais | Origem de `COD_COMERCIAL` |
| **CADCRED** | Crédito dos cedentes | Mantida **separada** da SIGFIDC (ver seção 21.4). Contém `RISCO` calculado inline |
| **cadGrupoEmpresarial** | Lookup de grupos empresariais | — |
| **ESTADOCONFIRMACAOTITULO** | Lookup de estado de confirmação | Relacionada via `ESTADOCONFIRMACAOTITULO_ID` |
| **cadtarfidc** | Tarifas do FIDC | Por tipo: BORDERO, PROTEC, TED, entre outros |

### 18. Tabelas Power Query (M)

- **GrupoEmpresa** — dedup + mescla com `cadGrupoEmpresarial`.
- **COD_OPERADOR_INDICANTE** — segmentação Comercial; classifica cada operador/indicante em **Interno**/**Externo** via `Tipo_Comissao` (usada no módulo Comissões).
- **Atualização** — timestamp do último refresh em UTC-3.
- **Visao**, **Bloqueio**, **Metodo** — tabelas estáticas.
- **IntervaloDias**, **Dcalendario** — tabelas geradas em DAX.
- **SIGFIDC (M)** — consome o SQL da SIGFIDC e mescla com `COD_OPERADOR_INDICANTE`, adicionando `TAXA_COMISSAO` e `VALOR_COMISSAO` (módulo Comissões).

### 19. Regras de negócio centrais (as que a IA e o produto mais vão usar)

#### 19.1 STATUS_PAGTO

| Status | Regra |
|---|---|
| **Vencido** | (`DTPGTO` preenchido + `BANCO` vazio + vencimento < hoje) OU (`DTPGTO` nulo + vencimento < hoje) |
| **A Vencer** | (`DTPGTO` preenchido + `BANCO` vazio + vencimento ≥ hoje) OU (`DTPGTO` nulo + vencimento ≥ hoje) |
| **Pago Em Dia** | `DTPGTO` preenchido + `BANCO` preenchido + vencimento ≥ `DTPGTO` |
| **Pago Vencido** | `DTPGTO` preenchido + `BANCO` preenchido + vencimento < `DTPGTO` |

> Nota histórica: até a v6 da documentação, um bug classificava **qualquer** título com pagamento parcial (`DTPGTO` preenchido + `BANCO` vazio) como `'Vencido'`, sem checar a data de vencimento — títulos com vencimento futuro apareciam como vencidos assim que recebiam pagamento parcial. Corrigido na v7 comparando a data de vencimento com `GETDATE()` também nesse cenário. **Na plataforma Web, implementar direto com a regra correta acima.**

#### 19.2 TIPO_PAGAMENTO

| Tipo | Regra |
|---|---|
| Pagamento Pendente | `DTPGTO` nulo + `BANCO` vazio |
| Pagamento Parcial | `DTPGTO` preenchido + `BANCO` vazio |
| Pagamento Total | `DTPGTO` preenchido + `BANCO` preenchido |

#### 19.3 JUROS_MENSAL

Juros compostos convertidos de período para taxa mensal:

```
(1 + JUROS / VALOR) ^ (30 / (PRAZO + FLOT)) - 1
```

Retorna `NULL` quando `PRAZO + FLOT = 0`, `VALOR = 0`, ou a base é ≤ 0.

#### 19.4 estoque_vencido e ATRASO_VENCIDOS

- **estoque_vencido**: `'Sim'` quando `DTPGTO > VENCIMENTO`, ou `DTPGTO` nulo e vencimento < hoje.
- **ATRASO_VENCIDOS**: reusa `DIAS_ATRASO` (calculado via `CROSS APPLY`) para classificar em `'Vencido -5 dias'` (≤ 5 dias) ou `'Vencido +5 dias'` (> 5 dias).

#### 19.5 StatusTranche e DataFuturaTranche

Calculadas no SQL via `CROSS APPLY` e CTE `PrazoTranche` (deduplicada por `ROW_NUMBER`). `DataFuturaTranche` = `DTBORDERO + PrazoLimiteConfirmacaoDeTitulos` (de `CADCRED`). `StatusTranche` compara `DataFuturaTranche` com `GETDATE()`.

#### 19.6 Módulo Comissões

- **Tipo_Comissao**: `CODIGO` (texto) igual a `099`, `108`, `010`, `033`, `078` ou `080` → `Interno`; demais → `Externo`.
- **TAXA_COMISSAO** (faixas sobre `JUROS_MENSAL`, não sobre `JUROS` bruto):

  | Faixa de JUROS_MENSAL | Taxa de comissão |
  |---|---|
  | nulo/vazio | 0% |
  | 0% a 2,1% | 3% |
  | 2,1% a 2,29% | 4% |
  | 2,29% a 2,39% | 5% |
  | acima de 2,39% | 6% |

- **VALOR_COMISSAO** = `JUROS` (valor bruto) × `TAXA_COMISSAO`.
- **comissao_comercial** soma `VALOR_COMISSAO` apenas para linhas com `COD_COMERCIAL` preenchido.

#### 19.7 RISCO (CADCRED)

Soma de `VALOR_` (SIGFIDC) para títulos em qualquer situação de risco (vencido, a vencer, pendente), calculada via subquery correlacionada por `CLIFOR`, respeitando o mesmo filtro `CODIGO IN (040, 041, 042, 046)`.

### 20. Relacionamentos do modelo

| De | Coluna | Para | Coluna | Cardinalidade | Observação |
|---|---|---|---|---|---|
| SIGFIDC | CLIFOR | SIGCAD | CODIGO | *:1 | — |
| SIGFIDC | BORDERO | SIGBORS | BORDERO | *:* | Ver 21.5 |
| SIGFIDC | SIGFLS | SIGFLS | CTRL_ID | *:1 | — |
| SIGCAD | BLOQUEIO | Bloqueio | id | *:1 | — |
| SIGCAD | CODIGO | CADCRED | CLIFOR | 1:1 | Mantidas separadas — ver 21.4 |
| SIGBORS | COD_OPERADOR_INDICANTE | COD_OPERADOR_INDICANTE | CODIGO | *:1 | — |
| CADCRED | GERENTECONTA | COD_OPERADOR_INDICANTE | CODIGO | *:1 | — |
| GrupoEmpresa | clifor | CADCRED | CLIFOR | 1:1 | — |
| GrupoEmpresa | idgrupo | cadGrupoEmpresarial | id | *:1 | — |
| SIGFLS | CLIFOR | GrupoEmpresa | clifor | *:1 | — |
| CADCRED | METODOCALCULOFIDC | Metodo | id | *:1 | — |
| SIGFLS | ESTADOCONFIRMACAOTITULO_ID | ESTADOCONFIRMACAOTITULO | CTRL_ID | *:1 | — |
| cadtarfidc | clifor | SIGCAD | CODIGO | *:1 | — |
| SIGFLS | DTBORDERO | Dcalendario | Date | *:1 | **Inativo** (equivalente a "opcional" — ver 21.7) |

`Visao` e `IntervaloDias` não têm relacionamento — no Power BI eram controladas via `SELECTEDVALUE` nas medidas DAX; na Web, tornam-se parâmetros de filtro/query normais.

### 21. Decisões de negócio e notas técnicas (herdadas do Power BI, válidas para a Web)

1. **CADCRED separada da SIGFIDC** — mantida como tabela independente para preservar cedentes sem título ativo. Um JOIN direto causaria perda desses cedentes, distorcendo métricas de limite total. Na Web: nunca colapsar essas duas fontes em uma única query sem UNION/OUTER JOIN cuidadoso.
2. **Slicer "Visão"** — no Power BI, uma tabela estática sem relacionamento, controlando um comportamento "Todos / Com Risco / Sem Risco" via `SELECTEDVALUE`. Na Web, vira um filtro de contexto de aplicação (ex: querystring ou state global), com fallback padrão para "Todos".
3. **Códigos SIGFIDC considerados** — `WHERE F.CODIGO IN (040, 041, 042, 046)`. Todo endpoint/query que toque `SIGFIDC` deve herdar esse filtro por padrão.
4. **Padrão SIGBORS e filtros de segmentação** — medidas/consultas baseadas em `SIGBORS` não herdam automaticamente filtros de Comercial/Grupo Econômico/Cedente aplicados sobre `SIGFIDC` (por causa do relacionamento `*:*`). O padrão é capturar o conjunto de `BORDERO` já filtrado em `SIGFIDC` e então filtrar `SIGBORS` por esse conjunto explicitamente.
5. **Performance em listagens grandes** — o equivalente Power BI usava uma medida de "top N condicional" como guarda para não carregar a tabela sem filtro algum. Na Web, replicar como paginação obrigatória + exigência de ao menos um filtro de contexto (Comercial, Grupo Econômico Cedente ou Cedente) antes de consultas pesadas.
6. **Relacionamento SIGFLS↔Dcalendario** — no Power BI ficava inativo por padrão, ativado pontualmente em uma medida (`USERELATIONSHIP`). Na Web, isso não é uma restrição técnica real — é uma regra de negócio: por padrão, os acumulados usam a data de referência do filtro corrente; o uso de `DTBORDERO` como data alternativa é uma opção secundária, não o padrão.
7. **Preparação para IA/RAG** — nomes de colunas, tabelas e regras devem permanecer descritivos e consistentes (evitar abreviações ambíguas) para facilitar indexação e recuperação semântica pelo assistente de IA da plataforma.

### 22. Inventário de grupos de métricas (Power BI → referência para a API Web)

Estes grupos representam os blocos de indicadores já validados em produção. Cada um deve virar um conjunto de endpoints/queries equivalente no backend, preservando a mesma regra de negócio:

Valores e Totais · Cards de Risco (respondem ao filtro "Visão") · Contagens · Cedentes · Taxas e Prazos · Tickets · Grupo Econômico · Tranche · Liquidez · Recompra · VOP (Volume de Operações) · Comportamental (Acumulado) · Risco Sacado e Concentração · Tarifário · Operações Bordero · Auxiliares · Comissões.

---

## 23. Próximos passos sugeridos

1. Definir o schema da API (REST ou GraphQL) espelhando os grupos da seção 22, um recurso por módulo listado na seção 9.
2. Desenhar o design system (tokens de cor, tipografia, espaçamento, sombra) a partir da seção 5, antes de qualquer tela final.
3. Prototipar primeiro o Dashboard executivo (módulo mais transversal) e a tela de Títulos Vencidos (maior valor de negócio imediato, dado o bug histórico corrigido em 19.1).
4. Desenhar a experiência da IA conversacional (seção 12) com um conjunto inicial de perguntas fixas (seção 12) antes de abrir para perguntas livres.
5. Validar com o cliente a régua visual (seção 5) em uma tela só, antes de replicar o padrão pelas demais.

> Sempre que uma nova regra de negócio for confirmada com o cliente durante o desenvolvimento da Web, ela deve ser adicionada à Parte II deste arquivo — este documento é vivo e é a principal fonte de contexto do produto e do assistente de IA.
