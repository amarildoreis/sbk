"use client";

import { useRef } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { GraficoIaExportMenu } from "./grafico-ia-export-menu";

// Variante de MiniGraficoMensal com eixo X por CATEGORIA (ex: um comercial
// por barra) em vez de mês — pedido do cliente em 2026-07-19: "gráfico
// onde o eixo X seja os nomes dos comerciais". Mesmo padrão visual
// (barras verticais, rótulo completo no topo, sem tooltip), só troca o
// eixo X de mês pra rótulo livre. Só o template `comissoes`
// (agrupar_por_comercial + formato=grafico) usa isso até agora.
function formatValorLabel(valor: number, unidade: "moeda" | "percentual"): string {
  const numero = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unidade === "percentual" ? `${numero}%` : numero;
}

export function MiniGraficoCategorico({
  titulo,
  cor,
  unidade = "moeda",
  itens,
}: {
  titulo: string;
  cor: string;
  unidade?: "moeda" | "percentual";
  itens: { rotulo: string; valor: number }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Barras mais estreitas espremidas, mais espaço horizontal — igual à
  // regra já usada nos gráficos mensais (12 barras fixas), só que aqui a
  // quantidade de categorias varia.
  const largura = Math.max(400, itens.length * 90);

  return (
    <div className="rounded-xl border border-cinza-prata/40 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-azul-escuro/70">{titulo}</p>
        <GraficoIaExportMenu titulo={titulo} itens={itens} containerRef={containerRef} />
      </div>
      <div ref={containerRef} className="overflow-x-auto">
        <div style={{ width: `${largura}px`, minWidth: "100%" }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={itens} margin={{ top: 32, right: 8, left: 8, bottom: 48 }}>
              <CartesianGrid vertical={false} stroke="#C8CDD6" strokeOpacity={0.35} />
              <XAxis
                dataKey="rotulo"
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                tick={{ fill: "#1A2347", fontSize: 10, fontWeight: 500 }}
              />
              <YAxis hide domain={[0, (max: number) => max * 1.25]} />
              <Bar dataKey="valor" fill={cor} radius={[5, 5, 0, 0]} maxBarSize={40}>
                <LabelList
                  dataKey="valor"
                  position="top"
                  formatter={(label: string | number | boolean | null | undefined) =>
                    formatValorLabel(Number(label ?? 0), unidade)
                  }
                  style={{ fill: "#1A2347", fontSize: 10, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
