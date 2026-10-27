// Cache em memória, simples e por processo — para consultas repetidas de
// baixa volatilidade (cadastros, listas de referência), evitando bater no
// SQL Server da WBA a cada request. Não sobrevive a restart/deploy, o que é
// aceitável para este tipo de dado (reconstrói sozinho na próxima chamada).
//
// Também usado nos dados dos cards/tabelas de cada tela (Comercial, Títulos,
// Carteira, Comportamental) — decisão do cliente em 2026-07-15: navegar
// entre módulos deve parecer instantâneo, sem esperar uma consulta nova toda
// vez, mas o botão "Atualizar" do topbar precisa sempre trazer dado fresco.
// Por isso o parâmetro `forceRefresh`: quando true, ignora o valor em cache
// (mesmo que ainda válido) e já grava o resultado novo de volta — a mesma
// chave volta a servir do cache pras próximas leituras normais dentro do TTL.
// TTL aumentado de 20s pra 2 minutos em 2026-07-16 — o cliente confirmou que
// não precisa desse nível de atualização automática; velocidade de
// navegação é mais importante que dado "ao vivo" a cada poucos segundos. O
// botão "Atualizar" continua bypassando o cache, então dado fresco sob
// demanda nunca é bloqueado por esse TTL maior.
export const DATA_CACHE_TTL_MS = 120_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options: { forceRefresh?: boolean } = {},
): Promise<T> {
  if (!options.forceRefresh) {
    const cached = store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
  }

  const value = await fetcher();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}
