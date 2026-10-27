// Fragmentos SQL reutilizados por qualquer query que leia SIGFIDC — mantidos
// aqui centralizados para não reimplementar a mesma regra de negócio em cada
// card (CLAUDE.md seção 19.1 e 21.3).

// CLAUDE.md 21.3: todo endpoint/query que toque SIGFIDC herda esse filtro.
export const SIGFIDC_CODIGOS_FIDC = "('040','041','042','046')";

// "Vencimento" de um título é SIGFIDC.DATA (não VCTO_) — confirmado pelo
// script SQL de origem que alimenta o Power BI (2026-07-12), que usa
// `CAST(F.DATA AS DATE) AS VENCIMENTO` em toda a classificação de
// STATUS_PAGTO e no cálculo de DIAS_ATRASO. Uma hipótese anterior
// (COALESCE(novadata, VCTO_)) chegou perto do valor certo só porque DATA e
// VCTO_ coincidem em ~99% das linhas — não é a regra real. Espera um alias
// `f` para SIGFIDC.
export const VENCIMENTO_EFETIVO = "CAST(f.DATA AS DATE)";

// CLAUDE.md 19.1 — STATUS_PAGTO. Não existe como coluna no banco (era
// calculado em Power Query/DAX), então é recalculado aqui em SQL. Já usa a
// regra corrigida (compara vencimento com GETDATE() em todos os cenários de
// pagamento parcial), não o bug histórico da v6.
// Espera um alias `f` para SIGFIDC na query que incluir este fragmento.
export const STATUS_PAGTO_CASE = `
CASE
    WHEN f.DTPGTO IS NOT NULL AND (f.BANCO IS NULL OR f.BANCO = '') AND ${VENCIMENTO_EFETIVO} < CAST(GETDATE() AS DATE) THEN 'Vencido'
    WHEN f.DTPGTO IS NULL AND ${VENCIMENTO_EFETIVO} < CAST(GETDATE() AS DATE) THEN 'Vencido'
    WHEN f.DTPGTO IS NOT NULL AND (f.BANCO IS NULL OR f.BANCO = '') AND ${VENCIMENTO_EFETIVO} >= CAST(GETDATE() AS DATE) THEN 'A Vencer'
    WHEN f.DTPGTO IS NULL AND ${VENCIMENTO_EFETIVO} >= CAST(GETDATE() AS DATE) THEN 'A Vencer'
    WHEN f.DTPGTO IS NOT NULL AND f.BANCO IS NOT NULL AND f.BANCO <> '' AND ${VENCIMENTO_EFETIVO} >= f.DTPGTO THEN 'Pago Em Dia'
    WHEN f.DTPGTO IS NOT NULL AND f.BANCO IS NOT NULL AND f.BANCO <> '' AND ${VENCIMENTO_EFETIVO} < f.DTPGTO THEN 'Pago Vencido'
END
`;

// CLAUDE.md 19.2 — TIPO_PAGAMENTO. Mesmo alias `f` de STATUS_PAGTO_CASE.
export const TIPO_PAGAMENTO_CASE = `
CASE
    WHEN f.DTPGTO IS NULL AND (f.BANCO IS NULL OR f.BANCO = '') THEN 'Pagamento Pendente'
    WHEN f.DTPGTO IS NOT NULL AND (f.BANCO IS NULL OR f.BANCO = '') THEN 'Pagamento Parcial'
    WHEN f.DTPGTO IS NOT NULL AND f.BANCO IS NOT NULL AND f.BANCO <> '' THEN 'Pagamento Total'
END
`;

// CLAUDE.md 19.3 — JUROS_MENSAL. JUROS/PRAZO/FLOT/VALOR vivem em SIGFLS, não
// em SIGFIDC (seção 17) — a query que incluir este fragmento precisa de um
// LEFT JOIN SIGFLS fl ON fl.ctrl_id = f.SIGFLS. ATENÇÃO: é a coluna
// SIGFIDC.SIGFLS, NÃO SIGFIDC.CTRL_ID — são colunas diferentes; usar CTRL_ID
// aqui (erro cometido numa versão anterior) perde ~26% das linhas sem match,
// distorcendo qualquer média ponderada por JUROS_MENSAL. NULL nas mesmas
// condições documentadas (prazo+flot=0, valor=0, base<=0) — tratado como 0
// nas somas ponderadas por quem consumir este fragmento, igual ao
// comportamento do BLANK em SUMX no DAX original.
export const JUROS_MENSAL_CASE = `
CASE
    WHEN fl.PRAZO IS NULL OR fl.FLOT IS NULL OR (fl.PRAZO + fl.FLOT) = 0 THEN NULL
    WHEN fl.VALOR IS NULL OR fl.VALOR = 0 THEN NULL
    WHEN (1 + fl.JUROS / fl.VALOR) <= 0 THEN NULL
    ELSE POWER(CAST(1 + fl.JUROS / fl.VALOR AS FLOAT), 30.0 / (fl.PRAZO + fl.FLOT)) - 1
END
`;

// VALOR_PAGAMENTO — quanto foi de fato pago num título (usado na coluna
// "Valor Pagamento" do Relatório Analítico de Títulos e em medidas de
// recompra do Comportamental). Quando não há BANCO (pagamento parcial/
// pendente), é a diferença entre VALOR_ e VALOR; quando há BANCO
// preenchido, é o VLPGTO direto. Espera um alias `f` para SIGFIDC.
export const VALOR_PAGAMENTO_EXPR = `
CASE
    WHEN f.BANCO IS NULL OR LTRIM(RTRIM(CAST(f.BANCO AS VARCHAR))) = ''
    THEN ISNULL(f.VALOR_, 0) - ISNULL(f.VALOR, 0)
    ELSE ISNULL(f.VLPGTO, 0)
END
`;

// estoque_vencido (CLAUDE.md 19.4) — 'Sim' quando DTPGTO > VENCIMENTO (pago
// com atraso), ou DTPGTO nulo e vencimento < hoje (ainda não pago e já
// vencido). Espera um alias `f` para SIGFIDC.
export const ESTOQUE_VENCIDO_EXPR = `
CASE
    WHEN f.DTPGTO IS NOT NULL AND CAST(f.DTPGTO AS DATE) > ${VENCIMENTO_EFETIVO}
        THEN 'Sim'
    WHEN f.DTPGTO IS NULL AND ${VENCIMENTO_EFETIVO} < CAST(GETDATE() AS DATE)
        THEN 'Sim'
    ELSE 'Nao'
END
`;

// COD_OPERADOR_INDICANTE — comercial POR BORDERÔ/TÍTULO (prioridade
// INDICANTE > OPERADOR de SIGBORS), usado em filtros "Comercial" que atuam
// sobre medidas vindas de SIGFIDC/SIGBORS diretamente. Diferente de
// CADCRED.gerenteconta, que é o comercial POR CEDENTE (usado em medidas
// vindas de CADCRED/SIGCAD/cadtarfidc) — CLAUDE.md 21.9: são dois vínculos
// diferentes para duas granularidades diferentes, nunca confundir.
// Uso: `LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO`, filtro
// `(@comercial = '' OR SO.codigoComercial = @comercial)`.
export const SIGBORS_OPERADOR_CTE = `
SigborsOperador AS (
    SELECT
        B.BORDERO,
        CASE
            WHEN B.INDICANTE IS NOT NULL AND B.INDICANTE <> '' THEN B.INDICANTE
            WHEN B.OPERADOR IS NOT NULL AND B.OPERADOR <> '' THEN B.OPERADOR
            ELSE NULL
        END AS codigoComercial
    FROM SIGBORS B
)
`;
