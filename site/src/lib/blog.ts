/** Static editorial content. No financial-data or publishing backend. */
export const BLOG_CATEGORIES = ["Bank statements", "Cash flow", "Budgeting", "Money basics", "Everyday spending", "Statement safety", "Saving habits", "Money routines"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
export type BlogSection = { readonly id: string; readonly title: string; readonly paragraphs: readonly string[] };
export type BlogArticle = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly category: BlogCategory;
  readonly publishedAt: string;
  readonly coverAlt: string;
  readonly cover: `/covers/${string}.webp`;
  readonly readTimeMinutes: number;
  readonly wordCount: number;
  readonly keyTakeaways: readonly string[];
  readonly introduction: readonly string[];
  readonly sections: readonly BlogSection[];
};
type ArticleDraft = Omit<BlogArticle, "cover" | "readTimeMinutes" | "wordCount">;
export const ARTICLE_CTA = "Track this automatically — first month free";
export const EDUCATIONAL_NOTE = "Educational only, not financial advice. Wall·ette helps you understand your records; it does not recommend investments, credit products or a particular financial plan. For advice specific to your circumstances, consult a suitably qualified professional.";

const drafts = [
  {
    "slug": "read-bank-statement",
    "title": "How to read your bank statement: UPI, NEFT and IMPS explained",
    "description": "Decode Indian bank statement entries, reconcile your balance, and separate spending from transfers, refunds and reversals.",
    "category": "Bank statements",
    "publishedAt": "2026-03-05",
    "coverAlt": "Illustrated bank statement with UPI, NEFT and IMPS entries highlighted",
    "keyTakeaways": [
      "Payment methods describe how money moved, not what you bought.",
      "Match opening balance plus credits minus debits to the closing balance.",
      "Check unfamiliar entries against receipts and report suspected fraud promptly."
    ],
    "introduction": [
      "A bank statement is a record of movements in one account, not a ready-made picture of your spending. Salary, a transfer from your other bank, a refund and a loan disbursal can all appear as credits. Rent, a savings transfer and a cash withdrawal can all appear as debits. Reading those lines correctly is the first step towards a useful monthly review.",
      "Start with one complete statement period and keep the original file unchanged. You do not need to understand every character in a narration. You need enough context to identify the movement, avoid counting it twice and spot anything that needs checking."
    ],
    "sections": [
      {
        "id": "start-with-balances",
        "title": "Start with dates, columns and balances",
        "paragraphs": [
          "Check the account holder, masked account number, statement period and currency before reviewing transactions. Many statements show a transaction date and a value date. The first generally records when the transaction was entered; the second indicates when it takes effect for account purposes. Formats vary by bank. When a payment falls near month-end, use a consistent date for your budget and retain the other date for reconciliation.",
          "In a normal savings account statement, a debit reduces your balance and a credit increases it. Opening balance plus total credits minus total debits should equal closing balance. For example, ₹12,000 plus ₹60,000 minus ₹48,000 leaves ₹24,000. This checks arithmetic, not whether every payment is legitimate. If the figures do not reconcile, look for missing pages, overlapping downloads, omitted fees or a row read with the wrong sign before changing any transaction."
        ]
      },
      {
        "id": "payment-codes",
        "title": "Decode UPI, NEFT and IMPS without guessing",
        "paragraphs": [
          "UPI means Unified Payments Interface. A narration may include UPI, DR or CR, a reference number, a bank abbreviation and part of a name or payment address. DR commonly means debit and CR commonly means credit, but always verify the amount column. A UPI address can belong to a person, a shop or a payment intermediary. It does not reliably reveal the spending category, and abbreviations are not standardised across every bank.",
          "NEFT means National Electronic Funds Transfer, a round-the-clock system that processes transfers in batches. IMPS means Immediate Payment Service and supports round-the-clock instant transfers. Either can carry salary, rent, family support or money between your own accounts. RTGS, if present, is another transfer system with a ₹2 lakh minimum transaction amount. Do not use the payment rail alone to label an entry as income or an expense. Use the recipient, purpose and matching record."
        ]
      },
      {
        "id": "trace-an-entry",
        "title": "Trace an unfamiliar entry to its source",
        "paragraphs": [
          "Compare the date and amount with the transaction history in the payment app, an invoice, a merchant order or a message from your bank. A statement may show a payment processor rather than the shop name you remember. For UPI, the app may display a payee and transaction reference that help you make the connection. References can be useful evidence, but avoid posting them publicly alongside your name and account details.",
          "For example, an unfamiliar ₹849 debit might match a food order including delivery fees, while a similar ₹849 credit might be a later refund. Keep those as separate movements linked to the same purchase rather than deleting both. If a debit is genuinely unrecognised, use the bank’s official app, website or published helpline to report it promptly. Do not wait for your monthly review or trust a phone number supplied by a stranger offering a refund."
        ]
      },
      {
        "id": "avoid-double-counting",
        "title": "Separate spending from money you moved",
        "paragraphs": [
          "A ₹5,000 transfer to another account you own reduces this account but does not reduce your combined money. If both accounts are in your tracker, match the outgoing and incoming entries as one internal transfer. A ₹5,000 payment to a parent is different: unless it is repayment of a documented amount you advanced, it may be household support. Ownership and purpose matter more than a familiar surname or a recurring payment pattern.",
          "Cash withdrawals also need care. The withdrawal moves money into your wallet; the later cash purchases are the spending. Counting both inflates expenses. Similarly, when detailed credit-card purchases are already recorded, paying the card bill is settlement rather than a second set of purchases. Keep interest and fees visible as expenses. If you only track the bank payment, label that limitation so you do not mistake a card repayment for a complete category breakdown."
        ]
      },
      {
        "id": "close-the-review",
        "title": "Finish with a short reconciliation checklist",
        "paragraphs": [
          "Check salary credits against your payslip and expected take-home pay, not your annual cost-to-company figure. Review bank charges, interest credits, failed-payment reversals and refunds separately. A failed payment can temporarily reduce available funds before a reversal arrives, so do not assume every pending reversal is spendable today. Download a fresh statement or contact the bank if a status remains unclear. Never invent a balancing entry just to make a total look tidy.",
          "Finally, save a small list of unresolved items with the date, amount and next action. Keep the statement in a protected location and redact identifying details before seeking help. Next month, reuse the categories and transfer matches you have already verified, but review unfamiliar merchants again. A good statement review ends with numbers you can explain, not a perfectly coloured chart. The aim is a dependable account of what happened and a manageable list of questions still open."
        ]
      }
    ]
  },
  {
    "slug": "salary-cash-flow",
    "title": "Cash flow for salaried Indians: plan between paydays",
    "description": "Build a salary-to-salary cash-flow plan around take-home pay, bill dates, card dues, annual costs and a realistic buffer.",
    "category": "Cash flow",
    "publishedAt": "2026-03-26",
    "coverAlt": "Salary timeline showing payday, rent, bills and a small buffer",
    "keyTakeaways": [
      "Budget the salary that reaches your account, not CTC.",
      "Put bills on a calendar: timing matters as much as totals.",
      "Give annual costs and irregular income separate treatment."
    ],
    "introduction": [
      "A salary can be predictable while your bank balance still feels unpredictable. Rent leaves early, a card bill arrives in the middle, school costs come quarterly and a festival trip lands before payday. Cash flow asks a practical question: will money be available on the dates it is needed? That is different from asking whether your monthly income is higher than your expenses.",
      "A useful plan follows the way your household actually gets paid. It can start on the last working day, the first of the month or another reliable payday. Pick one cycle, write down the dates and build from money you can reasonably count on."
    ],
    "sections": [
      {
        "id": "reliable-income",
        "title": "Begin with reliable take-home income",
        "paragraphs": [
          "Use the normal salary credit after payroll deductions as your starting point. CTC can include employer contributions, insurance and variable components that never arrive as freely available monthly cash. Compare recent payslips and credits to identify the dependable portion. If reimbursements or incentives arrive irregularly, keep them outside the base plan until credited. A travel reimbursement often replaces money you already spent for work; it is not automatically extra income for shopping.",
          "For a household with two salaries, list both amounts and both paydays. Do not assume the second salary is available before it arrives. If one income varies, build essential commitments around a cautious, supportable amount and decide in advance how additional receipts will be allocated. A bonus can replenish a buffer or fund a known annual bill, but making rent depend on an uncertain bonus creates a problem even when your annual earnings look comfortable."
        ]
      },
      {
        "id": "calendar",
        "title": "Map obligations onto a payday calendar",
        "paragraphs": [
          "Write down rent, EMIs, card payment due dates, utilities, school payments, family support and insurance premiums. Add expected amounts and distinguish a due date from an automatic debit date. Leave space for bank holidays, salary delays and processing time. You do not need a complicated forecasting tool: a calendar with dated amounts can reveal a shortfall that a single monthly total hides. Review the next cycle before moving surplus money elsewhere.",
          "Suppose ₹65,000 arrives on the 30th. Rent of ₹18,000 leaves on the 2nd, an EMI of ₹8,000 on the 5th, and a ₹12,000 card bill on the 12th. Those three obligations already claim ₹38,000. The remaining ₹27,000 is not all discretionary: groceries, transport, utilities and savings still need space. If the card bill includes last month’s purchases, avoid also treating the payment as this month’s new category spending in the same report."
        ]
      },
      {
        "id": "irregular-expenses",
        "title": "Make irregular expenses monthly on purpose",
        "paragraphs": [
          "An annual expense is not an emergency merely because it is not monthly. List predictable insurance renewals, school fees, maintenance, visits home and celebrations. Divide each expected cost by the number of paydays remaining before it is due. For example, a ₹24,000 premium due in twelve salary cycles needs ₹2,000 reserved each cycle; if it is due in three, the immediate requirement is ₹8,000. The deadline changes the plan.",
          "Keep these reserves distinct from an emergency fund and ordinary spending money. A separate account or clearly labelled ledger balance can work, provided the same rupees are not promised to several goals. Update estimates when a renewal notice arrives rather than relying indefinitely on last year’s amount. If the total is unaffordable, adjust optional commitments early. Quietly underfunding several annual bills creates a future cash crunch that a neat monthly budget can conceal."
        ]
      },
      {
        "id": "buffer",
        "title": "Build breathing room around uncertain dates",
        "paragraphs": [
          "A cash-flow buffer absorbs timing differences; it is not permission to overspend. Its useful size depends on how variable your salary date and bills are. Start by identifying the most awkward gap in your calendar: perhaps rent is due before the usual salary credit, or a reimbursement takes several weeks. Set aside money for that gap before assigning everything else. A modest buffer that stays available is more useful than an ambitious target you repeatedly empty.",
          "When a shortfall appears, first verify amounts and dates. Then consider reducing flexible spending, postponing an optional purchase or asking a provider whether a billing date can be changed. A lender or card issuer may have specific conditions, so confirm rather than assume. Borrowing to bridge a recurring gap adds future payments and can make the next cycle tighter. If essential commitments repeatedly exceed income, the plan needs structural changes rather than a more optimistic spreadsheet."
        ]
      },
      {
        "id": "weekly-review",
        "title": "Check the next seven days, not every rupee",
        "paragraphs": [
          "Once a week, compare actual balances with the calendar. Mark paid bills, update variable estimates and check that automatic payments have enough funding. Include other accounts and cash only if they are genuinely available for household spending. Exclude money earmarked for rent, annual costs or emergencies. A salary account showing ₹25,000 can still have very little flexible money if most of that balance already has a job before the next payday.",
          "At the end of the cycle, review the few differences that changed your plan: a late salary, a higher electricity bill, extra travel or an overlooked subscription. Carry those lessons into the next calendar. Keep ordinary variation separate from a permanent increase in costs. Cash-flow planning is not a test of personal discipline; it is a way to make dates, commitments and available money visible together, so everyday decisions are based on the next few weeks rather than a misleading balance."
        ]
      }
    ]
  },
  {
    "slug": "50-30-20-budget-india",
    "title": "The 50/30/20 budget, adapted to Indian households",
    "description": "Use 50/30/20 as a flexible starting point for take-home income, family support, EMIs and savings in an Indian household.",
    "category": "Budgeting",
    "publishedAt": "2026-04-16",
    "coverAlt": "Three labelled budget portions for needs, wants and future goals",
    "keyTakeaways": [
      "Apply percentages to take-home income and treat them as a starting point.",
      "Classify family support and EMIs by purpose, not a rigid label.",
      "Choose workable ratios when essential costs exceed half your salary."
    ],
    "introduction": [
      "The 50/30/20 rule divides income into three broad jobs: 50% for needs, 30% for wants and 20% for savings and debt reduction. It is easy to remember, but your household does not have to resemble the example behind a rule. Rent in a large city, support for parents, school costs and existing EMIs can leave very different amounts available.",
      "Use the framework to ask better questions, not to judge your household. A budget is useful when it explains your real obligations and gives you a next step. Hiding a necessary expense under another label simply to hit a percentage does neither."
    ],
    "sections": [
      {
        "id": "income-base",
        "title": "Choose the right income base first",
        "paragraphs": [
          "For a simple monthly plan, begin with reliable take-home pay reaching your account. Do not apply the rule to CTC: employer benefits, contributions and variable pay can make that number much larger than spendable income. If payroll already deducts retirement contributions, note them separately. You can include them in a broader savings-rate calculation later, but avoid mixing a gross-income savings measure with a take-home spending budget without explaining the difference.",
          "For example, with ₹60,000 of monthly take-home pay, the starting split is ₹30,000 for needs, ₹18,000 for wants and ₹12,000 for future goals. Those are illustrative amounts, not recommendations for every ₹60,000 household. Two earners living with family may have a different cost base from a single earner paying rent and supporting dependants. If income changes each month, use a cautious baseline and allocate extra receipts after they actually arrive."
        ]
      },
      {
        "id": "needs",
        "title": "Define needs around your household",
        "paragraphs": [
          "Needs usually include basic housing, groceries, essential transport, utilities, healthcare and minimum debt obligations. Regular support that pays for a parent’s essential medicines or living costs can belong here too. Classify the purpose rather than treating every family transfer as optional. A festival gift and a monthly contribution to essential household bills may go to the same person but do different jobs. Splitting a payment across purposes is reasonable when you have enough information.",
          "Not every amount within a necessary category is fixed. Transport is necessary, but choices within transport can have different costs. That does not make every comfort a moral failure. It simply reveals where a change might be possible if you need one. When rent and basic obligations already exceed 50%, record the actual amount honestly. Renaming groceries as a want will not make cash available or help you decide which commitment can realistically change."
        ]
      },
      {
        "id": "wants",
        "title": "Give wants room without losing the whole picture",
        "paragraphs": [
          "Wants can include eating out, entertainment, optional shopping, premium upgrades and travel that is not essential. A workable allowance makes these choices visible instead of pretending they will disappear. If you repeatedly budget nothing for social plans but spend on them anyway, your plan is inaccurate rather than especially disciplined. Start from recent statements, identify a sustainable amount and decide which few expenses you most want to preserve.",
          "Some costs need splitting. A basic mobile plan may be necessary for work while an additional entertainment bundle is optional. A trip home may combine essential caregiving and discretionary tourism. Use a consistent rule that is easy to maintain rather than debating every transaction. Household members should agree on definitions before reviewing each other’s spending. The aim is a shared language for trade-offs, not a system for proving one person’s preferences are less legitimate than another’s."
        ]
      },
      {
        "id": "future-goals",
        "title": "Separate future goals from duplicate transfers",
        "paragraphs": [
          "The future-goals portion can include emergency savings, planned longer-term goals and debt repayments above required minimums. Minimum loan payments are usually treated as needs in this simplified framework, while additional principal repayment sits here. Other budgeting conventions exist; consistency matters more than picking the one perfect label. This guide does not choose investments or determine which debt you should prioritise. Those decisions depend on terms, risk, liquidity and your wider circumstances.",
          "Moving ₹12,000 into another account you own can implement a savings plan, but it is not consumption. Do not count the transfer as both an expense and savings, or count the receiving credit as new income. Also distinguish goal contributions from money that will pay a known annual bill. An insurance-premium reserve is delayed spending for a predictable obligation, while an emergency reserve is protection against an unexpected financial shock. Both need funding, but they answer different questions."
        ]
      },
      {
        "id": "adapt-the-ratio",
        "title": "Adapt the ratio and review it after real changes",
        "paragraphs": [
          "If essential expenses take 65% of take-home pay, a temporary 65/20/15 split might describe reality better than an impossible 50/30/20 target. This is an example, not a recommended allocation. Start with the actual totals, protect essentials and minimum payments, then decide a realistic amount for goals and flexibility. Identify one change that could improve the picture: negotiating a bill, reducing a low-value subscription or planning ahead for an annual cost.",
          "Revisit the split after a rent increase, a new dependant, a salary change or a loan ending. Small monthly movements do not require rebuilding the entire system. Use percentages to spot direction over several cycles, while using rupee amounts to make immediate choices. A successful adaptation is one your household can follow without borrowing to maintain appearances or abandoning every enjoyable expense. The rule is a conversation starter; your actual cash flow remains the final constraint."
        ]
      }
    ]
  },
  {
    "slug": "family-transfers",
    "title": "Family transfers versus money moved: count both correctly",
    "description": "Distinguish family support, shared-bill reimbursements, loans and transfers between your own accounts without double-counting spending.",
    "category": "Money basics",
    "publishedAt": "2026-05-07",
    "coverAlt": "Two own-account arrows beside a separate family-support payment",
    "keyTakeaways": [
      "A familiar recipient is not automatically an internal transfer.",
      "Only transfers within your chosen ownership boundary are money moved.",
      "Use separate labels for support, reimbursements and recoverable advances."
    ],
    "introduction": [
      "A payment to your mother, spouse or sibling can mean several things. It might support household expenses, repay your share of dinner, return borrowed money or move funds into a jointly managed account. All four can look like an ordinary UPI debit. Automatically treating every family payment as money moved can hide genuine spending; treating every own-account transfer as spending inflates it.",
      "The solution starts with a clear boundary: whose finances does this report describe? Once that is settled, ownership and purpose can explain a transaction more reliably than the recipient’s name or how frequently the payment happens."
    ],
    "sections": [
      {
        "id": "reporting-boundary",
        "title": "Decide whether the report is personal or household",
        "paragraphs": [
          "In a personal report, an account solely owned by your spouse is not automatically another one of your accounts. A transfer may be your contribution to shared costs, a gift or an amount you expect back. In a combined household report that includes both partners’ accounts, the same transfer may sit inside the reporting boundary. Write down which accounts and people are included so the classification does not change whenever a category total looks inconvenient.",
          "An internal transfer normally has a matching outgoing and incoming movement within that boundary. Check amount, date and ownership, allowing for processing differences and any separately charged fee. Do not require every matching amount to be an internal transfer: two unrelated ₹5,000 payments can occur on the same day. A joint account also needs an agreed treatment. If you include it, record the included activity consistently rather than importing only the credits that make your income appear larger."
        ]
      },
      {
        "id": "support",
        "title": "Recognise family support as a real use of money",
        "paragraphs": [
          "If you send ₹8,000 each month for a parent’s medicines and groceries, that can be a genuine household-support expense in your personal budget. The fact that the recipient saves part of it does not mean you still control those funds. You can use a dedicated family-support category rather than forcing the payment into shopping or miscellaneous. If it is a recurring commitment, include it when planning essential costs and money available before payday.",
          "For a combined household budget, avoid counting both the contribution into a shared account and every purchase paid from that account as expenses. Choose one consistent level of detail. Counting the underlying purchases gives more information if you have permission and complete records. Counting only your contribution is simpler for a personal view but cannot tell you exactly how the receiving household spent it. State that limitation rather than filling the gap with assumptions about someone else’s transactions."
        ]
      },
      {
        "id": "reimbursements",
        "title": "Handle shared bills and reimbursements together",
        "paragraphs": [
          "Suppose you pay ₹3,000 for dinner and two friends each return ₹1,000. Your final share is ₹1,000. One method records the full payment and offsets ₹2,000 of linked reimbursements against the same category. Another records your ₹1,000 expense and a ₹2,000 receivable that clears when friends pay. Either can work, but classifying the reimbursements as salary-like income makes both income and spending look larger than your real share.",
          "Timing matters when repayment crosses a month boundary. The bank balance falls by the full ₹3,000 immediately, even if your ultimate expense will be smaller. Keep the expected reimbursement separate from money available now. If a friend has not confirmed repayment, do not build an essential bill payment around it. When money arrives, link it to the original bill. If it never arrives, update the record honestly rather than leaving a permanent imaginary receivable in your totals."
        ]
      },
      {
        "id": "loans-gifts",
        "title": "Keep loans, repayments and gifts distinct",
        "paragraphs": [
          "A family loan should not disappear into a vague transfer label. If you lend money and genuinely expect repayment, record an advance or receivable outside ordinary consumption, while recognising that available cash has still reduced. Note the amount and agreed repayment arrangement privately. If the intention is a gift or ongoing support, record that instead. A hope that someone might repay someday is not a dependable source of next month’s rent.",
          "When you borrow from family, the receipt increases cash but is not earned income. Returning principal reduces the liability rather than creating a fresh consumption expense. Any interest requires separate treatment. This distinction is useful for household tracking, but it does not determine tax or legal consequences. Family gifts and loans can have documentation and tax implications depending on the relationship and circumstances. Seek qualified guidance for those questions rather than assuming a budget category settles the rules."
        ]
      },
      {
        "id": "monthly-check",
        "title": "Review ambiguous transfers without invading privacy",
        "paragraphs": [
          "At review time, list only the unresolved items: date, amount, recipient and likely purpose. Ask a neutral question such as whether a payment was support, reimbursement or a temporary advance. You usually do not need another person’s entire statement to classify your own side. If sharing a screenshot, hide unrelated transactions, balances and account identifiers. Avoid putting sensitive family arrangements into notes that are visible to everyone with access to a device or shared tracker.",
          "Then apply the same rule next month, while allowing the purpose to change. A regular recipient can receive both essential support and a birthday gift. An own-account transfer can have a separately charged bank fee that is a real expense. Good categorisation preserves these differences without turning family life into bookkeeping theatre. The useful outcome is a clear answer to three questions: what did I spend, what do I still own, and what money am I waiting to receive?"
        ]
      }
    ]
  },
  {
    "slug": "left-to-spend",
    "title": "What is left to spend before payday?",
    "description": "Calculate a practical pre-payday spending amount after pending bills, essential costs, reserved money and a safety buffer.",
    "category": "Cash flow",
    "publishedAt": "2026-05-28",
    "coverAlt": "Available balance reduced by bills, essentials and a buffer before payday",
    "keyTakeaways": [
      "Your bank balance is not the same as flexible spending money.",
      "Subtract future commitments only once and exclude protected reserves.",
      "Recalculate when a bill, salary date or pending payment changes."
    ],
    "introduction": [
      "Opening your banking app can feel reassuring until you remember the rent payment, the card bill and the groceries still needed before salary. A balance shows money held in an account at a moment in time. Left to spend is an estimate of how much of that money is genuinely uncommitted until your next dependable payday.",
      "It is a planning number, not a guarantee. It depends on complete balances, sensible estimates and honest treatment of money already set aside. A simple calculation checked regularly is more useful than a precise-looking figure that forgets the next large bill."
    ],
    "sections": [
      {
        "id": "available-money",
        "title": "Start with money actually available today",
        "paragraphs": [
          "Add the balances you can genuinely use for this pay cycle. Include cash or a second spending account if you track them reliably. Exclude an emergency reserve, rent deposit, annual-fee pot or money held for another person. A credit-card limit and an overdraft facility are borrowing capacity, not available income. An expected refund or reimbursement is also not spendable until it arrives, unless you deliberately choose to carry the timing risk.",
          "Be consistent about how earmarked money enters the calculation. If a separate annual-bill account was excluded from the starting balance, do not subtract the same reserve again. If your banking app shows an available balance already reduced by a card hold, check that you are not removing that hold a second time. Some transactions may still be pending elsewhere. When records disagree, use a conservative estimate and investigate the difference rather than assuming the largest number is correct."
        ]
      },
      {
        "id": "the-formula",
        "title": "Subtract commitments before the next payday",
        "paragraphs": [
          "A practical formula is: usable money today, minus unpaid bills due before payday, minus essential variable costs for that period, minus any included reserves, minus a buffer. Add only income that is sufficiently dependable and will arrive before the relevant payment. For many people, leaving all future receipts out until credited is simpler. The purpose is to identify flexible money without forcing you to predict every small purchase perfectly.",
          "Suppose you have ₹28,000 available and twelve days until salary. A ₹10,000 card bill, ₹4,000 utility payment, ₹5,000 allowance for groceries and travel, and ₹3,000 buffer leave ₹6,000 flexible. These figures are an illustration, not suggested spending amounts. If you also need to reserve ₹2,000 from that same balance for a known commitment, flexible money falls to ₹4,000. If the reserve was excluded at the start, subtracting it again would understate your position."
        ]
      },
      {
        "id": "avoid-duplicates",
        "title": "Avoid counting paid bills and card purchases twice",
        "paragraphs": [
          "Only unpaid future commitments belong in the forward-looking subtraction. Yesterday’s rent has already reduced today’s bank balance, so removing it again would count it twice. Similarly, transfers among included accounts do not create new spending. When moving money from one included account to another, update both balances or neither until reconciled. An incomplete transfer can temporarily make a combined balance look artificially high or low, especially when statements end on different dates.",
          "Credit cards need a distinction between reporting and cash timing. Your spending report may already show the purchases, but your cash forecast must still reserve money for the unpaid card bill. That is not double-counting within the forecast because the bank balance has not yet fallen. However, do not subtract both the full statement bill and those same unpaid purchases as two separate commitments. New unbilled card purchases may need their own reserve if they are not included in the bill figure."
        ]
      },
      {
        "id": "daily-guide",
        "title": "Turn the result into a guide, not a daily command",
        "paragraphs": [
          "Dividing ₹6,000 by twelve days gives a ₹500 daily average, but life is not evenly distributed. A planned ₹2,000 weekend outing leaves ₹4,000 for the other days. A weekly or remaining-period allowance can be easier to use than a strict daily cap. Keep essential groceries and travel separate if you already reserved them in the formula; otherwise you may treat the same everyday costs as both protected spending and discretionary spending.",
          "A negative result is useful information. It means expected commitments exceed the funds included in this plan. Check for duplicate deductions and missing balances first. If the shortfall is real, reduce optional commitments, review payment timing with providers where appropriate and seek help early for essential bills. Do not make the number positive by quietly removing a mandatory payment or counting an uncertain loan as income. The calculation should reveal a problem while there is still time to respond."
        ]
      },
      {
        "id": "keep-current",
        "title": "Refresh after meaningful changes",
        "paragraphs": [
          "Update the estimate after a large payment, a new commitment, an unexpected expense or a change in payday. Small purchases reduce the available balance automatically if your records are current, but your remaining estimate for groceries may need adjusting too. Avoid subtracting the original full grocery allowance after half has already been spent unless that remaining allowance is genuinely still needed. The horizon should shrink as payday approaches, not restart every time you open your tracker.",
          "At payday, close the old cycle, verify what remains unpaid and build the next one with the new salary. Do not automatically release every leftover reserve; an annual bill or delayed debit may still need that money. Over time, compare estimates with actual costs and adjust your buffer to fit your circumstances. The aim is not to spend the calculated amount completely. It is to make a normal purchase without forgetting the obligations that must still be met before your next salary."
        ]
      }
    ]
  },
  {
    "slug": "hidden-subscriptions",
    "title": "Find hidden subscriptions and quiet price hikes",
    "description": "Audit bank and card statements for recurring payments, annual renewals, duplicate services and changing subscription prices.",
    "category": "Everyday spending",
    "publishedAt": "2026-06-18",
    "coverAlt": "Recurring subscription rows with a renewal date and a price change marked",
    "keyTakeaways": [
      "Search several months and include cards, app stores and annual renewals.",
      "Compare like-for-like billing periods before calling a change a price hike.",
      "Cancel with the provider and verify the outcome; blocking a payment is not always cancellation."
    ],
    "introduction": [
      "A subscription rarely announces itself as hidden. It becomes invisible because the charge is small, the merchant name is unfamiliar or the renewal happens only once a year. A service that was useful during a busy month can keep charging long after the habit disappears. Price changes can also slip through when you remember the original offer rather than the current bill.",
      "A subscription review is not a challenge to cancel everything enjoyable. It is a way to make recurring commitments deliberate. Keep the services you value, understand their renewal terms and remove the charges that no longer earn their place."
    ],
    "sections": [
      {
        "id": "gather-records",
        "title": "Look beyond one bank statement",
        "paragraphs": [
          "Gather recent bank and credit-card statements, app-store subscription lists and relevant billing emails. A few months can reveal monthly patterns, but annual renewals require a longer view, ideally covering the preceding year if records are available. Check each payment source you actually use, including a household member’s shared-service arrangement where you have permission. Do not assume a clean salary-account statement means there are no subscriptions; the charges may sit on a credit card or another account.",
          "Search for repeated merchants and similar amounts, but do not rely only on exact matches. Taxes, foreign-exchange conversion, usage-based additions and plan changes can alter the total. A payment aggregator may appear instead of the service name. Compare dates with receipts before deciding what a charge represents. Loan EMIs, insurance premiums and utility bills are also recurring, but they have different cancellation consequences and should not be treated like an unused music plan simply because an algorithm groups them together."
        ]
      },
      {
        "id": "inventory",
        "title": "Build a useful recurring-payments list",
        "paragraphs": [
          "For each confirmed service, record the provider, purpose, amount, billing frequency, payment source, next renewal date and who uses it. Note whether the plan renews automatically and where cancellation is managed. A subscription bought through an app store may need to be managed there rather than on the provider’s website. A family plan may cover several people, so ask before cancelling something that looks unused from your own login history.",
          "Convert annual charges into a monthly equivalent for comparison without forgetting the actual payment date. A ₹2,400 yearly service averages ₹200 a month, but still needs ₹2,400 available when renewed. Keep that cash-flow requirement visible. If you know a free trial becomes paid, record the first charge date and any cancellation deadline when you sign up. An email reminder alone can be missed, so a calendar entry can provide a second prompt without requiring daily attention."
        ]
      },
      {
        "id": "price-changes",
        "title": "Check whether a higher charge is really a price hike",
        "paragraphs": [
          "Compare invoices for the same service, plan, number of users and billing period. A move from a promotional rate to the standard rate is different from a change to the standard price, though both affect your budget. A higher total may also reflect an upgraded plan, additional storage, a failed-payment catch-up or applicable taxes. Foreign-currency subscriptions can change in rupees even when the provider’s quoted price is unchanged. Keep the explanation with the amount.",
          "For example, a plan moving from ₹299 to ₹349 costs ₹50 more each billing cycle; if billed monthly for twelve cycles, that is ₹600 more over a year before any other changes. This is arithmetic, not a claim about a particular provider. Check the effective date and renewal notice rather than assuming the new amount applies immediately. If the charge does not match the agreed plan, contact support through an official channel and retain invoices and correspondence."
        ]
      },
      {
        "id": "decide-and-cancel",
        "title": "Choose keep, change or cancel",
        "paragraphs": [
          "Judge value using actual use and household priorities, not just how inexpensive a service seems. You might keep a frequently used plan, downgrade storage after removing unneeded files, rotate entertainment services or cancel overlapping benefits. Before switching to annual billing, consider the upfront cash commitment and refund terms. A lower monthly equivalent is not necessarily better if you are unlikely to use the service for the full year or need that money for near-term essentials.",
          "To cancel, follow the provider’s or app store’s documented process and save the confirmation with the effective end date. Deleting an app generally does not cancel its subscription. Revoking a UPI AutoPay mandate or disabling a card payment may prevent future collection but does not necessarily terminate a contract or settle an amount already owed. Review the agreement and confirm both the subscription status and payment instruction where relevant. Never share an OTP, PIN or screen-control access with someone claiming cancellation requires it."
        ]
      },
      {
        "id": "verify",
        "title": "Verify the saving instead of assuming it",
        "paragraphs": [
          "Check the next expected billing date to ensure the charge stopped or changed as intended. Some cancellations take effect only at the end of the paid period, and refunds depend on the provider’s terms. If a charge continues, use your saved confirmation when contacting support and raise any dispute with the payment provider through official channels where appropriate. Treat an unauthorised transaction differently from a service you forgot you had agreed to renew; the evidence and remedies may differ.",
          "Finally, give the released money a job if you want the change to improve your cash flow. It could cover a bill reserve, a buffer or another priority you choose. Otherwise it may quietly become extra spending elsewhere, which is not wrong but should be intentional. Add a quick recurring-charge check to your monthly review and a fuller annual-renewal check occasionally. The best outcome is a short, accurate list of commitments, not a long cancellation streak that removes services your household genuinely values."
        ]
      }
    ]
  },
  {
    "slug": "upi-spending",
    "title": "Small UPI payments: see the pattern without tracking every chai",
    "description": "Understand frequent UPI spending by grouping real purchases, separating transfers and checking refunds without judging every small payment.",
    "category": "Everyday spending",
    "publishedAt": "2026-07-16",
    "coverAlt": "Several small UPI payments grouped into food, travel and household categories",
    "keyTakeaways": [
      "UPI is a payment method, not a spending category.",
      "Group small purchases by purpose and look at frequency as well as total.",
      "Keep transfers, pending reversals and wallet funding separate from consumption."
    ],
    "introduction": [
      "UPI makes a ₹20 payment almost as easy as a ₹2,000 payment. That convenience is useful, but a long statement full of small debits can be difficult to interpret. The problem is not that every tea or auto ride is irresponsible. It is that individual payments are easy to remember while their combined pattern is harder to see.",
      "A useful review keeps the convenience and improves the view. Start with the statement you already have, classify enough context to distinguish purchases from transfers, and focus on a few recurring habits rather than turning every small transaction into a separate financial decision."
    ],
    "sections": [
      {
        "id": "payment-method",
        "title": "Do not make UPI one giant spending category",
        "paragraphs": [
          "UPI can pay for groceries, rent, transport, gifts, a shared bill or a transfer to your own account. A single UPI category mixes necessities, optional purchases and non-spending movements. Instead, use the purpose where you can verify it. An unfamiliar payee name may be a shop owner’s personal name or a payment intermediary, so confirm with the app history or receipt before making a permanent rule. A narration alone is not always enough.",
          "Start with a few categories that answer questions you actually have: food outside home, groceries, transport, household needs and family support, for example. Leave uncertain items temporarily unclassified rather than guessing. Repeated known payees can become review shortcuts, but the same supermarket may sell both routine groceries and a larger household purchase. You do not need to split every mixed basket unless doing so changes a useful decision. Consistency and explainable totals matter more than exhaustive detail."
        ]
      },
      {
        "id": "frequency",
        "title": "Look at the pattern, not just the largest debit",
        "paragraphs": [
          "Add up a category over one salary cycle and note how often it appears. As a simple illustration, ₹80 spent on each of twenty workdays totals ₹1,600. That number is not evidence that the habit is wasteful; it gives you something concrete to compare with the value you get. A small daily convenience may be worth keeping, while a larger but less frequent expense might be easier to change. Let your priorities determine which pattern deserves attention.",
          "Compare similar periods. A month with travel, guests or a festival can legitimately differ from an ordinary month. A rising food total may reflect more meals away from home, higher prices or groceries moving from card payments to UPI. Payment-method changes can create apparent trends that vanish when you combine all sources. Review amounts across accounts before concluding that one habit has grown. Where information is incomplete, label the limitation instead of presenting a precise total as the whole picture."
        ]
      },
      {
        "id": "transfers-refunds",
        "title": "Remove movements that are not new purchases",
        "paragraphs": [
          "Match transfers between accounts you own so they do not inflate spending. For a shared bill, link reimbursements to the original payment and distinguish your share from money temporarily paid for others. A credit from a friend is not automatically new income. Likewise, returning borrowed money has a different meaning from buying something. These distinctions are especially important in UPI histories because person-to-person transfers and merchant payments can appear close together with similar-looking narrations.",
          "A failed payment and its reversal should remain traceable as separate movements. Do not treat an expected reversal as money already available or delete the debit just because the app initially reported failure. Verify the final bank records and follow up through official channels if needed. If you use UPI Lite or another stored-value feature, understand what your statement shows: funding that balance and spending from it should not both become consumption expenses. Availability of transaction detail varies, so document the method you use."
        ]
      },
      {
        "id": "gentle-limit",
        "title": "Choose one small experiment instead of dozens of rules",
        "paragraphs": [
          "Pick a pattern that you would genuinely like to change and set a practical experiment for the next pay cycle. You might bring lunch twice a week, combine a few delivery orders with planned groceries or set a weekly allowance for optional snacks. Preserve necessary transport and other essentials. An allowance works best when it reflects your routine and leaves room for an unplanned day, not when it is designed to prove maximum restraint for a week before being abandoned.",
          "Review the category weekly rather than checking every payment with anxiety. If the allowance is used faster than expected, inspect what changed: more office days, a price increase, visitors or a missing category. Do not respond by moving purchases to another app or card so the UPI total looks better. The target is the household spending pattern, not a payment rail. A good experiment produces information even if you decide the convenience is worth keeping at its current cost."
        ]
      },
      {
        "id": "safety",
        "title": "Keep convenience separate from payment safety",
        "paragraphs": [
          "Before authorising a payment, check the recipient and amount. A UPI PIN authorises a debit; you do not need to enter it just to receive money. Be cautious with collect requests, QR codes and messages creating urgency. Refunds do not require you to disclose your PIN or OTP to a caller. If you suspect fraud, contact your bank or payment provider promptly through an official channel; you can also use India’s cybercrime reporting channels, including helpline 1930, for suspected financial cybercrime.",
          "At month-end, save only the few observations that will affect next month: a category total, an unresolved debit and one experiment to continue or stop. You do not need a diary entry for every cup of tea. UPI can remain an easy way to pay while your review makes its combined effect visible. The useful question is not whether a payment was small, but whether all the payments together still fit the commitments and choices you want your salary to support."
        ]
      }
    ]
  },
  {
    "slug": "password-protected-statements",
    "title": "Handle password-protected bank statement PDFs safely",
    "description": "Open your own bank statement PDF carefully, verify the source, avoid unsafe unlockers and protect financial details when sharing.",
    "category": "Statement safety",
    "publishedAt": "2026-08-20",
    "coverAlt": "Locked statement PDF beside a private-device and safe-sharing checklist",
    "keyTakeaways": [
      "Use the bank’s official password instructions; never share banking credentials.",
      "Avoid uploading statements to unknown PDF-unlocking websites.",
      "An unlocked copy remains sensitive and needs careful storage and deletion."
    ],
    "introduction": [
      "Banks often protect emailed statement PDFs with a password. That extra step helps limit casual access, but it does not make a statement harmless once opened or copied. A statement can reveal account details, income, addresses and patterns of daily life. Handling it safely means thinking about where it came from, how it is opened and what happens to any copies.",
      "This guide is about statements you own or have permission to handle. It is not a way to bypass someone else’s protection. If you do not know the password, use the bank’s official instructions or ask the account holder to obtain the document themselves."
    ],
    "sections": [
      {
        "id": "verify-source",
        "title": "Verify the source before opening anything",
        "paragraphs": [
          "An email that looks like a bank statement can still be a phishing message. Check the sender carefully, but do not rely on a familiar display name or logo. If an attachment or link is unexpected, open your bank’s app or type the bank’s known website address yourself and download the statement there. Do not follow a message asking you to install a viewer, enable macros or provide remote access just to read a normal statement.",
          "Use an up-to-date device and trusted PDF reader. A public computer or shared work device may retain downloads, previews and recent-file entries outside your control. If you must use a shared device, consider postponing the task until you have a private one. A password on an attachment does not verify the identity of its sender. Nor does the presence of your name prove a message is genuine: personal details can be copied into fraudulent communications."
        ]
      },
      {
        "id": "password",
        "title": "Find the password instructions through official channels",
        "paragraphs": [
          "Banks use different password formats and may change them. Instructions can involve account-holder details and are often described in the bank’s own message or help section. Follow the instructions for your bank and statement type rather than a generic online guess. If they fail, request a fresh statement through official banking access or contact support using a number from the bank’s app, website or your card. Avoid posting your identifying details publicly to ask others to work out the password.",
          "A statement password is not the same thing as your banking login password, ATM PIN, UPI PIN or OTP. You should not provide those credentials to a PDF tool or someone offering to open the file. Even a statement password based on personal information should be treated carefully because it may reveal that information. If a service asks for more access than seems necessary, stop and understand why before proceeding. Convenience is not a good reason to surrender unrelated banking credentials."
        ]
      },
      {
        "id": "local-tools",
        "title": "Prefer trusted local handling over unknown upload sites",
        "paragraphs": [
          "An online PDF unlocker normally needs access to the document you upload and may also receive its password. Unless you have independently verified its data handling, you cannot assume the file is private, immediately deleted or kept out of logs and backups. Statements contain more than balances, so the potential exposure includes counterparties and transaction history. Avoid unknown upload services, especially those making broad security promises without a clear explanation of processing and retention.",
          "If a legitimate workflow requires an unlocked copy, use a trusted local application where possible and understand its export options. Features vary: printing or exporting may be restricted, remove useful text, change layout or omit information. Do not bypass restrictions on a file you are not authorised to modify. Keep the original unchanged and verify any exported copy against it, including all pages, dates, debit and credit columns, opening balance and closing balance. A file that opens successfully is not automatically a faithful copy."
        ]
      },
      {
        "id": "importing",
        "title": "Understand the receiving tool before importing",
        "paragraphs": [
          "Before using any statement-import tool, check what file types and banks it supports, whether processing occurs on your device or on a server, and what data is retained. Look for current documentation rather than assuming all finance apps work alike. Do not infer a privacy guarantee from the presence of a lock icon or an attractive upload screen. If the documentation is unclear, use a less sensitive method or ask the provider for an explanation before submitting the statement.",
          "Import only the period you need, and review the result against the source. Password handling, PDF extraction and categorisation are separate issues: a correct password does not guarantee every row was read correctly. Check totals and balance reconciliation, then inspect unusually large or ambiguous entries. Never alter a statement’s figures to make an importer accept it. If extraction fails, keep a note of the error without including sensitive data in a public support ticket or screenshot."
        ]
      },
      {
        "id": "storage-sharing",
        "title": "Protect the copies you create and share",
        "paragraphs": [
          "An unlocked PDF is easier for anyone with file access to read. Keep it in a protected location, avoid shared download folders and check whether cloud backup or automatic syncing will copy it elsewhere. Give it a neutral file name rather than embedding a full account number or personal identifier. Delete unnecessary working copies when finished, including those in recycle bins where appropriate, while recognising that backup systems may retain older copies according to their own policies.",
          "When seeking help, share the smallest useful extract. Redact account numbers, addresses, customer IDs, references and unrelated transactions using a proper redaction tool; drawing a black rectangle over text may leave the underlying content recoverable. Verify the exported redacted file before sending it. Keep only the originals and records you genuinely need in a location you understand. Safe handling is not one dramatic security step: it is a sequence of modest decisions that prevent a private financial document from becoming an uncontrolled collection of copies."
        ]
      }
    ]
  },
  {
    "slug": "emergency-fund-salary",
    "title": "Build an emergency fund on a monthly salary",
    "description": "Set a realistic emergency-fund target using essential costs, contribute each payday and separate emergencies from predictable annual bills.",
    "category": "Saving habits",
    "publishedAt": "2026-09-24",
    "coverAlt": "Monthly salary contributions building a reserve for essential expenses",
    "keyTakeaways": [
      "Base a reserve on essential outgoings and household risks, not a universal number.",
      "Begin with a manageable milestone and a sustainable payday contribution.",
      "Keep annual bills separate and rebuild the reserve after a genuine emergency."
    ],
    "introduction": [
      "An emergency fund gives your household time when income stops or an urgent essential expense arrives. It cannot remove uncertainty, but it can reduce the pressure to borrow immediately or sell something at an inconvenient time. Building one from a monthly salary is usually a sequence of modest contributions rather than a single large decision.",
      "There is no amount that fits every household. A stable two-income household with few dependants faces different risks from a sole earner supporting parents while paying an EMI. Start with your own essential costs and circumstances, then choose a first milestone that you can actually reach."
    ],
    "sections": [
      {
        "id": "essential-baseline",
        "title": "Estimate the cost of keeping the household running",
        "paragraphs": [
          "List housing, basic groceries, utilities, essential transport, medicines, minimum debt payments and necessary family support. Use recent statements to estimate a normal month, then adjust for expenses that would change during an income interruption. Commuting might fall, for example, while medical or job-search costs could rise. Include dependants’ needs rather than looking only at the account holder’s personal purchases. Separate essential commitments from subscriptions, discretionary shopping and optional travel that could reasonably pause.",
          "Suppose those essentials total ₹35,000 a month. A reserve covering three such months would be ₹1,05,000, while six would be ₹2,10,000. These are illustrations of the calculation, not prescribed targets. Consider income reliability, number of earners, health needs, insurance gaps and how long replacing income might take. Insurance can reduce some risks but may involve exclusions, deductibles, waiting periods or reimbursement delays. Do not assume that having a policy means no cash reserve is needed."
        ]
      },
      {
        "id": "first-milestone",
        "title": "Choose a first milestone smaller than the final target",
        "paragraphs": [
          "A distant target can make a useful small reserve feel pointless. Instead, identify an initial amount that would cover a plausible urgent bill or a short interruption in cash flow. Then work towards one month of essential expenses and reassess. The first milestone should be meaningful for your household, not copied from an online challenge. Even a partial reserve can prevent a small problem from immediately becoming a missed essential payment, though it will not cover every possible emergency.",
          "Be honest about existing funds. Money reserved for next month’s rent or an upcoming premium is not spare emergency money. A credit limit is not a reserve either; it is potential borrowing with repayment obligations. If you already have savings, identify which portion is genuinely available for unexpected essential needs without undermining a near-term commitment. Avoid assigning the same balance simultaneously to an emergency fund, a holiday and an annual school-fee bill. Each promise makes the headline amount less dependable."
        ]
      },
      {
        "id": "payday-contribution",
        "title": "Make the contribution fit your actual salary cycle",
        "paragraphs": [
          "After mapping essential bills, minimum payments and a workable living allowance, choose a contribution that can survive an ordinary month. Automating it after salary credit may help, provided the timing does not leave your account short for early bills. A transfer that repeatedly has to be reversed is a sign the amount or timing needs adjustment. You can begin smaller and increase it after a loan ends, a subscription is cancelled or income rises.",
          "For illustration, a ₹3,000 monthly contribution builds ₹36,000 over twelve contributions before any interest, withdrawals or charges. A bonus or genuine surplus can shorten the timeline, but it is safer not to rely on uncertain receipts for essential commitments. If high-cost debt and emergency saving compete, the trade-off depends on interest, minimum obligations, liquidity and household risk. This guide does not set a universal order. Consider qualified guidance if the choices are complex or repayments are already difficult to meet."
        ]
      },
      {
        "id": "access",
        "title": "Prioritise access and clarity over chasing returns",
        "paragraphs": [
          "The purpose of emergency money is to be usable when needed. Think about access time, withdrawal restrictions, potential loss, charges and what happens outside normal business hours. Different places to hold money involve different risks and conditions; this article does not recommend a particular account or product. Understand the current terms before choosing. A headline return is not a substitute for knowing whether the money will be available for an urgent bill on the day it is due.",
          "Keep the reserve distinguishable from ordinary spending, whether through a separate eligible account or a reliable ledger label. Make sure the appropriate household member knows how to locate it in an emergency without sharing PINs or passwords insecurely. Follow the provider’s official nomination and access procedures where relevant, and keep details current. A reserve that only one unavailable person can identify may be less useful than its balance suggests. Clear records and practical access are part of the fund, not administrative extras."
        ]
      },
      {
        "id": "use-rebuild",
        "title": "Define emergencies and plan to rebuild",
        "paragraphs": [
          "An urgent essential repair, income interruption or unexpected necessary medical cost may qualify. A known annual insurance premium or a planned festival trip generally belongs in a separate planned-expense reserve. Still, real life can blur categories. If you use the fund to protect an essential need, record why and what changed instead of treating the withdrawal as a personal failure. The purpose of building the reserve was to use it when the right situation arose.",
          "After a withdrawal, update the balance and choose a realistic replenishment plan alongside current obligations. Review the target when rent, dependants, health or employment circumstances change. Avoid continually raising the goal until it feels impossible, but do not leave it unchanged for years as essential costs rise. Progress is a combination of available money, clear boundaries and sustainable habits. A reserve built gradually and understood by the household is more protective than an impressive target written down without a workable way to fund or access it."
        ]
      }
    ]
  },
  {
    "slug": "monthly-money-check-in",
    "title": "Your 15-minute monthly money check-in",
    "description": "A calm, repeatable monthly review for statements, bills, subscriptions and one practical action before your next salary cycle.",
    "category": "Money routines",
    "publishedAt": "2026-11-12",
    "coverAlt": "Fifteen-minute checklist with statements, spending, upcoming bills and one next action",
    "keyTakeaways": [
      "Use a short agenda: reconcile, review patterns, look ahead and choose one action.",
      "Leave complicated questions on a follow-up list instead of forcing an answer.",
      "Repeat on a predictable date and share only the information your household needs."
    ],
    "introduction": [
      "A monthly money review does not need to become a weekend project. Fifteen focused minutes can be enough to check the main numbers, notice a change and prepare for the next salary cycle, especially once your records are organised. The first review may take longer. If accounts are missing or transactions do not reconcile, give those problems proper time rather than pretending a timer can resolve them.",
      "Think of this as a recurring check-in, not a financial performance appraisal. The aim is to understand what happened, see what is coming and leave with one useful action. Blame and perfect categorisation are not on the agenda."
    ],
    "sections": [
      {
        "id": "prepare",
        "title": "Before the timer: gather only what you need",
        "paragraphs": [
          "Choose a repeatable date after the relevant statements are available, ideally early enough to influence the next cycle. Keep bank statements, card statements, current balances and a simple bill calendar accessible in a protected location. If you share finances, agree on which accounts are included and ask permission before viewing another person’s records. A household review does not require everyone to surrender privacy around unrelated personal spending. Define the shared decisions you actually need to make.",
          "Use the same salary-to-salary or calendar-month boundary each time so comparisons are meaningful. Keep a short carry-forward note from the previous review: an unresolved debit, an expected refund or a subscription cancellation to verify. You do not need every receipt in front of you before starting. Gather enough to check totals, and let the review identify the few records worth retrieving later. Preparation should remove friction without growing into a second, unbounded administration session."
        ]
      },
      {
        "id": "minutes-one-four",
        "title": "Minutes 1–4: check that the numbers are trustworthy",
        "paragraphs": [
          "Confirm that each statement covers the intended dates and account. Check opening balance plus credits minus debits against closing balance, then look for duplicate imports, missing pages and unexpected charges. Match transfers between your own included accounts so they do not inflate spending or income. A clean reconciliation does not prove every transaction is authorised, but it gives you a dependable starting point for discussing patterns. A chart is not useful if its underlying rows are incomplete.",
          "Review the previous month’s unresolved items. Did the promised refund arrive? Did the cancelled subscription stop? If a debit appears unauthorised, stop the routine and report it promptly through official banking or payment channels rather than leaving it for next month. If an arithmetic problem needs more investigation, record the exact account, date and amount on a follow-up list. Mark the affected totals as provisional so you do not build confident decisions on numbers you already know may be wrong."
        ]
      },
      {
        "id": "minutes-five-eight",
        "title": "Minutes 5–8: notice two or three meaningful changes",
        "paragraphs": [
          "Look at a few broad categories rather than every line. Compare groceries, food outside home, transport, household support and any category you have been trying to understand. Ask what changed in real life: more office days, visitors, a festival, a new medicine or a price increase. A higher total is information, not automatically a problem. Where cards, cash and UPI are all used, combine the available sources before attributing a change to one habit.",
          "Check recurring charges and distinguish a genuine new commitment from a one-off expense. A ₹500 increase every month has a different future effect from a single ₹500 purchase. Also recognise what worked: a bill reserve funded on time, fewer duplicate services or a clearer transfer classification. If you share the review, describe observations neutrally. “Transport was higher because of office attendance” produces a more useful conversation than an accusation that someone has become careless with money."
        ]
      },
      {
        "id": "minutes-nine-twelve",
        "title": "Minutes 9–12: look ahead to the next payday",
        "paragraphs": [
          "List unpaid bills, essential variable costs and known one-offs due before your next reliable salary credit. Include annual or quarterly expenses coming soon enough to need contributions now. Compare those commitments with usable money, excluding funds already reserved for emergencies or other specific purposes. Expected reimbursements and bonuses should not silently become available cash. If your plan depends on a future receipt, make that dependency explicit and consider what happens if the payment is delayed.",
          "Calculate a rough left-to-spend figure after those commitments and a suitable buffer. If it is negative, first check for duplicate deductions such as subtracting rent that has already left the bank balance. If the gap is real, identify a specific adjustment or support conversation before the payment date. Do not hide it by moving an obligation to a different category. A forward view is valuable precisely because it reveals problems while there is still an opportunity to change the next few weeks."
        ]
      },
      {
        "id": "minutes-thirteen-fifteen",
        "title": "Minutes 13–15: choose one action and close the review",
        "paragraphs": [
          "Pick one concrete action with an owner and date: verify a ₹799 renewal, ask about a billing-date change, set aside a planned annual cost or resolve an unidentified transfer. One finished action is often more valuable than a list of fifteen vague intentions. If a decision involves debt terms, tax or investing, schedule the appropriate research or qualified advice rather than trying to settle it from a spending chart during the final minute of a household check-in.",
          "Write a three-line summary: what changed, what is due next and what you will do. Set the next review date, close sensitive documents and store them safely. If a short monthly reminder helps, The Monthly Check-in is the name of Wall·ette’s newsletter. Whether or not you subscribe, keep the routine small enough to repeat. Over time, trustworthy records and a few completed actions can make your salary cycle easier to understand without requiring you to monitor money every hour of the day."
        ]
      }
    ]
  }
] as const satisfies readonly ArticleDraft[];

export const articles: readonly BlogArticle[] = drafts.map((article) => {
  const text = [article.title, ...article.introduction, ...article.keyTakeaways, ...article.sections.flatMap((section) => [section.title, ...section.paragraphs])].join(" ");
  const wordCount = text.trim().split(/\s+/u).length;
  return { ...article, cover: `/covers/${article.slug}.webp` as const, wordCount, readTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)) };
});
export const featuredArticle = articles[0]!;
export function getArticle(slug: string): BlogArticle | undefined {
  return articles.find((article) => article.slug === slug);
}
export function formatBlogDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}
