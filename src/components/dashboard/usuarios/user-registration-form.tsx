"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  ShieldCheck,
  Camera,
  ClipboardCheck,
  Lock,
  ChevronDown,
  Check,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Copy,
  KeyRound,
} from "lucide-react";
import {
  PERFIS,
  EXTERNAL_PROFILES,
  STATUS_OPTIONS,
  STATUS_STYLES,
  COMERCIAL_TIPO_OPTIONS,
  type Status,
  type ComercialTipo,
} from "./constants";
import {
  PERMISSOES,
  EMPTY_PERMISSOES,
  permissoesFromDefaults,
  type PermissaoKey,
} from "./permissoes";
import {
  ComercialSistemaSelect,
  type ComercialSistema,
} from "../comercial-sistema-select";
import { CliforSelect } from "./clifor-select";

const MAX_FOTO_BYTES = 2 * 1024 * 1024;

const STEPS = [
  { n: 1, label: "Dados Gerais" },
  { n: 2, label: "Permissões" },
  { n: 3, label: "Revisão e Envio" },
] as const;

type StepNumber = (typeof STEPS)[number]["n"];

function StepIndicator({ currentStep }: { currentStep: StepNumber }) {
  return (
    <div className="flex items-start justify-center">
      {STEPS.map((step, idx) => {
        const isCompleted = currentStep > step.n;
        const isCurrent = currentStep === step.n;

        return (
          <div key={step.n} className="flex items-start">
            <div className="flex w-24 flex-col items-center gap-2">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition ${
                  isCompleted
                    ? "border-verde-escuro bg-verde-escuro text-white"
                    : isCurrent
                      ? "border-azul-escuro bg-azul-escuro text-white"
                      : "border-cinza-prata/60 bg-white text-azul-escuro/35"
                }`}
              >
                {isCompleted ? <Check size={16} strokeWidth={2.5} /> : step.n}
              </div>
              <span
                className={`text-center text-xs font-medium leading-tight ${
                  isCurrent || isCompleted
                    ? "text-azul-escuro"
                    : "text-azul-escuro/40"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`mt-5 h-px w-12 sm:w-20 ${
                  isCompleted ? "bg-verde-escuro" : "bg-cinza-prata/60"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CardHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof User;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul-escuro/5 text-azul-escuro">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-azul-escuro">{title}</h2>
        <p className="text-sm text-azul-escuro/50">{description}</p>
      </div>
    </div>
  );
}

function PermissionRow({
  label,
  description,
  checked,
  locked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-cinza-prata/50 bg-white px-4 py-3.5 transition ${
        locked
          ? "cursor-not-allowed opacity-90"
          : "cursor-pointer hover:border-azul-medio/40 hover:bg-azul-medio/5"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          checked
            ? "border-azul-escuro bg-azul-escuro"
            : "border-cinza-prata/70 bg-white"
        }`}
      >
        {checked && <Check size={13} strokeWidth={3} className="text-white" />}
      </span>
      <span className="flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-azul-escuro">{label}</span>
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-azul-escuro/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-azul-escuro/50">
              <Lock size={9} strokeWidth={2} />
              Padrão do perfil
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-azul-escuro/50">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={locked}
        onChange={onToggle}
      />
    </label>
  );
}

export interface UsuarioInitialData {
  nome: string;
  email: string;
  perfil: string;
  status: Status;
  vinculo: string | null;
  comercialTipo: ComercialTipo | null;
  comercialCodigo: string | null;
  fotoBase64: string | null;
  permissoes: Record<string, boolean>;
}

export function UserRegistrationForm({
  mode = "create",
  userId,
  initialData,
}: {
  mode?: "create" | "edit";
  userId?: string;
  initialData?: UsuarioInitialData;
}) {
  const [step, setStep] = useState<StepNumber>(1);
  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [perfil, setPerfil] = useState(initialData?.perfil ?? "");
  const [status, setStatus] = useState<Status>(initialData?.status ?? "Ativo");
  const [vinculo, setVinculo] = useState(initialData?.vinculo ?? "");
  const [comercialTipo, setComercialTipo] = useState<ComercialTipo>(
    initialData?.comercialTipo ?? "Interno",
  );
  const [comercialCodigo, setComercialCodigo] = useState(
    initialData?.comercialCodigo ?? "",
  );
  const [foto, setFoto] = useState<string | null>(initialData?.fotoBase64 ?? null);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [permissoes, setPermissoes] = useState<Record<PermissaoKey, boolean>>({
    ...EMPTY_PERMISSOES,
    ...(initialData?.permissoes as Record<PermissaoKey, boolean> | undefined),
  });
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [senhaCopiada, setSenhaCopiada] = useState(false);

  const [comerciaisSistema, setComerciaisSistema] = useState<ComercialSistema[]>([]);
  const [isLoadingComerciais, setIsLoadingComerciais] = useState(false);
  const [comerciaisError, setComerciaisError] = useState<string | null>(null);
  const [comercialCodigoError, setComercialCodigoError] = useState<string | null>(
    null,
  );
  const [vinculoError, setVinculoError] = useState<string | null>(null);

  const isExternalProfile = EXTERNAL_PROFILES.includes(perfil);
  const isComercial = perfil === "Comercial";

  useEffect(() => {
    if (!isComercial || comerciaisSistema.length > 0 || isLoadingComerciais) return;

    let cancelled = false;
    async function load() {
      setIsLoadingComerciais(true);
      setComerciaisError(null);
      try {
        const res = await fetch("/api/operadores-indicante");
        if (!res.ok) throw new Error("request-failed");
        const data = await res.json();
        if (!cancelled) setComerciaisSistema(data.operadores);
      } catch {
        if (!cancelled) {
          setComerciaisError(
            "Não foi possível carregar a lista de comerciais do sistema.",
          );
        }
      } finally {
        if (!cancelled) setIsLoadingComerciais(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComercial]);

  const selectedComercialSistema = comerciaisSistema.find(
    (c) => c.codigo === comercialCodigo,
  );
  const isAdministrador = perfil === "Administrador";
  const visiblePermissoes = PERMISSOES.filter(
    (p) =>
      (!p.internalOnly || !isExternalProfile) &&
      (!p.adminOnly || isAdministrador),
  );
  const checkedPermissoes = PERMISSOES.filter((p) => permissoes[p.key]);

  function handlePerfilChange(value: string) {
    setPerfil(value);
    setPermissoes(permissoesFromDefaults(value));
    if (!EXTERNAL_PROFILES.includes(value)) setVinculo("");
    if (value !== "Comercial") {
      setComercialTipo("Interno");
      setComercialCodigo("");
    }
    setComercialCodigoError(null);
    setVinculoError(null);
  }

  function togglePermissao(key: PermissaoKey, locked: boolean) {
    if (locked) return;
    setPermissoes((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleFotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFotoError("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_FOTO_BYTES) {
      setFotoError("Imagem muito grande — o máximo é 2MB.");
      return;
    }

    setFotoError(null);
    const reader = new FileReader();
    reader.onload = () => setFoto(reader.result as string);
    reader.onerror = () => setFotoError("Não foi possível ler essa imagem.");
    reader.readAsDataURL(file);
  }

  function handleAdvanceToPermissoes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isComercial && !comercialCodigo) {
      setComercialCodigoError("Selecione o comercial do sistema.");
      return;
    }
    setComercialCodigoError(null);
    if (isExternalProfile && !vinculo) {
      setVinculoError(
        `Selecione o ${perfil === "Sacado" ? "sacado" : "cedente"} vinculado.`,
      );
      return;
    }
    setVinculoError(null);
    setStep(2);
  }

  function handleAdvanceToRevisao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep(3);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    const payload = {
      nome,
      email,
      perfil,
      status,
      vinculo: isExternalProfile ? vinculo : null,
      comercialTipo: isComercial ? comercialTipo : null,
      comercialCodigo: isComercial ? comercialCodigo : null,
      fotoBase64: foto,
      permissoes,
      enviarEmail: mode === "create" ? enviarEmail : false,
    };

    try {
      const res = await fetch(
        mode === "edit" ? `/api/usuarios/${userId}` : "/api/usuarios",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Não foi possível salvar o usuário.");
      }

      if (mode === "create") {
        setSenhaGerada(data.senhaGerada ?? null);
        setEmailSent(Boolean(data.emailSent));
      }
      setSubmitted(true);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o usuário no momento.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setNome("");
    setEmail("");
    setPerfil("");
    setStatus("Ativo");
    setVinculo("");
    setComercialTipo("Interno");
    setComercialCodigo("");
    setFoto(null);
    setPermissoes(EMPTY_PERMISSOES);
    setEnviarEmail(true);
    setSenhaGerada(null);
    setEmailSent(false);
    setSenhaCopiada(false);
    setSubmitted(false);
    setStep(1);
  }

  async function handleCopySenha() {
    if (!senhaGerada) return;
    try {
      await navigator.clipboard.writeText(senhaGerada);
      setSenhaCopiada(true);
      setTimeout(() => setSenhaCopiada(false), 2000);
    } catch {
      // Sem permissão de clipboard — a senha continua visível na tela.
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {!submitted && (
        <Link
          href="/dashboard/usuarios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-azul-medio transition hover:text-azul-escuro"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Voltar para lista de usuários
        </Link>
      )}

      {!submitted && <StepIndicator currentStep={step} />}

      <div className="animate-fade-in-up rounded-2xl border border-cinza-prata/40 bg-white p-6 shadow-premium-sm sm:p-8">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-verde-escuro/10 text-verde-escuro">
              <CheckCircle2 size={28} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-azul-escuro">
                {mode === "edit"
                  ? "Alterações salvas com sucesso"
                  : "Usuário cadastrado com sucesso"}
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-azul-escuro/55">
                <span className="font-medium text-azul-escuro">{nome}</span>{" "}
                {mode === "edit" ? "foi atualizado(a)" : "foi cadastrado(a)"}{" "}
                como <strong>{perfil}</strong>. As permissões selecionadas já
                estão ativas para o próximo acesso.
              </p>
            </div>

            {mode === "create" && senhaGerada && (
              <div className="w-full max-w-sm rounded-xl border border-cinza-prata/40 bg-surface-alt/60 p-4 text-left">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-azul-escuro/40">
                  <KeyRound size={13} strokeWidth={2} />
                  Senha temporária gerada
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2.5 ring-1 ring-cinza-prata/50">
                  <span className="font-mono text-sm font-semibold text-azul-escuro">
                    {senhaGerada}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySenha}
                    title="Copiar senha"
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-azul-medio transition hover:bg-azul-medio/10"
                  >
                    <Copy size={13} strokeWidth={2} />
                    {senhaCopiada ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-azul-escuro/45">
                  Essa senha não será mostrada de novo — copie agora se
                  precisar repassar manualmente.
                </p>
                <p
                  className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${
                    emailSent ? "text-verde-escuro" : "text-azul-escuro/50"
                  }`}
                >
                  {emailSent ? (
                    <Check size={13} strokeWidth={2.5} />
                  ) : (
                    <Mail size={13} strokeWidth={2} />
                  )}
                  {emailSent
                    ? "E-mail de boas-vindas enviado."
                    : "E-mail não enviado (opção desmarcada ou SMTP indisponível)."}
                </p>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              {mode === "create" && (
                <button
                  onClick={handleReset}
                  className="rounded-xl border border-cinza-prata/60 px-5 py-2.5 text-sm font-medium text-azul-escuro transition hover:border-azul-medio/40 hover:bg-azul-medio/5"
                >
                  Cadastrar outro usuário
                </button>
              )}
              {mode === "edit" && userId && (
                <Link
                  href={`/dashboard/usuarios/${userId}`}
                  className="rounded-xl border border-cinza-prata/60 px-5 py-2.5 text-sm font-medium text-azul-escuro transition hover:border-azul-medio/40 hover:bg-azul-medio/5"
                >
                  Ver usuário
                </Link>
              )}
              <Link
                href="/dashboard/usuarios"
                className="rounded-xl bg-azul-escuro px-5 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99]"
              >
                Voltar para lista
              </Link>
            </div>
          </div>
        ) : step === 1 ? (
          <form onSubmit={handleAdvanceToPermissoes} className="space-y-7">
            <CardHeader
              icon={User}
              title="Dados Gerais"
              description="Informações de acesso e perfil do usuário."
            />

            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-azul-escuro/5 text-azul-escuro ring-1 ring-cinza-prata/40">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={foto}
                      alt="Foto do usuário"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User size={28} strokeWidth={1.5} />
                  )}
                </div>
                <label
                  htmlFor="foto-input"
                  title="Alterar foto"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-azul-escuro text-white shadow-premium-sm transition hover:bg-azul-medio"
                >
                  <Camera size={13} strokeWidth={2} />
                </label>
                <input
                  id="foto-input"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFotoChange}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-azul-escuro">
                  Foto do usuário
                </p>
                <p className="text-xs text-azul-escuro/50">
                  JPG ou PNG, até 2MB. Opcional — o próprio usuário poderá
                  trocar depois no perfil dele.
                </p>
                {fotoError && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-vermelho-risco">
                    <AlertTriangle size={12} />
                    {fotoError}
                  </p>
                )}
                {foto && !fotoError && (
                  <button
                    type="button"
                    onClick={() => setFoto(null)}
                    className="mt-1 text-xs font-medium text-vermelho-risco transition hover:underline"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="nome"
                  className="mb-2 block text-sm font-medium text-azul-escuro/80"
                >
                  Nome
                </label>
                <div className="relative">
                  <User
                    size={18}
                    strokeWidth={1.75}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35"
                  />
                  <input
                    id="nome"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Ana Beatriz Costa"
                    className="w-full rounded-xl border border-cinza-prata/70 bg-white py-3 pl-11 pr-4 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-azul-escuro/80"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    strokeWidth={1.75}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35"
                  />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@empresa.com.br"
                    className="w-full rounded-xl border border-cinza-prata/70 bg-white py-3 pl-11 pr-4 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="perfil"
                  className="mb-2 block text-sm font-medium text-azul-escuro/80"
                >
                  Perfil
                </label>
                <div className="relative">
                  <ShieldCheck
                    size={18}
                    strokeWidth={1.75}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35"
                  />
                  <select
                    id="perfil"
                    required
                    value={perfil}
                    onChange={(e) => handlePerfilChange(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-cinza-prata/70 bg-white py-3 pl-11 pr-10 text-sm text-azul-escuro outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {PERFIS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    strokeWidth={1.75}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/40"
                  />
                </div>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-azul-escuro/80">
                  Status
                </span>
                <div className="inline-flex rounded-xl border border-cinza-prata/60 bg-surface-alt p-1">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setStatus(opt)}
                      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                        status === opt
                          ? "bg-azul-escuro text-white shadow-premium-sm"
                          : "text-azul-escuro/60 hover:text-azul-escuro"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {isComercial && (
                <>
                  <div>
                    <span className="mb-2 block text-sm font-medium text-azul-escuro/80">
                      Tipo
                    </span>
                    <div className="inline-flex rounded-xl border border-cinza-prata/60 bg-surface-alt p-1">
                      {COMERCIAL_TIPO_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setComercialTipo(opt)}
                          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                            comercialTipo === opt
                              ? "bg-azul-escuro text-white shadow-premium-sm"
                              : "text-azul-escuro/60 hover:text-azul-escuro"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="comercial-sistema"
                      className="mb-2 block text-sm font-medium text-azul-escuro/80"
                    >
                      Comercial do Sistema
                    </label>
                    <ComercialSistemaSelect
                      id="comercial-sistema"
                      value={comercialCodigo}
                      onChange={(codigo) => {
                        setComercialCodigo(codigo);
                        setComercialCodigoError(null);
                      }}
                      options={comerciaisSistema}
                      isLoading={isLoadingComerciais}
                    />
                    {comerciaisError ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-vermelho-risco">
                        <AlertTriangle size={12} />
                        {comerciaisError}
                      </p>
                    ) : comercialCodigoError ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-vermelho-risco">
                        <AlertTriangle size={12} />
                        {comercialCodigoError}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-azul-escuro/40">
                        Vincula este usuário ao código do comercial no BANCO
                        DE DADOS. Quando{" "}
                        <span className="font-semibold text-vermelho-risco">
                          Interno
                        </span>
                        , a taxa de comissão é calculada automaticamente
                        pelas Faixas de Comissões cadastradas, quando{" "}
                        <span className="font-semibold text-vermelho-risco">
                          Externo
                        </span>
                        , a taxa de comissão é calculada pela taxa do seu
                        respectivo borderô.
                      </p>
                    )}
                  </div>
                </>
              )}

              {isExternalProfile && (
                <div className="sm:col-span-2">
                  <label
                    htmlFor="vinculo"
                    className="mb-2 block text-sm font-medium text-azul-escuro/80"
                  >
                    {perfil === "Sacado" ? "Sacado vinculado" : "Cedente vinculado"}
                  </label>
                  <CliforSelect
                    id="vinculo"
                    value={vinculo}
                    onChange={(value) => {
                      setVinculo(value);
                      setVinculoError(null);
                    }}
                  />
                  {vinculoError ? (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-vermelho-risco">
                      <AlertTriangle size={12} />
                      {vinculoError}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-azul-escuro/40">
                      Define de qual{" "}
                      {perfil === "Sacado" ? "sacado" : "cedente"} este
                      usuário poderá visualizar os dados na plataforma.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-cinza-prata/30 pt-6">
              <span />
              <button
                type="submit"
                className="group flex items-center gap-2 rounded-xl bg-azul-escuro px-5 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99]"
              >
                Avançar
                <ArrowRight
                  size={16}
                  strokeWidth={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </div>
          </form>
        ) : step === 2 ? (
          <form onSubmit={handleAdvanceToRevisao} className="space-y-7">
            <CardHeader
              icon={ShieldCheck}
              title="Permissões"
              description="Selecione o que este usuário poderá acessar na plataforma."
            />

            <div className="space-y-2.5">
              {visiblePermissoes.map((permissao) => {
                const locked =
                  perfil === "Administrador" &&
                  permissao.key === "cadastrar_usuarios";
                return (
                  <PermissionRow
                    key={permissao.key}
                    label={permissao.label}
                    description={permissao.description}
                    checked={permissoes[permissao.key]}
                    locked={locked}
                    onToggle={() => togglePermissao(permissao.key, locked)}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-cinza-prata/30 pt-6">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-2 rounded-xl border border-cinza-prata/60 px-5 py-2.5 text-sm font-medium text-azul-escuro transition hover:border-azul-medio/40 hover:bg-azul-medio/5"
              >
                <ArrowLeft size={16} strokeWidth={2} />
                Voltar
              </button>
              <button
                type="submit"
                className="group flex items-center gap-2 rounded-xl bg-azul-escuro px-5 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99]"
              >
                Avançar
                <ArrowRight
                  size={16}
                  strokeWidth={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSave} className="space-y-7">
            <CardHeader
              icon={ClipboardCheck}
              title="Revisão e Envio"
              description="Confira os dados antes de concluir o cadastro."
            />

            <div className="space-y-5">
              <div className="rounded-xl border border-cinza-prata/40 bg-surface-alt/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-azul-escuro/10 text-azul-escuro ring-1 ring-cinza-prata/40">
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={foto}
                        alt={nome}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User size={18} strokeWidth={1.75} />
                    )}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-azul-escuro/40">
                    Dados Gerais
                  </p>
                </div>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-azul-escuro/50">Nome</dt>
                    <dd className="text-sm font-medium text-azul-escuro">
                      {nome}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-azul-escuro/50">E-mail</dt>
                    <dd className="text-sm font-medium text-azul-escuro">
                      {email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-azul-escuro/50">Perfil</dt>
                    <dd className="text-sm font-medium text-azul-escuro">
                      {perfil}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-azul-escuro/50">Status</dt>
                    <dd className="mt-0.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
                      >
                        {status}
                      </span>
                    </dd>
                  </div>
                  {isExternalProfile && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-azul-escuro/50">
                        {perfil === "Sacado"
                          ? "Sacado vinculado"
                          : "Cedente vinculado"}
                      </dt>
                      <dd className="text-sm font-medium text-azul-escuro">
                        {vinculo}
                      </dd>
                    </div>
                  )}
                  {isComercial && (
                    <>
                      <div>
                        <dt className="text-xs text-azul-escuro/50">Tipo</dt>
                        <dd className="text-sm font-medium text-azul-escuro">
                          {comercialTipo}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-azul-escuro/50">
                          Comercial do Sistema
                        </dt>
                        <dd className="text-sm font-medium text-azul-escuro">
                          {selectedComercialSistema
                            ? `${selectedComercialSistema.codigo} - ${selectedComercialSistema.nome ?? "(sem nome cadastrado)"}`
                            : "—"}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>

              <div className="rounded-xl border border-cinza-prata/40 bg-surface-alt/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-azul-escuro/40">
                  Permissões selecionadas
                </p>
                {checkedPermissoes.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {checkedPermissoes.map((p) => (
                      <span
                        key={p.key}
                        className="inline-flex items-center gap-1.5 rounded-full bg-verde-escuro/10 px-2.5 py-1 text-xs font-medium text-verde-escuro"
                      >
                        <Check size={12} strokeWidth={2.5} />
                        {p.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-azul-escuro/45">
                    Nenhuma permissão selecionada.
                  </p>
                )}
              </div>

              {mode === "create" && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-cinza-prata/50 bg-white px-4 py-3.5 transition hover:border-azul-medio/40 hover:bg-azul-medio/5">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                      enviarEmail
                        ? "border-azul-escuro bg-azul-escuro"
                        : "border-cinza-prata/70 bg-white"
                    }`}
                  >
                    {enviarEmail && (
                      <Check size={13} strokeWidth={3} className="text-white" />
                    )}
                  </span>
                  <span className="flex-1">
                    <span className="text-sm font-medium text-azul-escuro">
                      Enviar e-mail de boas-vindas
                    </span>
                    <span className="mt-0.5 block text-xs text-azul-escuro/50">
                      Uma senha temporária é gerada de qualquer forma; esta
                      opção só controla se ela é enviada por e-mail agora.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={enviarEmail}
                    onChange={(e) => setEnviarEmail(e.target.checked)}
                  />
                </label>
              )}
            </div>

            {saveError && (
              <p className="flex items-center gap-2 rounded-xl bg-vermelho-risco/10 px-4 py-3 text-sm text-vermelho-risco">
                <AlertTriangle size={16} className="shrink-0" />
                {saveError}
              </p>
            )}

            <div className="flex items-center justify-between border-t border-cinza-prata/30 pt-6">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-2 rounded-xl border border-cinza-prata/60 px-5 py-2.5 text-sm font-medium text-azul-escuro transition hover:border-azul-medio/40 hover:bg-azul-medio/5"
              >
                <ArrowLeft size={16} strokeWidth={2} />
                Voltar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-azul-escuro px-5 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving
                  ? "Salvando..."
                  : mode === "edit"
                    ? "Salvar Alterações"
                    : "Confirmar Cadastro"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
