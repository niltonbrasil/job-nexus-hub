import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Definir nova senha — Umbrella" },
      { name: "description", content: "Defina uma nova senha para sua conta Umbrella." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase aciona PASSWORD_RECOVERY ao consumir o link
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });

    // Fallback: se já houver sessão (link já processado), liberar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
      else {
        // dar um curto tempo para o listener disparar
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s2 } }) => {
            if (!s2) setInvalid(true);
          });
        }, 1500);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada com sucesso.");
    const target = roles.includes("worker") ? "/app" : "/dashboard";
    navigate({ to: target });
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="relative hidden bg-hero p-12 text-white md:flex md:flex-col md:justify-between">
        <div className="absolute inset-0 grid-bg opacity-50" />
        <div className="relative">
          <BrandMark light />
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Defina uma nova senha.
          </h2>
          <p className="mt-4 text-white/70">
            Escolha uma senha forte para proteger seu acesso.
          </p>
        </div>
        <p className="relative text-xs text-white/50">© Umbrella · Job Hub</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="md:hidden">
            <BrandMark />
          </div>
          <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">Nova senha</h1>

          {invalid ? (
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <p className="font-display text-lg font-semibold">Link inválido ou expirado</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Solicite um novo link de recuperação para continuar.
              </p>
              <Button asChild variant="hero" size="sm" className="mt-6">
                <Link to="/forgot-password">Recuperar senha</Link>
              </Button>
            </div>
          ) : !ready ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando link...
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Atualizar senha
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
