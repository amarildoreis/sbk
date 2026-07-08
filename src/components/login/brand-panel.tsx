import { ShieldCheck, Database } from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    label: "Acesso restrito a contas provisionadas",
  },
  {
    icon: Database,
    label: "Dados sincronizados em tempo real",
  },
];

export function BrandPanel() {
  return (
    <div className="relative hidden flex-col overflow-hidden bg-brand-panel p-10 text-white md:flex lg:p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-azul-medio/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 -translate-x-1/3 translate-y-1/3 rounded-full bg-verde-escuro/10 blur-3xl"
      />

      <div className="relative flex flex-1 flex-col">
        <div className="animate-fade-in-up">
          <p className="text-xs font-medium tracking-[0.2em] text-cinza-prata">
            SBKANA . FIAGRO
          </p>
        </div>

        <div
          className="mt-16 animate-fade-in-up lg:mt-20"
          style={{ animationDelay: "80ms" }}
        >
          <h1 className="text-3xl font-semibold leading-[1.15] text-white lg:text-4xl">
            Inteligência analítica
            <br />
            para o seu FIDC
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-cinza-prata">
            Exposição de carteira, comportamento de títulos e comissões em um
            único painel executivo.
          </p>
        </div>

        <div className="flex-1" />

        <div
          className="animate-fade-in-up space-y-4 border-t border-white/10 pt-6"
          style={{ animationDelay: "160ms" }}
        >
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-verde-claro">
                <Icon size={16} strokeWidth={1.75} />
              </span>
              <span className="text-sm text-cinza-prata">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
