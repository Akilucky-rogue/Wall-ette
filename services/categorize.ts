// ═══════════════════════════════════════════════════════════════
// TRANSACTION CATEGORIES — one rule set for every statement format
// ═══════════════════════════════════════════════════════════════
//
// The PDF and Excel parsers both file rows through these two functions, so a
// statement row lands in the same category whichever format was imported
// (audit H2). Moved unchanged from IDFCBankParser. Every name returned here must
// be on CATEGORIES in types.ts; the return type makes tsc check that (M10).

import type { Category } from '../types';

export type RowDirection = 'income' | 'expense';

/**
 * Brokers and investment platforms, matched on a lower-cased narration. Debits
 * to them are filed as Investment; services/spend.ts also treats credits from
 * them as money moved, not income.
 */
export const INVESTMENT_PLATFORM = /zerodha|groww|kuvera|paytm.?money|coin.?zerodha|angel.?broking|motilaloswal|hdfc.?sec|icicidirect|upstox|trftochoice|choice.?equity|razorpaytp.*choice/;

/**
 * Clean up a statement narration: collapse whitespace and drop punctuation,
 * keeping - / @ . : for UPI IDs and transfer references.
 */
export function cleanNarration(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-\/@.:]/g, '') // Keep @, ., :, / for UPI IDs and transfer references
    .trim();
}

/**
 * Categorize a statement row from its cleaned narration, with comprehensive
 * Indian merchant/UPI patterns.
 */
export function categorizeNarration(description: string, type: RowDirection): Category {
  const desc = description.toLowerCase();

  // ── INCOME categories ────────────────────────────────────────────────────
  if (type === 'income') {
    if (desc.match(/\bsal\b|salary|payroll|stipend|ctc/)) return 'Salary';
    if (desc.match(/bonus|incentive|reward|cashback|cb\b/)) return 'Bonus';
    if (desc.match(/dividend|mutual.?fund|\bmf\b|sip.?return|nav/)) return 'Investment Returns';
    if (desc.match(/interest|fd.?int|recurring.?dep|int.?cr/)) return 'Interest Income';
    if (desc.match(/refund|reversal|chargeback|return|rfd/)) return 'Refunds';
    if (desc.match(/freelance|invoice|consulting|payment.?received/)) return 'Freelance';
    if (desc.match(/rent.?received|rental.?income/)) return 'Rental Income';
    // Generic transfers in — keep as last resort
    return 'Transfer In';
  }

  // ── EXPENSE: Food & Dining ───────────────────────────────────────────────
  if (desc.match(/zomato|swiggy|dunzo|magicpin|eatsure|box8|freshmenu|rebel.?foods/))
    return 'Food Delivery';
  if (desc.match(/dominos|dominoes|pizza.?hut|kfc|mcdonalds|mcd\b|burger.?king|subway|starbucks|cafe.?coffee|ccd\b|barista|chaayos|naturals.?ice/))
    return 'Dining';
  if (desc.match(/restaurant|dhaba|hotel.?food|biryani|thali|mess\b|canteen|cafeteria/))
    return 'Dining';

  // ── EXPENSE: Groceries ───────────────────────────────────────────────────
  if (desc.match(/blinkit|zepto|bigbasket|big.?basket|jiomart|milkbasket|supr.?daily|grofers|instamart/))
    return 'Groceries';
  if (desc.match(/dmart|d.?mart|reliance.?fresh|reliance.?smart|more.?supermarket|spencers|star.?bazaar|lulu.?mart|nature.?basket/))
    return 'Groceries';
  if (desc.match(/\bgrocery\b|kirana|provision|supermarket|hypermarket/))
    return 'Groceries';

  // ── EXPENSE: Transport ───────────────────────────────────────────────────
  if (desc.match(/uber|ola.?cab|rapido|meru|taxi\b|cab\b/))
    return 'Taxi & Cab';
  if (desc.match(/irctc|indian.?railway|railway|train.?ticket/))
    return 'Train';
  if (desc.match(/\bair\b.*ticket|airline|indigo|air.?india|spicejet|vistara|goair|akasa|flight/))
    return 'Flights';
  if (desc.match(/metro|dmrc|bmrc|nmrc|cmrl|smartcard.?recharge/))
    return 'Metro';
  if (desc.match(/petrol|fuel|hpcl|bpcl|iocl|indian.?oil|hp.?pump|shell.?pump/))
    return 'Fuel';
  if (desc.match(/parking|fastag|toll|highway/))
    return 'Transport';
  if (desc.match(/bus\b|ksrtc|msrtc|apsrtc|tsrtc|redbus/))
    return 'Transport';

  // ── EXPENSE: Shopping ────────────────────────────────────────────────────
  if (desc.match(/amazon|flipkart|myntra|ajio|meesho|nykaa|tatacliq|tata.?cliq|snapdeal|shopsy|jiomart.?shop/))
    return 'Online Shopping';
  if (desc.match(/\bh&m\b|zara|uniqlo|westside|max.?fashion|pantaloons|lifestyle|shoppers.?stop|trends\b/))
    return 'Clothing';
  if (desc.match(/apple.?store|croma|vijay.?sales|reliance.?digital|samsung|oneplus|laptop|mobile.?purchase/))
    return 'Electronics';
  if (desc.match(/ikea|pepperfry|urban.?ladder|hometown|furniture/))
    return 'Furniture';

  // ── EXPENSE: Entertainment ───────────────────────────────────────────────
  if (desc.match(/netflix|hotstar|disney\+|zee5|sonyliv|jiocinema|primevideo|amazon.?prime|hulu|apple.?tv/))
    return 'Streaming';
  if (desc.match(/spotify|gaana|wynk|jiosaavn|apple.?music|youtube.?premium/))
    return 'Music';
  if (desc.match(/bookmyshow|pvr|inox|cinepolis|movie.?ticket/))
    return 'Movies';
  if (desc.match(/steam\b|playstation|xbox|nintendo|game\b|gaming/))
    return 'Games';

  // ── EXPENSE: Telecom ─────────────────────────────────────────────────────
  if (desc.match(/jio\b|airtel|bsnl|\bvi\b|vodafone|idea.?vodafone|tata.?docomo|recharge|mobile.?bill|postpaid/))
    return 'Phone & Internet';
  if (desc.match(/jiofib|hathway|act.?fibre|you.?broadband|airtel.?fiber|broadband|internet.?bill/))
    return 'Phone & Internet';

  // ── EXPENSE: Utilities ───────────────────────────────────────────────────
  if (desc.match(/electricity|bescom|mseb|tata.?power|adani.?elec|torrent.?power|bwssb|water.?bill|piped.?gas|mgl\b|igl\b|adani.?gas/))
    return 'Utilities';
  if (desc.match(/gas.?bill|lpg|cooking.?gas|indane|hp.?gas|bharat.?gas/))
    return 'Utilities';

  // ── EXPENSE: Housing ─────────────────────────────────────────────────────
  if (desc.match(/\brent\b|rental|lease|maintenance.?society|society.?maint|housing.?society|apartment/))
    return 'Rent';

  // ── EXPENSE: Healthcare ──────────────────────────────────────────────────
  if (desc.match(/pharmeasy|1mg|apollo.?pharma|medplus|netmeds|tata.?1mg|pharmacy|medical.?store/))
    return 'Pharmacy';
  if (desc.match(/hospital|clinic|doctor|dr\.\s|consultant.?fee|apollo\b|fortis|manipal|max.?hospital|aiims/))
    return 'Doctor & Hospital';
  if (desc.match(/diagnostic|lab.?test|blood.?test|thyrocare|srl.?diagnost|lal.?path/))
    return 'Healthcare';

  // ── EXPENSE: Insurance ───────────────────────────────────────────────────
  if (desc.match(/lic\b|hdfc.?life|icici.?pru|sbi.?life|max.?life|bajaj.?allianz|tata.?aia|insurance|premium.?due/))
    return 'Insurance';
  if (desc.match(/health.?insur|car.?insur|bike.?insur|term.?plan/))
    return 'Insurance';

  // ── EXPENSE: Investments ─────────────────────────────────────────────────
  if (INVESTMENT_PLATFORM.test(desc))
    return 'Investment';
  if (desc.match(/mutual.?fund|\bsip\b|\bmf\b|nfo\b|nav\b|demat/))
    return 'Investment';
  if (desc.match(/fd\b|fixed.?deposit|recurring.?deposit|\brd\b/))
    return 'Investment';

  // ── EXPENSE: Loans & EMI ─────────────────────────────────────────────────
  if (desc.match(/\bemi\b|loan.?emi|equated|home.?loan|car.?loan|personal.?loan|education.?loan|hl\b|pl\b/))
    return 'Loan & EMI';
  if (desc.match(/credit.?card.?bill|cc.?payment|card.?due|amex|hdfc.?cc|sbi.?card/))
    return 'Credit Card';

  // ── EXPENSE: Education ───────────────────────────────────────────────────
  if (desc.match(/school.?fee|college.?fee|tuition|coaching|byju|unacademy|vedantu|coursera|udemy|upgrad/))
    return 'Education';

  // ── EXPENSE: Personal Care ───────────────────────────────────────────────
  if (desc.match(/salon|spa\b|haircut|beauty|nykaa.?fashion|mamaearth|wow.?skin/))
    return 'Personal Care';

  // ── EXPENSE: ATM / Cash ──────────────────────────────────────────────────
  if (desc.match(/\batm\b|cash.?withdrawal|cwl\b/))
    return 'Cash Withdrawal';

  // ── EXPENSE: Subscriptions ───────────────────────────────────────────────
  if (desc.match(/subscription|renewal|annual.?plan|membership/))
    return 'Subscriptions';
  if (desc.match(/gym\b|fitness|cult.?fit|gold.?gym|anytime.?fitness/))
    return 'Gym';

  // ── EXPENSE: Transfers (classify last — very broad) ──────────────────────
  if (desc.match(/\bneft\b|\brtgs\b|\bimps\b|\bift\b|\bupi\b/))
    return 'Transfer Out';

  return 'Other';
}
