import type { ComparisonApp } from "./compare-model";

/** Official-source research checked 2026-11-26; unknowns remain explicit. */
export const COMPARISON_PEERS: ComparisonApp[] = [
  {
    "id": "fold",
    "name": "Fold",
    "kind": "Automatic personal-finance tracker for India.",
    "origin": "India · Lunchbrake Classic Private Limited, Bengaluru.",
    "countries": "Indian accounts; official support lists 26 banks, including SBI, HDFC, ICICI, Axis and Kotak. Individual connections may be temporarily disabled.",
    "india": "Explicit India support through RBI's Account Aggregator framework.",
    "tracking": "AA-based bank synchronization without SMS or email scraping; some assets can be added manually. Credit-card connection mechanism was not verified.",
    "storage": "Not local-only: Fold receives and decrypts financial information; AA partners cannot decrypt it. Hosting location and retention remain unverified.",
    "platforms": "Android and iPhone; web finance dashboard not verified.",
    "price": "Limited free tier and paid Fold Plus. Standard monthly/yearly prices and currency not verified.",
    "trial": "Standard trial duration not verified.",
    "features": "Categorization, cash-flow insights, transaction search, investments/net worth, credit scores, shared Spaces and Plus CSV exports.",
    "fit": "Someone with supported indian accounts wanting automatic tracking without sms permissions.",
    "caveat": "Check exact bank availability before subscribing.",
    "sources": [
      {
        "label": "Official FAQ",
        "url": "https://fold.money/faq"
      },
      {
        "label": "Supported banks",
        "url": "https://help.fold.money/hc/en-us/articles/17395285542290-Supported-Banks"
      },
      {
        "label": "Data access and decryption",
        "url": "https://help.fold.money/hc/en-us/articles/17258458172690-Can-the-Account-Aggregator-view-my-data-How-is-my-data-kept-secure"
      },
      {
        "label": "Free versus Plus",
        "url": "https://help.fold.money/hc/en-us/articles/17262017781522-Is-Fold-a-free-app"
      }
    ]
  },
  {
    "id": "axio",
    "name": "axio",
    "kind": "SMS money manager within a financial-products and lending app.",
    "origin": "Operated by India's Axio Digital Private Limited; brand owned by group company Capfloat Financial Service Private Limited.",
    "countries": "India-focused; exact supported bank/message-format list not verified. SMS detection is not bank connectivity.",
    "india": "Tracks Indian bank, UPI, credit-card and wallet transactional messages, subject to message recognition.",
    "tracking": "Permission-based parsing of business, service and transactional SMS; official material says personal SMS are not read. AA and file-import support not verified.",
    "storage": "Cloud processing, not local-only; privacy policy describes encrypted server storage in India and processing by partners. Personal SMS and OTP messages are not backed up.",
    "platforms": "Android verified; current iOS tracker and web dashboard not verified.",
    "price": "Standard tracker monthly/yearly subscription prices not verified. Loan interest and financial-product charges are separate.",
    "trial": "Tracker subscription trial not verified.",
    "features": "Automatic categorization, daily/monthly summaries, category budgets, spending alerts, bill reminders, notes, tags and receipts.",
    "fit": "An indian android user receiving transaction sms who wants automatic tracking without bank linking.",
    "caveat": "Requires SMS permissions and is also a credit-products platform.",
    "sources": [
      {
        "label": "Official tracking guide",
        "url": "https://www.axio.co.in/blogs/managing-money-with-axio"
      },
      {
        "label": "Operator and privacy policy",
        "url": "https://www.axio.co.in/axio-digital-privacy-policy"
      },
      {
        "label": "Official Android listing",
        "url": "https://play.google.com/store/apps/details?id=com.daamitt.walnut.app&hl=en_US"
      }
    ]
  },
  {
    "id": "mojek",
    "name": "Mojek",
    "kind": "Account-connected personal-finance tracker.",
    "origin": "Mojek Solutions Private Limited, incorporated in India; financial-data services involve Shreem Datatech Solutions Private Limited.",
    "countries": "Indian bank accounts only; official help says downloads available in India, USA and Canada, but registration requires an Indian mobile number.",
    "india": "Official help lists 17 supported banks, including SBI, HDFC, ICICI, Axis, Kotak and Yes Bank.",
    "tracking": "Account Aggregator connectivity through OneMoney and SETU. Manual entry, SMS tracking and transaction-file imports not verified.",
    "storage": "Terms state financial data is managed and stored on Shreem Datatech servers, with Mojek displaying information locally; not local-only.",
    "platforms": "Official terms describe Android and iOS; current store availability and web dashboard not independently verified.",
    "price": "Official help says currently free, with charging planned after beta. No standard monthly/yearly amount or currency verified.",
    "trial": "No paid-plan trial verified; current free access is not necessarily a timed trial.",
    "features": "Account overview, merchant search and summaries, cash-flow views, statement downloads, transaction notes and account nicknames.",
    "fit": "Someone with supported indian accounts seeking aa-based tracking and accepting an evolving beta product.",
    "caveat": "Overseas download availability does not mean overseas bank support.",
    "sources": [
      {
        "label": "Operator and server storage",
        "url": "https://www.mojek.money/terms-conditions"
      },
      {
        "label": "Supported banks",
        "url": "https://mojekmoney.help.center/article/1019-supported-banks"
      },
      {
        "label": "Countries and registration requirements",
        "url": "https://mojekmoney.help.center/article/1036-can-i-download-mojek-as-an-nri"
      },
      {
        "label": "Pricing",
        "url": "https://mojekmoney.help.center/article/1014-is-mojek-a-free-app"
      },
      {
        "label": "AA partners",
        "url": "https://mojekmoney.help.center/article/1012-how-are-you-connecting-to-my-bank-account-and-accessing-my-banking-data"
      },
      {
        "label": "Features",
        "url": "https://www.mojek.money/"
      }
    ]
  },
  {
    "id": "realbyte",
    "name": "Realbyte Money Manager",
    "kind": "Manual financial ledger with double-entry bookkeeping.",
    "origin": "Realbyte Inc.; official Google Play developer address is Seoul, South Korea.",
    "countries": "Multi-currency manual tracking; no verified direct-bank country or institution list.",
    "india": "Suitable for manually recording Indian finances; Indian bank linking and AA support not verified.",
    "tracking": "Manual entry, recurring transactions and spreadsheet-related tools. Internal debit-card/account associations are bookkeeping, not evidence of live bank feeds.",
    "storage": "Device and optional Google Drive backups are documented; paid Data Sync also exists. Privacy policy permits account-data processing and advertising.",
    "platforms": "Android, iPhone and iPad; PC Manager accesses the mobile ledger over Wi-Fi, rather than a verified standalone cloud dashboard.",
    "price": "Free / remove-ads editions; US iOS Data Sync USD2.49/month or USD19.99/year. India and Android prices not verified.",
    "trial": "Standard Data Sync trial not verified.",
    "features": "Double-entry accounts, budgets, asset charts, receipt photos, recurring transfers, calendar views and PC editing.",
    "fit": "Someone wanting detailed bookkeeping and willing to maintain records rather than rely on automatic bank feeds.",
    "caveat": "Data synchronization is not bank synchronization; platform purchases and features differ.",
    "sources": [
      {
        "label": "US iOS subscription prices and features",
        "url": "https://apps.apple.com/us/app/money-manager-expense-budget/id560481810"
      },
      {
        "label": "Android and developer origin",
        "url": "https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=en_US"
      },
      {
        "label": "Backups",
        "url": "https://help.realbyteapps.com/hc/en-us/articles/360042747934-How-to-backup-and-restore-data"
      },
      {
        "label": "Privacy",
        "url": "https://realbyteapps.com/policy/privacy.html"
      }
    ]
  },
  {
    "id": "cashew",
    "name": "Cashew",
    "kind": "Local-first expense tracker and customizable budget planner.",
    "origin": "James Kokoska / DapperAppDeveloper. Terms use Ontario law; founding country not verified.",
    "countries": "Multi-currency manual/import tracking; no verified country-specific bank-feed coverage.",
    "india": "Can track Indian spending manually or through imports; Indian AA and direct-bank support not verified.",
    "tracking": "Manual entry and CSV import/export; official guides also describe notification/SMS-message scanning, Apple Pay Shortcuts and other automation. These are not universal bank synchronization.",
    "storage": "On-device financial database with optional Google Drive backup/sync; developer says no central financial-data server.",
    "platforms": "Android, iPhone/iPad and web; official FAQ says web does not support Cashew Pro.",
    "price": "US iOS Pro: US$1.49/month, US$11.99/year or US$19.99 lifetime; free app available. Android and iOS purchases are separate; Indian prices not verified.",
    "trial": "Standard trial duration not verified.",
    "features": "Flexible-period budgets, charts, recurring bills/reminders, customization, multiple currencies and CSV migration.",
    "fit": "Someone prioritizing local records, flexible visual budgeting and manual/import-based control.",
    "caveat": "Automation requires setup and varies by platform; optional cloud and AI workflows involve external services.",
    "sources": [
      {
        "label": "Developer and US iOS prices",
        "url": "https://apps.apple.com/us/app/cashew-expense-budget-tracker/id6463662930"
      },
      {
        "label": "Privacy and governing law",
        "url": "https://cashewapp.web.app/policy.html"
      },
      {
        "label": "Imports, automation, web and licensing",
        "url": "https://cashewapp.web.app/faq.html"
      },
      {
        "label": "Android listing",
        "url": "https://play.google.com/store/apps/details?hl=en_US&id=com.budget.tracker_app"
      }
    ]
  },
  {
    "id": "spendee",
    "name": "Spendee",
    "kind": "Cloud-synced budgeting app with optional bank feeds.",
    "origin": "SPENDEE a.s., registered in Prague, Czech Republic.",
    "countries": "Official help claims over 9,000 banks; exact country/institution availability must be checked in-app. Connections use Salt Edge or Plaid.",
    "india": "India pricing exists, but the reviewed India bank page returned no bank matches. Indian bank-feed support remains unverified.",
    "tracking": "Manual entry, file import and Premium read-only bank synchronization; Premium also advertises receipt scanning.",
    "storage": "Cloud backup/sync; official material says data is encrypted in transit and on servers, never sold, and exportable/deletable.",
    "platforms": "Mobile and web service; current feature parity across Android, iOS and web not verified.",
    "price": "India iOS: free tier; Plus ₹249/month or ₹2,999/year; Premium ₹599/month or ₹3,999/year. Store / country prices differ.",
    "trial": "Current help says duration and eligibility depend on plan/store offer; a universal seven-day trial is not confirmed.",
    "features": "Budgets, category insights, shared wallets, multi-device sync and exports; Premium adds bank feeds and automatic categorization.",
    "fit": "Someone wanting shared cloud budgeting, with bank automation only after confirming their exact institution.",
    "caveat": "Regional pricing and a global bank count do not establish Indian bank connectivity.",
    "sources": [
      {
        "label": "India pricing",
        "url": "https://www.spendee.com/in/pricing/"
      },
      {
        "label": "US pricing",
        "url": "https://www.spendee.com/pricing"
      },
      {
        "label": "Bank availability",
        "url": "https://www.spendee.com/help/supported-banks/"
      },
      {
        "label": "India banks and storage disclosures",
        "url": "https://www.spendee.com/in/banks/"
      },
      {
        "label": "Trial conditions",
        "url": "https://www.spendee.com/help/free-trial/"
      },
      {
        "label": "Operator and privacy",
        "url": "https://www.spendee.com/privacy-policy/"
      },
      {
        "label": "Connection partners",
        "url": "https://www.spendee.com/budget-app-with-bank-sync/"
      }
    ]
  },
  {
    "id": "money-lover",
    "name": "Money Lover",
    "kind": "Budgeting and money manager with a separate bank-feed subscription.",
    "origin": "Finsify; official company site lists Hanoi, Vietnam.",
    "countries": "Official listings name Vietnam, Thailand, Indonesia, Malaysia, Hong Kong, Singapore and the Philippines, with differences between listings. Current supported institutions require in-app verification.",
    "india": "Manual multi-currency tracking is available; Indian bank connectivity was not verified.",
    "tracking": "Manual entries and recurring transactions; separate Linked Wallet subscription automatically synchronizes supported banks. General transaction-file imports not verified.",
    "storage": "Cloud synchronization; support describes encrypted bank data on Google- and Amazon-managed servers and read-only bank connections.",
    "platforms": "Android, iPhone/iPad, Apple Watch and web. Company site also mentions Windows, but current availability was not verified.",
    "price": "US iOS: Premium lifetime USD19.99 (bank feeds excluded). Linked Wallet has USD2.49 and USD2.99 monthly listings; applicable SKU / annual price not verified.",
    "trial": "Seven-day Linked Wallet trial for first-time subscribers; separate from Premium.",
    "features": "Budgets, multiple wallets, bills, recurring entries, debts/loans, savings goals, travel currencies and paid exports.",
    "fit": "Someone wanting manual multi-currency budgeting or supported southeast asian bank feeds.",
    "caveat": "Premium does not include Linked Wallet; verify current checkout entitlements.",
    "sources": [
      {
        "label": "Company origin",
        "url": "https://finsify.com/"
      },
      {
        "label": "US iOS prices and platforms",
        "url": "https://apps.apple.com/us/app/money-lover-money-manager/id486312413"
      },
      {
        "label": "Additional named bank countries",
        "url": "https://apps.apple.com/vn/app/money-lover-money-manager/id486312413"
      },
      {
        "label": "Linked Wallet pricing structure, trial and storage",
        "url": "https://moneylover.zendesk.com/hc/en-us/articles/35707018765209-Linked-Bank-Wallet-Subscription"
      },
      {
        "label": "Web and Premium entitlements",
        "url": "https://web.moneylover.me/store/"
      }
    ]
  },
  {
    "id": "lunch-money",
    "name": "Lunch Money",
    "kind": "Flexible budgeting and financial tracking.",
    "origin": "Founded in 2019 by Jen; Lunchbag Labs, Inc., Toronto, Canada.",
    "countries": "Bank sync in the US, Canada and selected European countries; 160+ currencies. Manual entry / imports extend tracking beyond bank-sync coverage.",
    "india": "No Indian bank sync listed. Manual entry and CSV/PDF imports are alternatives; Indian app-store availability was not verified.",
    "tracking": "Optional bank sync, manual entry, CSV/PDF imports and API; supports 160+ currencies.",
    "storage": "Cloud service with AES-256 encryption, optional 2FA and read-only bank access. Says it does not sell information for advertising.",
    "platforms": "Web, with official iOS and Android companion apps.",
    "price": "USD10/month, or choose-your-price yearly from USD60/year. The annual checkout also displays USD100 as a selected amount.",
    "trial": "30 days; no credit card required.",
    "features": "Flexible budgets, rules, splits, tags, reports, net worth, crypto tracking and API.",
    "fit": "Multicurrency households, internationally mobile users and api enthusiasts.",
    "caveat": "Country coverage does not guarantee every institution or account type. Server residency not verified.",
    "sources": [
      {
        "label": "Company origin",
        "url": "https://lunchmoney.app/media-kit/"
      },
      {
        "label": "Coverage and platforms",
        "url": "https://lunchmoney.app/"
      },
      {
        "label": "Official pricing",
        "url": "https://lunchmoney.app/pricing"
      },
      {
        "label": "Security",
        "url": "https://lunchmoney.app/features/security"
      }
    ]
  },
  {
    "id": "money-pro",
    "name": "Money Pro",
    "kind": "Personal bookkeeping, budgeting and bill planning.",
    "origin": "Operated by iBear LLC. Founding country and Money Pro launch year were not established from current official sources.",
    "countries": "Manual tracking is independent of bank feeds. An official 2022 announcement covered US/Canada connections; current full coverage is not verified.",
    "india": "Indian bank sync and Indian store availability unverified. Manual tracking does not require a connected bank.",
    "tracking": "Manual entries, file imports and optional GOLD bank downloads.",
    "storage": "Local by default; paid Money Pro Sync stores data locally and in the cloud. Cloud-account deletion does not erase device copies.",
    "platforms": "iOS/iPadOS, Android, macOS and Windows; no browser app established.",
    "price": "US iOS listing states PLUS $4.99/month and GOLD $9.99/month, plus a $0.99 download for the referenced edition. Annual prices and other-platform prices unverified.",
    "trial": "Standard trial duration not verified.",
    "features": "Rollover budgets, scheduled bills, reports, assets/liabilities, multiple profiles and shared tracking.",
    "fit": "Users wanting detailed desktop/mobile bookkeeping with optional cloud synchronization.",
    "caveat": "Multiple editions and platform purchases complicate pricing. Current bank coverage, annual pricing and national origin remain unresolved.",
    "sources": [
      {
        "label": "Operator and platforms",
        "url": "https://ibearsoft.com/terms.html"
      },
      {
        "label": "Storage and subscriptions",
        "url": "https://money.pro/faq/"
      },
      {
        "label": "Features",
        "url": "https://money.pro/guide/"
      },
      {
        "label": "Historical bank announcement",
        "url": "https://money.pro/blog/2022/06/23/online-banking-for-us-canada/"
      },
      {
        "label": "Publisher pricing on US App Store",
        "url": "https://apps.apple.com/us/app/money-pro-personal-finance-ar/id918609651"
      }
    ]
  },
  {
    "id": "fast-budget",
    "name": "Fast Budget",
    "kind": "Expense tracking and category budgeting.",
    "origin": "Operated by AppFer S.R.L., Italy. Founding and launch dates unverified.",
    "countries": "Bank selector covers the EU, UK, Canada and selected countries in Latin America and Asia; India is not listed. Manual access is separate.",
    "india": "India is absent from the bank selector. Indian store availability unverified; manual tracking is available without bank sync.",
    "tracking": "Manual transactions and CSV/XLS imports; Ultra adds Salt Edge bank downloads and automatic categorization.",
    "storage": "Financial data stored online for eligible synchronization plans; otherwise local storage with recommended Dropbox backups. Free mobile tier has ads, but entered financial data is not sold/shared with advertisers.",
    "platforms": "Android and iOS; web app requires Premium or Ultra.",
    "price": "Free tier plus Pro, Premium and Ultra. Exact monthly/yearly prices and billing currencies require the relevant in-app Store and were not verified.",
    "trial": "Standard trial duration not verified.",
    "features": "Category budgets, recurring transactions, subscriptions, savings goals, reports and optional bank sync.",
    "fit": "Mobile-first expense tracking, especially with a supported european bank.",
    "caveat": "Selectable countries do not guarantee every bank. Do not substitute historical Salt Edge worldwide coverage claims for current app coverage.",
    "sources": [
      {
        "label": "Operator",
        "url": "https://fastbudget.app/legal/terms-of-service"
      },
      {
        "label": "Current bank-country selector",
        "url": "https://fastbudget.app/bank-sync"
      },
      {
        "label": "Bank synchronization",
        "url": "https://fastbudget.app/faq/answer/bank/faq-bank-sync"
      },
      {
        "label": "Plans and purchasing",
        "url": "https://fastbudget.app/faq/answer/purchases/faq-purchases-and-subscriptions"
      },
      {
        "label": "Data storage and privacy",
        "url": "https://fastbudget.app/faq/answer/sync/faq-user-data"
      },
      {
        "label": "Web features",
        "url": "https://fastbudget.app/web-app"
      }
    ]
  },
  {
    "id": "ynab",
    "name": "YNAB",
    "kind": "Active allocation-based budgeting.",
    "origin": "Jesse Mecham launched the commercial spreadsheet in September 2004; Taylor Brown joined development in 2006. Incorporation geography was not verified.",
    "countries": "Direct Import for selected US, Canadian, UK and European institutions. Elsewhere use manual entry or file imports; currency support is separate from bank coverage.",
    "india": "Indian institutions are not supported for Direct Import. Manual/file-based tracking is the alternative; Indian app-store availability unverified.",
    "tracking": "Assign available money to categories, then maintain the plan using manual entries, file imports or optional bank imports.",
    "storage": "Cloud-synchronized with encryption in transit and at rest. Financial data is not sold; marketing advertising may constitute sale/share under some state privacy laws.",
    "platforms": "Web and mobile apps; iOS/Android storefront availability by country not individually checked.",
    "price": "US$14.99/month or US$109/year, plus applicable tax.",
    "trial": "34 days; direct signup requires no credit card.",
    "features": "Category allocations, savings targets, debt planning, transaction reconciliation and device synchronization.",
    "fit": "People willing to actively maintain a spending plan rather than only monitor expenses.",
    "caveat": "Not every institution or account type is supported within covered countries. Server residency not verified.",
    "sources": [
      {
        "label": "Origin timeline",
        "url": "https://www.ynab.com/about/timeline"
      },
      {
        "label": "Official pricing and trial",
        "url": "https://www.ynab.com/pricing"
      },
      {
        "label": "Bank coverage limitations",
        "url": "https://support.ynab.com/en_us/my-bank-isnt-listed-HJivlLavle.md"
      },
      {
        "label": "European country list",
        "url": "https://support.ynab.com/en_us/direct-import-in-europe-Syae1z_A9.md"
      },
      {
        "label": "Security and privacy",
        "url": "https://www.ynab.com/security"
      }
    ]
  },
  {
    "id": "copilot",
    "name": "Copilot Money",
    "kind": "Automated personal-finance tracking and budgeting.",
    "origin": "Founded in 2019 by Andrés Ugarte and launched in 2020. Teams operate in New York and Santiago.",
    "countries": "Officially available in the US and supports US-based accounts only, across 16,000+ institutions. Chilean operations do not imply Chilean bank support.",
    "india": "No Indian bank support; service is US-focused. Indian availability not established.",
    "tracking": "Read-only account aggregation with automated categorization and adaptable budgets.",
    "storage": "Provider-hosted financial data, not local-only; bank credentials handled by connection providers. Financial information is not sold or used for advertising, but marketing identifiers may be shared.",
    "platforms": "Web, iPhone, iPad and Mac; no native Android app listed.",
    "price": "US$18/month or $119/year standard; official site displays a limited-time $109/year offer.",
    "trial": "One month for new users; subscription selection required and auto-renewal applies.",
    "features": "Budgets, subscriptions, savings goals, cash flow, investments, net worth and automated categorization.",
    "fit": "Us users wanting automated financial monitoring, particularly on apple devices.",
    "caveat": "Annual $9/month display is an annual-plan equivalent, not monthly billing. Hosting region and offer end date unverified.",
    "sources": [
      {
        "label": "Origin, coverage and features",
        "url": "https://www.copilot.money/faq"
      },
      {
        "label": "Launch and operating locations",
        "url": "https://www.copilot.money/careers"
      },
      {
        "label": "Official pricing",
        "url": "https://www.copilot.money/"
      },
      {
        "label": "Trial and availability",
        "url": "https://help.copilot.money/en/articles/11157550-quick-start-guide"
      },
      {
        "label": "Privacy policy",
        "url": "https://www.copilot.money/privacy-policy"
      }
    ]
  },
  {
    "id": "monarch",
    "name": "Monarch Money",
    "kind": "Household financial aggregation, budgeting and planning.",
    "origin": "US company founded in 2018 by Val Agostino, Jon Sutherland and Ozzie Osman; fully remote.",
    "countries": "Official summary states US availability with partial Canadian-institution support, using multiple providers across 13,000+ institutions. Worldwide access and complete Canadian coverage are not established.",
    "india": "No Indian bank support or supported Indian service availability established.",
    "tracking": "Automatic account aggregation and transaction categorization, with category-based or Flex budgeting.",
    "storage": "Cloud-synchronized with encryption in transit/at rest and MFA. Read-only connections; ad-free and does not sell financial data.",
    "platforms": "Web, iOS and Android.",
    "price": "US web pricing: Core $14.99/month or $99.99/year; Plus $199.99/year. Plus monthly pricing not verified.",
    "trial": "Seven days.",
    "features": "Household collaboration, budgets, reports, recurring bills, goals, investments and net worth; Plus adds forecasting and deeper planning tools.",
    "fit": "Couples and households seeking a consolidated financial dashboard.",
    "caveat": "Check exact institution support, especially in Canada. Core and Plus have different planning tools; Plus monthly billing not verified.",
    "sources": [
      {
        "label": "Company origin and features",
        "url": "https://www.monarch.com/about"
      },
      {
        "label": "Official pricing and trial",
        "url": "https://www.monarch.com/pricing"
      },
      {
        "label": "Official coverage summary",
        "url": "https://www.monarch.com/llms.txt"
      },
      {
        "label": "Security",
        "url": "https://www.monarch.com/security"
      }
    ]
  },
  {
    "id": "everydollar",
    "name": "EveryDollar",
    "kind": "Ramsey-style zero-based budgeting.",
    "origin": "Created by US-based Ramsey Solutions and launched in 2015, following Dave Ramsey's earlier budgeting tools.",
    "countries": "Mobile downloads and Premium are US-only. Official support says the free browser version can be used internationally; Premium bank connectivity is US-focused.",
    "india": "Free browser budgeting is the supported international alternative. Indian mobile downloads, Premium and Indian bank sync are not supported.",
    "tracking": "Free version uses manual tracking; Premium streams bank transactions for assignment to budget lines.",
    "storage": "Account-based hosted service with encryption and third-party bank processing through Mastercard Connect/Plaid. Hosting region and a product-specific no-data-sale promise were not verified.",
    "platforms": "Web, iOS and Android; mobile apps restricted to US storefronts.",
    "price": "Free tier; Premium US$17.99/month or US$79.99/year.",
    "trial": "14 days for Premium; new-user eligibility applies.",
    "features": "Zero-based budgets, sinking funds and shared household budgeting; Premium adds bank streaming, paycheck planning, insights, coaching and financial-roadmap tools.",
    "fit": "Ramsey/baby steps followers and beginners wanting a straightforward spending plan.",
    "caveat": "Premium requires US-based registration/payment eligibility. Exact bank and account compatibility must be checked in-app.",
    "sources": [
      {
        "label": "Origin",
        "url": "https://www.ramseysolutions.com/budgeting/why-we-built-everydollar"
      },
      {
        "label": "Official pricing and trial",
        "url": "https://www.ramseysolutions.com/money/everydollar/premium"
      },
      {
        "label": "International restrictions",
        "url": "https://everydollar.help.ramseysolutions.com/hc/en-us/articles/360032444792-Using-EveryDollar-Outside-the-United-States"
      },
      {
        "label": "Features and method",
        "url": "https://www.ramseysolutions.com/budgeting/everydollar-a-faster-easier-way-to-budget"
      },
      {
        "label": "Data security",
        "url": "https://everydollar.help.ramseysolutions.com/hc/en-us/articles/11300204792845-EveryDollar-Data-Security"
      }
    ]
  },
  {
    "id": "quickbooks",
    "name": "QuickBooks Online",
    "kind": "Cloud business accounting.",
    "origin": "Intuit · US company. Regional product editions differ.",
    "countries": "Regional editions are offered internationally; bank connectivity and features vary by country.",
    "india": "Current India availability and Indian bank connectivity were not verified; do not assume global availability includes India.",
    "tracking": "Automatic bank feeds and categorization, manual bookkeeping, invoices and receipt capture.",
    "storage": "Vendor-hosted cloud storage; not local-only. Storage jurisdiction and detailed sharing practices were not verified.",
    "platforms": "Web browser and mobile access.",
    "price": "US standard monthly: Simple Start USD38; Essentials USD85; Plus USD140; Advanced USD340. A separate limited Free tier exists. Annual pricing not verified.",
    "trial": "30-day trial on eligible new monthly subscriptions; cannot combine with the introductory discount. Regional terms differ.",
    "features": "Income and expenses, invoicing, financial reports and tax workflows; higher tiers add inventory and project profitability.",
    "fit": "Small businesses needing accounting rather than household budgeting.",
    "caveat": "Prices and capabilities are region-specific; exact bank support requires checking the connection directory.",
    "sources": [
      {
        "label": "US subscription prices",
        "url": "https://quickbooks.intuit.com/subscription/"
      },
      {
        "label": "US pricing and Free tier",
        "url": "https://quickbooks.intuit.com/pricing/"
      },
      {
        "label": "International availability and cloud FAQ",
        "url": "https://quickbooks.intuit.com/global/faq/"
      },
      {
        "label": "Global pricing and trial",
        "url": "https://quickbooks.intuit.com/global/pricing/"
      }
    ]
  },
  {
    "id": "actual-budget",
    "name": "Actual Budget",
    "kind": "Open-source envelope budgeting.",
    "origin": "Community-developed, MIT-licensed project; original founding date and country were not verified.",
    "countries": "Manual tracking is independent of bank coverage. Optional providers cover North America, Europe, Brazil and New Zealand.",
    "india": "Manual entry and supported file imports are possible; no Indian bank-sync provider was verified.",
    "tracking": "Manual entry, CSV/QIF/OFX/QFX/CAMT imports and optional bank synchronization.",
    "storage": "Local-first with optional hosted synchronization and end-to-end encryption. Bank-sync tokens remain server-side and outside budget E2EE.",
    "platforms": "Windows, macOS, Linux and web/mobile-browser interface.",
    "price": "Software USD0 monthly/yearly; hosting and bank services cost extra. Documentation quotes SimpleFIN at USD1.50/month or USD15/year.",
    "trial": "No trial needed for free software; external hosting/provider trial terms were not verified.",
    "features": "Envelope budgets, split transactions, rules, net-worth and cash-flow reports, custom reports.",
    "fit": "Privacy-conscious, hands-on budgeters comfortable choosing hosting and bank services.",
    "caveat": "GoCardless is not accepting new accounts; provider coverage and fees vary.",
    "sources": [
      {
        "label": "Official repository and installation",
        "url": "https://github.com/actualbudget/actual/"
      },
      {
        "label": "Local-first budgeting",
        "url": "https://actualbudget.org/"
      },
      {
        "label": "Supported bank providers and token security",
        "url": "https://actualbudget.org/docs/advanced/bank-sync/"
      },
      {
        "label": "Transaction imports",
        "url": "https://actualbudget.org/docs/transactions/importing/"
      },
      {
        "label": "SimpleFIN pricing",
        "url": "https://actualbudget.org/docs/advanced/bank-sync/simplefin/"
      }
    ]
  },
  {
    "id": "credit-karma",
    "name": "Credit Karma",
    "kind": "Credit tools plus personal-finance tracking.",
    "origin": "Founded in 2007 in San Francisco, United States; now Intuit Credit Karma.",
    "countries": "Verified finance-tracking offering is the US experience, advertising 12,000+ institutions. Canadian/UK feature parity was not verified.",
    "india": "Indian eligibility and Indian bank connections were not verified; do not present as India-supported.",
    "tracking": "Linked accounts update daily with automatic transaction categorization and spending summaries.",
    "storage": "Hosted online service with encryption in transit and at rest. Its security statement restricts sale/sharing with unaffiliated parties for their own marketing; personalized recommendations use member data.",
    "platforms": "Web, iOS and Android.",
    "price": "Finance-tracking service USD0/month and USD0/year.",
    "trial": "No paid trial required for the free tracking service.",
    "features": "Spending, transactions, net worth, recurring bills and Left After Bills, alongside credit scores and monitoring.",
    "fit": "Free financial overview combined with credit visibility.",
    "caveat": "Personal-finance features are distinct from credit reporting; do not assume full Mint budgeting parity or identical international features.",
    "sources": [
      {
        "label": "Company history",
        "url": "https://www.creditkarma.com/about"
      },
      {
        "label": "US origin background",
        "url": "https://www.creditkarma.com/res/docs/CK_overview.pdf"
      },
      {
        "label": "Free finance tracking and bank coverage",
        "url": "https://www.creditkarma.com/cash-flow"
      },
      {
        "label": "Security and privacy",
        "url": "https://www.creditkarma.com/about/security"
      },
      {
        "label": "Platforms",
        "url": "https://www.creditkarma.com/credit/i/credit-karma-app"
      }
    ]
  },
  {
    "id": "empower",
    "name": "Empower Personal Dashboard",
    "kind": "Free financial aggregation and investment dashboard.",
    "origin": "Former Personal Capital dashboard, transitioned to Empower branding; original founding details were not verified.",
    "countries": "Linked accounts support US-based institutions in USD only; signup requires a valid US phone number.",
    "india": "Indian institutions are not supported for linking; international assets can be represented manually, subject to signup eligibility.",
    "tracking": "Aggregates linked bank, investment and credit accounts; manual accounts cover unsupported assets.",
    "storage": "Hosted data centers with AES-256 encryption for credentials and personal data, plus device verification/two-factor authentication.",
    "platforms": "Web and mobile app; individual mobile OS support was not independently verified.",
    "price": "Dashboard: USD0. Separate investment advisory fees are not a Dashboard subscription; consult advisory terms.",
    "trial": "Dashboard is free rather than a time-limited trial.",
    "features": "Net worth, spending/cash flow, portfolio analysis and retirement scenarios.",
    "fit": "Investment and net-worth oversight rather than detailed envelope budgeting.",
    "caveat": "Free Dashboard and paid advisory services are separate products; advisory fees are not a Dashboard subscription.",
    "sources": [
      {
        "label": "Personal Capital transition and free dashboard",
        "url": "https://www.empower.com/empower-personal-wealth-transition"
      },
      {
        "label": "Dashboard features",
        "url": "https://www.empower.com/tools"
      },
      {
        "label": "US-only linked institutions and signup requirements",
        "url": "https://support-personalwealth.empower.com/hc/en-us/articles/201169680-Can-I-link-an-international-account-in-Empower-Personal-Dashboard"
      },
      {
        "label": "Dashboard security",
        "url": "https://support-personalwealth.empower.com/hc/en-us/articles/201169540-Multiple-Layers-of-Security"
      },
      {
        "label": "Separate advisory pricing",
        "url": "https://www.empower.com/products-solutions/investment-accounts"
      }
    ]
  },
  {
    "id": "mint",
    "name": "Mint",
    "kind": "Discontinued personal-finance service; historical entry only.",
    "origin": "Mountain View, California service acquired by Intuit in 2009; Intuit identifies Aaron Patzer as founder.",
    "countries": "No current availability; historical country coverage was not verified from official archival sources.",
    "india": "No current service; historical Indian bank support was not verified.",
    "tracking": "Historically aggregated online accounts and categorized transactions for financial tracking.",
    "storage": "Historical online service; archival storage jurisdiction, retention and privacy details were not verified.",
    "platforms": "No live platform; historical platform coverage was not fully verified.",
    "price": "Current monthly/yearly pricing is not applicable; historical pricing was not verified.",
    "trial": "Not applicable: discontinued.",
    "features": "Historical spending, net-worth tracking, transaction categorization and financial goals.",
    "fit": "Historical comparisons and migration context only.",
    "caveat": "Historical entry only — no current signup. Intuit directs former users to Credit Karma; do not assume complete Mint feature parity.",
    "status": "discontinued",
    "sources": [
      {
        "label": "Current Mint retirement landing page",
        "url": "https://mint.intuit.com/"
      },
      {
        "label": "Intuit acquisition and US location",
        "url": "https://investors.intuit.com/news-events/press-releases/detail/1005/intuit-completes-acquisition-of-mint-com"
      },
      {
        "label": "Historical goals and founder",
        "url": "https://investors.intuit.com/news-events/press-releases/detail/880/paying-off-debt-made-easier-with-mint-com"
      },
      {
        "label": "Migration announcement",
        "url": "https://www.creditkarma.com/about/releases/intuit-credit-karma-welcomes-all-minters"
      }
    ]
  },
  {
    "id": "rocket-money",
    "name": "Rocket Money",
    "kind": "Subscription management and personal-finance tracking.",
    "origin": "US company founded in 2015 as Truebill by the Mokhtarzada brothers; acquired in 2021 and renamed in 2022.",
    "countries": "Official FAQ describes Plaid connectivity to 12,000+ US institutions; non-US eligibility was not conclusively verified.",
    "india": "Indian eligibility and bank connections were not verified; do not present as India-supported.",
    "tracking": "Linked transactions support spending categorization, recurring-charge detection and subscription tracking.",
    "storage": "Hosted service with TLS/AES-256 protection. Rocket Money says bank credentials go directly to Plaid rather than being stored by Rocket Money.",
    "platforms": "Web and mobile app; individual mobile OS support was not separately verified.",
    "price": "Free tier USD0; Premium generally USD7–14/month with platform/offer variability; Premium+ USD15/month plus tax. Universal annual-plan pricing was not verified.",
    "trial": "New Premium members are advertised a 7-day free trial; eligibility depends on signup terms.",
    "features": "Subscriptions, spending reviews, paid cancellation assistance, budgeting, savings goals and enhanced financial tracking.",
    "fit": "Identifying recurring charges and simplifying subscription management.",
    "caveat": "Paid features and prices vary by tier/platform; bill-negotiation charges and eligibility require current terms verification.",
    "sources": [
      {
        "label": "Company origin and rebrand",
        "url": "https://www.rocketmoney.com/press-inquiries"
      },
      {
        "label": "Features, bank coverage and security",
        "url": "https://www.rocketmoney.com/faq"
      },
      {
        "label": "Pricing tiers",
        "url": "https://www.rocketmoney.com/learn/personal-finance/how-much-does-rocket-money-cost"
      },
      {
        "label": "Pricing variability and trial",
        "url": "https://help.rocketmoney.com/en/articles/2217739-how-much-does-rocket-money-cost"
      }
    ]
  },
  {
    "id": "simplifi",
    "name": "Quicken Simplifi",
    "kind": "Paid cloud household budgeting and financial tracking.",
    "origin": "Quicken product; precise launch date and origin country were not verified.",
    "countries": "Designed for the US and Canada and their financial accounts; advertises 14,000+ institutions.",
    "india": "Indian bank connections are outside the documented US/Canada scope; overseas sign-in may encounter restrictions.",
    "tracking": "Automatic account imports and categorization, with manual asset/liability accounts.",
    "storage": "Cloud-based; Quicken identifies AWS hosting and encryption in transit and at rest. Not local-only Quicken Classic.",
    "platforms": "Web browser, iOS and Android.",
    "price": "Standard USD6.99/month equivalent billed annually, USD83.88/year. Advertised USD3.99/month equivalent is promotional; standalone monthly billing was not verified.",
    "trial": "30-day money-back guarantee, not a verified free trial; purchase-channel conditions apply.",
    "features": "Spending Plan, bills/subscriptions, projected cash flow, reports, net worth and investments.",
    "fit": "General-purpose household budgeting with automated account aggregation.",
    "caveat": "Verify institution support and renewal price; promotional monthly equivalents should not be represented as monthly billing.",
    "sources": [
      {
        "label": "Features and advertised pricing",
        "url": "https://www.quicken.com/products/simplifi"
      },
      {
        "label": "Countries and platforms",
        "url": "https://support.simplifi.quicken.com/en/articles/3363727-quicken-simplifi-subscription-questions"
      },
      {
        "label": "Aggregation and manual accounts",
        "url": "https://www.quicken.com/features/aggregation/"
      },
      {
        "label": "Cloud security",
        "url": "https://www.quicken.com/privacy-us/security-privacy-practices/"
      },
      {
        "label": "Money-back guarantee",
        "url": "https://www.quicken.com/support/Terms-and-Conditions-For-Exchanging-Canceling-or-Refunding-Quicken-Products/"
      }
    ]
  }
];

export const PEER_IDS = COMPARISON_PEERS.map(app => app.id);
