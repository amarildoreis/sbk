// `Usuario.vinculo` (Cedente/Sacado) é salvo como o rótulo completo escolhido
// no CliforSelect — "CODIGO - NOME" ou "CODIGO - NOME - CGC" (ver
// clifor-select.tsx `formatLabel`). Pra usar em filtros de SQL (CLIFOR/
// SACADO), só o código antes do primeiro " - " interessa. Extraído aqui
// pra não duplicar o parsing entre a sessão (auth.ts) e qualquer outro
// consumidor.
export function extractVinculoCodigo(vinculo: string | null | undefined): string | null {
  if (!vinculo) return null;
  const codigo = vinculo.split(" - ")[0]?.trim();
  return codigo || null;
}

export function extractVinculoNome(vinculo: string | null | undefined): string | null {
  if (!vinculo) return null;
  const partes = vinculo.split(" - ");
  const nome = partes.length > 1 ? partes[1]?.trim() : null;
  return nome || null;
}
