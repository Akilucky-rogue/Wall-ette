import { GraduationCap, MailCheck, School, ShieldCheck } from "lucide-react";
import { STUDENT_OFFER } from "@/lib/programs";
import { OpensWithPlans } from "./OpensWithPlans";

/** Student access starts with paid plans; until then the panel says so. */
export function StudentPanel() {
  return <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
    <div>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">{[{ icon: MailCheck, title: "Institution email", text: "Use an active email issued by your college or school." }, { icon: School, title: "Single-use code", text: "A partner institution gives each eligible student a unique code." }, { icon: ShieldCheck, title: "Assisted review", text: "If neither works, request a secure document-review route." }].map((item) => <div key={item.title} className="rounded-2xl bg-sand p-5"><item.icon className="size-5 text-forest" /><h3 className="mt-3 text-base">{item.title}</h3><p className="mt-2 text-sm text-muted-foreground">{item.text}</p></div>)}</div>
      <div className="mt-5 rounded-2xl border border-border p-5"><h3 className="text-lg">Why institution codes are better</h3><p className="mt-2 text-sm text-muted-foreground">A college or school verifies its own students, then receives a batch of unique, single-use codes. We check eligibility without collecting every student’s ID card. Codes are validated during review before access is approved.</p><p className="mt-3 text-sm text-muted-foreground">For Indian institutions, the administrator can request codes using an official domain email and an authorised contact. Students never need to share passwords or OTPs.</p></div>
    </div>

    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8" aria-labelledby="student-application-title">
      <GraduationCap className="size-7 text-forest" />
      <h3 id="student-application-title" className="mt-4 text-2xl">Apply for student access</h3>
      <p className="mt-2 text-muted-foreground">{STUDENT_OFFER.plan} until your verified course end date, with an eligibility check every {STUDENT_OFFER.verificationIntervalMonths} months. No card during approved student access. Currently for students aged {STUDENT_OFFER.minimumAge}+.</p>
      <OpensWithPlans title="Applications open with paid plans" body="Until then Wall·ette is free for everyone, students included. Hear when applications open:" source="spread-students" />
    </section>
  </div>;
}

/** Institution code batches start with paid plans too. */
export function InstitutionRequestForm() {
  return <OpensWithPlans className="mt-5" title="Institution requests open with paid plans" body="We’ll take requests from authorised representatives then. Until then, write to us from the Contact page with any question." source="spread-institutions" />;
}
