# Wall-ette 🌿

**A mindful, aesthetic wallet tracker built with React, Firebase, and Firestore for seamless real-time sync.**

Wall-ette (Wallet & Assets Logic / Living Economy) brings peace of mind to personal finance with Zen design, robust security, and AI-powered automation.

**🌍 LIVE APP**: https://wall-e-7a113.web.app  
**STATUS**: ✅ Production Deployed | ✅ Fully Secured | ✅ Real-time Sync

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg?logo=tailwind-css)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-FFCA28.svg?logo=firebase)
![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF.svg?logo=capacitor)

## ✨ Key Features

### 🛡️ Security & Privacy
*   **Session Security**: Automatic application lock after 15 minutes of inactivity (and on backgrounding, on Android).
*   **Authentication**: Secure Firebase Email/Password login.
*   **Password Reset & Recovery**: Anti-enumeration reset flow at login, recovery from the lock screen, and in-app password change (re-authentication + strength rules).
*   **Biometric Unlock**: Real fingerprint/face unlock on Android (cold start + session lock) with PIN/pattern fallback. Authenticator-app 2FA (TOTP) is built and parked as "Coming Soon".
*   **Daily Limits**: Set daily spending limits with real-time blocking and alerts.
*   **Security Logs**: Tracks login attempts and unlocking methods (Password/Bio/MFA).

### 📄 Statement Import (rule-based, no AI, no network)
*   **Smart Import**: Upload IDFC FIRST Bank statements as PDF or Excel.
    *   Deterministic rule-based parsers (`services/idfcParser.ts`, `services/IDFCBankParser.ts`) with balance validation against statement totals.
    *   Automatic merchant categorization via comprehensive Indian merchant/UPI patterns.
    *   Duplicate detection against existing transactions at review time.
*   **Mindful Insights**: Fully local analysis (`services/insightsService.ts`) — savings rate, anomalies, budget suggestions. No API keys, nothing leaves the device.

### 📊 Financial Analytics
*   **Spend Analysis**: Visual breakdown of expenses by category (Groceries, Transport, etc.).
*   **Income Insights**: Stability analysis of income streams (Consistency Tiers).
*   **Pulse**: Weekly spending trends visualization.
*   **Category Split**: Conic gradient visualization of expense distribution.

### 🧘 Zen UX/UI
*   **Aesthetic**: Custom color palette (Sage, Rose, Sand, Charcoal) designed for visual comfort.
*   **Haptic & Visual Feedback**: Smooth transitions, backdrop blurs, and intuitive navigation.
*   **Offline First**: Works offline with local storage fallback and auto-syncs when online.

---

## 🛠️ Tech Stack

*   **Frontend**: React 19, Vite
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS (Custom Configuration)
*   **Backend**: Firebase (Authentication, Firestore with offline persistent cache)
*   **Mobile**: Capacitor 8 (Android)
*   **Data Handling**: `xlsx` for spreadsheet parsing, `pdfjs-dist` for PDF text extraction (worker bundled locally).

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   A Firebase Project (Authentication + Firestore). No AI/API keys are needed.

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Akilucky-rogue/Wall-ette.git
    cd Wall-ette
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    No environment variables are required — the app makes no external AI calls.
    Remember that any `VITE_*` variable is inlined into the client bundle and
    visible to every user; never put secrets in `.env` files here.

    *Note: The current build includes a pre-configured Firebase setup in `services/firebase.ts` (Firebase web config values are public identifiers, secured by Firestore Rules). For production, replace them with your own project's config.*

4.  **Run the Application**
    ```bash
    npm run dev
    ```
    Open `http://localhost:8080` in your browser.

---

## 📂 Project Structure

```text
/
├── components/          # UI Components
│   ├── Dashboard.tsx    # Main Hub
│   ├── SecurityLock.tsx # Inactivity/Auth Lock Screen
│   ├── ImportStatement.tsx # Statement import & review flow
│   ├── Profile.tsx      # User Settings & Limits
│   └── ...
├── context/
│   ├── AuthContext.tsx  # Firebase Auth State
│   └── WalletContext.tsx# Transaction Logic & Firestore Sync
├── services/
│   ├── firebase.ts      # DB Configuration
│   ├── idfcParser.ts    # Rule-based PDF statement parser (pdf.js)
│   ├── IDFCBankParser.ts# Rule-based Excel statement parser (xlsx)
│   └── insightsService.ts # Local financial insights (no AI/API)
├── utils/
│   ├── log.ts           # Logger (debug/info/warn are no-ops in production)
│   └── exportFile.ts    # Platform-aware export (web download / Android share sheet)
├── docs/                # Project documentation, audit report, fix checklist
├── scripts/             # Dev-only tools (parser debugging, icon generation)
├── private/             # Personal files: statements, old builds (gitignored)
├── types.ts             # TypeScript Interfaces
├── currencyUtils.ts     # Currency conversion + cached formatters
└── index.html           # Entry point
```

---

## 🎯 Quick Start

1. **Right Now (5 min)**: See [docs/QUICK_START.md](docs/QUICK_START.md) to deploy security rules
2. **This Week (10 hrs)**: Implement edit, search, and validation features
3. **Next Week (6 hrs)**: Mobile optimization and final testing
4. **Week 3-4 (6 hrs)**: Android prep and launch

**Full timeline?** → See [docs/VISUAL_ROADMAP.md](docs/archive/VISUAL_ROADMAP.md)

---

## 📋 Documentation

Project documentation lives in [`docs/`](docs/). Key entry points:

| Document | Purpose |
|----------|---------|
| [TECH_SPEC.md](docs/TECH_SPEC.md) | Complete technical specification |
| [AUDIT_REPORT.md](docs/AUDIT_REPORT.md) | Full code audit findings (2026-06) |
| [FIX_CHECKLIST.md](docs/FIX_CHECKLIST.md) | Executed fix plan with phase status |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design & data flow |
| [docs/QUICK_START.md](docs/QUICK_START.md) | Getting started |
| [docs/PRODUCTION_ROADMAP.md](docs/PRODUCTION_ROADMAP.md) | Launch strategy |
| [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) | Pre-launch verification |

---

## 🧮 Insights Implementation

Insights are computed entirely on-device in `services/insightsService.ts` — savings rate, category concentration, anomaly detection (3× median), and a 50/30/20 budget heuristic. The previous Gemini-based pipeline was removed after it required shipping an API key in the client bundle.

---

## 🎨 Design System

The app uses a custom Tailwind configuration defined in `index.html`:

*   **Bg**: `#FAF9F6` (Zen White)
*   **Sage**: `#9BAE93` (Primary Accent - Positive/Growth)
*   **Rose**: `#D4A5A5` (Secondary Accent - Expense/Alert)
*   **Charcoal**: `#333333` (Text/Contrast)

---

## 🤝 Contributing

This is a personal finance app built for multiple platforms:
- **Web** (React + Vite)
- **Android** (Capacitor 8 — shipped, sideloaded APK)

When contributing, ensure code is **type-safe** (TypeScript), **secure** (no hardcoded credentials), and **documented** (comments for complex logic).

---

## 📄 License

This project is licensed under the MIT License.
