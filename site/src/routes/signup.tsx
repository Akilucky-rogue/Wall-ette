import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/site/AuthLayout";
import { AuthField, PasswordField } from "@/components/site/AuthFields";
import { GoogleButton } from "@/components/site/GoogleButton";
import { useAuth } from "@/hooks/use-auth";
import { APP_URL, firebaseAuth, firestore } from "@/lib/firebase";
import { PASSWORD_HINT, PASSWORD_RULE, TERMS_VERSION, authMessage, errorCode } from "@/lib/auth-rules";
import { continueWithGoogle } from "@/lib/google";
import { COMPANY } from "@/lib/site";

const accountSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().regex(PASSWORD_RULE, PASSWORD_HINT),
  confirm: z.string(),
}).refine((data) => data.password === data.confirm, { message: "The passwords don’t match", path: ["confirm"] });

type Account = z.infer<typeof accountSchema>;
type Errors = Partial<Record<keyof Account, string>>;

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your wallet — Wall·ette" },
      { name: "description", content: "Create your Wall·ette account: import your bank statement, check the numbers and see what’s left to spend." },
      { property: "og:title", content: "Create your Wall·ette account" },
      { property: "og:description", content: "One account for the web app and the Android app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}/signup` }],
  }),
  component: SignUp,
});

function SignUp() {
  const [form, setForm] = useState<Account>({ email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; signIn?: boolean } | null>(null);
  const { user, loading, signOut } = useAuth();
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState("");

  async function google() {
    setGoogleError("");
    setError(null);
    setGooglePending(true);
    const outcome = await continueWithGoogle();
    if (outcome.status === "signed-in") {
      window.location.assign(APP_URL);
      return;
    }
    // An existing account with two-step sign-in: its code is asked on Sign in.
    if (outcome.status === "second-factor") setGoogleError("This account uses two-step sign-in. Continue on the Sign in page.");
    else if (outcome.status === "failed") setGoogleError(outcome.message);
    setGooglePending(false);
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    const parsed = accountSchema.safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Account] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    if (!terms) {
      setError({ text: "Please accept the Terms of use and Privacy Policy to continue." });
      return;
    }
    setError(null);
    setPending(true);
    const [auth, m] = await Promise.all([firebaseAuth(), import("firebase/auth")]);
    try {
      const credential = await m.createUserWithEmailAndPassword(auth, parsed.data.email.toLowerCase(), parsed.data.password);
      // The same consent record the app keeps (components/Auth.tsx).
      try {
        const [db, f] = await Promise.all([firestore(), import("firebase/firestore")]);
        await f.setDoc(f.doc(db, "users", credential.user.uid), { termsAccepted: true, termsVersion: TERMS_VERSION, termsAcceptedAt: f.serverTimestamp() }, { merge: true });
      } catch {
        // The account exists either way; the app asks nothing further.
      }
      window.location.assign(APP_URL);
    } catch (e) {
      const code = errorCode(e);
      setError({ text: authMessage(code), signIn: code === "auth/email-already-in-use" });
      setPending(false);
    }
  }

  if (!loading && user && !pending && !googlePending) {
    return <AuthLayout mode="signup" title="Your wallet is ready" lead={`You’re signed in as ${user.email ?? "your Wall·ette account"}.`}><div className="space-y-3"><Button asChild variant="hero" size="xl" className="w-full"><a href={APP_URL}>Open Wall·ette</a></Button><Button type="button" variant="soft" size="xl" className="w-full" onClick={() => void signOut()}>Use another account</Button></div></AuthLayout>;
  }

  return (
    <AuthLayout mode="signup" title="Create your wallet" lead="One account for the web app and the Android app." footer={<p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/signin" className="font-semibold text-forest hover:underline">Sign in</Link></p>}>
      <GoogleButton pending={googlePending} disabled={pending} onClick={() => void google()} error={googleError} />
      <form onSubmit={(event) => void createAccount(event)} noValidate className="space-y-4">
        <AuthField id="signup-email" label="Email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))} error={errors.email} />
        <PasswordField id="signup-password" label="Password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))} error={errors.password} />
        {!errors.password && <p className="-mt-2 text-xs text-muted-foreground">{PASSWORD_HINT}</p>}
        <PasswordField id="signup-confirm" label="Confirm password" autoComplete="new-password" value={form.confirm} onChange={(event) => setForm((old) => ({ ...old, confirm: event.target.value }))} error={errors.confirm} />
        <p className="rounded-2xl bg-sand p-4 text-sm"><strong>Paid plans haven’t started yet.</strong> Until they do, Wall·ette is free and no card is asked for. We’ll tell you before anything changes.</p>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-1 size-4 accent-[var(--forest)]" /><span>I agree to the <Link to="/terms" className="text-forest underline">Terms of use</Link> and <Link to="/privacy" className="text-forest underline">Privacy Policy</Link>.</span></label>
        {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error.text}{error.signIn && <> <Link to="/signin" className="font-semibold underline">Sign in</Link></>}</p>}
        <Button type="submit" variant="hero" size="xl" className="w-full" disabled={pending || loading}>{pending ? "Creating your wallet…" : "Create my wallet"}</Button>
      </form>
    </AuthLayout>
  );
}
