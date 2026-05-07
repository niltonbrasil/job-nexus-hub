import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — Umbrella" },
      { name: "description", content: "Recupere o acesso à sua conta Umbrella." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    // Resposta genérica para não vazar existência de conta
    if (error && error.status && error.status >= 500) {
      toast.error("Não foi possível processar agora. Tente novamente em instantes.");
      return;
    }
    setSent(true);
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
            Recupere o acesso em poucos segundos.
          </h2>
          <p className="mt-4 text-white/70">
            Enviaremos um link seguro para você redefinir sua senha.
          </p>
        </div>
        <p className="relative text-xs text-white/50">© Umbrella · Job Hub</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="md:hidden">
            <BrandMark />
          </div>
          <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">Esqueci minha senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lembrou?{" "}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Voltar ao login
            </Link>
          </p>

          {sent ? (
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <p className="font-display text-lg font-semibold">Verifique seu e-mail</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Se existir uma conta vinculada a <strong>{email}</strong>, enviaremos instruções para redefinir a senha.
              </p>
              <div className="mt-6 flex gap-3">
                <Button asChild variant="outline" size="sm">
                  <Link to="/login">Ir para login</Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
                  Reenviar
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar link de recuperação
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
