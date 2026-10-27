import { randomInt } from "node:crypto";

// Sem caracteres ambíguos (0/O, 1/l/I) para reduzir erro de digitação
// quando alguém precisa copiar a senha manualmente.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function pick(charset: string) {
  return charset[randomInt(charset.length)];
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Gera uma senha aleatória de 12 caracteres com maiúscula, minúscula, número e símbolo garantidos. */
export function generateRandomPassword(): string {
  const guaranteed = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: 8 }, () => pick(ALL));
  return shuffle([...guaranteed, ...rest]).join("");
}
