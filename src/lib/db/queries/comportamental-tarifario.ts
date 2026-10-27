import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import { SIGFIDC_CODIGOS_FIDC } from "./sigfidc-shared";

// Grupo "Tarifário" do módulo Comportamental. Medidas DAX coladas pelo
// cliente em 2026-07-15. Como o próprio cliente observou, a maioria destas
// medidas (Taxa, Tipo de Taxa, Ad Valorem, Cheque, Título) só faz sentido de
// verdade com um Cedente (ou Grupo Econômico) filtrado — sem filtro elas
// somam a propriedade de todos os cedentes do universo, um número sem
// significado de negócio isolado. Os filtros da tela ainda serão construídos
// (ver comportamental-header.tsx); por enquanto a query já aceita
// comercial/grupoEconomico/cedente pra não precisar retrabalho depois.
export interface TarifarioFiltros {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(searchParams: URLSearchParams): TarifarioFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

function filtrosParams(filtros: TarifarioFiltros) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export interface TarifarioTotais {
  /** Fração (ex.: 0.03 = 3%) — mesma convenção da coluna "taxa" de Carteira de Clientes. */
  taxa: number;
  /** Rótulo do método (Efetivo/Nominal/Misto/Efetivo VA/Padrão) ou "-" quando
   * o conjunto filtrado tem mais de um método distinto (equivalente ao
   * SELECTEDVALUE do Power BI, que retorna em branco/"-" nesse caso). */
  tipoDeTaxa: string;
  /** Fração — mesma convenção de "taxa". */
  adValorem: number;
  bordero: number;
  protec: number;
  ted: number;
  cheque: number;
  titulo: number;
}

// CADTARFIDC[nome]='BORDERO'/'PROTEC'/'TED' é comparação EXATA na DAX
// original — e os dados reais têm variações (BORDERÔ com acento, PROETEC/
// RPOTEC com erro de digitação, DOC/TED etc, confirmado via SELECT DISTINCT
// nome em 2026-07-15). Mantido literal igual ao Power BI (mesmos números que
// o cliente já vê hoje); cedentes cadastrados só com a variante não-exata
// mostram 0 nesse card, igual acontece no relatório atual.
const METODO_CASE = `
CASE MetodoUnico.metodo
    WHEN 1 THEN 'Efetivo'
    WHEN 2 THEN 'Nominal'
    WHEN 3 THEN 'Misto'
    WHEN 4 THEN 'Efetivo VA'
    WHEN 7 THEN 'Padrão'
    ELSE '-'
END
`;

const QUERY = `
;WITH GrupoEmpresaUnico AS (
    SELECT clifor, idgrupo, ROW_NUMBER() OVER (PARTITION BY clifor ORDER BY clifor) AS RN
    FROM GrupoEmpresa
),
Universo AS (
    SELECT clifor FROM CADCRED
    UNION
    SELECT CLIFOR FROM SIGFIDC WHERE CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
),
FiltroClifor AS (
    SELECT Universo.clifor
    FROM Universo
    LEFT JOIN CADCRED ON CADCRED.clifor = Universo.clifor
    LEFT JOIN GrupoEmpresaUnico GEU ON GEU.clifor = Universo.clifor AND GEU.RN = 1
    WHERE (@comercial = '' OR CADCRED.gerenteconta = @comercial)
      AND (@grupoEconomico = '' OR CAST(GEU.idgrupo AS VARCHAR) = @grupoEconomico)
      AND (@cedente = '' OR CAST(Universo.clifor AS VARCHAR) = @cedente)
),
Cadastro AS (
    SELECT
        ISNULL(SUM(SIGCAD.fatorfidc), 0) / 100.0 AS taxa,
        ISNULL(SUM(CADCRED.servicofidc), 0) / 100.0 AS adValorem,
        ISNULL(SUM(CADCRED.tarifachequefidc), 0) AS cheque,
        ISNULL(SUM(CADCRED.tarifatitulofidc), 0) AS titulo
    FROM FiltroClifor
    LEFT JOIN SIGCAD ON SIGCAD.CODIGO = FiltroClifor.clifor
    LEFT JOIN CADCRED ON CADCRED.clifor = FiltroClifor.clifor
),
-- SELECTEDVALUE(CADCRED[Metodo], "-"): só retorna um método quando o
-- conjunto filtrado (FiltroClifor) tem exatamente um valor distinto de
-- METODOCALCULOFIDC; caso contrário cai no fallback "-".
MetodoUnico AS (
    SELECT CASE WHEN COUNT(DISTINCT CADCRED.METODOCALCULOFIDC) = 1 THEN MAX(CADCRED.METODOCALCULOFIDC) END AS metodo
    FROM FiltroClifor
    LEFT JOIN CADCRED ON CADCRED.clifor = FiltroClifor.clifor
),
Tarifas AS (
    SELECT
        ISNULL(SUM(CASE WHEN T.nome = 'BORDERO' THEN T.valor ELSE 0 END), 0) AS bordero,
        ISNULL(SUM(CASE WHEN T.nome = 'PROTEC' THEN T.valor ELSE 0 END), 0) AS protec,
        ISNULL(SUM(CASE WHEN T.nome = 'TED' THEN T.valor ELSE 0 END), 0) AS ted
    FROM FiltroClifor
    INNER JOIN cadtarfidc T ON T.clifor = FiltroClifor.clifor
)
SELECT
    Cadastro.taxa,
    ${METODO_CASE} AS tipoDeTaxa,
    Cadastro.adValorem,
    Tarifas.bordero,
    Tarifas.protec,
    Tarifas.ted,
    Cadastro.cheque,
    Cadastro.titulo
FROM Cadastro
CROSS JOIN MetodoUnico
CROSS JOIN Tarifas
`;

const VAZIO: TarifarioTotais = {
  taxa: 0,
  tipoDeTaxa: "-",
  adValorem: 0,
  bordero: 0,
  protec: 0,
  ted: 0,
  cheque: 0,
  titulo: 0,
};

export async function getTarifario(
  filtros: Scoped<TarifarioFiltros>,
  forceRefresh = false,
): Promise<TarifarioTotais> {
  return withCache(
    `comportamental-tarifario:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<TarifarioTotais>(QUERY, filtrosParams(filtros));
      return rows[0] ?? VAZIO;
    },
    { forceRefresh },
  );
}
