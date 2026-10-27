import { ShieldAlert } from "lucide-react";

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-cinza-prata/40 bg-white p-8 text-center shadow-premium-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-vermelho-risco/10 text-vermelho-risco">
        <ShieldAlert size={22} strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-semibold text-azul-escuro">Acesso restrito</h2>
      <p className="text-sm text-azul-escuro/55">
        {message ?? "Você não tem permissão para acessar esta área."}
      </p>
    </div>
  );
}
