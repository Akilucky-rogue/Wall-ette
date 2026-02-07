import Anthropic from "@anthropic-ai/sdk";

const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || '';

// Initialize Claude client
let client: Anthropic | null = null;
if (apiKey) {
  client = new Anthropic({ apiKey });
}

// ═══════════════════════════════════════════════════════════════
// TYPES (from geminiService for compatibility)
// ═══════════════════════════════════════════════════════════════

interface RawTransaction {
    date: string;
    merchant: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    mode?: string;
    nature?: string;
    category?: string;
    incomeSource?: string;
    note?: string;
}

interface StatementHeader {
    bankName?: string;
    accountNumber?: string;
    statementPeriod?: { from: string; to: string };
    openingBalance: number;
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
}

function safeParseJSON(jsonString: string): RawTransaction[] {
    try {
        const parsed = JSON.parse(jsonString);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((tx: any) => ({
            date: tx.date || '',
            merchant: tx.merchant || 'Unknown',
            amount: parseFloat(tx.amount) || 0,
            type: (tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as const,
            mode: tx.mode,
            nature: tx.nature,
            category: tx.category,
            incomeSource: tx.incomeSource,
            note: tx.note
        }));
    } catch (error) {
        console.error('JSON parse error:', error);
        return [];
    }
}

function convertBase64ToPNG(base64Data: string): string {
    // Already in base64, just return with proper prefix
    if (base64Data.startsWith('data:image')) {
      return base64Data;
    }
    // Detect image type from content or default to jpeg
    return `data:image/jpeg;base64,${base64Data}`;
}

// ═══════════════════════════════════════════════════════════════
// CLAUDE BANK STATEMENT PARSER
// ═══════════════════════════════════════════════════════════════

export const parseBankStatement = async (data: string, mimeType: string): Promise<RawTransaction[]> => {
    if (!client) throw new Error("Claude API key not configured. Set VITE_CLAUDE_API_KEY");

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    let transactions: RawTransaction[] = [];

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`🤖 Claude attempt ${attempt}/${MAX_RETRIES}...`);

            let messageContent: Array<{ type: string; text?: string; source?: any }> = [];

            // Prepare content based on mime type
            if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
                // For PDFs and images, send as base64
                const mediaType = mimeType === 'application/pdf' 
                    ? 'application/pdf' 
                    : mimeType.startsWith('image/') 
                    ? mimeType 
                    : 'image/jpeg';

                messageContent.push({
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: mediaType,
                        data: data
                    }
                });
            } else if (mimeType === 'text/csv' || mimeType === 'text/plain') {
                // For CSV/text, send as text
                messageContent.push({
                    type: "text",
                    text: data
                });
            } else {
                // Try to detect - assume it's text data (Excel converted to text)
                messageContent.push({
                    type: "text",
                    text: data
                });
            }

            // Add instruction prompt
            const prompt = attempt === 1 
                ? `Extract all transactions from this bank statement. Return ONLY valid JSON array.
                   
For each transaction, extract:
- date (YYYY-MM-DD format)
- merchant (transaction description/recipient)
- amount (numeric value)
- type ('INCOME' or 'EXPENSE')
- category (Salary, Groceries, Transport, Bills, Transfer, ATM, Shopping, etc.)
- note (transaction description)

Return as valid JSON array only, no other text:
[{"date":"2024-01-15","merchant":"Store Name","amount":5000,"type":"EXPENSE","category":"Shopping","note":"Purchase details"}]`
                : `Extract ALL transactions. Be less strict about format but maintain JSON structure. Return complete list:
                   
[{"date":"YYYY-MM-DD","merchant":"name","amount":number,"type":"INCOME"|"EXPENSE","category":"category","note":"details"}]`;

            messageContent.push({
                type: "text",
                text: prompt
            });

            const response = await client!.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 4096,
                messages: [
                    {
                        role: "user",
                        content: messageContent as Anthropic.ContentBlockParam[]
                    }
                ]
            });

            const responseText = response.content[0].type === 'text' 
                ? response.content[0].text 
                : '';

            console.log(`📄 Response length: ${responseText.length} chars`);

            // Parse JSON from response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                transactions = safeParseJSON(jsonMatch[0]);
                
                if (transactions.length > 0) {
                    console.log(`✅ Claude successfully extracted ${transactions.length} transactions on attempt ${attempt}`);
                    break;
                }
            }
        } catch (error: any) {
            lastError = error;
            console.warn(`⚠️ Claude attempt ${attempt} failed:`, error.message);
            
            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    if (transactions.length === 0) {
        throw lastError || new Error("Failed to parse bank statement with Claude after multiple attempts");
    }

    return transactions;
};

// ═══════════════════════════════════════════════════════════════
// SPENDING ANALYSIS
// ═══════════════════════════════════════════════════════════════

export const analyzeSpendingHabits = async (transactionsContext: string) => {
    if (!client) return "Claude API not configured.";
    
    try {
        const response = await client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 500,
            system: "You are a mindful financial assistant. Keep responses short, calming, and insightful.",
            messages: [
                {
                    role: "user",
                    content: `Analyze these spending habits and provide a brief, mindful insight: ${transactionsContext}`
                }
            ]
        });

        return response.content[0].type === 'text' ? response.content[0].text : "Unable to generate insights.";
    } catch (error) {
        console.error("Claude API Error:", error);
        return "Unable to generate insights at this moment.";
    }
};

// ═══════════════════════════════════════════════════════════════
// CATEGORIZATION
// ═══════════════════════════════════════════════════════════════

export const categorizeTransaction = async (description: string) => {
    if (!client) return "Uncategorized";
    
    try {
        const response = await client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 50,
            messages: [
                {
                    role: "user",
                    content: `Categorize this transaction into ONE word category only (e.g., Groceries, Transport, Entertainment, Utilities): ${description}`
                }
            ]
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : "Uncategorized";
        return text.trim();
    } catch (error) {
        console.error("Claude categorization error:", error);
        return "Uncategorized";
    }
};

export default { parseBankStatement, analyzeSpendingHabits, categorizeTransaction };
