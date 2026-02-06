# WALL-E Wallet App - Complete Documentation

## 📱 Project Overview

**WALL-E** is a personal finance tracking app built with React + TypeScript + Firebase, featuring AI-powered bank statement parsing.

---

## 🏗️ Architecture

```
wall-et/
├── App.tsx                 # Main app component with routing
├── index.tsx               # Entry point
├── types.ts                # TypeScript interfaces
├── currencyUtils.ts        # Currency formatting
├── capacitor.config.ts     # Android/iOS config
├── components/
│   ├── Auth.tsx            # Login/Register
│   ├── Dashboard.tsx       # Main dashboard
│   ├── TransactionHistory.tsx  # Vault - view/edit/delete transactions
│   ├── NewEntry.tsx        # Manual transaction entry
│   ├── ImportStatement.tsx # PDF/Excel import with AI parsing
│   ├── SpendAnalysis.tsx   # Spending analytics (Pulse)
│   ├── IncomeInsights.tsx  # Income tracking
│   ├── CategorySplit.tsx   # Category breakdown
│   ├── ExportReports.tsx   # Export to CSV/PDF
│   ├── Profile.tsx         # User settings
│   ├── SecurityLock.tsx    # PIN/biometric lock
│   ├── IgnoreRules.tsx     # Transaction filtering rules
│   ├── CurrencySelector.tsx # Multi-currency support
│   └── Navigation.tsx      # Bottom navigation
├── context/
│   ├── AuthContext.tsx     # Firebase auth state
│   └── WalletContext.tsx   # Transaction state + Firestore
├── services/
│   ├── firebase.ts         # Firebase config
│   ├── geminiService.ts    # Google Gemini AI (cloud)
│   └── ollamaService.ts    # Ollama AI (local/offline)
└── android/                # Capacitor Android project
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript |
| Build | Vite 6 |
| Backend | Firebase Auth + Firestore |
| AI (Cloud) | Google Gemini 2.0 Flash |
| AI (Local) | Ollama (qwen3-vl + deepseek-r1) |
| PDF Parsing | pdfjs-dist |
| Excel Parsing | xlsx |
| Mobile | Capacitor (Android/iOS) |

---

## 🤖 AI Parsing Pipeline

### Two-Model Architecture (Ollama Local)

```
┌─────────────────────────────────────────────────────────────┐
│  STEP A: Extract Header (Opening/Closing/Totals)            │
│  Model: qwen3-vl:8b (Vision)                                │
├─────────────────────────────────────────────────────────────┤
│  STEP B: Extract Transactions (Page by Page)                │
│  Model: qwen3-vl:8b (Vision - sees table columns)           │
├─────────────────────────────────────────────────────────────┤
│  STEP C: Validate Totals (Parsed vs Header)                 │
│  Logic: Auto-swap if types appear reversed                  │
├─────────────────────────────────────────────────────────────┤
│  STEP D: DeepSeek-R1 Math Verification                      │
│  Model: deepseek-r1:8b (Chain-of-Thought reasoning)         │
│  - Verifies: Opening + Credit - Debit = Closing             │
│  - Identifies misclassified transactions                    │
│  - Suggests corrections with reasoning                      │
└─────────────────────────────────────────────────────────────┘
```

### Hybrid Mode (Auto-Fallback)

| Mode | When | Indicator |
|------|------|-----------|
| 🦙 Ollama (Local) | Ollama running + models installed | Green banner |
| ☁️ Gemini (Cloud) | Ollama not available | Blue banner |

### Transaction Classification (STEP C)

```typescript
type TransactionNature = 
  | 'CONSUMPTION'        // Merchant spending (Zomato, Amazon)
  | 'TRANSFER'           // Bank transfers (NEFT, IMPS, UPI)
  | 'CASH_OUT'           // ATM withdrawals
  | 'INVESTMENT_INFLOW'  // Credits from brokers
  | 'INVESTMENT_OUTFLOW' // Debits to brokers
  | 'INVESTMENT_RETURN'  // MF redemptions, dividends
  | 'PASSIVE_INCOME'     // Interest, cashback
  | 'SALARY'             // Salary credits
  | 'UNCATEGORIZED';     // Needs user classification
```

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project
- (Optional) Ollama for local AI
- (Optional) Android Studio for APK

### 1. Install Dependencies
```bash
cd wall-et
npm install
```

### 2. Configure Firebase
Create `.env` file:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Run Locally
```bash
npm run dev
```
Open http://localhost:8080

---

## 🦙 Ollama Setup (Optional - Local AI)

### Install Ollama
```powershell
winget install Ollama.Ollama
```

### Add to PATH
```powershell
$env:Path += ";C:\Users\9787080\AppData\Local\Programs\Ollama"
```

### Pull Models
```powershell
# Vision model - sees PDF tables directly (RECOMMENDED)
ollama pull qwen3-vl:8b

# Math model - chain-of-thought verification
ollama pull deepseek-r1:8b

# Alternative smaller models
ollama pull qwen2.5:7b
ollama pull llama3.2:3b
```

### Start Ollama Server
```powershell
ollama serve
```

### Model Comparison

| Model | Size | Best For | VRAM |
|-------|------|----------|------|
| `qwen3-vl:8b` | ~6GB | PDF vision extraction | 8GB |
| `qwen2.5-vl:7b` | ~5GB | PDF vision (older) | 6GB |
| `deepseek-r1:8b` | ~5GB | Math verification | 6GB |
| `qwen2.5:7b` | ~4GB | Text extraction | 6GB |
| `llama3.2:3b` | ~2GB | Fast/light fallback | 4GB |

---

## 📱 Android APK Build

### 1. Build & Sync
```bash
npm run android
```

### 2. Open in Android Studio
```bash
npm run android:open
```

### 3. Build APK
```bash
npm run android:build
```

### 4. Find APK
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Available Scripts
```json
{
  "android": "npm run build && npx cap sync android",
  "android:open": "npx cap open android",
  "android:build": "npm run android && cd android && .\\gradlew assembleDebug",
  "android:release": "npm run android && cd android && .\\gradlew assembleRelease"
}
```

---

## 🔥 Firebase Deployment

### Deploy to Firebase Hosting
```bash
npm run build
npx firebase deploy --only hosting
```

### Live URL
https://wall-e-7a113.web.app

---

## ✏️ Key Features

### 1. Transaction Management
- ✅ Add manual transactions
- ✅ Import from PDF/Excel bank statements
- ✅ Edit transactions in Vault
- ✅ Delete transactions
- ✅ Clear all history
- ✅ Export to CSV

### 2. AI Parsing
- ✅ IDFC FIRST Bank statement support
- ✅ Automatic categorization
- ✅ Income/Expense detection
- ✅ Duplicate detection (flagged, not removed)
- ✅ Statement header validation
- ✅ Math verification with DeepSeek-R1

### 3. Analytics
- ✅ Spending breakdown by category
- ✅ Income insights
- ✅ Monthly trends
- ✅ Category split visualization

### 4. Security
- ✅ Firebase Authentication
- ✅ PIN lock
- ✅ Per-user data isolation

### 5. Multi-Currency
- ✅ INR, USD, EUR, GBP support
- ✅ Real-time conversion

---

## 📊 Bank Statement Format (IDFC FIRST)

The parser expects this column structure:

| Date | Value Date | Particulars | Chq No | Withdrawal(Dr) | Deposit(Cr) | Balance |
|------|------------|-------------|--------|----------------|-------------|---------|

### Key Rules
- Amount in **Withdrawal (Dr)** column → `EXPENSE`
- Amount in **Deposit (Cr)** column → `INCOME`
- Salary credits → Always `INCOME`
- ATM withdrawals → Always `EXPENSE`
- Refunds/Cashback → Always `INCOME`

---

## 🐛 Troubleshooting

### Ollama Not Connecting
```powershell
# Check if running
curl http://localhost:11434/api/tags

# Start server
ollama serve

# Check installed models
ollama list
```

### Model Download Failing
- Check network/proxy settings
- Try smaller model: `ollama pull qwen3:1b`
- Download manually from https://ollama.com/library

### Build Errors
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Android Studio Not Found
```powershell
# Set environment variable
$env:CAPACITOR_ANDROID_STUDIO_PATH = "C:\Program Files\Android\Android Studio\bin\studio64.exe"
```

---

## 📝 API Reference

### WalletContext Functions
```typescript
const {
  transactions,           // All transactions
  addTransaction,         // Add new transaction
  editTransaction,        // Edit existing (id, updates)
  deleteTransaction,      // Delete by ID
  clearAllTransactions,   // Delete all
  formatAmount,           // Format with currency
} = useWallet();
```

### Ollama Service Exports
```typescript
import {
  parseBankStatement,     // Main parser
  checkOllamaStatus,      // Check connection
  analyzeSpendingHabits,  // AI insights
  categorizeTransaction,  // Single categorization
} from './services/ollamaService';
```

### Gemini Service Exports
```typescript
import {
  parseBankStatement,     // Main parser
  analyzeSpendingHabits,  // AI insights
  categorizeTransaction,  // Single categorization
} from './services/geminiService';
```

---

## 📅 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Feb 2026 | Initial release with Gemini parsing |
| 1.1.0 | Feb 2026 | Added Ollama local support |
| 1.2.0 | Feb 2026 | Two-model pipeline (Vision + Math) |
| 1.3.0 | Feb 2026 | Edit transaction feature |
| 1.4.0 | Feb 2026 | Android APK support |

---

## 🔗 Resources

- **Firebase Console**: https://console.firebase.google.com/project/wall-e-7a113
- **Live App**: https://wall-e-7a113.web.app
- **Ollama**: https://ollama.com
- **Gemini API**: https://ai.google.dev
- **Capacitor**: https://capacitorjs.com

---

## 📞 Quick Commands Reference

```powershell
# Development
npm run dev              # Start dev server (localhost:8080)
npm run build            # Production build

# Firebase
npx firebase deploy --only hosting   # Deploy to web

# Android
npm run android          # Build + sync to Android
npm run android:open     # Open Android Studio
npm run android:build    # Build debug APK

# Ollama
$env:Path += ";C:\Users\9787080\AppData\Local\Programs\Ollama"
ollama serve             # Start server
ollama list              # List models
ollama pull qwen3-vl:8b  # Download model
```

---

*Documentation generated: February 6, 2026*
