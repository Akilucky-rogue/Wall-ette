# 🔧 COMMAND REFERENCE & QUICK START

## 🚀 Your App is Live!

**Visit**: https://wall-e-7a113.web.app

---

## 📱 Testing the App

### Option 1: Test Online (Right Now!)
```
1. Open browser
2. Go to: https://wall-e-7a113.web.app
3. Click "Sign Up"
4. Create account with any email/password
5. Click "Add Entry"
6. Add income/expense
7. Watch it sync instantly!
```

### Option 2: Test Offline
```
1. Open app at https://wall-e-7a113.web.app
2. Sign in
3. Add a transaction
4. Press F12 → Network tab
5. Check "Offline" box
6. Add another transaction (works!)
7. Uncheck "Offline"
8. Watch both sync instantly!
```

### Option 3: Test Multi-Device Sync
```
1. Open on phone: https://wall-e-7a113.web.app
2. Sign in with account
3. Add transaction on phone
4. Open on computer with same account
5. Refresh computer
6. Transaction appears instantly!
```

---

## 💻 Local Development Commands

### Start Development Server
```bash
npm run dev
```
- Opens at http://localhost:5173
- Hot reload enabled (auto-refreshes)
- For testing new features locally

### Build for Production
```bash
npm run build
```
- Creates optimized `dist/` folder
- Compresses and minifies code
- Ready for deployment

### Preview Production Build Locally
```bash
npm run preview
```
- Shows what production will look like
- Tests optimized version before deploy
- Useful for performance testing

### Install Dependencies
```bash
npm install
```
- Only needed if package.json changes
- Downloads all libraries

---

## 🔥 Firebase Deployment Commands

### Deploy Everything
```bash
firebase deploy
```
- Deploys Firestore rules + hosting
- Takes ~1-2 minutes
- Your app updates live

### Deploy Only Rules
```bash
firebase deploy --only firestore:rules
```
- Updates database security rules
- ~30 seconds
- Live immediately

### Deploy Only App
```bash
firebase deploy --only hosting
```
- Updates hosted app code
- ~1 minute
- Live immediately

### View Deployment Status
```bash
firebase status
```
- Shows current deployment status
- Last deploy time
- Project info

### Open Firebase Console
```bash
firebase console
```
- Opens https://console.firebase.google.com
- View database
- Check user accounts
- Monitor usage

---

## 🔍 Development Tools

### Open Browser DevTools
```
Press: F12 (Windows/Linux) or Cmd+Option+I (Mac)
```

**Tabs**:
- **Console**: See errors and logs
- **Network**: See API calls and data size
- **Application**: See local storage and offline data
- **Device Emulation**: Test on different phone sizes

### Check Console for Errors
```
1. Open app at https://wall-e-7a113.web.app
2. Press F12
3. Go to Console tab
4. Look for red errors
5. Red X = something broke
6. Yellow ⚠️ = warning (ok to ignore usually)
```

### Test Different Screen Sizes
```
1. Press F12
2. Click device icon (top-left)
3. Select device (iPhone, iPad, etc)
4. Drag to resize
5. Test all sizes
```

### Test on Mobile
```
Same WiFi connection:
1. Find your computer IP: ipconfig (Windows)
2. On phone: navigate to http://[YOUR-IP]:5173
3. Test app on phone in real time
4. Press F12 to see mobile console

OR just visit the live version:
https://wall-e-7a113.web.app
```

---

## 📝 Code Editing

### Open in VS Code
```bash
code .
```
- Opens current folder in VS Code
- Edit files
- Save with Ctrl+S
- Dev server auto-reloads

### Key Files to Edit

**Add Features**:
- `components/` - UI components
- `context/WalletContext.tsx` - App logic
- `services/firebase.ts` - Backend connection

**Styling**:
- `index.html` - Tailwind CSS config
- `App.tsx` - Global styles

**Database**:
- `firestore.rules` - Security rules
- `types.ts` - Data models

---

## 🐛 Debugging Tips

### Something broke? Try these:

```bash
# Clear node modules and reinstall
rm -r node_modules package-lock.json
npm install

# Clear browser cache
Press: Ctrl+Shift+Delete

# Stop and restart dev server
Press: Ctrl+C (in terminal)
npm run dev

# Check for errors
Press: F12, go to Console tab

# Reset Firebase auth
In Firebase Console:
1. Authentication > Users
2. Delete test users
3. Try again

# Check database rules
In Firebase Console:
1. Firestore > Rules
2. Verify rules are deployed
3. Scroll to view rules
```

---

## 📊 Useful Links

### Your App
```
Live: https://wall-e-7a113.web.app
Local: http://localhost:5173 (after npm run dev)
```

### Firebase
```
Console: https://console.firebase.google.com/project/wall-e-7a113
Docs: https://firebase.google.com/docs
```

### Documentation
```
NEXT_STEPS.md - What to build next
DEPLOYMENT_COMPLETE.md - Deployment details
PROJECT_STATUS.md - Current status
VISUAL_ROADMAP.md - 4-week plan
```

---

## ⏱️ Estimated Task Times

| Task | Time | Command |
|------|------|---------|
| Start dev server | 10 sec | `npm run dev` |
| Build for production | 3 min | `npm run build` |
| Deploy to Firebase | 2 min | `firebase deploy` |
| Deploy rules only | 30 sec | `firebase deploy --only firestore:rules` |
| Deploy app only | 1 min | `firebase deploy --only hosting` |
| Edit + test feature | 30-45 min | Edit file, auto-reloads |
| Add new component | 15-30 min | Code + test |
| Debug issue | varies | Use F12 console |

---

## 🎯 Typical Development Flow

```bash
# 1. Start dev server
npm run dev

# 2. Edit a file (in VS Code)
# Changes auto-reload in browser

# 3. When ready to deploy
npm run build

# 4. Test production build locally
npm run preview

# 5. Deploy to Firebase
firebase deploy

# 6. Visit live app
# https://wall-e-7a113.web.app
```

---

## 💡 Pro Tips

1. **Keep terminal open**
   - Run `npm run dev` once
   - Leave it running
   - Edit files, they auto-reload

2. **Use keyboard shortcuts**
   - F12: Open DevTools
   - Ctrl+S: Save file
   - Ctrl+Shift+Delete: Clear cache
   - Ctrl+R: Reload page

3. **Test early, test often**
   - Don't wait to deploy
   - Test in browser as you code
   - Find bugs immediately

4. **Use Chrome DevTools**
   - Best for React debugging
   - Install React DevTools extension
   - See component state in real-time

5. **Read error messages**
   - Press F12, go to Console
   - Read the error text
   - It usually tells you exactly what's wrong

---

## ✅ Quick Checklist

Before you start coding:

```
☑️ npm run dev is running (terminal)
☑️ Browser showing http://localhost:5173
☑️ VS Code is open with project
☑️ F12 console showing no red errors
☑️ Ready to edit!
```

---

## 🚨 If Something Goes Wrong

**Error in Console?**
1. Read the error message
2. Open file it mentions
3. Look at that line
4. See what's wrong
5. Fix it
6. Reload page (F5)

**Build fails?**
```bash
# Try clearing and reinstalling
rm -r node_modules
npm install
npm run build
```

**Firebase won't deploy?**
```bash
# Check login status
firebase login:list

# Re-login if needed
firebase login

# Try deploying again
firebase deploy
```

**App shows blank page?**
```bash
# Press F12
# Go to Console tab
# Look for errors
# Most common: Missing env variable
# Check .env.local file
```

---

## 🎓 Learning Resources

**For React**:
- https://react.dev/learn

**For TypeScript**:
- https://www.typescriptlang.org/docs

**For Firebase**:
- https://firebase.google.com/docs/firestore

**For Tailwind CSS**:
- https://tailwindcss.com/docs

---

## 🎉 You're All Set!

Your app is live, your tools are ready, and you have everything you need.

**Next step**: 
1. Open https://wall-e-7a113.web.app
2. Test it out
3. Then pick a task from NEXT_STEPS.md
4. Start coding!

**Good luck!** 🚀

