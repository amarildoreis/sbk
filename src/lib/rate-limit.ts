// Rate limiter em memória — suficiente para uma ferramenta interna de porte
// modesto. Reinicia a cada deploy/restart do processo; se algum dia isso
// rodar em múltiplas instâncias, precisa virar algo compartilhado (Redis).
const attempts = new Map<string, number[]>();

/**
 * Retorna true se a chave está DENTRO do limite (pode prosseguir), false se
 * excedeu `max` tentativas na janela de `windowMs`.
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const timestamps = (attempts.get(key) ?? []).filter(
    (t) => now - t < windowMs,
  );

  if (timestamps.length >= max) {
    attempts.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  attempts.set(key, timestamps);
  return true;
}
