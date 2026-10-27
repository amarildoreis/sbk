import sql from "mssql";
import type { Scoped } from "@/lib/auth/access-scope";
import { executeReadQuery } from "@/lib/db/query";
import { withCache, DATA_CACHE_TTL_MS } from "@/lib/db/cache";
import {
  STATUS_PAGTO_CASE,
  SIGFIDC_CODIGOS_FIDC,
  SIGBORS_OPERADOR_CTE,
} from "./sigfidc-shared";

// Grupo "Exposição Cedente" do módulo Comportamental (CLAUDE.md — em
// andamento). Medidas DAX coladas pelo cliente em 2026-07-14: limite_credito,
// limite_grupo_economico, risco, limite_disponivel, a_vencer(_qtd),
// vencido(_qtd). Todas usavam SELECTEDVALUE(Visao[VISAO], "Todos") no Power
// BI, mas o cliente confirmou que essa tela NÃO tem o slicer "Visão" — é
// sempre "Todos" fixo, então a ramificação Com Risco/Sem Risco foi
// descartada na tradução (ao contrário de Carteira de Clientes, que tem o
// toggle).
export interface ExposicaoCedenteFiltros {
  comercial?: string;
  grupoEconomico?: string;
  cedente?: string;
}

export function parseFiltrosFromSearchParams(
  searchParams: URLSearchParams,
): ExposicaoCedenteFiltros {
  return {
    comercial: searchParams.get("comercial") ?? "",
    grupoEconomico: searchParams.get("grupoEconomico") ?? "",
    cedente: searchParams.get("cedente") ?? "",
  };
}

function filtrosParams(filtros: ExposicaoCedenteFiltros) {
  return [
    { name: "comercial", type: sql.VarChar(20), value: (filtros.comercial ?? "").trim() },
    { name: "grupoEconomico", type: sql.VarChar(20), value: (filtros.grupoEconomico ?? "").trim() },
    { name: "cedente", type: sql.VarChar(20), value: (filtros.cedente ?? "").trim() },
  ];
}

export interface ExposicaoCedenteTotais {
  limiteCredito: number;
  limiteGrupoCedente: number;
  risco: number;
  limiteDisponivel: number;
  aVencer: number;
  aVencerQtd: number;
  vencido: number;
  vencidoQtd: number;
}

// limite_grupo_economico = MAX(GrupoEmpresa[LIMITE]) no Power BI: GrupoEmpresa
// ali é a tabela já mesclada com cadGrupoEmpresarial (CLAUDE.md seção 18) —
// no SQL Server "puro" isso é GrupoEmpresa.clifor → cadGrupoEmpresarial.Limite
// (confirmado via INFORMATION_SCHEMA: GrupoEmpresa não tem coluna Limite,
// só id/idgrupo/clifor; quem tem Limite é cadGrupoEmpresarial).
//
// a_vencer_qtd / vencido_qtd = COUNTROWS(SIGFIDC) filtrado por STATUS_PAGTO —
// conta TÍTULOS, não cedentes distintos (a DAX é literal nisso, apesar do
// rótulo "contador" no card sugerir cedentes à primeira vista).
//
// Comercial tem DOIS vínculos diferentes nesta tela (CLAUDE.md 21.9): as
// medidas de CADCRED (limite_credito, limite_grupo_economico) filtram via
// CADCRED.gerenteconta (comercial por CEDENTE); as medidas de SIGFIDC
// (risco/a_vencer/vencido) filtram via COD_OPERADOR_INDICANTE por BORDERÔ
// (SIGBORS_OPERADOR_CTE) — são caminhos diferentes até o mesmo valor de
// filtro, não confundir um pelo outro.
const QUERY = `
;WITH ${SIGBORS_OPERADOR_CTE},
GrupoEmpresaUnico AS (
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
Credito AS (
    SELECT ISNULL(SUM(CADCRED.ConsLimCedFIDC), 0) AS limiteCredito
    FROM CADCRED
    INNER JOIN FiltroClifor ON FiltroClifor.clifor = CADCRED.clifor
),
GrupoLimite AS (
    SELECT ISNULL(MAX(CG.Limite), 0) AS limiteGrupoCedente
    FROM GrupoEmpresa GE
    INNER JOIN FiltroClifor ON FiltroClifor.clifor = GE.clifor
    LEFT JOIN cadGrupoEmpresarial CG ON CG.id = GE.idgrupo
),
Titulos AS (
    SELECT
        ISNULL(SUM(CASE WHEN ${STATUS_PAGTO_CASE} NOT IN ('Pago Em Dia', 'Pago Vencido') THEN f.VALOR_ ELSE 0 END), 0) AS risco,
        ISNULL(SUM(CASE WHEN ${STATUS_PAGTO_CASE} = 'A Vencer' THEN f.VALOR_ ELSE 0 END), 0) AS aVencer,
        ISNULL(SUM(CASE WHEN ${STATUS_PAGTO_CASE} = 'Vencido' THEN f.VALOR_ ELSE 0 END), 0) AS vencido,
        ISNULL(SUM(CASE WHEN ${STATUS_PAGTO_CASE} = 'A Vencer' THEN 1 ELSE 0 END), 0) AS aVencerQtd,
        ISNULL(SUM(CASE WHEN ${STATUS_PAGTO_CASE} = 'Vencido' THEN 1 ELSE 0 END), 0) AS vencidoQtd
    FROM SIGFIDC f
    LEFT JOIN SigborsOperador SO ON SO.BORDERO = f.BORDERO
    LEFT JOIN GrupoEmpresaUnico GEU2 ON GEU2.clifor = f.CLIFOR AND GEU2.RN = 1
    WHERE f.CODIGO IN ${SIGFIDC_CODIGOS_FIDC}
      AND (@comercial = '' OR SO.codigoComercial = @comercial)
      AND (@grupoEconomico = '' OR CAST(GEU2.idgrupo AS VARCHAR) = @grupoEconomico)
      AND (@cedente = '' OR CAST(f.CLIFOR AS VARCHAR) = @cedente)
)
SELECT
    Credito.limiteCredito,
    GrupoLimite.limiteGrupoCedente,
    Titulos.risco,
    (Credito.limiteCredito - Titulos.risco) AS limiteDisponivel,
    Titulos.aVencer,
    Titulos.aVencerQtd,
    Titulos.vencido,
    Titulos.vencidoQtd
FROM Credito
CROSS JOIN GrupoLimite
CROSS JOIN Titulos
`;

const VAZIO: ExposicaoCedenteTotais = {
  limiteCredito: 0,
  limiteGrupoCedente: 0,
  risco: 0,
  limiteDisponivel: 0,
  aVencer: 0,
  aVencerQtd: 0,
  vencido: 0,
  vencidoQtd: 0,
};

export async function getExposicaoCedente(
  filtros: Scoped<ExposicaoCedenteFiltros>,
  forceRefresh = false,
): Promise<ExposicaoCedenteTotais> {
  return withCache(
    `comportamental-exposicao-cedente:${JSON.stringify(filtros)}`,
    DATA_CACHE_TTL_MS,
    async () => {
      const rows = await executeReadQuery<ExposicaoCedenteTotais>(QUERY, filtrosParams(filtros));
      return rows[0] ?? VAZIO;
    },
    { forceRefresh },
  );
}
