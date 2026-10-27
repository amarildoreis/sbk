"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Loader2, AlertTriangle } from "lucide-react";

interface Clifor {
  clifor: string;
  nome: string;
  cgc: string | null;
}

function formatLabel(c: Clifor) {
  return `${c.clifor} - ${c.nome}${c.cgc ? ` - ${c.cgc}` : ""}`;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 350;

export function CliforSelect({
  id,
  value,
  onChange,
  placeholder = "Buscar por código, nome ou CNPJ (CLIFOR)...",
}: {
  id?: string;
  value: string;
  onChange: (label: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Clifor[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sincroniza com o valor vindo de fora (ex: modo edição) quando o campo
  // não está sendo digitado no momento.
  useEffect(() => {
    if (!isOpen) setQuery(value);
  }, [value, isOpen]);

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
    if (!isOpen || termo.length < MIN_CHARS) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clifor?q=${encodeURIComponent(termo)}`);
        if (!res.ok) throw new Error("request-failed");
        const data = await res.json();
        setResults(data.clifores);
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
  }, [query, isOpen]);

  function handleSelect(c: Clifor) {
    const label = formatLabel(c);
    onChange(label);
    setQuery(label);
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <Building2
        size={18}
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
          if (value) onChange("");
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-cinza-prata/70 bg-white py-3 pl-11 pr-4 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
      />

      {isOpen && (
        <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-cinza-prata/50 bg-white py-1.5 shadow-premium">
          {query.trim().length < MIN_CHARS ? (
            <p className="px-4 py-3 text-sm text-azul-escuro/45">
              Digite pelo menos {MIN_CHARS} caracteres para buscar.
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
            results.map((c) => (
              <button
                key={c.clifor}
                type="button"
                onClick={() => handleSelect(c)}
                className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm transition hover:bg-azul-medio/5"
              >
                <span className="font-medium text-azul-escuro">
                  {c.clifor} - {c.nome}
                </span>
                {c.cgc && (
                  <span className="text-xs text-azul-escuro/45">{c.cgc}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
