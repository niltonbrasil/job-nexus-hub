import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
import { Loader2, Building2, HardHat } from "lucide-react";

const searchSchema = z.object({
  role: z.enum(["company", "worker"]).optional(),
});

export const Route = createFileRoute("/signup")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Criar conta — Umbrella" },
      { name: "description", content: "Crie sua conta Umbrella como empresa ou profissional." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, roles, loading } = useAuth();
  const [role, setRole] = useState<"company" | "worker">(search.role ?? "company");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailExists, setEmailExists] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const target = roles.includes("worker") ? "/app" : "/dashboard";
      navigate({ to: target });
    }
  }, [user, roles, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone, role },
      },
    });

    if (error) {
      setSubmitting(false);
      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("user already") ||
        (error as { code?: string }).code === "user_already_exists"
      ) {
        setEmailExists(true);
        return;
      }
      toast.error(error.message);
      return;
    }

    const newUser = data.user;
    if (!newUser) {
      setSubmitting(false);
      toast.error("Não foi possível criar a conta.");
      return;
    }

    // Create company or worker record
    if (role === "company") {
      await supabase.from("clients").insert({
        owner_id: newUser.id,
        name: organization || fullName,
        contact_email: email,
      });
    } else {
      const { data: worker } = await supabase
        .from("workers")
        .insert({
          user_id: newUser.id,
          name: fullName,
          email,
          phone,
        })
        .select("id")
        .single();
      if (worker) {
        await supabase.from("worker_metrics").insert({ worker_id: worker.id });
      }
    }

    setSubmitting(false);
    toast.success("Conta criada! Verifique seu email se necessário.");
    navigate({ to: role === "worker" ? "/app" : "/dashboard" });
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
            Junte-se ao hub que separa promessa de execução.
          </h2>
          <p className="mt-4 text-white/70">
            Empresas publicam jobs. Profissionais escolhem o modo. Tudo medido por execução real.
          </p>
        </div>
        <p className="relative text-xs text-white/50">© Umbrella · Job Hub</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="md:hidden">
            <BrandMark />
          </div>
          <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">Criar conta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Entrar
            </Link>
          </p>

          {/* Role selector */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {(
              [
                { value: "company", label: "Empresa", icon: Building2, desc: "Publicar jobs" },
                { value: "worker", label: "Profissional", icon: HardHat, desc: "Executar jobs" },
              ] as const
            ).map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  role === r.value
                    ? "border-accent bg-accent/5 shadow-glow"
                    : "border-border bg-card hover:border-accent/50"
                }`}
              >
                <r.icon
                  className={`h-5 w-5 ${role === r.value ? "text-accent" : "text-muted-foreground"}`}
                />
                <p className="mt-2 font-display font-semibold">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            {role === "company" && (
              <div className="space-y-2">
                <Label htmlFor="org">Empresa</Label>
                <Input
                  id="org"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar conta
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
