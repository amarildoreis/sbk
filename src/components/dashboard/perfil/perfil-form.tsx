"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Camera,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
} from "lucide-react";

const MAX_FOTO_BYTES = 2 * 1024 * 1024;

interface PerfilUsuario {
  id: string;
  nome: string;
  email: string;
  fotoBase64: string | null;
}

export function PerfilForm({ usuario }: { usuario: PerfilUsuario }) {
  const router = useRouter();

  const [foto, setFoto] = useState<string | null>(usuario.fotoBase64);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [isSavingFoto, setIsSavingFoto] = useState(false);
  const [fotoSaved, setFotoSaved] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingSenha, setIsSavingSenha] = useState(false);
  const [senhaError, setSenhaError] = useState<string | null>(null);
  const [senhaSaved, setSenhaSaved] = useState(false);

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

  async function handleSaveFoto() {
    setIsSavingFoto(true);
    setFotoError(null);
    setFotoSaved(false);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoBase64: foto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar a foto.");
      setFotoSaved(true);
      router.refresh();
      setTimeout(() => setFotoSaved(false), 2500);
    } catch (error) {
      setFotoError(
        error instanceof Error ? error.message : "Não foi possível salvar a foto.",
      );
    } finally {
      setIsSavingFoto(false);
    }
  }

  async function handleSaveSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingSenha(true);
    setSenhaError(null);
    setSenhaSaved(false);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha, confirmarSenha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível trocar a senha.");
      setSenhaSaved(true);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      setTimeout(() => setSenhaSaved(false), 2500);
    } catch (error) {
      setSenhaError(
        error instanceof Error ? error.message : "Não foi possível trocar a senha.",
      );
    } finally {
      setIsSavingSenha(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-azul-escuro">Meu Perfil</h1>
        <p className="text-sm text-azul-escuro/50">
          Gerencie sua foto e sua senha de acesso.
        </p>
      </div>

      <div className="animate-fade-in-up rounded-2xl border border-cinza-prata/40 bg-white p-6 shadow-premium-sm sm:p-8">
        <h2 className="text-base font-semibold text-azul-escuro">Foto</h2>
        <p className="text-sm text-azul-escuro/50">{usuario.nome} · {usuario.email}</p>

        <div className="mt-5 flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-azul-escuro/5 text-azul-escuro ring-1 ring-cinza-prata/40">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt={usuario.nome} className="h-full w-full object-cover" />
              ) : (
                <User size={28} strokeWidth={1.5} />
              )}
            </div>
            <label
              htmlFor="perfil-foto-input"
              title="Alterar foto"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-azul-escuro text-white shadow-premium-sm transition hover:bg-azul-medio"
            >
              <Camera size={13} strokeWidth={2} />
            </label>
            <input
              id="perfil-foto-input"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFotoChange}
            />
          </div>
          <div className="flex-1">
            <p className="text-xs text-azul-escuro/50">JPG ou PNG, até 2MB.</p>
            {foto && (
              <button
                type="button"
                onClick={() => setFoto(null)}
                className="mt-1 text-xs font-medium text-vermelho-risco transition hover:underline"
              >
                Remover foto
              </button>
            )}
            {fotoError && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-vermelho-risco">
                <AlertTriangle size={12} />
                {fotoError}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSaveFoto}
            disabled={isSavingFoto}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-azul-escuro px-4 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSavingFoto ? "Salvando..." : fotoSaved ? "Salvo!" : "Salvar foto"}
            {fotoSaved && !isSavingFoto && <Check size={15} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSaveSenha}
        className="animate-fade-in-up rounded-2xl border border-cinza-prata/40 bg-white p-6 shadow-premium-sm sm:p-8"
      >
        <h2 className="text-base font-semibold text-azul-escuro">Trocar senha</h2>
        <p className="text-sm text-azul-escuro/50">
          Informe sua senha atual e a nova senha desejada.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="senhaAtual" className="mb-2 block text-sm font-medium text-azul-escuro/80">
              Senha atual
            </label>
            <div className="relative">
              <Lock size={18} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35" />
              <input
                id="senhaAtual"
                type={showPassword ? "text" : "password"}
                required
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                className="w-full rounded-xl border border-cinza-prata/70 bg-white py-3 pl-11 pr-11 text-sm text-azul-escuro outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35 transition hover:text-azul-escuro/70"
              >
                {showPassword ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="novaSenha" className="mb-2 block text-sm font-medium text-azul-escuro/80">
                Nova senha
              </label>
              <div className="relative">
                <Lock size={18} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35" />
                <input
                  id="novaSenha"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-xl border border-cinza-prata/70 bg-white py-3 pl-11 pr-4 text-sm text-azul-escuro placeholder:text-azul-escuro/35 outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
                />
              </div>
            </div>
            <div>
              <label htmlFor="confirmarSenhaPerfil" className="mb-2 block text-sm font-medium text-azul-escuro/80">
                Confirmar nova senha
              </label>
              <div className="relative">
                <Lock size={18} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-azul-escuro/35" />
                <input
                  id="confirmarSenhaPerfil"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full rounded-xl border border-cinza-prata/70 bg-white py-3 pl-11 pr-4 text-sm text-azul-escuro outline-none transition focus:border-azul-medio focus:ring-4 focus:ring-azul-medio/10"
                />
              </div>
            </div>
          </div>
        </div>

        {senhaError && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-vermelho-risco/10 px-4 py-3 text-sm text-vermelho-risco">
            <AlertTriangle size={16} className="shrink-0" />
            {senhaError}
          </p>
        )}

        <div className="mt-6 flex justify-end border-t border-cinza-prata/30 pt-6">
          <button
            type="submit"
            disabled={isSavingSenha}
            className="flex items-center gap-2 rounded-xl bg-azul-escuro px-5 py-2.5 text-sm font-semibold text-white shadow-premium-sm transition hover:bg-azul-medio active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSavingSenha ? "Salvando..." : senhaSaved ? "Senha atualizada!" : "Trocar senha"}
            {senhaSaved && !isSavingSenha && <Check size={15} strokeWidth={2.5} />}
          </button>
        </div>
      </form>
    </div>
  );
}
