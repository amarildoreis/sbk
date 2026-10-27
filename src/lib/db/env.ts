const REQUIRED_VARS = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
] as const;

export interface DbEnv {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  /** Opcional — só necessário se o servidor não negociar TLS com o padrão do Node/OpenSSL. */
  tlsMinVersion?: "TLSv1.3" | "TLSv1.2" | "TLSv1.1" | "TLSv1";
}

let cached: DbEnv | null = null;

// Fail-fast: chamado no primeiro uso da conexão. Se faltar qualquer variável
// obrigatória, lança um erro explícito em vez de deixar o driver falhar
// depois com uma mensagem genérica de conexão recusada.
export function getDbEnv(): DbEnv {
  if (cached) return cached;

  const missing = REQUIRED_VARS.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Configuração do banco incompleta — variáveis de ambiente ausentes: ${missing.join(", ")}. ` +
        "Defina-as em .env.local (veja .env.local.example).",
    );
  }

  const port = Number(process.env.DB_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `DB_PORT inválido: "${process.env.DB_PORT}". Deve ser um número inteiro positivo.`,
    );
  }

  const rawTlsMinVersion = process.env.DB_TLS_MIN_VERSION?.trim();
  const validTlsVersions = ["TLSv1.3", "TLSv1.2", "TLSv1.1", "TLSv1"] as const;
  if (rawTlsMinVersion && !validTlsVersions.includes(rawTlsMinVersion as never)) {
    throw new Error(
      `DB_TLS_MIN_VERSION inválido: "${rawTlsMinVersion}". Use um de: ${validTlsVersions.join(", ")}.`,
    );
  }

  cached = {
    host: process.env.DB_HOST!.trim(),
    port,
    database: process.env.DB_NAME!.trim(),
    user: process.env.DB_USER!.trim(),
    password: process.env.DB_PASSWORD!,
    encrypt: (process.env.DB_ENCRYPT ?? "true").trim().toLowerCase() !== "false",
    trustServerCertificate:
      (process.env.DB_TRUST_SERVER_CERTIFICATE ?? "false").trim().toLowerCase() ===
      "true",
    tlsMinVersion: rawTlsMinVersion as DbEnv["tlsMinVersion"],
  };

  return cached;
}
