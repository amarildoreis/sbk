"use client";

import { useEffect, useState } from "react";

// Painel de filtros retrátil — alternativa à popup (window.open) usada em
// Títulos/Carteira/Comissões. A pedido do cliente em 2026-07-16: clicar no
// ícone de filtro faz "a tela descer" mostrando os campos embutidos na
// própria página, e recolhe de novo assim que aplicado. Genérico de
// propósito (não sabe nada sobre os campos específicos de cada tela) — o
// mesmo padrão será reaproveitado em Títulos/Carteira/Comissões numa etapa
// futura.
//
// A animação usa o truque de CSS grid (`grid-template-rows: 0fr -> 1fr`)
// em vez de medir altura via JS: o wrapper externo é um grid de 1 linha só,
// e o conteúdo real fica dentro de uma div com `overflow-hidden` — o
// browser anima a transição de tamanho da linha do grid suavemente, sem
// nunca precisar saber a altura real do conteúdo de antemão.
//
// `overflow-hidden` só fica ativo enquanto o painel está fechado ou
// animando — assim que a transição de abertura termina, troca pra
// `overflow-visible`, senão qualquer dropdown de um select interno (Grupo
// Econômico, Método etc.) fica cortado na borda do painel em vez de abrir
// livremente por cima do conteúdo abaixo. Confirmado pelo cliente em
// 2026-07-16: sem isso, os selects ficavam espremidos mostrando só 2-3
// opções em vez do dropdown inteiro.
export function RetractableFiltrosPanel({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const [allowOverflow, setAllowOverflow] = useState(false);

  // Fechar precisa recortar o conteúdo desde o primeiro instante da
  // animação (senão o painel "murcha" com o conteúdo ainda visível por
  // cima) — só ao abrir é que esperamos a transição terminar antes de
  // liberar o overflow.
  useEffect(() => {
    if (!open) setAllowOverflow(false);
  }, [open]);

  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      aria-hidden={!open}
      onTransitionEnd={(event) => {
        if (event.propertyName === "grid-template-rows" && open) {
          setAllowOverflow(true);
        }
      }}
    >
      <div className={allowOverflow ? "overflow-visible" : "overflow-hidden"}>{children}</div>
    </div>
  );
}
