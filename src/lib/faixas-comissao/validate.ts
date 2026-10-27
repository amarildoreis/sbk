export interface FaixaComissaoInput {
  jurosMin: number;
  jurosMax: number | null;
  taxa: number;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function parseFaixaComissaoInput(body: unknown): FaixaComissaoInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Corpo da requisição inválido.");
  }
  const b = body as Record<string, unknown>;

  const jurosMin = Number(b.jurosMin);
  if (!Number.isFinite(jurosMin) || jurosMin < 0) {
    throw new ValidationError("Juros mínimo inválido.");
  }

  let jurosMax: number | null = null;
  if (b.jurosMax !== null && b.jurosMax !== undefined && b.jurosMax !== "") {
    jurosMax = Number(b.jurosMax);
    if (!Number.isFinite(jurosMax)) {
      throw new ValidationError("Juros máximo inválido.");
    }
    if (jurosMax <= jurosMin) {
      throw new ValidationError("Juros máximo precisa ser maior que o mínimo.");
    }
  }

  const taxa = Number(b.taxa);
  if (!Number.isFinite(taxa) || taxa < 0) {
    throw new ValidationError("Taxa de comissão inválida.");
  }

  return { jurosMin, jurosMax, taxa };
}
