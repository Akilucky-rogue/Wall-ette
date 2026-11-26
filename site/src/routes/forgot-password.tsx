import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/site/AuthLayout";
import { AuthField } from "@/components/site/AuthFields";
import { Button } from "@/components/ui/button";
import { firebaseAuth } from "@/lib/firebase";
import { authMessage, errorCode } from "@/lib/auth-rules";
import { COMPANY } from "@/lib/site";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [
    { title: "Reset your Wall·ette password" },
    { name: "description", content: "Request a secure link to reset your Wall·ette account password." },
    { property: "og:title", content: "Reset your Wall·ette password" },
    { property: "og:description", content: "Request a secure password-reset link." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ], links: [{ rel: "canonical", href: `${COMPANY.siteUrl}/forgot-password` }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    setPending(true); setError("");
    const [auth, m] = await Promise.all([firebaseAuth(), import("firebase/auth")]);
    try {
      await m.sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSent(true);
    } catch (e) {
      // No account for that address: say so plainly, as the app does.
      setError(errorCode(e) === "auth/user-not-found" ? "There’s no Wall·ette account for that email. Check it for a typo, or create an account." : authMessage(errorCode(e)));
    }
    setPending(false);
  }

  return <AuthLayout mode="recovery" title="Forgot your password?" lead="Enter your account email and we’ll send you a link to choose a new one." footer={<p className="text-center text-sm"><Link to="/signin" className="font-semibold text-forest hover:underline">Back to sign in</Link></p>}>
    {sent ? <div className="rounded-3xl bg-accent p-6 text-center" role="status"><MailCheck className="mx-auto size-10 text-forest" /><h2 className="mt-4 text-xl">Check your email</h2><p className="mt-2 text-sm text-muted-foreground">A reset link is on its way to {email}. It opens a page where you choose a new password; then sign in with it here or in the app. Check spam if it hasn’t arrived in a few minutes.</p></div> : <form onSubmit={(event) => void submit(event)} noValidate className="space-y-5"><AuthField id="forgot-email" label="Account email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={error} /><Button type="submit" variant="hero" size="xl" className="w-full" disabled={pending}>{pending ? "Sending link…" : "Send reset link"}</Button></form>}
  </AuthLayout>;
}
