import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import type { MultiFactorResolver } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/site/AuthLayout";
import { AuthField, PasswordField } from "@/components/site/AuthFields";
import { useAuth } from "@/hooks/use-auth";
import { APP_URL, firebaseAuth } from "@/lib/firebase";
import { authMessage, errorCode } from "@/lib/auth-rules";
import { COMPANY } from "@/lib/site";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address"), password: z.string().min(1, "Enter your password") });

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in to your wallet — Wall·ette" },
      { name: "description", content: "Sign in securely to review your spending, money flow and what’s left to spend." },
      { property: "og:title", content: "Welcome back to Wall·ette" },
      { property: "og:description", content: "Sign in securely to your private money-tracking account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}/signin` }],
  }),
  component: SignIn,
});

function SignIn() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // An account with two-step sign-in: the authenticator app's code comes next.
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [code, setCode] = useState("");
  const { user, loading, signOut } = useAuth();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as "email" | "password"] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setError("");
    setPending(true);
    const [auth, m] = await Promise.all([firebaseAuth(), import("firebase/auth")]);
    try {
      await m.signInWithEmailAndPassword(auth, parsed.data.email.toLowerCase(), parsed.data.password);
      window.location.assign(APP_URL);
    } catch (e) {
      if (errorCode(e) === "auth/multi-factor-auth-required") setResolver(m.getMultiFactorResolver(auth, e as Parameters<typeof m.getMultiFactorResolver>[1]));
      else setError(authMessage(errorCode(e)));
      setPending(false);
    }
  }

  async function confirmCode(event: FormEvent) {
    event.preventDefault();
    if (!resolver || !/^\d{6}$/.test(code.trim())) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setError("");
    setPending(true);
    const m = await import("firebase/auth");
    const hint = resolver.hints.find((h) => h.factorId === m.TotpMultiFactorGenerator.FACTOR_ID);
    try {
      if (!hint) throw Object.assign(new Error("No authenticator app"), { code: "auth/invalid-verification-code" });
      await resolver.resolveSignIn(m.TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim()));
      window.location.assign(APP_URL);
    } catch (e) {
      setError(authMessage(errorCode(e)));
      setCode("");
      setPending(false);
    }
  }

  if (!loading && user && !pending) {
    return <AuthLayout mode="signin" title="You’re already signed in" lead={`Continue as ${user.email ?? "your Wall·ette account"}.`}><div className="space-y-3"><Button asChild variant="hero" size="xl" className="w-full"><a href={APP_URL}>Open Wall·ette</a></Button><Button type="button" variant="soft" size="xl" className="w-full" onClick={() => void signOut()}>Sign out</Button></div></AuthLayout>;
  }

  if (resolver) {
    return (
      <AuthLayout mode="signin" title="Two-step sign-in" lead="Enter the 6-digit code your authenticator app shows for Wall·ette.">
        <form onSubmit={(event) => void confirmCode(event)} noValidate className="space-y-4">
          <AuthField id="signin-code" label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
          {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={pending}>{pending ? "Checking…" : "Sign in"}</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => { setResolver(null); setCode(""); setError(""); }}>Back</Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout mode="signin" title="Welcome back" lead="Sign in to see your money clearly again." footer={<p className="text-center text-sm text-muted-foreground">New to Wall·ette? <Link to="/signup" className="font-semibold text-forest hover:underline">Create your wallet</Link></p>}>
      <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
        <AuthField id="signin-email" label="Email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))} error={errors.email} />
        <div>
          <PasswordField id="signin-password" label="Password" autoComplete="current-password" value={form.password} onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))} error={errors.password} />
          <div className="mt-2 text-right"><Link to="/forgot-password" className="text-sm font-medium text-forest hover:underline">Forgot password?</Link></div>
        </div>
        {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" variant="hero" size="xl" className="w-full" disabled={pending || loading}>{pending ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">The same account works in the Android app.</p>
    </AuthLayout>
  );
}
