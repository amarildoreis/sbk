export const PERFIS = [
  "Administrador",
  "Comercial",
  "Operação",
  "Cedente",
  "Sacado",
] as const;

export const EXTERNAL_PROFILES = ["Cedente", "Sacado"];

export const STATUS_OPTIONS = ["Ativo", "Inativo"] as const;
export type Status = (typeof STATUS_OPTIONS)[number];

export const STATUS_STYLES: Record<Status, string> = {
  Ativo: "bg-verde-escuro/10 text-verde-escuro",
  Inativo: "bg-vermelho-risco/10 text-vermelho-risco",
};

// Tipo_Comissao (CLAUDE.md 19.6): classifica o comercial em Interno/Externo.
export const COMERCIAL_TIPO_OPTIONS = ["Interno", "Externo"] as const;
export type ComercialTipo = (typeof COMERCIAL_TIPO_OPTIONS)[number];
