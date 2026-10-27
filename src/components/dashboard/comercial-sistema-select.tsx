"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

export interface ComercialSistema {
  codigo: string;
  nome: string | null;
  email: string | null;
}

function formatLabel(c: ComercialSistema) {
  // codigo vazio = opção "Todos" (usada nos filtros) — sem prefixo de código.
  if (!c.codigo) return c.nome ?? "";
  return `${c.codigo} - ${c.nome ?? "(sem nome cadastrado)"}`;
}

export function ComercialSistemaSelect({
  id,
  value,
  onChange,
  options,
  isLoading,
  placeholder = "Buscar por código ou nome...",
}: {
  id?: string;
  value: string;
  onChange: (codigo: string) => void;
  options: ComercialSistema[];
  isLoading?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((c) => c.codigo === value);

  useEffect(() => {
    if (!isOpen) {
      setQuery(selected ? formatLabel(selected) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Enquanto mostra o valor já selecionado (dropdown fechado ou acabou de
    // abrir sem digitar nada), não filtra — mostra a lista toda.
    if (!q || (selected && q === formatLabel(selected).toLowerCase())) {
      return options;
    }
    return options.filter(
      (c) =>
        c.codigo.toLowerCase().includes(q) ||
        (c.nome ?? "").toLowerCase().includes(q),
    );
  }, [options, query, selected]);

  function handleSelect(c: ComercialSistema) {
    onChange(c.codigo);
    setQuery(formatLabel(c));
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      {isLoading && (
        <Loader2
          size={16}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-azul-escuro/35"
        />
      )}
      <input
        id={id}
        type="text"
        disabled={isLoading}
        value={query}
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          if (value) onChange("");
        }}
        placeholder={isLoading ? "Carregando..." : placeholder}
        autoComplete="off"
        className={`w-full appearance-none rounded-xl border border-cinza-prata/70 bg-white py-3 ${
          isLoading ? "pl-9" : "pl-3.5"
        } pr-10 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10 disabled:bg-surface-alt disabled:text-azul-escuro/40`}
      />
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/40"
      />

      {isOpen && !isLoading && (
        <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-cinza-prata/50 bg-white py-1.5 shadow-premium">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-azul-escuro/45">
              Nenhum resultado para &quot;{query}&quot;.
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.codigo || "todos"}
                type="button"
                onClick={() => handleSelect(c)}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-azul-medio/5 ${
                  c.codigo === value
                    ? "bg-azul-medio/10 font-medium text-azul-escuro"
                    : "text-azul-escuro/80"
                }`}
              >
                {c.codigo && (
                  <span className="font-mono text-xs text-azul-escuro/50">
                    {c.codigo}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">
                  {c.codigo ? (c.nome ?? "(sem nome cadastrado)") : c.nome}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
