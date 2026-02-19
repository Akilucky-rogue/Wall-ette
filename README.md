# Wall-ette 🌿

**A mindful, aesthetic wallet tracker built with React, Firebase, and Firestore for seamless real-time sync.**

Wall-ette (Wallet & Assets Logic / Living Economy) brings peace of mind to personal finance with Zen design, robust security, and AI-powered automation.

**🌍 LIVE APP**: https://wall-e-7a113.web.app  
**STATUS**: ✅ Production Deployed | ✅ Fully Secured | ✅ Real-time Sync

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg?logo=tailwind-css)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-FFCA28.svg?logo=firebase)
![Gemini](https://img.shields.io/badge/AI-Gemini%203%20Pro-8E75B2.svg?logo=google-gemini)

## ✨ Key Features

### 🛡️ Security & Privacy (Locked Features)
*   **Session Security**: Automatic application lock after 15 minutes of inactivity.
*   **Authentication**: Secure Firebase Email/Password login.
*   **2FA Simulation**: Toggleable Multi-Factor Authentication (MFA) in settings.
*   **Daily Limits**: Set daily spending limits with real-time blocking and alerts.
*   **Security Logs**: Tracks login attempts and unlocking methods (Password/Bio/MFA).

### 🧠 AI-Powered Automation
*   **Smart Import**: Upload PDF, Excel, or Image bank statements.
    *   Uses **Gemini 3 Pro** for high-precision table parsing and data extraction.
    *   Uses **Gemini 3 Flash** for instant transaction categorization.
*   **Mindful Insights**: AI analysis of spending habits providing calming, actionable feedback.

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
*   **Backend**: Firebase (Authentication, Firestore)
*   **AI Integration**: Google GenAI SDK (`@google/genai`)
*   **Data Handling**: `xlsx` for spreadsheet parsing.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   A Google Cloud Project with the **Gemini API** enabled.
*   A Firebase Project.

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/wall-e.git
    cd wall-e
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory (if not using the hardcoded values for demo purposes).
    
    ```env
    # Required for AI Features
    API_KEY=your_google_gemini_api_key
    ```

    *Note: The current build includes a pre-configured Firebase setup in `services/firebase.ts`. For production, replace these credentials with your own.*

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
│   ├── ImportStatement.tsx # AI Import Logic
│   ├── Profile.tsx      # User Settings & Limits
│   └── ...
├── context/
│   ├── AuthContext.tsx  # Firebase Auth State
│   └── WalletContext.tsx# Transaction Logic & Firestore Sync
├── services/
│   ├── firebase.ts      # DB Configuration
│   └── geminiService.ts # AI Model Interaction (Flash/Pro)
├── types.ts             # TypeScript Interfaces
├── currencyUtils.ts     # Currency conversion logic
└── index.html           # Entry point
```

---

## 🎯 Quick Start

1. **Right Now (5 min)**: See [QUICK_START.md](QUICK_START.md) to deploy security rules
2. **This Week (10 hrs)**: Implement edit, search, and validation features
3. **Next Week (6 hrs)**: Mobile optimization and final testing
4. **Week 3-4 (6 hrs)**: Android prep and launch

**Full timeline?** → See [VISUAL_ROADMAP.md](VISUAL_ROADMAP.md)

---

## 📋 Documentation

This project includes comprehensive documentation for both web and Android development:

| Document | Purpose | Time to Read |
|----------|---------|--------------|
| [QUICK_START.md](QUICK_START.md) | What to do RIGHT NOW | 5 min |
| [VISUAL_ROADMAP.md](VISUAL_ROADMAP.md) | 4-week implementation timeline | 10 min |
| [PRODUCTION_ROADMAP.md](PRODUCTION_ROADMAP.md) | Launch strategy & timeline | 15 min |
| [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) | Code examples for features | 20 min |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design & data flow | 15 min |
| [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) | Pre-launch verification | 10 min |
| [SETUP_COMPLETE_SUMMARY.md](SETUP_COMPLETE_SUMMARY.md) | What's built & next steps | 10 min |

---

## 🤖 AI Implementation Details

Wall-ette uses a hybrid model approach for optimal performance and cost:

1.  **Gemini 3 Flash**: Used for real-time, low-latency tasks like analyzing spending habits strings and simple categorization.
2.  **Gemini 3 Pro**: Used in `services/geminiService.ts` for heavy-duty document parsing (Bank Statements). It creates structured JSON from unstructured PDF/Image inputs with high accuracy.

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
- **Android** (Flutter - upcoming)

When contributing, ensure code is **type-safe** (TypeScript), **secure** (no hardcoded credentials), and **documented** (comments for complex logic).

---

## 📄 License

This project is licensed under the MIT License.
