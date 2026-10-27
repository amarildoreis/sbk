import sql from "mssql";
import { getPool } from "./pool";

// Palavras-chave de escrita/DDL — a query nunca pode começar (ignorando
// comentários/CTEs) com nenhuma delas. Isso é uma trava adicional no código,
// NÃO um substituto para a permissão somente-leitura do usuário de banco
// (essa é a proteção real; ver CLAUDE.md e o lembrete de segurança do time).
const WRITE_KEYWORDS =
  /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|EXEC|EXECUTE|MERGE|GRANT|REVOKE|DENY)\b/i;

export class ReadOnlyViolationError extends Error {
  constructor() {
    super("Operação bloqueada: apenas consultas de leitura (SELECT) são permitidas.");
    this.name = "ReadOnlyViolationError";
  }
}

function assertReadOnly(queryText: string) {
  // Remove comentários de linha/bloco antes de checar a primeira palavra,
  // para não deixar passar "-- DROP TABLE\nSELECT 1" nem ser enganado por
  // um SELECT comentado escondendo um comando de escrita.
  const withoutComments = queryText
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  if (WRITE_KEYWORDS.test(withoutComments)) {
    throw new ReadOnlyViolationError();
  }
}

export interface QueryParam {
  name: string;
  type: sql.ISqlType | (() => sql.ISqlType);
  value: unknown;
}

export interface ReadQueryOptions {
  /** Timeout específico desta query, em ms. Padrão: 20s (definido no pool). Máximo permitido: 30s. */
  timeoutMs?: number;
}

const MAX_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Executa uma consulta de LEITURA parametrizada contra o SQL Server.
 * Nunca concatene valores na string SQL — sempre use `params` com
 * `request.input`, tanto por segurança quanto para reaproveitar query plans.
 */
export async function executeReadQuery<T = Record<string, unknown>>(
  queryText: string,
  params: QueryParam[] = [],
  options: ReadQueryOptions = {},
): Promise<T[]> {
  assertReadOnly(queryText);

  const pool = await getPool();
  const request = pool.request();

  // `timeout` existe em tempo de execução (mssql/tedious) mas não está
  // declarado no @types/mssql — cast pontual só para esta atribuição.
  (request as unknown as { timeout: number }).timeout = Math.min(
    options.timeoutMs ?? 20_000,
    MAX_REQUEST_TIMEOUT_MS,
  );

  for (const param of params) {
    request.input(param.name, param.type, param.value);
  }

  try {
    const result = await request.query<T>(queryText);
    return result.recordset;
  } catch (error) {
    // Log estruturado, sem parâmetros (podem conter dado sensível do cliente)
    // e sem string de conexão/credenciais.
    // eslint-disable-next-line no-console
    console.error("[db] query failed", {
      timestamp: new Date().toISOString(),
      code: (error as { code?: string } | undefined)?.code,
      message: (error as Error).message,
    });
    throw error;
  }
}
