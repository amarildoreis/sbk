import { Construction, type LucideIcon } from "lucide-react";

// Placeholder premium reutilizável pra módulos que já têm item de menu +
// permissão criados, mas cuja tabela/relatório ainda será construído numa
// etapa seguinte — mesmo padrão usado inicialmente por Borderôs
// Liberados/Carteira de Sacados antes da tabela entrar.
export function ModuloEmDesenvolvimento({
  titulo,
  descricao,
  icon: Icon,
}: {
  titulo: string;
  descricao: string;
  icon: LucideIcon;
}) {
  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center gap-3.5 rounded-2xl border border-cinza-prata/40 bg-white p-5 shadow-premium-sm">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-azul-escuro">{titulo}</h2>
          <p className="text-sm text-azul-escuro/50">{descricao}</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-cinza-prata/50 bg-surface-alt/40 px-8 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-azul-medio/10 text-azul-medio">
          <Construction size={22} strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-semibold text-azul-escuro">Módulo em desenvolvimento</h3>
        <p className="max-w-sm text-sm text-azul-escuro/55">
          Este relatório está sendo construído e estará disponível em breve, seguindo o mesmo
          padrão de tabela, filtros e exportação dos demais módulos.
        </p>
      </div>
    </div>
  );
}
