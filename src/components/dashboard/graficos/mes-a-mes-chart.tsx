"use client";

import { useEffect, useState } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { useDataRefresh, useIsForcedRefresh } from "../refresh-context";
import { AnoFiltro, anoAtualPadrao } from "./ano-filtro";
import { GraficoExportMenu } from "./grafico-export-menu";
import type { GraficosFiltros } from "./graficos-page";

export type GraficoEixo = "compra" | "pagamento" | "vencimento";

export interface OpcaoEixo {
  value: string;
  label: string;
  detalhe: string;
}

export interface PontoMensal {
  mes: number;
  valor: number;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Opções padrão de "Base de data" — usadas por Títulos/Deságios/Comissões.
// Gráficos com regra diferente (ex: Vencidos, com "Evolução Acumulada" em
// vez de "Base de data") passam seu próprio `opcoesEixo`/`rotuloRadios`.
export const OPCOES_EIXO_DATA: OpcaoEixo[] = [
  { value: "compra", label: "Data de Compra", detalhe: "Pago Total, Parcial ou Pendente" },
  { value: "pagamento", label: "Data de Pagamento", detalhe: "Pago Total" },
  { value: "vencimento", label: "Data de Vencimento", detalhe: "Pago Total, Parcial ou Pendente" },
];

// Label acima de cada barra — valor literal completo, sem abreviação e sem
// o prefixo "R$" (economiza espaço horizontal, pedido explícito do
// cliente pra manter o rótulo na horizontal em vez de inclinado).
function formatValorLabel(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Painel de gráfico mensualizado (jan-dez) genérico, reaproveitado por
// TODOS os gráficos do módulo Gráficos (Títulos, Deságios, ...) — CLAUDE.md
// seção 9. Pedido explícito do cliente em 2026-07-17: "as regras são
// exatamente as mesmas [entre os gráficos]". A única coisa que muda de um
// gráfico pro outro é: ícone, título/subtítulo, cor da barra (dentro da
// mesma paleta, pra facilitar a identificação visual ao longo do tempo) e o
// endpoint de dados. Todo o resto — filtro de Ano (2023-2033), os 3 radios
// de "Base de data" (Compra/Pagamento/Vencimento), o preenchimento das 12
// barras, o formato do rótulo acima da barra — é idêntico.
export function MesAMesChart({
  slug,
  icon: Icon,
  titulo,
  subtitulo,
  cor,
  corContorno,
  apiEndpoint,
  filtros,
  resumoFiltros,
  opcoesEixo,
  rotuloRadios = "Base de data",
}: {
  /** Chave do gráfico no registro de exportação (GRAFICOS em
   * graficos-registry.ts) — ex: "titulos", "desagios". */
  slug: string;
  icon: LucideIcon;
  titulo: string;
  subtitulo: string;
  cor: string;
  /** Contorno da barra — opcional, só necessário pra cores claras da
   * paleta (ex: cinza-prata) que perdem contraste sem borda no fundo
   * branco. As demais cores (saturadas) não precisam. */
  corContorno?: string;
  apiEndpoint: string;
  filtros: GraficosFiltros;
  /** Resumo dos filtros aplicados (nomes, não códigos — ex: "Comercial:
   * Fulano · Cedente: Empresa X"), exibido como título central dentro do
   * painel. Vazio quando nenhum filtro está ativo. */
  resumoFiltros?: string;
  /** Opções do radio group interno do painel — padrão são os 3 de "Base de
   * data" (Compra/Pagamento/Vencimento). Gráficos com regra diferente (ex:
   * Vencidos, "Evolução Acumulada") passam suas próprias opções. Passe um
   * array vazio pra ocultar o radio group por completo (ex: VOP Cedente,
   * que só tem o filtro de Ano). */
  opcoesEixo?: OpcaoEixo[];
  /** Rótulo acima do radio group — padrão "Base de data". */
  rotuloRadios?: string;
}) {
  const opcoes = opcoesEixo ?? OPCOES_EIXO_DATA;
  const temRadios = opcoes.length > 0;
  const { token: refreshToken } = useDataRefresh();
  const forced = useIsForcedRefresh(refreshToken);
  const [ano, setAno] = useState(anoAtualPadrao);
  const [eixo, setEixo] = useState<string>(opcoes[0]?.value ?? "");
  const [pontos, setPontos] = useState<PontoMensal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ ano: String(ano), eixo });
    if (filtros.comercial) params.set("comercial", filtros.comercial);
    if (filtros.grupoEconomico) params.set("grupoEconomico", filtros.grupoEconomico);
    if (filtros.cedente) params.set("cedente", filtros.cedente);
    if (forced) params.set("refresh", "1");
    fetch(`${apiEndpoint}?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setPontos(data.pontos as PontoMensal[]);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o gráfico agora.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    ano,
    eixo,
    apiEndpoint,
    filtros.comercial,
    filtros.grupoEconomico,
    filtros.cedente,
    refreshToken,
    forced,
  ]);

  const dados = pontos.map((p) => ({ mes: MESES[p.mes - 1], valor: p.valor }));

  return (
    <div className="animate-fade-in-up rounded-2xl border border-cinza-prata/40 bg-white shadow-premium-sm">
      <div className="relative flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
            <Icon size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-azul-escuro">{titulo}</h3>
            <p className="text-sm text-azul-escuro/50">{subtitulo}</p>
          </div>
        </div>

        {resumoFiltros && (
          <div className="pointer-events-none hidden items-center justify-center lg:absolute lg:inset-0 lg:flex">
            <span className="truncate px-4 text-sm font-semibold text-azul-escuro/70">
              {resumoFiltros}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <AnoFiltro value={ano} onChange={setAno} />
          <GraficoExportMenu
            grafico={slug}
            titulo={titulo}
            ano={ano}
            eixo={eixo}
            filtros={filtros}
            resumoFiltros={resumoFiltros}
          />
        </div>
      </div>

      {temRadios && (
        <div className="border-t border-cinza-prata/40 px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-azul-escuro/40">
            {rotuloRadios}
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {opcoes.map((opcao) => {
              const active = opcao.value === eixo;
              return (
                <label key={opcao.value} className="flex cursor-pointer items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      active ? "border-azul-escuro" : "border-cinza-prata/60"
                    }`}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-azul-escuro" />}
                  </span>
                  <span className="text-sm leading-snug">
                    <span className="font-medium text-azul-escuro">{opcao.label}</span>
                    <span className="block text-xs text-azul-escuro/50">{opcao.detalhe}</span>
                  </span>
                  <input
                    type="radio"
                    name={`grafico-eixo-${apiEndpoint}`}
                    className="sr-only"
                    checked={active}
                    onChange={() => setEixo(opcao.value)}
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className={`px-3 pb-6 pt-4 sm:px-5 ${!temRadios ? "border-t border-cinza-prata/40" : ""}`}>
        {isLoading ? (
          <div className="flex h-80 items-center justify-center text-azul-escuro/40">
            <Loader2 size={22} strokeWidth={2} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="flex h-80 items-center justify-center text-sm text-vermelho-risco">
            {error}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={dados} margin={{ top: 32, right: 12, left: 12, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="#C8CDD6" strokeOpacity={0.35} />
              <XAxis
                dataKey="mes"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#1A2347", fontSize: 12, fontWeight: 500 }}
              />
              <YAxis hide domain={[0, (max: number) => max * 1.2]} />
              <Bar
                dataKey="valor"
                fill={cor}
                stroke={corContorno}
                strokeWidth={corContorno ? 1 : 0}
                radius={[8, 8, 0, 0]}
                maxBarSize={48}
              >
                <LabelList
                  dataKey="valor"
                  position="top"
                  formatter={(label: string | number | boolean | null | undefined) =>
                    formatValorLabel(Number(label ?? 0))
                  }
                  style={{ fill: "#1A2347", fontSize: 13, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
