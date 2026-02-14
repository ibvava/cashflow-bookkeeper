# 🚀 CashFlow Bookkeeper — Ship to iOS Today

## What You Have

A complete Progressive Web App (PWA) that works as a native-feeling app on iPhone, iPad, Android, and desktop. It includes:

- ✅ Auto-categorization with 200+ AU keywords
- ✅ GST / BAS quarterly tracking
- ✅ Profit & Loss reports
- ✅ Invoice management
- ✅ CSV bank statement import
- ✅ Manual receipt/expense entry
- ✅ Business vs Personal separation
- ✅ Offline support (works without internet)
- ✅ Data persistence (survives browser close)
- ✅ iOS home screen app (full-screen, no browser bar)
- ✅ App icons for iOS and Android

---

## Option A: Deploy to Vercel (FREE — 5 minutes)

### Prerequisites
- A GitHub account (free)
- A Vercel account (free at vercel.com — sign up with GitHub)

### Steps

1. **Create a GitHub repo**
   ```bash
   # In the cashflow-pwa folder:
   git init
   git add .
   git commit -m "CashFlow Bookkeeper PWA v1.0"
   ```

2. **Push to GitHub**
   - Go to github.com → New Repository → name it `cashflow-bookkeeper`
   - Follow the instructions to push your existing repo:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/cashflow-bookkeeper.git
   git branch -M main
   git push -u origin main
   ```

3. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com) → "New Project"
   - Import your GitHub repo
   - Vercel auto-detects Vite — just click "Deploy"
   - Done! Your app is live at `https://cashflow-bookkeeper.vercel.app`

4. **Install on iPhone**
   - Open the Vercel URL in Safari on your iPhone
   - Tap the Share button (box with arrow)
   - Tap "Add to Home Screen"
   - Tap "Add"
   - The app now appears on your home screen like a native app!

---

## Option B: Deploy to Netlify (FREE — 5 minutes)

1. Go to [app.netlify.com](https://app.netlify.com)
2. Drag and drop the `dist` folder (after running `npm run build`)
3. Your app is live instantly

---

## Option C: Run Locally First

```bash
# 1. Install dependencies
npm install

# 2. Run development server
npm run dev
# Opens at http://localhost:5173

# 3. Build for production
npm run build
# Output in /dist folder

# 4. Preview production build
npm run preview
```

---

## Adding to iPhone Home Screen

Once deployed (or running locally on your network), on your iPhone:

1. Open **Safari** (must be Safari, not Chrome)
2. Go to your app URL
3. Tap the **Share** button (📤)
4. Scroll down and tap **"Add to Home Screen"**
5. Name it "CashFlow" and tap **Add**

The app will:
- Launch full-screen (no browser bar)
- Have your custom green $ icon
- Work offline after first load
- Save all your data locally on-device

---

## Custom Domain (Optional)

If you want a professional URL like `books.yourbusiness.com.au`:

1. Buy a domain from Namecheap, Cloudflare, or any registrar
2. In Vercel → Project Settings → Domains → Add your domain
3. Update DNS as instructed (usually takes 5-30 minutes)

---

## Project Structure

```
cashflow-pwa/
├── index.html          # HTML shell with iOS PWA meta tags
├── package.json        # Dependencies
├── vite.config.js      # Vite + PWA plugin config
├── public/
│   ├── favicon.svg     # Browser tab icon
│   ├── pwa-192x192.png # Android install icon
│   ├── pwa-512x512.png # Android splash icon
│   └── apple-touch-icon.png  # iOS home screen icon
└── src/
    ├── main.jsx        # React entry point
    └── App.jsx         # Full app (910+ lines)
```

---

## Data Storage

All data is stored in the browser's localStorage on-device:
- `cashflow_transactions` — all transactions
- `cashflow_invoices` — all invoices

**This means:**
- Data stays on the user's device (private!)
- No server or database needed
- Survives browser close and app restart
- Gets cleared if user clears browser data

**Future upgrade:** Add cloud sync with Supabase or Firebase for multi-device access.

---

## Next Steps to Consider

1. **Cloud Sync** — Supabase (free tier) for syncing across devices
2. **Export to CSV/PDF** — Generate reports for your accountant
3. **Receipt Photo** — Use device camera to snap receipts
4. **Recurring Transactions** — Auto-detect and flag subscriptions
5. **React Native** — Full App Store listing when you're ready
6. **Multi-currency** — For clients who invoice internationally
