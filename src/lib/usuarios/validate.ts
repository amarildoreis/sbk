import {
  PERFIS,
  STATUS_OPTIONS,
  COMERCIAL_TIPO_OPTIONS,
} from "@/components/dashboard/usuarios/constants";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UsuarioInput {
  nome: string;
  email: string;
  perfil: string;
  status: string;
  vinculo: string | null;
  comercialTipo: string | null;
  comercialCodigo: string | null;
  fotoBase64: string | null;
  permissoes: Record<string, boolean>;
  /** Só relevante na criação — dispara ou não o e-mail de boas-vindas. */
  enviarEmail: boolean;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// O cliente limita o arquivo original a 2MB, mas base64 infla o tamanho em
// ~33% — o limite aqui precisa ser maior que 2MB ou uma foto de 2MB exatos
// seria rejeitada no servidor mesmo tendo passado na validação do formulário.
const MAX_FOTO_BASE64_LENGTH = 2.8 * 1024 * 1024;

export function parseUsuarioInput(body: unknown): UsuarioInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Corpo da requisição inválido.");
  }
  const b = body as Record<string, unknown>;

  const nome = typeof b.nome === "string" ? b.nome.trim() : "";
  if (!nome) throw new ValidationError("Nome é obrigatório.");

  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new ValidationError("E-mail inválido.");
  }

  const perfil = typeof b.perfil === "string" ? b.perfil : "";
  if (!PERFIS.includes(perfil as (typeof PERFIS)[number])) {
    throw new ValidationError(
      `Perfil inválido. Use um de: ${PERFIS.join(", ")}.`,
    );
  }

  const status = typeof b.status === "string" ? b.status : "";
  if (!STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
    throw new ValidationError(
      `Status inválido. Use um de: ${STATUS_OPTIONS.join(", ")}.`,
    );
  }

  let comercialTipo: string | null = null;
  if (perfil === "Comercial") {
    comercialTipo = typeof b.comercialTipo === "string" ? b.comercialTipo : "";
    if (
      !COMERCIAL_TIPO_OPTIONS.includes(
        comercialTipo as (typeof COMERCIAL_TIPO_OPTIONS)[number],
      )
    ) {
      throw new ValidationError(
        `Tipo de comercial inválido. Use um de: ${COMERCIAL_TIPO_OPTIONS.join(", ")}.`,
      );
    }
  }

  const comercialCodigo =
    perfil === "Comercial" && typeof b.comercialCodigo === "string"
      ? b.comercialCodigo.trim() || null
      : null;

  const vinculo =
    (perfil === "Cedente" || perfil === "Sacado") && typeof b.vinculo === "string"
      ? b.vinculo.trim() || null
      : null;

  const fotoBase64 = typeof b.fotoBase64 === "string" ? b.fotoBase64 : null;
  if (fotoBase64 && fotoBase64.length > MAX_FOTO_BASE64_LENGTH) {
    throw new ValidationError("Foto muito grande — envie uma imagem menor.");
  }
  if (fotoBase64 && !fotoBase64.startsWith("data:image/")) {
    throw new ValidationError("Foto inválida — envie uma imagem (data URI).");
  }

  const permissoes =
    typeof b.permissoes === "object" && b.permissoes !== null
      ? Object.fromEntries(
          Object.entries(b.permissoes as Record<string, unknown>).map(
            ([key, value]) => [key, Boolean(value)],
          ),
        )
      : {};

  return {
    nome,
    email,
    perfil,
    status,
    vinculo,
    comercialTipo,
    comercialCodigo,
    fotoBase64,
    permissoes,
    enviarEmail: b.enviarEmail === true,
  };
}
