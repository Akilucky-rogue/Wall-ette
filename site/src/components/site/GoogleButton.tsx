import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/** Google's four-colour G, as Google's branding guidelines ask. */
function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>;
}

/**
 * "Continue with Google" in Google's colours for light and dark pages, the
 * consent it carries, and the divider before the email form. Signs in, or
 * creates the account the first time (lib/google.ts).
 */
export function GoogleButton({ pending, disabled, onClick, error }: { pending: boolean; disabled?: boolean; onClick: () => void; error?: string }) {
  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="xl"
        className="w-full rounded-full border border-[#747775] bg-white text-sm font-medium text-[#1F1F1F] shadow-none hover:bg-[#F8F8F8] dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:bg-[#1C1C1E]"
        disabled={pending || disabled}
        onClick={onClick}
      >
        <GoogleMark /> {pending ? "Connecting…" : "Continue with Google"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Continuing with Google signs you in, or creates your wallet the first time, and means you agree to the <Link to="/terms" className="text-forest underline">Terms of use</Link> and <Link to="/privacy" className="text-forest underline">Privacy Policy</Link>.</p>
      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex items-center gap-3 py-2" aria-hidden="true"><span className="h-px flex-1 bg-border" /><span className="text-xs uppercase tracking-wider text-muted-foreground">or use email</span><span className="h-px flex-1 bg-border" /></div>
    </div>
  );
}
