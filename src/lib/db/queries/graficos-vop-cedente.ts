import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX, type PontoMensal } from "./graficos-shared";

export { GRAFICO_ANO_MIN, GRAFICO_ANO_MAX };
export type { PontoMensal };

function parseAno(value: string | null): number {
  const atual = new Date().getFullYear();
  const ano = Number(value);
  if (!Number.isInteger(ano) || ano < GRAFICO_ANO_MIN || ano > GRAFICO_ANO_MAX) {
    return Math.min(Math.max(atual, GRAFICO_ANO_MIN), GRAFICO_ANO_MAX);
  }
  return ano;
}

// Único filtro além de Comercial/Grupo Econômico/Cedente é o Ano — este
// gráfico não tem radio de eixo (nem "Base de data" nem "Evolução
// Acumulada"), pedido explícito do cliente em 2026-07-17.
export interface GraficoVopCedenteFiltros {
  ano?: number;
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): GraficoVopCedenteFiltros {
  return {
    ano: parseAno(searchParams.get("ano")),
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

// Gráfico "VOP Cedente" (Volume de Operações Cedente) — quinto dos 7
// gráficos do módulo (CLAUDE.md seção 9). Medida DAX colada pelo cliente em
// 2026-07-17:
//
// vop_cedente = CALCULATE(
//     SUM(SIGFLS[VALOR]),
//     SIGFLS[rejeitado] <> "X",
//     USERELATIONSHIP(SIGFLS[DTBORDERO], Dcalendario[Date]),
//     TREATAS(VALUES(CADCRED[CLIFOR]), SIGFLS[CLIFOR])
// ) + 0
//
// `USERELATIONSHIP(SIGFLS[DTBORDERO], Dcalendario[Date])` é o que confirma
// o eixo de data pro gráfico mensualizado: SIGFLS.DTBORDERO — diferente de
// SIGFLS.EMISSAO, usada nas janelas de 30/60/90 dias do grupo "VOP Cedente"
// do Comportamental (comportamental-vop-cedente.ts), que é um contexto sem
// slicer de data ativo. `TREATAS(VALUES(CADCRED[CLIFOR]), SIGFLS[CLIFOR])`
// filtra a partir do universo de CADCRED — mesmo padrão já usado no grupo
// homônimo do Comportamental, por isso o Comercial usa
// `CADCRED.gerenteconta`, não `COD_OPERADOR_INDICANTE` por borderô (CLAUDE.md
// 21.9). `rejeitado <> "X"` inclui linhas em branco no DAX (BLANK() <> "X"
// é TRUE) — em SQL vira `rejeitado IS NULL OR rejeitado <> 'X'`. Sem filtro
// de SIGFIDC[CODIGO] — a medida original não referencia SIGFIDC, só SIGFLS.
const QUERY = `
;WITH GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
),
FiltroClifor AS (
    SELECT CADCRED.clifor
    FROM CADCRED
    LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = CADCRED.clifor AND GEU.RN = 1
    WHERE (@comercial = '' OR CADCRED.gerenteconta = @comercial)
      AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
      AND (@cedente = '' OR CAST(CADCRED.clifor AS VARCHAR) = @cedente)
)
SELECT MONTH(SIGFLS.DTBORDERO) AS mes, ISNULL(SUM(ISNULL(SIGFLS.VALOR, 0)), 0) AS valor
FROM SIGFLS
INNER JOIN FiltroClifor ON FiltroClifor.clifor = SIGFLS.CLIFOR
WHERE (SIGFLS.rejeitado IS NULL OR SIGFLS.rejeitado <> 'X')
  AND SIGFLS.DTBORDERO IS NOT NULL
  AND YEAR(SIGFLS.DTBORDERO) = @ano
GROUP BY MONTH(SIGFLS.DTBORDERO)
`;

function filtrosParams(filtros: GraficoVopCedenteFiltros) {
  const ano = filtros.ano ?? new Date().getFullYear();
  return [
    { name: "ano", type: sql.Int, value: ano },
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    {
      name: "grupoEconomico",
      type: sql.VarChar(20),
      value: (filtros.grupoEconomico ?? "").trim(),
    },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export async function getGraficoVopCedenteMensal(
  filtros: Scoped<GraficoVopCedenteFiltros>,
  forceRefresh = false,
): Promise<PontoMensal[]> {
  const ano = filtros.ano ?? new Date().getFullYear();

  return withCache(
    `graficos-vop-cedente:${ano}:${JSON.stringify({
      comercial: filtros.comercial,
      grupoEconomico: filtros.grupoEconomico,
      cedente: filtros.cedente,
    })}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<PontoMensal>(QUERY, filtrosParams(filtros));
      const porMes = new Map(rows.map((r) => [r.mes, r.valor]));
      return Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        valor: porMes.get(i + 1) ?? 0,
      }));
    },
    { forceRefresh },
  );
}
