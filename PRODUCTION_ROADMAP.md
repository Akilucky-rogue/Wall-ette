# WALL-ET: Production Roadmap
## Complete Path to Web App → Android Migration

---

## 📋 **PHASE 1: Foundation (This Week) - CRITICAL**

### 1.1 🔐 **Security & Firestore Rules** [HIGHEST PRIORITY]

**Current Issue:** Anyone can read/write to any user's data!

**What to do:**
```
1. Create Firestore Security Rules
2. Implement password hashing
3. Add rate limiting for API calls
4. Enable email verification
5. Add logout functionality
```

**Firestore Rules needed:**
```typescript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
    match /users/{userId}/transactions/{txnId} {
      allow read, write: if request.auth.uid == userId;
      allow create: if request.auth.uid == userId && 
                       request.resource.data.userId == userId;
    }
  }
}
```

### 1.2 🎯 **Missing Critical Features**

- [ ] **Edit Transactions** - Can only delete, need edit
- [ ] **Search/Filter** - Find transactions by date, amount, category
- [ ] **Undo Feature** - Undo last transaction
- [ ] **Logout Button** - Currently no way to logout
- [ ] **Session Timeout** - Add inactivity timeout
- [ ] **Export Data** - Download transactions as CSV/PDF

### 1.3 ⚡ **Performance Optimization**

- [ ] Implement React.lazy() for all routes (already done ✅)
- [ ] Add skeleton loaders while data loads
- [ ] Optimize Firestore queries (limit to 100 recent transactions)
- [ ] Cache currency rates locally (3-6 hours)
- [ ] Implement virtual scrolling for large transaction lists

---

## 📋 **PHASE 2: Quality (Week 2) - IMPORTANT**

### 2.1 ✅ **Input Validation & Error Handling**

Currently: Minimal validation
Needed:
- Amount must be > 0
- Category required
- Date can't be in future
- Transaction notes character limit
- Graceful error messages

### 2.2 📱 **Mobile Responsiveness**

- Test on actual devices
- Improve touch targets (min 44px)
- Fix keyboard issues on mobile
- Test landscape orientation
- Test on slow 3G networks

### 2.3 🧪 **Testing**

Add tests for:
- Transaction calculations (income, expenses, balance)
- Monthly rollup logic
- Currency conversion
- Date filtering
- Firestore sync behavior

---

## 📋 **PHASE 3: Advanced Features (Week 3-4) - NICE-TO-HAVE**

- [ ] **Recurring Transactions** - Auto-add monthly expenses
- [ ] **Budget Alerts** - Notify when spending exceeds limit
- [ ] **Analytics** - Spending trends, charts, predictions
- [ ] **Categories** - Custom categories, emoji icons
- [ ] **Multi-currency** - Real-time conversion
- [ ] **Import Bank Statement** - AI-powered CSV/PDF import
- [ ] **Export Reports** - Monthly/yearly PDF reports

---

## 🤖 **PHASE 4: Android Preparation (Week 4-5)**

### 4.1 📚 **Document Everything**

Create detailed docs for Android devs:
```
├── Architecture.md (How data flows)
├── API.md (Firestore collections & fields)
├── DataModel.ts (TypeScript interfaces)
├── Constants.ts (Category types, limits, etc.)
└── Migration.md (How to migrate from web)
```

### 4.2 🔧 **Extract Shared Business Logic**

```
shared/
├── calculations.ts (balance, monthly totals)
├── validation.ts (input validation rules)
├── formatting.ts (currency, dates)
├── constants.ts (categories, icons)
└── types.ts (TypeScript interfaces)
```

This folder can be imported into Flutter app!

### 4.3 🧪 **Test Suite for Logic**

Business logic must work identically on Android:
- Balance calculation must match
- Monthly totals must match
- Currency conversion must match
- Validation rules must match

---

## 🚀 **QUICK START CHECKLIST (Next 24 Hours)**

**Priority 1 (Must Do):**
- [ ] Add Firestore security rules
- [ ] Add logout button
- [ ] Add "Edit Transaction" feature
- [ ] Fix any auth issues

**Priority 2 (Should Do):**
- [ ] Add input validation
- [ ] Improve error messages
- [ ] Add search/filter
- [ ] Test on mobile

**Priority 3 (Nice to Have):**
- [ ] Add skeleton loaders
- [ ] Optimize Firestore queries
- [ ] Add undo feature

---

## 📊 **Feature Completion Matrix**

| Feature | Status | Priority | Android Ready |
|---------|--------|----------|---------------|
| Auth (Login/Signup) | ✅ Done | High | ✅ Yes |
| Add Transaction | ✅ Done | High | ✅ Yes |
| View Transactions | ✅ Done | High | ✅ Yes |
| Delete Transaction | ✅ Done | High | ✅ Yes |
| Edit Transaction | ❌ Missing | High | ⚠️ No |
| Search/Filter | ❌ Missing | Medium | ⚠️ No |
| Monthly Summary | ✅ Done | High | ✅ Yes |
| Category Split | ✅ Done | Medium | ✅ Yes |
| Logout | ❌ Missing | High | ⚠️ No |
| Data Export | ❌ Missing | Medium | ⚠️ No |
| Firestore Rules | ❌ Missing | Critical | ✅ Yes* |
| Error Handling | ⚠️ Partial | High | ⚠️ No |
| Input Validation | ⚠️ Minimal | High | ⚠️ No |

---

## 🎯 **Recommended Order (Next 2 Weeks)**

```
DAY 1-2: Critical Security
├─ Firestore security rules
├─ Logout functionality
└─ Input validation

DAY 3-4: Core Features
├─ Edit transactions
├─ Search/filter
└─ Error handling

DAY 5-7: Polish & Testing
├─ Mobile responsiveness
├─ Skeleton loaders
├─ Data export
└─ Manual testing

DAY 8-10: Documentation
├─ Architecture docs
├─ API docs
├─ Code examples
└─ Android migration guide

DAY 11-14: Advanced Features (Optional)
├─ Recurring transactions
├─ Budget alerts
├─ Analytics/charts
└─ Bank import
```

---

## 💾 **Data Model for Android (Export This)**

```typescript
// shared/types.ts - Share with Android team

interface Transaction {
  id: string;
  amount: number;           // Always in INR (base currency)
  type: 'INCOME' | 'EXPENSE';
  category: string;
  date: string;             // ISO 8601 format
  note?: string;
  merchant?: string;
  createdAt: number;        // Unix timestamp
  updatedAt?: number;
}

interface UserProfile {
  email: string;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  dailyLimit: number;       // In base currency (INR)
  mfaEnabled: boolean;
  lastLogin: number;
}

interface IgnoreRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}
```

---

## ✅ **Success Criteria**

Your app is ready for Android when:

- ✅ All user data is private (Firestore rules enforced)
- ✅ No sensitive data stored in localStorage unencrypted
- ✅ All calculations are tested & accurate
- ✅ Error handling is graceful
- ✅ Input validation prevents bad data
- ✅ App works offline & syncs online
- ✅ Business logic is extracted & documented
- ✅ TypeScript interfaces are shared
- ✅ No hardcoded strings (use constants)
- ✅ Authentication is secure

---

## 📞 **What Would You Like to Build First?**

Choose one to start immediately:

1. **🔐 Security First** - Firestore rules + logout
2. **✨ Features First** - Edit transactions + search
3. **📊 Quality First** - Validation + error handling
4. **📱 Mobile First** - Responsive design + testing

Recommend: **Start with 🔐 Security First!** (Most critical, takes 30 min)

