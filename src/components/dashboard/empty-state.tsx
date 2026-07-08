import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description = "Conteúdo em desenvolvimento.",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-cinza-prata/60 bg-white/60 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-azul-escuro/5 text-azul-escuro">
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-azul-escuro">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-azul-escuro/50">{description}</p>
    </div>
  );
}
