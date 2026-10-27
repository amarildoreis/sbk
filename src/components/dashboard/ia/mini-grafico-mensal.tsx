"use client";

import { useRef } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { GraficoIaExportMenu } from "./grafico-ia-export-menu";

// Versão compacta de MesAMesChart (src/components/dashboard/graficos/) pro
// resultado da IA (CLAUDE.md seção 12, "retornar gráficos quando
// solicitado") — sem os filtros/radios próprios da tela de Gráficos, já que
// os dados já vêm resolvidos (RLS aplicado, ano/eixo já escolhidos) do
// template `graficos` (templates.ts). Mesma paleta de cores por métrica já
// usada na tela /dashboard/graficos, pra manter a identidade visual
// consistente entre os dois lugares.
//
// Rótulo de valor no topo de cada barra em valor LITERAL COMPLETO (não
// abreviado em mil/milhões, sem tooltip no hover) — pedido do cliente em
// 2026-07-19, mesma convenção já usada em MesAMesChart (formatValorLabel).
// A bolha do chat (chat-ia.tsx) usa max-w-full quando há gráfico, pra dar
// espaço horizontal suficiente pros rótulos completos não se sobrepor.
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatValorLabel(valor: number, unidade: "moeda" | "percentual"): string {
  const numero = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unidade === "percentual" ? `${numero}%` : numero;
}

export function MiniGraficoMensal({
  titulo,
  cor,
  unidade = "moeda",
  pontos,
}: {
  titulo: string;
  cor: string;
  /** "moeda" (padrão, R$) ou "percentual" (ex: Liquidez Pontual). */
  unidade?: "moeda" | "percentual";
  pontos: { mes: number; valor: number }[];
}) {
  const dados = pontos.map((p) => ({ mes: MESES[p.mes - 1], valor: p.valor }));
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="rounded-xl border border-cinza-prata/40 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-azul-escuro/70">{titulo}</p>
        <GraficoIaExportMenu titulo={titulo} pontos={pontos} containerRef={containerRef} />
      </div>
      <div ref={containerRef}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dados} margin={{ top: 32, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#C8CDD6" strokeOpacity={0.35} />
            <XAxis
              dataKey="mes"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#1A2347", fontSize: 11, fontWeight: 500 }}
            />
            <YAxis hide domain={[0, (max: number) => max * 1.25]} />
            <Bar dataKey="valor" fill={cor} radius={[5, 5, 0, 0]} maxBarSize={40}>
              <LabelList
                dataKey="valor"
                position="top"
                formatter={(label: string | number | boolean | null | undefined) =>
                  formatValorLabel(Number(label ?? 0), unidade)
                }
                style={{ fill: "#1A2347", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
