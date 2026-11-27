import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { AuthLayout } from "@/components/site/AuthLayout";
import { PasswordField } from "@/components/site/AuthFields";
import { Button } from "@/components/ui/button";
import { firebaseAuth } from "@/lib/firebase";
import { PASSWORD_HINT, PASSWORD_RULE, authMessage, errorCode } from "@/lib/auth-rules";
import { COMPANY } from "@/lib/site";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Choose a new password — Wall·ette" },
    { name: "description", content: "Choose a new password for your Wall·ette account." },
    { property: "og:title", content: "Choose a new Wall·ette password" },
    { property: "og:description", content: "Securely choose a new account password." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ], links: [{ rel: "canonical", href: `${COMPANY.siteUrl}/reset-password` }] }),
  component: ResetPassword,
});

/**
 * Firebase's reset email opens Firebase's own page by default. This page
 * takes over when the email's link points here (?mode=resetPassword&oobCode=…).
 */
function ResetPassword() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [oobCode, setOobCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("oobCode");
    if (params.get("mode") !== "resetPassword" || !code) { setStatus("invalid"); return; }
    void Promise.all([firebaseAuth(), import("firebase/auth")])
      .then(([auth, m]) => m.verifyPasswordResetCode(auth, code))
      .then(() => { setOobCode(code); setStatus("ready"); })
      .catch(() => setStatus("invalid"));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!PASSWORD_RULE.test(password)) { setError(PASSWORD_HINT); return; }
    if (password !== confirm) { setError("The passwords don’t match."); return; }
    setPending(true); setError("");
    const [auth, m] = await Promise.all([firebaseAuth(), import("firebase/auth")]);
    try {
      await m.confirmPasswordReset(auth, oobCode, password);
      setStatus("done");
    } catch (e) {
      setError(authMessage(errorCode(e)));
    }
    setPending(false);
  }

  return <AuthLayout mode="recovery" title={status === "done" ? "Password updated" : "Choose a new password"} lead={status === "done" ? "Your new password is ready to use." : PASSWORD_HINT}>
    {status === "checking" && <p className="text-muted-foreground" role="status">Checking your reset link…</p>}
    {status === "invalid" && <div className="rounded-2xl bg-sand p-5"><p className="font-semibold">This reset link isn’t valid or has expired.</p><p className="mt-2 text-sm text-muted-foreground">For your security, a password can only be changed from a fresh link.</p><Button asChild variant="hero" size="xl" className="mt-5 w-full"><Link to="/forgot-password">Request a new link</Link></Button></div>}
    {status === "ready" && <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4"><PasswordField id="reset-password" label="New password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><PasswordField id="reset-confirm" label="Confirm new password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} error={error} /><Button type="submit" variant="hero" size="xl" className="w-full" disabled={pending}>{pending ? "Updating…" : "Update password"}</Button></form>}
    {status === "done" && <div className="text-center" role="status"><CheckCircle2 className="mx-auto size-12 text-forest" /><p className="mt-4 text-muted-foreground">Sign in with your new password.</p><Button asChild variant="hero" size="xl" className="mt-6 w-full"><Link to="/signin">Sign in</Link></Button></div>}
  </AuthLayout>;
}
