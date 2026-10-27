"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, AlertTriangle } from "lucide-react";

export interface FiltroBuscaOption {
  value: string;
  label: string;
}

const MIN_CHARS = 1;
const DEBOUNCE_MS = 350;

// Select genérico com busca sob demanda (debounced) no servidor, pra listas
// grandes demais pra cachear (Sacado, Borderô) — mesmo padrão de
// clifor-select.tsx, mas devolve o código cru como valor (pra filtrar),
// não o texto formatado inteiro.
export function FiltroBuscaSelect({
  id,
  value,
  label,
  onChange,
  endpoint,
  mapResults,
  placeholder = "Digite para buscar...",
  minChars = MIN_CHARS,
}: {
  id?: string;
  value: string;
  label: string;
  onChange: (value: string, label: string) => void;
  endpoint: string;
  mapResults: (data: unknown) => FiltroBuscaOption[];
  placeholder?: string;
  minChars?: number;
}) {
  const [query, setQuery] = useState(label);
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<FiltroBuscaOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isOpen) setQuery(label);
  }, [label, isOpen]);

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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const termo = query.trim();
    if (!isOpen || termo.length < minChars) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const separador = endpoint.includes("?") ? "&" : "?";
        const res = await fetch(`${endpoint}${separador}q=${encodeURIComponent(termo)}`);
        if (!res.ok) throw new Error("request-failed");
        const data = await res.json();
        setResults(mapResults(data));
      } catch {
        setError("Não foi possível buscar agora.");
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isOpen, endpoint, minChars]);

  function handleSelect(option: FiltroBuscaOption) {
    onChange(option.value, option.label);
    setQuery(option.label);
    setIsOpen(false);
  }

  function handleClear() {
    onChange("", "");
    setQuery("");
    setIsOpen(true);
  }

  return (
    <div ref={rootRef} className="relative">
      <Search
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35"
      />
      <input
        id={id}
        type="text"
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          if (value) onChange("", "");
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-cinza-prata/70 bg-white py-2.5 pl-10 pr-4 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
      />

      {isOpen && (
        <div className="absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-cinza-prata/50 bg-white py-1.5 shadow-premium">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="flex w-full items-center px-4 py-2 text-left text-xs font-medium text-azul-medio transition hover:bg-azul-medio/5"
            >
              Limpar seleção (Todos)
            </button>
          )}
          {query.trim().length < minChars ? (
            <p className="px-4 py-3 text-sm text-azul-escuro/45">
              Digite pra buscar.
            </p>
          ) : isSearching ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-azul-escuro/45">
              <Loader2 size={14} className="animate-spin" />
              Buscando...
            </p>
          ) : error ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-vermelho-risco">
              <AlertTriangle size={14} />
              {error}
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-azul-escuro/45">
              Nenhum resultado para &quot;{query}&quot;.
            </p>
          ) : (
            results.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option)}
                className="flex w-full items-center px-4 py-2.5 text-left text-sm text-azul-escuro/80 transition hover:bg-azul-medio/5"
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
