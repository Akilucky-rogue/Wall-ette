import { useEffect, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { COMPANY } from "@/lib/site";

type LegalSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

type LegalDocument = {
  path: string;
  title: string;
  description: string;
  sections: readonly LegalSection[];
};

const operator =
  "Wall·ette is built and run by Akshat Vora, an independent developer in Mumbai (“we”, “us”), and backed by SERNET. SERNET is not a party to these policies and has no access to your account or your financial records.";

const scope =
  "Wall·ette is a money-tracking and budgeting tool. It helps you organise your recorded transactions and manage your own budgets. It is not a bank, a SEBI-registered investment adviser or a research analyst. It does not provide financial, tax, legal or investment advice, hold deposits or guarantee financial outcomes.";

const freeNow =
  "Wall·ette is free to use today. Paid plans, Essential and Plus, are planned; until they start, nothing is charged and no card is asked for. Before any plan starts we will tell you its price and terms, and nothing will be charged without your agreement.";

const pricing =
  "When paid plans start: Essential will cost ₹49 per month or ₹449 per year, and Plus ₹99 per month or ₹899 per year. New members will get their first 30 days at ₹0, with card or UPI/bank payment details required to start; the first charge comes on day 31 at the full price of the chosen plan and billing period, and cancelling before then costs nothing. Plans will renew automatically until cancelled. Essential can move up to Plus at any time; Plus can move down to Essential after the first year. Switching between monthly and yearly billing mid-term applies at once, with the price difference charged. After moving down, nothing is deleted: extra accounts and older history become read-only. Records are kept when a subscription ends and are deleted only when you delete them or ask us to; export and deletion stay available on every plan. In the Android app, purchases will go through Google Play, whose payment and refund terms apply as well.";

const decisions =
  "You remain responsible for checking source records and for your spending, payment, borrowing, tax and investment decisions. To the extent permitted by applicable law, we accept no liability for decisions you make in reliance on the tool. Nothing here excludes liability or consumer remedies that cannot lawfully be excluded.";

const documents = {
  privacy: {
    path: "/privacy",
    title: "Privacy policy",
    description:
      "What Wall·ette keeps, where it’s stored, what is read only on your device, and how to see, export or delete your data.",
    sections: [
      {
        id: "who-we-are",
        title: "Who we are and what this covers",
        paragraphs: [
          `${operator} We decide how the personal data described here is used. This policy covers the Wall·ette Android app, the web app at wall-ette.com/app and this website.`,
          scope,
          "The short version: your financial data belongs to you, is kept in your own private account space, and is never sold, shared for advertising or used for anything other than showing you your own money.",
        ],
      },
      {
        id: "statement-reading",
        title: "Statements are read on your device",
        paragraphs: [
          "Statement files (PDF or Excel) are read entirely on your phone or computer. The file itself is never uploaded to any server. A password you type to open a protected PDF is used only to open that file and is never saved. We never need your internet-banking password, PIN, CVV or OTP; never send these to anyone, including us.",
          "What is saved from an import is the transactions you choose to keep: date, amount, the bank’s description of each payment, category and notes. To tell your bank accounts apart and keep each one’s balance right, Wall·ette also keeps each account’s opening balance, the bank’s name and the last four digits of the account number, never the full number. Each import leaves a record of the statement’s bank, period, how many rows were added or skipped, and the balance check.",
          "Bank descriptions can contain the names of people and businesses you paid. Import only statements you are entitled to use. If you send a statement or screenshot to us by email, that copy leaves your device; cover account numbers and anything unrelated first.",
        ],
      },
      {
        id: "information-we-use",
        title: "Everything else we keep",
        paragraphs: [
          "Your account: your email address and a password, handled by Google Firebase Authentication (we never see your password). When you sign up we record which version of the terms you accepted, and when.",
          "If you sign in with Google instead, Google tells us your email address, your name and the address of your profile picture, and confirms it’s you; we never see your Google password and get no access to your Gmail, Drive, contacts or anything else in your Google account. We use your email address to run your account; your name and picture stay in your sign-in record. You can remove Wall·ette’s access at any time in your Google Account (Security → Your connections to third-party apps and services).",
          "Your settings: currency, daily limit, budgets, savings goal, alerts, and which payees count as spending. Security log (Android app): the time and method (password or biometric) of each unlock, kept in your account so you can see who opened your wallet.",
          "Crash reports (Android app): when the app crashes or hits an error, it sends what went wrong (the error, with email addresses, IDs and numbers removed), where in the app’s code it happened, the screens opened just before, the app version, device details such as model, Android version and free memory, and a random ID for this installation. Reports never include your transactions, statements, balances, payee names or account details, and aren’t linked to your account. Turn them off in Self → Your data.",
          "This website: what you send in the contact form (name, email, topic and message), and, if you subscribe to the Monthly Check-in, your email address and where you signed up. Website forms are optional.",
          "We do not collect your contacts, location, advertising identifiers or analytics profiles, and there is no advertising in Wall·ette.",
        ],
      },
      {
        id: "purposes-and-consent",
        title: "Why we use it",
        paragraphs: [
          "To run your account, save your entries and keep them the same on every device, keep your account secure, fix crashes, answer your messages and, if you asked for it, send the newsletter. We do not sell your data, use it for advertising or send it to any AI service.",
          "Insights are worked out on your device: spending and income analysis, recurring payments, budgets and Left to spend are computed from your own data where you use the app. Phone notifications, if you switch them on, are made on your phone too; nothing is sent to us to make them.",
          "Where we rely on your consent, such as the newsletter or crash reports, you can withdraw it at any time: unsubscribe from the email, turn crash reports off, or delete your account. Withdrawing doesn’t undo processing that was lawful before.",
        ],
      },
      {
        id: "processors-and-disclosures",
        title: "Services we use",
        paragraphs: [
          "Google Firebase stores your account and transaction data (Firestore and Authentication) and hosts this website, as our data processor. Firebase Crashlytics receives the crash reports described above and deletes them after 90 days.",
          "The app fetches public currency exchange rates from exchangerate-api.com; that request carries no personal or financial information. The app and this website load fonts from Google Fonts, which sees the usual web-request details such as your IP address. On Android, the app asks Google Play whether a newer version is available; Google Play receives the app version and device details for that, as it does when it updates apps.",
          "We share data only with these providers, for these purposes, or where the law requires it. Google’s servers may be outside India; any transfer follows Indian law. Ask us for details of the providers handling your data.",
        ],
      },
      {
        id: "how-we-protect",
        title: "How we keep your data private",
        paragraphs: [
          "Your data is encrypted in transit and at rest. Database rules let only your signed-in account read or write your data: not other users, and not SERNET. Two-step sign-in and, on Android, a biometric or password lock add protection, and the Android app keeps your wallet out of device backups and hides its screen from screenshots and the app switcher.",
          "No system can be guaranteed completely secure. Use a device you trust, keep your password to yourself, and tell us at once if you suspect someone else has used your account. If a breach affects your personal data, we will tell you and the authorities as the law requires.",
        ],
      },
      {
        id: "delete",
        title: "Keeping and deleting your data",
        paragraphs: [
          "Your data is kept for as long as your account exists. To delete everything yourself: in the app open Self → Account and security → Delete account and all data, type DELETE and enter your password (or confirm with Google, if you sign in with Google). Your transactions, settings, security log and account are erased at once, from our servers and from that device. To remove only transactions, use Vault → Clear all history.",
          "If you can no longer use the app, email us from your registered address with the subject “Data deletion request” and we will delete everything within 30 days. See the data-deletion page for details.",
          "Each device keeps an offline copy of your wallet so the app works without a connection. Signing out (once your changes have synced), deleting your account or uninstalling the app removes it from that device.",
          "Contact messages are kept while we need them to answer you. Newsletter addresses are kept until you unsubscribe. Crash reports are deleted after 90 days. Google, which runs our database, removes deleted data from its own systems on its usual schedule.",
        ],
      },
      {
        id: "your-rights",
        title: "Your rights under Indian law",
        paragraphs: [
          "Under the Digital Personal Data Protection Act, 2023 and its rules, you can ask what we hold and how it’s used, have it corrected or completed, have it erased, withdraw consent, nominate someone to act for you, and have grievances heard.",
          "Most of this you can do yourself: edit any entry in the app, export a full copy from Data Studio (Export → Full backup), and delete your account from Self. For anything else, email us with the subject “Privacy rights request”. We may ask for proportionate proof that the account is yours, never your password or an OTP. We reply within two working days and resolve requests within 30 days.",
          "If you are not satisfied, contact the Grievance Officer. After that, you may approach the Data Protection Board of India where it is available, or another competent authority.",
        ],
      },
      {
        id: "children-and-changes",
        title: "Children and changes to this policy",
        paragraphs: [
          "Wall·ette is for people aged 18 and over. Do not create an account for a child. If you believe a child has given us personal data, tell us and we will delete it.",
          "If this policy changes, the new version will be posted here with a new date, and material changes will be pointed out in the app. Where the law requires fresh consent, we will ask for it.",
        ],
      },
    ],
  },
  terms: {
    path: "/terms",
    title: "Terms of use",
    description:
      "The agreement for using Wall·ette: your account, what the service does and doesn’t do, plans, acceptable use and Indian law.",
    sections: [
      {
        id: "service-and-eligibility",
        title: "The service and eligibility",
        paragraphs: [
          `These terms are an agreement between you and Akshat Vora, the developer of Wall·ette. ${operator.replace("Wall·ette is built and run by Akshat Vora, an independent developer in Mumbai (“we”, “us”), and backed by SERNET. ", "Wall·ette is backed by SERNET. ")} By creating an account or using Wall·ette you accept these terms and the privacy policy, which forms part of them.`,
          scope,
          "Use Wall·ette only if you are at least 18 and can enter into a binding contract under Indian law. Mandatory consumer and data-protection rights continue to apply whatever these terms say.",
        ],
      },
      {
        id: "accounts",
        title: "Your account and your records",
        paragraphs: [
          "Give a valid email address and keep your password, and any second factor, to yourself. Activity under your account is your responsibility; tell us promptly if you suspect someone else has used it.",
          "Import only statements and records you are entitled to use, and use other people’s information in them lawfully. The app’s output is only as complete and accurate as the data you give it.",
        ],
      },
      {
        id: "subscriptions",
        title: "Price and paid plans",
        paragraphs: [
          freeNow,
          pricing,
          "Any taxes must be shown before you agree to pay. Price changes will be announced before they affect a renewal, with a chance to cancel.",
        ],
      },
      {
        id: "spread-programmes",
        title: "Referrals, student access and gifts",
        paragraphs: [
          "These open when paid plans start, on the terms shown on the Spread page then. In outline: after a referred friend’s first paid month, each of you gets one month of your own current plan; verified students aged 18 or over get Essential until their verified course end date, checked every 12 months; annual gift codes come with volume discounts. None of these is cash, and abuse such as self-referral may be refused.",
        ],
      },
      {
        id: "cancellation-and-refunds",
        title: "Cancellation and refunds",
        paragraphs: [
          "While Wall·ette is free there is nothing to cancel or refund. You can stop using it and delete your account whenever you like.",
          "When paid plans start, you will be able to cancel at any time: cancelling stops the next renewal and keeps access until the end of the paid period, and doesn’t delete your data. Paid fees won’t ordinarily be refunded for unused time, except where the law requires; duplicate or unauthorised charges, charges after a timely cancellation, or a failure to provide the service will be put right. The refund policy has the details.",
        ],
      },
      {
        id: "acceptable-use",
        title: "Acceptable use",
        paragraphs: [
          "Do not use Wall·ette unlawfully, commit fraud, launder money, infringe rights, harass others, upload malicious files, access another account without permission, scrape private information or get around security and access controls. Do not overload or disrupt the service or reverse-engineer it.",
          "Do not present Wall·ette’s output as a bank-certified record or a regulated professional recommendation. Report security problems to us privately rather than accessing, copying or exposing anyone else’s information.",
        ],
      },
      {
        id: "accuracy-and-availability",
        title: "Accuracy, availability and your decisions",
        paragraphs: [
          "Statement reading, categories, balances, forecasts and calculations can be incomplete or wrong because of statement formats, missing transactions, your own entries, rounding or software errors. Compare important figures with your bank’s records before acting on them.",
          "Wall·ette is provided “as is” and “as available” by an individual developer. We don’t guarantee uninterrupted availability or support for every statement format, and features may change. Where we reasonably can, we will give notice before any permanent shutdown so you can export your data.",
          decisions,
        ],
      },
      {
        id: "intellectual-property",
        title: "Intellectual property and your data",
        paragraphs: [
          "The Wall·ette name, mascot, design, content and code belong to Akshat Vora. You get a personal, non-exclusive, non-transferable licence to use the app for its intended purpose.",
          "Your financial data remains yours. You let us process it only to provide, protect and support the service and to meet legal obligations, as the privacy policy describes. You can export it at any time and delete it from the app.",
        ],
      },
      {
        id: "suspension-and-liability",
        title: "Suspension and liability",
        paragraphs: [
          "We may restrict or suspend an account for serious misuse, security risks or legal requirements, proportionately and, where practicable, after telling you why and letting you respond.",
          "To the extent permitted by law, we are not liable for indirect or consequential loss, lost opportunities, loss of data or losses caused by your decisions, inaccurate source records or third-party services outside our control. These limits do not exclude liability for fraud or wilful misconduct, or any liability or consumer remedy that cannot lawfully be excluded.",
        ],
      },
      {
        id: "law-and-changes",
        title: "Indian law, disputes and changes",
        paragraphs: [
          "Indian law governs these terms. Please raise any dispute with us or the Grievance Officer first so we can try to resolve it. The courts of Mumbai, Maharashtra have jurisdiction, subject to any consumer forum or remedy available to you by law.",
          "We may update these terms. The date above will change, and material changes will be pointed out in the app before they take effect. Changes never remove rights you have already acquired.",
        ],
      },
    ],
  },
  disclaimer: {
    path: "/disclaimer",
    title: "Disclaimer",
    description:
      "Wall·ette organises your own money data. It isn’t advice, and it isn’t a bank record: check the numbers that matter.",
    sections: [
      {
        id: "not-a-regulated-adviser",
        title: "A tool, not a bank or adviser",
        paragraphs: [
          scope,
          "References to banks, securities, taxes or financial products are for information and do not imply a licence, registration, endorsement, partnership or recommendation. Wall·ette does not act as your fiduciary or professional adviser.",
        ],
      },
      {
        id: "not-advice",
        title: "No financial, tax or investment advice",
        paragraphs: [
          "Charts, categories, spending summaries, Left to spend, calculators and other figures organise information or illustrate assumptions. They are not personal recommendations to buy, sell, hold, borrow, lend, pay tax in a particular way or enter any transaction.",
          "Consult a qualified professional for advice suited to you. A calculation or past pattern is no guarantee of future income, returns, savings or affordability.",
        ],
      },
      {
        id: "check-the-source",
        title: "Check source records and assumptions",
        paragraphs: [
          "Imported statements can contain omissions, duplicates or unclear descriptions, and reading, categorising, rounding, recurring-payment detection and forecasts can be wrong. Reconcile important figures with your original records.",
          "A transaction shown in Wall·ette is not proof that a payment went through, and not a substitute for a bank statement, tax record or audit. Confirm payment status with your bank or provider.",
        ],
      },
      {
        id: "third-parties",
        title: "Third-party services and availability",
        paragraphs: [
          "Banks, payment providers and other websites operate independently on their own terms. Links and product names are not endorsements, and their availability, timing, fees and security are outside our control.",
          "Interruptions and delayed or incomplete information can happen. Don’t rely on Wall·ette as your only way to track a time-sensitive payment or meet a legal obligation.",
        ],
      },
      {
        id: "responsibility",
        title: "Your decisions",
        paragraphs: [
          decisions,
          "This disclaimer does not override the terms of use, excuse unlawful conduct or limit consumer and data-protection rights that cannot be limited. Tell us if anything in Wall·ette seems misleading.",
        ],
      },
    ],
  },
  cookies: {
    path: "/cookies",
    title: "Cookie and browser-storage policy",
    description:
      "Wall·ette sets no tracking cookies. What the website and web app keep in your browser, and how to clear it.",
    sections: [
      {
        id: "storage-basics",
        title: "No tracking cookies",
        paragraphs: [
          "Wall·ette uses no advertising cookies, analytics trackers, pixels or cross-site tracking, so there is no consent banner to click through. If that ever changes, this page will say so first and you will be asked.",
          "Browsers can also keep values in local storage, session storage and a local database for a site. Here is everything Wall·ette keeps that way, and why.",
        ],
      },
      {
        id: "necessary-storage",
        title: "What we keep in your browser",
        paragraphs: [
          "Sign-in: when you sign in on this website or in the web app, Firebase Authentication keeps your session in this tab’s session storage. It ends when you close the tab.",
          "Your wallet (web app): so the web app works offline and opens quickly, it keeps a copy of your entries and settings in your browser’s local storage and local database. Signing out (once your changes have synced) removes it.",
          "Light or dark: the website remembers your choice of theme in local storage.",
        ],
      },
      {
        id: "local-calculators",
        title: "Calculators and statements stay local",
        paragraphs: [
          "The website’s calculators work in your browser. What you type into them is not sent anywhere or saved.",
          "Statements you import are read in your browser or on your phone. Only the transactions you choose to keep are saved to your account; see the privacy policy.",
        ],
      },
      {
        id: "optional-technologies",
        title: "Requests to other services",
        paragraphs: [
          "Pages load fonts from Google Fonts, and the web app fetches public exchange rates. These requests carry the usual web details, such as your IP address, but no cookies from us and no account or financial information.",
        ],
      },
      {
        id: "your-controls",
        title: "Your browser controls",
        paragraphs: [
          "Your browser’s site-data settings let you see and remove what this site keeps. Clearing it signs you out and removes the offline copy; it doesn’t delete your account or data on our servers, cancel anything or unsubscribe you from email. Use the app or contact us for those.",
        ],
      },
    ],
  },
  grievance: {
    path: "/grievance",
    title: "Grievance redressal",
    description:
      "Raise a complaint about your account, your data or the service with Wall·ette’s Grievance Officer, Akshat Vora.",
    sections: [
      {
        id: "officer",
        title: "Grievance Officer",
        paragraphs: [
          `Under the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023 and the rules made under them: Grievance Officer: ${COMPANY.grievanceOfficer}, developer of Wall·ette. Email: ${COMPANY.supportEmail}. Location: ${COMPANY.address}. Hours: Monday to Friday, 10:00 to 18:00 IST, except public holidays.`,
          "Use this for account, data, privacy, security or service complaints. Start the subject line with “Grievance”. For an urgent security concern, write “Urgent security concern” instead.",
        ],
      },
      {
        id: "submit-a-grievance",
        title: "What to include",
        paragraphs: [
          "Your name, the email your account uses, what happened and when, which part of Wall·ette it concerns, and what you would like done. Include any earlier reference.",
          "Never send passwords, OTPs, PINs, CVVs or card numbers, and cover unrelated financial details. If you write for someone else, say why you can act for them; we may ask for proportionate proof before discussing their account.",
        ],
      },
      {
        id: "timelines",
        title: "When you’ll hear back",
        paragraphs: [
          "We acknowledge grievances within 48 hours and resolve them within 30 days. If something needs longer, we will tell you why and when to expect the next update. Where the law sets a shorter deadline for a particular kind of complaint, that deadline applies.",
        ],
      },
      {
        id: "data-grievances",
        title: "Requests about your data",
        paragraphs: [
          "For data matters, say whether you want information about your data, a correction, erasure, withdrawal of consent or a nomination, or have a complaint about how we handled your data. Much of this you can do yourself in the app: see the privacy policy.",
        ],
      },
      {
        id: "escalation",
        title: "If it isn’t resolved",
        paragraphs: [
          "Reply to our answer with “Escalation” in the subject and explain what remains unresolved; we will review how it was handled and give reasons for our decision.",
          "You may then approach the Data Protection Board of India where it is available, a consumer commission, a court or another competent authority. Nothing here asks you to give up any legal remedy.",
        ],
      },
    ],
  },
  "data-deletion": {
    path: "/data-deletion",
    title: "Delete your data",
    description:
      "Delete your Wall·ette account and everything in it from the app in a minute, or ask us by email.",
    sections: [
      {
        id: "in-the-app",
        title: "Delete it yourself, in the app",
        paragraphs: [
          "Open Self → Account and security → Delete account and all data, type DELETE and enter your password (or confirm with Google, if you sign in with Google). Your transactions, settings, security log and account are erased at once, from our servers and from that device.",
          "Want a copy first? Data Studio → Export → Full backup saves everything as a file you keep. To remove only transactions and keep the account, use Vault → Clear all history.",
        ],
      },
      {
        id: "email-request",
        title: "Or ask us by email",
        paragraphs: [
          `If you can’t use the app, email ${COMPANY.supportEmail} from your registered address with the subject “Data deletion request”, saying “Please delete my Wall·ette account and all its data.” If you only want some data removed, say which.`,
          "Don’t include passwords, OTPs, card details or a bank statement. If you can’t reach your registered email, write from another address and explain; we will ask for proportionate proof that the account is yours before deleting anything.",
        ],
      },
      {
        id: "verification-and-timing",
        title: "How long it takes",
        paragraphs: [
          "Deleting in the app takes effect at once. Email requests are acknowledged within 48 hours and completed within 30 days of confirming the account is yours; we will tell you when it’s done.",
        ],
      },
      {
        id: "what-is-removed",
        title: "What deletion covers",
        paragraphs: [
          "Your account and sign-in, every transaction, opening balances and account labels, settings, budgets, payee rules, import records and security log.",
          "Statement files were never uploaded, so there is nothing of them to delete on our side; delete your own copies if you no longer need them. Website contact messages and newsletter sign-ups are kept apart from your account: ask us in the same email and we will remove those too, or unsubscribe from any newsletter.",
        ],
      },
      {
        id: "exceptions-and-backups",
        title: "After deletion",
        paragraphs: [
          "Deletion can’t be undone. Crash reports, which aren’t linked to your account, expire after 90 days. Google, which runs our database, removes deleted data from its own systems on its usual schedule. Uninstalling the app or clearing your browser alone does not delete your account.",
        ],
      },
      {
        id: "follow-up",
        title: "Follow up",
        paragraphs: [
          `Reply to our acknowledgement to check progress. If something isn’t resolved, contact the Grievance Officer, ${COMPANY.grievanceOfficer}, at the same address; the grievance page explains how to escalate.`,
        ],
      },
    ],
  },
  "refund-policy": {
    path: "/refund-policy",
    title: "Refund and cancellation policy",
    description:
      "Wall·ette is free today. How cancellation and refunds will work once paid plans start.",
    sections: [
      {
        id: "plans-and-trial",
        title: "Free today, paid plans to come",
        paragraphs: [
          freeNow,
          pricing,
        ],
      },
      {
        id: "renewal",
        title: "Renewal",
        paragraphs: [
          "Once a paid plan starts, monthly plans renew each month and yearly plans each year until cancelled. Automatic payments follow your payment mandate, RBI requirements and any notice they require. Uninstalling the app or a failed payment does not by itself cancel a subscription.",
        ],
      },
      {
        id: "how-to-cancel",
        title: "How to cancel",
        paragraphs: [
          `Cancel in the app, or in Google Play for purchases made on Android, or email ${COMPANY.supportEmail} from your registered address with the subject “Cancel subscription”. Never send card numbers, PINs, CVVs or OTPs.`,
          "Cancel before day 31 of the free month and you pay nothing. After that, cancelling stops the next renewal and you keep access until the paid period ends. Cancelling doesn’t delete your data; use the data-deletion page for that.",
        ],
      },
      {
        id: "refund-eligibility",
        title: "When refunds apply",
        paragraphs: [
          "Fees already paid aren’t ordinarily refunded for part of a month or year you didn’t use, or a change of mind, except where the law requires.",
          "We will put right duplicate charges, charges after a timely cancellation, unauthorised payments, wrong amounts and any failure to provide what you paid for, with a refund or correction. Purchases made through Google Play also follow Google Play’s refund policy. This policy doesn’t limit your consumer rights or your rights with your bank or payment provider.",
        ],
      },
      {
        id: "request-and-timing",
        title: "Asking for a refund",
        paragraphs: [
          "Email us with the subject “Refund request”, giving your registered email, the charge date, amount, payment reference and what went wrong. We acknowledge within 48 hours and decide within 7 working days of having what we need. Approved refunds go back to the original payment method; how long they take to appear depends on your bank or provider.",
        ],
      },
      {
        id: "escalate-billing",
        title: "If it isn’t resolved",
        paragraphs: [
          `Reply to our answer asking for a review by the Grievance Officer, ${COMPANY.grievanceOfficer}. The grievance page explains how to escalate further.`,
        ],
      },
    ],
  },
} as const satisfies Record<string, LegalDocument>;

export type LegalDocumentKey = keyof typeof documents;

export function legalRoute(key: LegalDocumentKey) {
  const document = documents[key];
  const title = `${document.title} — Wall·ette`;
  const canonical = new URL(document.path, COMPANY.siteUrl).href;

  return {
    head: () => ({
      meta: [
        { title },
        { name: "description", content: document.description },
        { property: "og:title", content: title },
        { property: "og:description", content: document.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: canonical }],
    }),
    component: function LegalRoutePage() {
      return <LegalPage document={document} />;
    },
  };
}

export function LegalPage({ document }: { document: LegalDocument }) {
  const [activeId, setActiveId] = useState(
    document.sections[0]?.id ?? "",
  );

  useEffect(() => {
    const sections = document.sections
      .map(({ id }) => window.document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    let frame = 0;

    const updateActiveSection = () => {
      frame = 0;
      let current = sections[0]?.id ?? "";

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 160) {
          current = section.id;
        }
      }

      setActiveId(current);
    };

    const scheduleUpdate = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(updateActiveSection);
      }
    };

    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [document]);

  return (
    <>
      <PageHeader
        crumbs={[{ label: document.title }]}
        eyebrow="Legal and privacy"
        title={document.title}
        lead={document.description}
      />

      <div className="container-site py-12 lg:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
          <aside className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
            <nav aria-label="On this page">
              <p className="text-sm font-semibold text-foreground">
                On this page
              </p>

              <ol className="mt-4 space-y-1 border-l border-border">
                {document.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      aria-current={
                        activeId === section.id ? "location" : undefined
                      }
                      className={`block border-l-2 py-2 pl-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
                        activeId === section.id
                          ? "border-primary font-medium text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article
            aria-label={document.title}
            className="min-w-0 max-w-3xl"
          >
            <p className="text-sm text-muted-foreground">
              Last updated:{" "}
              <time dateTime="2026-11-27">27 November 2026</time>
            </p>

            <div
              role="note"
              className="mt-5 rounded-xl border border-border bg-muted p-5 text-sm leading-7 text-foreground"
            >
              <strong>Plain words, clear choices.</strong>{" "}
              These policies explain how Wall·ette works and how to reach us about your account, your data or the service. Rights you have under the law apply whatever they say.
            </div>

            <div className="mt-10 space-y-10">
              {document.sections.map((section, index) => (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-heading`}
                  className="scroll-mt-32"
                >
                  <h2
                    id={`${section.id}-heading`}
                    className="text-2xl font-semibold tracking-tight text-foreground"
                  >
                    {index + 1}. {section.title}
                  </h2>

                  <div className="mt-4 space-y-4 text-base leading-8 text-muted-foreground">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <section
              aria-labelledby="legal-support-heading"
              className="mt-12 border-t border-border pt-8"
            >
              <h2
                id="legal-support-heading"
                className="text-xl font-semibold text-foreground"
              >
                Support and legal contact
              </h2>

              <address className="mt-4 space-y-2 text-sm not-italic leading-7 text-muted-foreground">
                <p>{COMPANY.legalName}, developer of Wall·ette · {COMPANY.endorsement}</p>
                <p>Grievance Officer: {COMPANY.grievanceOfficer}</p>
                <p>
                  <a
                    href={`mailto:${COMPANY.supportEmail}`}
                    className="text-foreground underline underline-offset-4"
                  >
                    {COMPANY.supportEmail}
                  </a>
                </p>
                <p>{COMPANY.address}</p>
              </address>

              <nav
                aria-label="Related legal policies"
                className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm"
              >
                {Object.entries(documents)
                  .filter(([, item]) => item.path !== document.path)
                  .map(([key, item]) => (
                    <a
                      key={key}
                      href={item.path}
                      className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      {item.title}
                    </a>
                  ))}
              </nav>
            </section>
          </article>
        </div>
      </div>
    </>
  );
}
