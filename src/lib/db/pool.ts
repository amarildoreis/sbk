import sql from "mssql";
import { getDbEnv } from "./env";

// Erros de rede transitórios — únicos que justificam retry. Erros de auth,
// permissão ou sintaxe SQL nunca devem ser reenviados automaticamente.
const TRANSIENT_ERROR_CODES = new Set([
  "ETIMEOUT",
  "ESOCKET",
  "ECONNCLOSED",
  "ECONNREFUSED",
  "ECONNRESET",
]);

const MAX_CONNECT_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

function isTransientError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  return typeof code === "string" && TRANSIENT_ERROR_CODES.has(code);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let poolPromise: Promise<sql.ConnectionPool> | null = null;

async function connectWithRetry(): Promise<sql.ConnectionPool> {
  const env = getDbEnv();

  const config: sql.config = {
    server: env.host,
    port: env.port,
    database: env.database,
    user: env.user,
    password: env.password,
    connectionTimeout: 10_000,
    requestTimeout: 20_000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
    options: {
      encrypt: env.encrypt,
      trustServerCertificate: env.trustServerCertificate,
      // Só definido se DB_TLS_MIN_VERSION estiver setado — necessário apenas
      // quando o servidor não negocia com o mínimo de TLS que o Node aceita
      // por padrão. Não afeta o TLS global do processo, só esta conexão.
      ...(env.tlsMinVersion && {
        cryptoCredentialsDetails: { minVersion: env.tlsMinVersion },
      }),
    },
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    try {
      const pool = new sql.ConnectionPool(config);
      pool.on("error", (err: Error) => {
        // eslint-disable-next-line no-console
        console.error("[db] pool error", { message: (err as Error).message });
      });
      return await pool.connect();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < MAX_CONNECT_ATTEMPTS && isTransientError(error);
      // eslint-disable-next-line no-console
      console.error("[db] connection attempt failed", {
        attempt,
        code: (error as { code?: string } | undefined)?.code,
        willRetry: canRetry,
      });
      if (!canRetry) throw error;
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

// Pool singleton, lazy: só conecta no primeiro request. Reaproveitado entre
// chamadas — nunca crie um sql.ConnectionPool novo por requisição.
export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = connectWithRetry().catch((error) => {
      // Permite tentar reconectar numa próxima chamada em vez de travar
      // o processo para sempre com uma promise rejeitada em cache.
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}
