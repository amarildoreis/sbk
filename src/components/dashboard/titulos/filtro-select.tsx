"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

export interface FiltroOption {
  value: string;
  label: string;
}

const TODOS: FiltroOption = { value: "", label: "Todos" };

// Select genérico com busca client-side, pra listas pequenas já carregadas
// por inteiro (Grupo Econômico, Cedente, Situação) — mesmo padrão visual do
// ComercialSistemaSelect, mas com options {value,label} genéricas em vez de
// {codigo,nome,email}.
export function FiltroSelect({
  id,
  value,
  onChange,
  options,
  isLoading,
  placeholder = "Buscar...",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: FiltroOption[];
  isLoading?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const allOptions = useMemo(() => [TODOS, ...options], [options]);
  const selected = allOptions.find((o) => o.value === value);

  useEffect(() => {
    if (!isOpen) setQuery(selected ? selected.label : "");
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
    if (!q || (selected && q === selected.label.toLowerCase())) return allOptions;
    return allOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [allOptions, query, selected]);

  function handleSelect(option: FiltroOption) {
    onChange(option.value);
    setQuery(option.label);
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
        className={`w-full appearance-none rounded-xl border border-cinza-prata/70 bg-white py-2.5 ${
          isLoading ? "pl-9" : "pl-3.5"
        } pr-9 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10 disabled:bg-surface-alt disabled:text-azul-escuro/40`}
      />
      <ChevronDown
        size={15}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-azul-escuro/40"
      />

      {isOpen && !isLoading && (
        <div className="absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-cinza-prata/50 bg-white py-1.5 shadow-premium">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-azul-escuro/45">
              Nenhum resultado para &quot;{query}&quot;.
            </p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value || "todos"}
                type="button"
                onClick={() => handleSelect(option)}
                className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition hover:bg-azul-medio/5 ${
                  option.value === value
                    ? "bg-azul-medio/10 font-medium text-azul-escuro"
                    : "text-azul-escuro/80"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
