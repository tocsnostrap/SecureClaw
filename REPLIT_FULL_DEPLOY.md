# 🚨 REPLIT FULL DEPLOYMENT - Both Servers

## THE ISSUE

You have **TWO servers** running:
1. **Backend** (Node.js API with all the AGI tools)
2. **Frontend** (Expo iOS app UI)

**You need to restart BOTH!**

---

## ✅ SOLUTION - Restart Everything

### On Replit, you should have **2 terminals/shells**:

#### **Terminal 1 - Backend API**
```bash
npm run server:dev
```

#### **Terminal 2 - Expo App**
```bash
npm run expo:dev
```

---

## 📱 MOBILE REPLIT (Simplified)

### If you only see ONE terminal:

**Stop everything** and run this:

```bash
npm install && npm run server:dev
```

**Then in a NEW terminal** (tap + or open second shell):

```bash
npm run expo:dev
```

---

## 🔍 What You Should See

### **Terminal 1 (Backend)**:
```
[Permissions] 📂 Permission system ready
[Integrations] 🔗 App linking available
[Passport OAuth] 🔐 OAuth strategies configured
[Monitor] 🏥 Health monitoring active
express server serving on port 5000
```

### **Terminal 2 (Expo)**:
```
Starting Metro Bundler
› Scan the QR code above
› Press w │ open web
› Press i │ open iOS simulator
```

---

## ✅ VERIFY BACKEND IS LOADED

Open this URL in browser:
```
https://your-replit-url.replit.dev/api/health
```

**Must show**:
```json
{
  "systems": {
    "permissions": true,
    "integrations": true,
    "monitoring": true,
    "helpWiki": true,
    "browserSkills": true,
    "credits": true
  }
}
```

**If ANY is `false`** = That system didn't load properly.

---

## 🧪 THEN TEST

In iOS app:

```
"What are your capabilities"
```

Should say "23 tools" or list all the advanced tools.

---

## 🚨 IF STILL NOT WORKING

The problem is likely:

1. **Expo app is cached** - Run:
   ```bash
   npm run expo:dev -- --clear
   ```

2. **Dependencies not installed** - Run:
   ```bash
   npm install
   ```

3. **Wrong branch** - Check:
   ```bash
   git branch
   ```
   Should be: `main`

---

## 📋 COMPLETE DEPLOYMENT CHECKLIST

- [ ] Run `npm install`
- [ ] Check `git branch` shows `main`
- [ ] Start Terminal 1: `npm run server:dev`
- [ ] Start Terminal 2: `npm run expo:dev`
- [ ] Verify `/api/health` shows all systems `true`
- [ ] Test in iOS app: "What are your capabilities"
- [ ] Should see 23 tools listed

---

## ✅ BOTTOM LINE

**You need:**
1. Backend server running (`npm run server:dev`)
2. Expo app running (`npm run expo:dev`)
3. **BOTH** restarted to load new code

**The backend has the tools, the frontend shows the UI.**

**Restart BOTH servers!** 🚀

