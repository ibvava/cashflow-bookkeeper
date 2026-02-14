import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import * as Papaparse from "papaparse";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ═══ LocalStorage Persistence ═══
const STORAGE_KEYS = { txns: "cashflow_transactions", invoices: "cashflow_invoices", budgets: "cashflow_budgets" };
function loadData(key, fallback) {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; }
}
function saveData(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.warn("Storage full:", e); }
}

// ════════════════════════════════════════════════════════════════════
// GST CONFIG
// ════════════════════════════════════════════════════════════════════
const GST_RATE = 0.1;
const GST_CODES = {
  GST: { label: "GST (10%)", rate: 0.1 },
  GST_FREE: { label: "GST-Free", rate: 0 },
  INPUT_TAXED: { label: "Input Taxed", rate: 0 },
  BAS_EXCLUDED: { label: "BAS Excluded", rate: 0 },
};

// ════════════════════════════════════════════════════════════════════
// EXPANDED TAX CATEGORIES — comprehensive AU keywords
// ════════════════════════════════════════════════════════════════════
const TAX_CATEGORIES = {
  income: {
    salary_income: {
      label: "Salary / Wages", icon: "💰", gst: "BAS_EXCLUDED", deductible: false,
      keywords: ["salary", "payroll", "wage", "direct deposit", "pay run", "fortnightly pay", "weekly pay", "employer", "payg"]
    },
    sales_income: {
      label: "Sales / Revenue", icon: "🛒", gst: "GST", deductible: false,
      keywords: ["invoice", "payment received", "client payment", "sale", "revenue", "pos", "square", "shopify", "stripe transfer", "paypal transfer"]
    },
    freelance_income: {
      label: "Freelance / Contract", icon: "💻", gst: "GST", deductible: false,
      keywords: ["freelance", "consulting", "contract", "abn", "contractor", "fiverr", "upwork", "toptal"]
    },
    interest_income: {
      label: "Interest Income", icon: "🏦", gst: "INPUT_TAXED", deductible: false,
      keywords: ["interest", "savings interest", "term deposit", "ing interest", "ubank interest", "bonus interest"]
    },
    investment_income: {
      label: "Investment Income", icon: "📈", gst: "GST_FREE", deductible: false,
      keywords: ["dividend", "distribution", "vanguard", "betashares", "capital gain", "etf", "shares", "commsec", "selfwealth", "stake"]
    },
    govt_income: {
      label: "Government Payments", icon: "🏛️", gst: "BAS_EXCLUDED", deductible: false,
      keywords: ["centrelink", "jobseeker", "youth allowance", "austudy", "family tax benefit", "child care subsidy", "services australia", "ato refund", "tax refund", "gst refund"]
    },
    rental_income: {
      label: "Rental Income", icon: "🏘️", gst: "GST_FREE", deductible: false,
      keywords: ["rent received", "tenant", "rental income", "property income", "airbnb income"]
    },
    other_income: {
      label: "Other Income", icon: "🎁", gst: "GST_FREE", deductible: false,
      keywords: ["refund", "rebate", "cashback", "reimbursement", "bonus", "gift", "transfer in", "deposit", "credit"]
    },
  },
  expense: {
    // ── BUSINESS DEDUCTIBLE ──
    advertising: {
      label: "Advertising & Marketing", icon: "📣", gst: "GST", deductible: true,
      keywords: ["google ads", "facebook ads", "meta ads", "instagram", "tiktok ads", "linkedin ads", "marketing", "advertising", "ad spend", "seo", "sem", "mailchimp", "hubspot", "sendinblue", "convertkit", "flyer", "signage", "business cards", "vistaprint"]
    },
    vehicle: {
      label: "Motor Vehicle", icon: "🚗", gst: "GST", deductible: true,
      keywords: ["fuel", "petrol", "diesel", "bp ", "shell", "caltex", "ampol", "7-eleven fuel", "united fuel", "rego", "registration", "car service", "car wash", "mechanic", "repco", "supercheap auto", "parking", "wilson parking", "secure parking", "toll", "linkt", "etoll", "citylink", "eastlink", "go via", "roam", "nrma", "racq", "racv", "raa"]
    },
    office: {
      label: "Office Supplies", icon: "🖥️", gst: "GST", deductible: true,
      keywords: ["officeworks", "stationery", "printer", "ink", "toner", "paper", "desk", "chair", "monitor", "keyboard", "mouse", "headset", "webcam", "usb", "hard drive", "ssd"]
    },
    equipment: {
      label: "Equipment & Tools", icon: "🔧", gst: "GST", deductible: true,
      keywords: ["bunnings", "tools", "equipment", "hardware", "laptop", "computer", "ipad", "tablet", "camera", "jb hi-fi", "jb hifi", "harvey norman", "apple store", "dell", "lenovo"]
    },
    rent_business: {
      label: "Rent (Business)", icon: "🏢", gst: "GST", deductible: true,
      keywords: ["office rent", "coworking", "wework", "workspace", "studio rent", "commercial rent", "warehouse"]
    },
    phone_internet: {
      label: "Phone & Internet", icon: "📱", gst: "GST", deductible: true,
      keywords: ["telstra", "optus", "vodafone", "tpg", "aussie broadband", "iinet", "dodo", "belong", "amaysim", "boost mobile", "aldi mobile", "felix", "spintel", "nbn", "internet", "phone plan", "mobile plan", "sim"]
    },
    power_utilities: {
      label: "Utilities (Business)", icon: "⚡", gst: "GST", deductible: true,
      keywords: ["origin energy", "agl", "energy australia", "energyaustralia", "alinta", "red energy", "lumo", "powershop", "electricity", "electric", "gas bill", "water bill", "council rates"]
    },
    insurance_biz: {
      label: "Insurance (Business)", icon: "🛡️", gst: "GST", deductible: true,
      keywords: ["public liability", "professional indemnity", "business insurance", "income protection", "workers comp", "bizcover"]
    },
    subscriptions: {
      label: "Software & Subscriptions", icon: "💿", gst: "GST", deductible: true,
      keywords: ["adobe", "xero", "myob", "quickbooks", "reckon", "canva", "figma", "notion", "slack", "zoom", "microsoft 365", "google workspace", "dropbox", "github", "aws", "azure", "heroku", "vercel", "netlify", "domain", "hosting", "godaddy", "cloudflare", "namecheap", "siteground", "squarespace", "wix", "wordpress", "saas", "software", "app store", "play store"]
    },
    professional: {
      label: "Professional Services", icon: "👔", gst: "GST", deductible: true,
      keywords: ["accountant", "h&r block", "tax agent", "tax return", "lawyer", "solicitor", "legal", "bookkeeper", "bas agent", "financial adviser", "planner", "architect", "engineer"]
    },
    travel: {
      label: "Travel (Business)", icon: "✈️", gst: "GST", deductible: true,
      keywords: ["flight", "qantas", "jetstar", "virgin australia", "rex airlines", "tigerair", "hotel", "airbnb", "booking.com", "expedia", "wotif", "accommodation", "motel", "serviced apartment"]
    },
    meals_ent: {
      label: "Meals & Entertainment", icon: "🍽️", gst: "GST", deductible: true,
      keywords: ["restaurant", "cafe", "coffee", "mcdonald", "kfc", "subway", "dominos", "pizza hut", "hungry jack", "guzman", "nando", "sushi", "thai", "indian", "chinese", "vietnamese", "uber eats", "deliveroo", "menulog", "doordash", "grubhub"]
    },
    bank_fees: {
      label: "Bank & Merchant Fees", icon: "🏦", gst: "INPUT_TAXED", deductible: true,
      keywords: ["bank fee", "account fee", "monthly fee", "overdrawn", "merchant fee", "stripe fee", "paypal fee", "square fee", "afterpay fee", "zip fee", "eftpos", "atm fee", "international fee", "currency conversion"]
    },
    education: {
      label: "Training & Education", icon: "📚", gst: "GST", deductible: true,
      keywords: ["course", "udemy", "coursera", "skillshare", "linkedin learning", "pluralsight", "training", "workshop", "seminar", "conference", "summit", "bootcamp", "certification"]
    },
    home_office: {
      label: "Home Office", icon: "🏡", gst: "GST", deductible: true,
      keywords: ["home office", "work from home", "wfh"]
    },
    super_contribution: {
      label: "Superannuation", icon: "🏦", gst: "BAS_EXCLUDED", deductible: true,
      keywords: ["super contribution", "superannuation", "super fund", "australian super", "hostplus", "sunsuper", "rest super", "cbus", "unisuper", "aware super", "smsf"]
    },
    // ── PERSONAL NON-DEDUCTIBLE ──
    housing: {
      label: "Housing / Rent", icon: "🏠", gst: "BAS_EXCLUDED", deductible: false,
      keywords: ["rent", "mortgage", "home loan", "strata", "body corp", "council rates", "land tax"]
    },
    groceries: {
      label: "Groceries", icon: "🛒", gst: "BAS_EXCLUDED", deductible: false,
      keywords: ["woolworths", "woolies", "coles", "aldi", "iga", "costco", "harris farm", "grocery", "supermarket", "food", "butcher", "baker", "fruit", "veg", "market"]
    },
    health: {
      label: "Health & Medical", icon: "🏥", gst: "GST_FREE", deductible: false,
      keywords: ["doctor", "gp", "pharmacy", "chemist warehouse", "priceline pharmacy", "terry white", "dental", "dentist", "optometrist", "specsavers", "opsm", "physio", "physiotherapy", "chiro", "chiropractor", "pathology", "radiology", "hospital", "medical", "medicare", "medibank", "bupa", "nib", "hbf", "hcf", "ahm", "health insurance"]
    },
    transport_personal: {
      label: "Transport (Personal)", icon: "🚌", gst: "BAS_EXCLUDED", deductible: false,
      keywords: ["uber", "lyft", "didi", "ola", "taxi", "13cabs", "opal", "myki", "go card", "metrocard", "smartrider", "translink", "bus", "train", "tram", "ferry"]
    },
    shopping: {
      label: "Shopping (Personal)", icon: "🛍️", gst: "BAS_EXCLUDED", deductible: false,
      keywords: ["amazon", "ebay", "kmart", "target", "big w", "ikea", "freedom", "catch.com", "temple & webster", "clothing", "cotton on", "uniqlo", "h&m", "zara", "myer", "david jones", "country road", "rebel sport", "bcf", "anaconda"]
    },
    entertainment: {
      label: "Entertainment", icon: "🎬", gst: "BAS_EXCLUDED", deductible: false,
      keywords: ["netflix", "spotify", "disney", "stan", "binge", "kayo", "foxtel", "paramount", "apple tv", "youtube premium", "cinema", "hoyts", "event cinema", "village cinema", "movie", "game", "playstation", "xbox", "steam", "nintendo", "ticket", "ticketek", "ticketmaster", "eventbrite", "concert", "festival", "gym", "anytime fitness", "fitness first", "f45"]
    },
    kids_family: {
      label: "Kids & Family", icon: "👶", gst: "BAS_EXCLUDED", deductible: false,
      keywords: ["childcare", "child care", "daycare", "kindy", "kindergarten", "school fees", "school", "uniform", "baby bunting", "toys r us", "toy world"]
    },
    insurance_personal: {
      label: "Insurance (Personal)", icon: "🛡️", gst: "BAS_EXCLUDED", deductible: false,
      keywords: ["car insurance", "home insurance", "contents insurance", "life insurance", "nrma insurance", "allianz", "suncorp", "qbe", "aami", "gio", "youi", "budget direct", "real insurance"]
    },
    donations: {
      label: "Donations & Gifts", icon: "❤️", gst: "GST_FREE", deductible: true,
      keywords: ["donation", "charity", "dgr", "red cross", "salvation army", "smith family", "unicef", "world vision", "oxfam", "beyond blue", "gofundme"]
    },
    personal_other: {
      label: "Other / Uncategorized", icon: "📦", gst: "BAS_EXCLUDED", deductible: false,
      keywords: []
    },
  },
};

// ════════════════════════════════════════════════════════════════════
// AUTO-CLASSIFICATION ENGINE
// ════════════════════════════════════════════════════════════════════
function autoClassify(description, amount) {
  const desc = description.toLowerCase().trim();
  const type = amount >= 0 ? "income" : "expense";
  const cats = TAX_CATEGORIES[type];

  // Score-based: longer keyword match = higher confidence
  let bestMatch = null;
  let bestLength = 0;

  for (const [key, cat] of Object.entries(cats)) {
    for (const kw of cat.keywords) {
      if (desc.includes(kw) && kw.length > bestLength) {
        bestMatch = { type, category: key, gstCode: cat.gst };
        bestLength = kw.length;
      }
    }
  }

  if (bestMatch) return bestMatch;
  return { type, category: type === "income" ? "other_income" : "personal_other", gstCode: type === "income" ? "GST_FREE" : "BAS_EXCLUDED" };
}

// ════════════════════════════════════════════════════════════════════
// CSV PARSER
// ════════════════════════════════════════════════════════════════════
function parseCSV(text) {
  const result = Papaparse.parse(text, { header: true, skipEmptyLines: true });
  const txns = [];
  for (const row of result.data) {
    const keys = Object.keys(row);
    const dateKey = keys.find((k) => /date/i.test(k));
    const descKey = keys.find((k) => /desc|narr|detail|memo|ref|particular|transaction/i.test(k));
    const amountKey = keys.find((k) => /^amount$/i.test(k));
    const creditKey = keys.find((k) => /credit|deposit|cr/i.test(k));
    const debitKey = keys.find((k) => /debit|withdrawal|dr/i.test(k));
    if (!dateKey) continue;

    let amount = 0;
    if (amountKey) {
      amount = parseFloat(String(row[amountKey]).replace(/[^0-9.\-]/g, "")) || 0;
    } else if (creditKey || debitKey) {
      const cr = parseFloat(String(row[creditKey] || "0").replace(/[^0-9.\-]/g, "")) || 0;
      const dr = parseFloat(String(row[debitKey] || "0").replace(/[^0-9.\-]/g, "")) || 0;
      amount = cr > 0 ? cr : -dr;
    }
    // Try combining multiple text columns for better description
    let description = row[descKey] || "";
    if (!description) {
      // Fallback: join all non-date, non-numeric columns
      description = keys.filter((k) => k !== dateKey && k !== amountKey && k !== creditKey && k !== debitKey)
        .map((k) => row[k]).filter(Boolean).join(" ");
    }
    if (!description) description = "Unknown Transaction";

    const { type, category, gstCode } = autoClassify(description, amount);
    const cat = TAX_CATEGORIES[type]?.[category];

    // Date parsing — try multiple formats
    let d = new Date(row[dateKey]);
    if (isNaN(d)) {
      const p = String(row[dateKey]).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (p) {
        const yr = p[3].length === 2 ? "20" + p[3] : p[3];
        d = new Date(`${yr}-${p[2].padStart(2, "0")}-${p[1].padStart(2, "0")}`);
        if (isNaN(d)) d = new Date(`${yr}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`);
      }
    }
    if (isNaN(d)) continue;

    txns.push({
      id: crypto.randomUUID(), date: d.toISOString().split("T")[0], description: description.trim(),
      amount: Math.abs(amount), type, category, gstCode,
      isBusiness: cat?.deductible === true || (type === "income" && category !== "other_income" && category !== "govt_income"),
    });
  }
  return txns;
}

// ════════════════════════════════════════════════════════════════════
// DEMO DATA
// ════════════════════════════════════════════════════════════════════
function generateDemoData() {
  const txns = [];
  const now = new Date();
  const items = [
    { d: "Client Invoice #1042 - Web Design", a: 3300 }, { d: "Freelance Consulting - Strategy Session", a: 1650 },
    { d: "Salary Direct Deposit", a: 5200 }, { d: "ING Savings Interest", a: 18.5 },
    { d: "Vanguard ETF Distribution", a: 120 }, { d: "Centrelink Family Tax Benefit", a: 280 },
    { d: "Google Ads Campaign", a: -220 }, { d: "Ampol Petrol Station", a: -92 },
    { d: "Officeworks Stationery", a: -67 }, { d: "Adobe Creative Cloud Subscription", a: -54.99 },
    { d: "Telstra Mobile Plan", a: -89 }, { d: "Origin Energy Electricity", a: -165 },
    { d: "Public Liability Insurance", a: -195 }, { d: "Xero Accounting Software", a: -33 },
    { d: "H&R Block Tax Return Fee", a: -350 }, { d: "Qantas Flight - Client Visit MEL-SYD", a: -289 },
    { d: "Client Lunch - Thai Restaurant", a: -48 }, { d: "Stripe Merchant Fee", a: -33 },
    { d: "Udemy Course - Advanced React", a: -14.99 }, { d: "JB Hi-Fi Laptop", a: -1299 },
    { d: "Woolworths Weekly Shop", a: -156 }, { d: "Coles Supermarket", a: -98.3 },
    { d: "Rent Payment - Home", a: -1800 }, { d: "Netflix Subscription", a: -22.99 },
    { d: "Spotify Premium", a: -12.99 }, { d: "Chemist Warehouse", a: -32 },
    { d: "Uber Ride to Airport", a: -34.5 }, { d: "Opal Card Top Up", a: -50 },
    { d: "Amazon AU - Books", a: -45 }, { d: "AAMI Car Insurance", a: -128 },
    { d: "Kayo Sports Subscription", a: -27.5 }, { d: "Anytime Fitness Membership", a: -64.9 },
    { d: "Donation - Beyond Blue", a: -50 }, { d: "Australian Super Contribution", a: -500 },
  ];
  for (let m = 5; m >= 0; m--) {
    for (const item of items) {
      const date = new Date(now.getFullYear(), now.getMonth() - m, Math.floor(Math.random() * 28) + 1);
      const v = 1 + (Math.random() - 0.5) * 0.2;
      const amt = Math.abs(item.a * v);
      const { type, category, gstCode } = autoClassify(item.d, item.a);
      const cat = TAX_CATEGORIES[type]?.[category];
      txns.push({ id: crypto.randomUUID(), date: date.toISOString().split("T")[0], description: item.d, amount: parseFloat(amt.toFixed(2)), type, category, gstCode, isBusiness: cat?.deductible === true || (type === "income" && !["other_income", "govt_income"].includes(category)) });
    }
  }
  return txns.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function generateDemoInvoices() {
  const now = new Date();
  return [
    { id: crypto.randomUUID(), number: "INV-1042", client: "Acme Corp", amount: 3300, gst: 330, total: 3630, date: new Date(now.getFullYear(), now.getMonth(), 3).toISOString().split("T")[0], dueDate: new Date(now.getFullYear(), now.getMonth(), 17).toISOString().split("T")[0], status: "paid", description: "Web Design Package" },
    { id: crypto.randomUUID(), number: "INV-1043", client: "StartupXYZ", amount: 1650, gst: 165, total: 1815, date: new Date(now.getFullYear(), now.getMonth(), 8).toISOString().split("T")[0], dueDate: new Date(now.getFullYear(), now.getMonth(), 22).toISOString().split("T")[0], status: "sent", description: "Strategy Consulting" },
    { id: crypto.randomUUID(), number: "INV-1044", client: "Local Bakery", amount: 880, gst: 88, total: 968, date: new Date(now.getFullYear(), now.getMonth(), 12).toISOString().split("T")[0], dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 12).toISOString().split("T")[0], status: "draft", description: "Logo & Branding" },
    { id: crypto.randomUUID(), number: "INV-1039", client: "BigCo Ltd", amount: 4400, gst: 440, total: 4840, date: new Date(now.getFullYear(), now.getMonth() - 1, 5).toISOString().split("T")[0], dueDate: new Date(now.getFullYear(), now.getMonth() - 1, 19).toISOString().split("T")[0], status: "overdue", description: "Monthly Retainer" },
  ];
}

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════
const fmt = (n) => "$" + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#e11d48", "#6366f1"];
const statusColors = { paid: { bg: "rgba(16,185,129,0.12)", color: "#10b981" }, sent: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" }, draft: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" }, overdue: { bg: "rgba(239,68,68,0.12)", color: "#ef4444" } };

function getBASQuarter(date) {
  const d = new Date(date); const m = d.getMonth(); const y = d.getFullYear();
  if (m >= 6 && m <= 8) return { label: `Q1 FY${y + 1}`, start: `${y}-07-01`, end: `${y}-09-30` };
  if (m >= 9 && m <= 11) return { label: `Q2 FY${y + 1}`, start: `${y}-10-01`, end: `${y}-12-31` };
  if (m >= 0 && m <= 2) return { label: `Q3 FY${y}`, start: `${y}-01-01`, end: `${y}-03-31` };
  return { label: `Q4 FY${y}`, start: `${y}-04-01`, end: `${y}-06-30` };
}

// ════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════
export default function App() {
  const [transactions, setTransactions] = useState(() => loadData(STORAGE_KEYS.txns, []));
  const [invoices, setInvoices] = useState(() => loadData(STORAGE_KEYS.invoices, []));
  const [view, setView] = useState("home");
  const [editingTxn, setEditingTxn] = useState(null);
  const [basQuarter, setBasQuarter] = useState(() => getBASQuarter(new Date()).label);
  const [plPeriod, setPlPeriod] = useState("all");
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [txnFilter, setTxnFilter] = useState("all");
  const [showManualTxn, setShowManualTxn] = useState(false);
  const [manualType, setManualType] = useState("expense");
  const fileRef = useRef(null);

  // Persist data on change
  useEffect(() => { saveData(STORAGE_KEYS.txns, transactions); }, [transactions]);
  useEffect(() => { saveData(STORAGE_KEYS.invoices, invoices); }, [invoices]);

  const handleUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    let newTxns = [];
    for (const file of files) {
      try {
        if (file.name.toLowerCase().endsWith(".csv")) {
          newTxns.push(...parseCSV(await file.text()));
        } else { alert("Please use CSV format. Export from your bank's website."); }
      } catch (err) { console.error(err); }
    }
    if (newTxns.length > 0) {
      setTransactions((prev) => [...prev, ...newTxns].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setView("transactions");
    }
    e.target.value = "";
  }, []);

  const clearAllData = () => {
    if (confirm("Clear all transactions and invoices? This cannot be undone.")) {
      setTransactions([]); setInvoices([]); setView("home");
      localStorage.removeItem(STORAGE_KEYS.txns);
      localStorage.removeItem(STORAGE_KEYS.invoices);
    }
  };

  // ─── Stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const bizTxns = transactions.filter((t) => t.isBusiness);
    const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const bizIncome = bizTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const bizExpenses = bizTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const deductible = transactions.filter((t) => t.type === "expense" && TAX_CATEGORIES.expense[t.category]?.deductible).reduce((s, t) => s + t.amount, 0);

    const monthlyMap = {};
    transactions.forEach((t) => {
      const m = t.date.substring(0, 7);
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, income: 0, expenses: 0, bizIncome: 0, bizExpenses: 0 };
      if (t.type === "income") { monthlyMap[m].income += t.amount; if (t.isBusiness) monthlyMap[m].bizIncome += t.amount; }
      else { monthlyMap[m].expenses += t.amount; if (t.isBusiness) monthlyMap[m].bizExpenses += t.amount; }
    });
    const monthlyData = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({ ...m, net: m.income - m.expenses, bizNet: m.bizIncome - m.bizExpenses, label: new Date(m.month + "-15").toLocaleDateString("en-AU", { month: "short", year: "2-digit" }) }));

    const catMap = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
    const categoryData = Object.entries(catMap).map(([key, value]) => ({ name: TAX_CATEGORIES.expense[key]?.label || key, value: +value.toFixed(2), key, icon: TAX_CATEGORIES.expense[key]?.icon || "📦" })).sort((a, b) => b.value - a.value);

    const quarters = {};
    transactions.forEach((t) => {
      const q = getBASQuarter(t.date);
      if (!quarters[q.label]) quarters[q.label] = { label: q.label, gstCollected: 0, gstPaid: 0, totalSales: 0, totalPurchases: 0 };
      const gr = GST_CODES[t.gstCode]?.rate || 0;
      if (t.type === "income" && t.isBusiness) { quarters[q.label].totalSales += t.amount; quarters[q.label].gstCollected += t.amount * gr / (1 + gr); }
      else if (t.type === "expense" && t.isBusiness && t.gstCode === "GST") { quarters[q.label].totalPurchases += t.amount; quarters[q.label].gstPaid += t.amount * gr / (1 + gr); }
    });

    // Uncategorized count
    const uncategorized = transactions.filter((t) => t.category === "personal_other" || t.category === "other_income").length;

    return { totalIncome, totalExpenses, bizIncome, bizExpenses, deductible, monthlyData, categoryData, quarters, netSavings: totalIncome - totalExpenses, uncategorized };
  }, [transactions]);

  const filteredTxns = useMemo(() => {
    if (txnFilter === "business") return transactions.filter((t) => t.isBusiness);
    if (txnFilter === "personal") return transactions.filter((t) => !t.isBusiness);
    if (txnFilter === "uncategorized") return transactions.filter((t) => t.category === "personal_other" || t.category === "other_income");
    return transactions;
  }, [transactions, txnFilter]);

  const hasData = transactions.length > 0;
  const navItems = ["home", "dashboard", "transactions", "GST / BAS", "P&L", "invoices"];

  // ─── Styles ─────────────────────────────────────────────
  const card = { padding: 18, borderRadius: 12, background: "#111827", border: "1px solid #1e293b" };
  const mono = { fontFamily: "ui-monospace, 'Cascadia Code', monospace" };
  const pill = (active) => ({ padding: "6px 12px", borderRadius: 7, border: "none", background: active ? "rgba(16,185,129,0.15)" : "transparent", color: active ? "#10b981" : "#64748b", fontWeight: 600, fontSize: 12, cursor: "pointer" });
  const gBtn = { padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#10b981", fontWeight: 600, fontSize: 13, cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: "#0b1120", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 14, WebkitTouchCallout: "none", WebkitUserSelect: "none" }}>
      <input ref={fileRef} type="file" accept=".csv" multiple onChange={handleUpload} style={{ display: "none" }} />

      {/* ═══ HEADER ═══ */}
      <header style={{ borderBottom: "1px solid #1e293b", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0b1120", position: "sticky", top: 0, zIndex: 50 }}>
        <div onClick={() => setView("home")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "white" }}>$</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>CashFlow</div>
            <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.5px" }}>BOOKKEEPER</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {navItems.map((v) => {
            const label = v === "home" ? "🏠 Home" : v === "GST / BAS" ? "GST/BAS" : v.charAt(0).toUpperCase() + v.slice(1);
            const show = v === "home" || hasData;
            return show ? <button key={v} onClick={() => setView(v)} style={pill(view === v)}>{label}</button> : null;
          })}
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>

        {/* ═══ HOME — Command Center ═══ */}
        {view === "home" && (
          <div>
            {/* Welcome / Header */}
            <div style={{ textAlign: "center", paddingTop: hasData ? 20 : 50, marginBottom: hasData ? 24 : 36 }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>📒</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
                {hasData ? "What would you like to do?" : "Your Bookkeeper, Built In"}
              </h2>
              <p style={{ color: "#64748b", maxWidth: 440, margin: "0 auto", lineHeight: 1.5, fontSize: 13 }}>
                {hasData
                  ? "Upload statements, create invoices, add receipts, or review your books."
                  : "Upload bank statements, auto-categorize for tax, track GST for BAS, generate P&L reports, and manage invoices."}
              </p>
            </div>

            {/* First-time: Demo button */}
            {!hasData && (
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <button onClick={() => { setTransactions(generateDemoData()); setInvoices(generateDemoInvoices()); setView("dashboard"); }} style={{ padding: "12px 24px", borderRadius: 10, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  ✨ Try with Demo Data
                </button>
              </div>
            )}

            {/* ── Action Cards Grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: hasData ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: 14, maxWidth: 740, margin: "0 auto", marginBottom: 24 }}>
              {/* Upload Statements */}
              <div onClick={() => fileRef.current?.click()} style={{ ...card, cursor: "pointer", padding: 22, textAlign: "center", transition: "border-color 0.2s", borderColor: "#1e293b" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e293b"}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 10px" }}>📄</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Upload Statements</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>Import bank CSV files. Transactions are auto-categorized for tax.</div>
              </div>

              {/* Create Invoice */}
              <div onClick={() => { setShowNewInvoice(true); setView("invoices"); }} style={{ ...card, cursor: "pointer", padding: 22, textAlign: "center", transition: "border-color 0.2s", borderColor: "#1e293b" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e293b"}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #3b82f6, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 10px" }}>🧾</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Create Invoice</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>Create and track invoices with automatic GST calculation.</div>
              </div>

              {/* Add Receipt / Manual Transaction */}
              <div onClick={() => setShowManualTxn(true)} style={{ ...card, cursor: "pointer", padding: 22, textAlign: "center", transition: "border-color 0.2s", borderColor: "#1e293b" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e293b"}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 10px" }}>🧾</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Add Receipt / Expense</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>Manually add a receipt, expense, or income entry with tax details.</div>
              </div>

              {/* Quick Nav Cards — only show when data exists */}
              {hasData && <>
                <div onClick={() => setView("dashboard")} style={{ ...card, cursor: "pointer", padding: 18, textAlign: "center", transition: "border-color 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e293b"}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📊</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Dashboard</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>Overview & charts</div>
                </div>
                <div onClick={() => setView("GST / BAS")} style={{ ...card, cursor: "pointer", padding: 18, textAlign: "center", transition: "border-color 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(20,184,166,0.4)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e293b"}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>🧾</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>GST / BAS</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>Quarterly summary</div>
                </div>
                <div onClick={() => setView("P&L")} style={{ ...card, cursor: "pointer", padding: 18, textAlign: "center", transition: "border-color 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(236,72,153,0.4)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1e293b"}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📈</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Profit & Loss</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>Business P&L report</div>
                </div>
              </>}
            </div>

            {/* Manual Transaction / Receipt Modal */}
            {showManualTxn && (
              <div style={{ maxWidth: 560, margin: "0 auto 24px" }}>
                <div style={{ ...card }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>➕ Add Receipt / Transaction</div>
                    <button onClick={() => setShowManualTxn(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    const amt = parseFloat(fd.get("amount")) || 0;
                    const isIncome = fd.get("type") === "income";
                    const desc = fd.get("description") || "Manual Entry";
                    const catKey = fd.get("category");
                    const t = isIncome ? "income" : "expense";
                    const cat = TAX_CATEGORIES[t]?.[catKey];
                    const newTxn = {
                      id: crypto.randomUUID(),
                      date: fd.get("date") || new Date().toISOString().split("T")[0],
                      description: desc,
                      amount: amt,
                      type: t,
                      category: catKey,
                      gstCode: cat?.gst || "BAS_EXCLUDED",
                      isBusiness: cat?.deductible === true || (isIncome && !["other_income", "govt_income"].includes(catKey)),
                      notes: fd.get("notes") || "",
                    };
                    setTransactions((prev) => [newTxn, ...prev].sort((a, b) => new Date(b.date) - new Date(a.date)));
                    setShowManualTxn(false);
                  }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 2 }}>Type</label>
                      <select name="type" defaultValue="expense" onChange={(e) => setManualType(e.target.value)} style={{ width: "100%", padding: "8px 9px", background: "#0b1120", border: "1px solid #1e293b", borderRadius: 6, color: "#e2e8f0", fontSize: 12 }}>
                        <option value="expense">Expense / Receipt</option>
                        <option value="income">Income</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 2 }}>Category</label>
                      <select name="category" style={{ width: "100%", padding: "8px 9px", background: "#0b1120", border: "1px solid #1e293b", borderRadius: 6, color: "#e2e8f0", fontSize: 12 }}>
                        {manualType === "income" ? (
                          Object.entries(TAX_CATEGORIES.income).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)
                        ) : (<>
                          <optgroup label="Business (Deductible)">{Object.entries(TAX_CATEGORIES.expense).filter(([, v]) => v.deductible).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</optgroup>
                          <optgroup label="Personal">{Object.entries(TAX_CATEGORIES.expense).filter(([, v]) => !v.deductible).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</optgroup>
                        </>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 2 }}>Description</label>
                      <input name="description" type="text" placeholder="e.g. Office supplies from Officeworks" required style={{ width: "100%", padding: "8px 9px", background: "#0b1120", border: "1px solid #1e293b", borderRadius: 6, color: "#e2e8f0", fontSize: 12, boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 2 }}>Amount (incl. GST)</label>
                      <input name="amount" type="number" step="0.01" placeholder="150.00" required style={{ width: "100%", padding: "8px 9px", background: "#0b1120", border: "1px solid #1e293b", borderRadius: 6, color: "#e2e8f0", fontSize: 12, boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 2 }}>Date</label>
                      <input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} style={{ width: "100%", padding: "8px 9px", background: "#0b1120", border: "1px solid #1e293b", borderRadius: 6, color: "#e2e8f0", fontSize: 12, boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 2 }}>Notes (optional)</label>
                      <input name="notes" type="text" placeholder="Receipt #, client, etc." style={{ width: "100%", padding: "8px 9px", background: "#0b1120", border: "1px solid #1e293b", borderRadius: 6, color: "#e2e8f0", fontSize: 12, boxSizing: "border-box" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <button type="submit" style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                        Add Transaction
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Data Summary */}
            {hasData && (
              <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <div style={{ ...card }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 10 }}>📋 Data Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#0b1120" }}>
                      <div style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>Transactions</div>
                      <div style={{ fontSize: 18, fontWeight: 700, ...mono }}>{transactions.length}</div>
                    </div>
                    <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#0b1120" }}>
                      <div style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>Invoices</div>
                      <div style={{ fontSize: 18, fontWeight: 700, ...mono }}>{invoices.length}</div>
                    </div>
                    <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#0b1120" }}>
                      <div style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>Business</div>
                      <div style={{ fontSize: 18, fontWeight: 700, ...mono, color: "#10b981" }}>{transactions.filter((t) => t.isBusiness).length}</div>
                    </div>
                    <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#0b1120" }}>
                      <div style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>Uncategorized</div>
                      <div style={{ fontSize: 18, fontWeight: 700, ...mono, color: stats.uncategorized > 0 ? "#f59e0b" : "#10b981" }}>{stats.uncategorized}</div>
                    </div>
                  </div>
                  {stats.uncategorized > 0 && (
                    <button onClick={() => { setTxnFilter("uncategorized"); setView("transactions"); }} style={{ ...gBtn, width: "100%", marginBottom: 8, textAlign: "center" }}>
                      ⚠️ Review {stats.uncategorized} Uncategorized →
                    </button>
                  )}
                  <button onClick={clearAllData} style={{ width: "100%", padding: "7px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.04)", color: "#ef4444", fontWeight: 600, fontSize: 11, cursor: "pointer", textAlign: "center" }}>
                    Clear All Data
                  </button>
                </div>
              </div>
            )}

            {/* Feature cards for first-time users */}
            {!hasData && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, maxWidth: 660, margin: "28px auto 0" }}>
                {[["🏷️", "Auto-Categorize", "200+ AU keywords"], ["🧾", "GST / BAS", "Quarterly prep"], ["📊", "P&L Reports", "Business performance"], ["📄", "Invoices", "Create & track"], ["📈", "Trends", "Monthly charts"], ["💼", "Biz vs Personal", "Separate tracking"]].map(([ic, ti, de]) => (
                  <div key={ti} style={{ ...card, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 20, marginBottom: 3 }}>{ic}</div>
                    <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 1 }}>{ti}</div>
                    <div style={{ fontSize: 9, color: "#64748b" }}>{de}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ DASHBOARD ═══ */}
        {hasData && view === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
              {[
                { label: "Business Income", val: fmt(stats.bizIncome), color: "#10b981" },
                { label: "Business Expenses", val: fmt(stats.bizExpenses), color: "#ef4444" },
                { label: "Business Profit", val: fmt(stats.bizIncome - stats.bizExpenses), color: stats.bizIncome - stats.bizExpenses >= 0 ? "#10b981" : "#ef4444" },
              ].map((c) => (
                <div key={c.label} style={card}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c.color, ...mono }}>{c.val}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
              {[
                { label: "Total Income (All)", val: fmt(stats.totalIncome), color: "#94a3b8" },
                { label: "Tax Deductible", val: fmt(stats.deductible), color: "#8b5cf6" },
                { label: "Net Savings", val: fmt(stats.netSavings), color: stats.netSavings >= 0 ? "#10b981" : "#ef4444" },
              ].map((c) => (
                <div key={c.label} style={card}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>{c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c.color, ...mono }}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* Uncategorized alert */}
            {stats.uncategorized > 0 && (
              <div onClick={() => { setTxnFilter("uncategorized"); setView("transactions"); }} style={{ ...card, marginBottom: 16, cursor: "pointer", borderColor: "rgba(245,158,11,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
                <span style={{ fontSize: 13 }}>⚠️ <strong>{stats.uncategorized}</strong> transactions need categorization</span>
                <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>Review →</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Monthly Income vs Expenses</div>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={stats.monthlyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }} formatter={(v) => fmt(v)} />
                    <Bar dataKey="bizIncome" fill="#10b981" radius={[3, 3, 0, 0]} name="Biz Income" />
                    <Bar dataKey="bizExpenses" fill="#ef4444" radius={[3, 3, 0, 0]} name="Biz Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Expense Breakdown</div>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie data={stats.categoryData.slice(0, 8)} cx="50%" cy="50%" outerRadius={76} innerRadius={40} dataKey="value" nameKey="name" paddingAngle={2}>
                      {stats.categoryData.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }} formatter={(v) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick BAS */}
            {(() => { const cq = getBASQuarter(new Date()); const q = stats.quarters[cq.label]; if (!q) return null; const ow = q.gstCollected - q.gstPaid; return (
              <div style={{ ...card, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 3 }}>BAS — {cq.label}</div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                    <span>Collected: <strong style={{ color: "#10b981", ...mono }}>{fmt(q.gstCollected)}</strong></span>
                    <span>Credits: <strong style={{ color: "#3b82f6", ...mono }}>{fmt(q.gstPaid)}</strong></span>
                    <span>Net: <strong style={{ color: ow >= 0 ? "#ef4444" : "#10b981", ...mono }}>{fmt(Math.abs(ow))}</strong></span>
                  </div>
                </div>
                <button onClick={() => setView("GST / BAS")} style={gBtn}>View BAS →</button>
              </div>
            ); })()}
          </div>
        )}

        {/* ═══ TRANSACTIONS ═══ */}
        {hasData && view === "transactions" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Transactions</h2>
                <span style={{ color: "#64748b", fontSize: 12 }}>({filteredTxns.length})</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["all", "business", "personal", "uncategorized"].map((f) => (
                  <button key={f} onClick={() => setTxnFilter(f)} style={pill(txnFilter === f)}>
                    {f === "uncategorized" ? `⚠️ Uncategorized (${stats.uncategorized})` : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "82px 1fr 150px 78px 100px 56px", padding: "8px 12px", background: "#0f172a", fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <div>Date</div><div>Description</div><div>Category</div><div>GST</div><div style={{ textAlign: "right" }}>Amount</div><div style={{ textAlign: "center" }}>Biz</div>
              </div>
              <div style={{ maxHeight: 440, overflowY: "auto" }}>
                {filteredTxns.map((t) => {
                  const cat = TAX_CATEGORIES[t.type]?.[t.category];
                  const isUncat = t.category === "personal_other" || t.category === "other_income";
                  return (
                    <div key={t.id} style={{ display: "grid", gridTemplateColumns: "82px 1fr 150px 78px 100px 56px", padding: "8px 12px", borderTop: "1px solid #1e293b", alignItems: "center", fontSize: 12, background: isUncat ? "rgba(245,158,11,0.03)" : "transparent" }}>
                      <div style={{ color: "#64748b", ...mono, fontSize: 10 }}>{new Date(t.date).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}</div>
                      <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 6 }}>{t.description}</div>
                      <div>
                        {editingTxn === t.id ? (
                          <select value={t.category} onChange={(e) => {
                            const nc = e.target.value;
                            const nt = TAX_CATEGORIES.income[nc] ? "income" : "expense";
                            const ncat = TAX_CATEGORIES[nt]?.[nc];
                            setTransactions((p) => p.map((x) => x.id === t.id ? { ...x, category: nc, type: nt, gstCode: ncat?.gst || "BAS_EXCLUDED", isBusiness: ncat?.deductible === true || (nt === "income" && !["other_income", "govt_income"].includes(nc)) } : x));
                            setEditingTxn(null);
                          }} onBlur={() => setEditingTxn(null)} autoFocus style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 4, padding: "2px 4px", fontSize: 10, width: "100%" }}>
                            <optgroup label="── Income">{Object.entries(TAX_CATEGORIES.income).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</optgroup>
                            <optgroup label="── Business (Deductible)">{Object.entries(TAX_CATEGORIES.expense).filter(([, v]) => v.deductible).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</optgroup>
                            <optgroup label="── Personal">{Object.entries(TAX_CATEGORIES.expense).filter(([, v]) => !v.deductible).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</optgroup>
                          </select>
                        ) : (
                          <span onClick={() => setEditingTxn(t.id)} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: isUncat ? "rgba(245,158,11,0.12)" : "#1e293b", border: isUncat ? "1px solid rgba(245,158,11,0.25)" : "none", cursor: "pointer", whiteSpace: "nowrap", color: isUncat ? "#f59e0b" : "#e2e8f0" }}>
                            {cat?.icon} {cat?.label || t.category} {isUncat ? "✏️" : ""}
                          </span>
                        )}
                      </div>
                      <div><span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: t.gstCode === "GST" ? "rgba(16,185,129,0.1)" : "rgba(148,163,184,0.06)", color: t.gstCode === "GST" ? "#10b981" : "#64748b" }}>{GST_CODES[t.gstCode]?.label || t.gstCode}</span></div>
                      <div style={{ textAlign: "right", fontWeight: 600, ...mono, color: t.type === "income" ? "#10b981" : "#ef4444", fontSize: 12 }}>{t.type === "income" ? "+" : "-"}{fmt(t.amount)}</div>
                      <div style={{ textAlign: "center" }}>
                        <button onClick={() => setTransactions((p) => p.map((x) => x.id === t.id ? { ...x, isBusiness: !x.isBusiness } : x))} style={{ background: t.isBusiness ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.08)", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 9, color: t.isBusiness ? "#10b981" : "#64748b", cursor: "pointer", fontWeight: 600 }}>
                          {t.isBusiness ? "BIZ" : "PRSNL"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ GST / BAS ═══ */}
        {hasData && view === "GST / BAS" && (() => {
          const qKeys = Object.keys(stats.quarters).sort();
          const q = stats.quarters[basQuarter];
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>GST / BAS Summary</h2>
                <div style={{ display: "flex", gap: 4 }}>{qKeys.map((k) => <button key={k} onClick={() => setBasQuarter(k)} style={pill(basQuarter === k)}>{k}</button>)}</div>
              </div>
              {!q ? <div style={card}><p style={{ color: "#64748b" }}>No data for this quarter.</p></div> : (() => {
                const ow = q.gstCollected - q.gstPaid;
                const gstTxns = transactions.filter((t) => getBASQuarter(t.date).label === basQuarter && t.isBusiness && t.gstCode === "GST");
                return (<div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
                    {[{ l: "G1 - Total Sales", v: fmt(q.totalSales), c: "#94a3b8" }, { l: "1A - GST Collected", v: fmt(q.gstCollected), c: "#10b981" }, { l: "1B - GST Credits", v: fmt(q.gstPaid), c: "#3b82f6" }, { l: ow >= 0 ? "Net GST Owing" : "Net GST Refund", v: fmt(Math.abs(ow)), c: ow >= 0 ? "#ef4444" : "#10b981" }].map((c) => (
                      <div key={c.l} style={card}><div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>{c.l}</div><div style={{ fontSize: 22, fontWeight: 700, color: c.c, ...mono }}>{c.v}</div></div>
                    ))}
                  </div>
                  <div style={{ ...card, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 10 }}>BAS Worksheet — {basQuarter}</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr style={{ borderBottom: "1px solid #1e293b" }}><td style={{ padding: "6px 0", color: "#64748b", fontWeight: 600, fontSize: 10 }}>FIELD</td><td style={{ padding: "6px 0", color: "#64748b", fontWeight: 600, fontSize: 10 }}>DESCRIPTION</td><td style={{ padding: "6px 0", color: "#64748b", fontWeight: 600, fontSize: 10, textAlign: "right" }}>AMOUNT</td></tr></thead>
                      <tbody>
                        {[["G1", "Total sales (incl. GST)", fmt(q.totalSales)], ["G3", "GST-free sales", fmt(0)], ["G11", "Non-capital purchases", fmt(q.totalPurchases)], ["1A", "GST on sales", fmt(q.gstCollected)], ["1B", "GST on purchases", fmt(q.gstPaid)], ["─", ow >= 0 ? "GST payable" : "GST refund", fmt(Math.abs(ow))]].map(([f, d, a], i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}><td style={{ padding: "7px 0", ...mono, fontSize: 11, color: "#10b981" }}>{f}</td><td style={{ padding: "7px 0" }}>{d}</td><td style={{ padding: "7px 0", textAlign: "right", ...mono, fontWeight: 600 }}>{a}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "9px 14px", fontSize: 12, fontWeight: 600, color: "#94a3b8", borderBottom: "1px solid #1e293b" }}>GST Transactions ({gstTxns.length})</div>
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      {gstTxns.map((t) => { const ga = t.amount * GST_RATE / (1 + GST_RATE); return (
                        <div key={t.id} style={{ display: "grid", gridTemplateColumns: "74px 1fr 80px 80px", padding: "6px 14px", borderTop: "1px solid #1e293b", fontSize: 11, alignItems: "center" }}>
                          <div style={{ color: "#64748b", ...mono, fontSize: 10 }}>{new Date(t.date).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}</div>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
                          <div style={{ textAlign: "right", ...mono, color: "#64748b" }}>GST {fmt(ga)}</div>
                          <div style={{ textAlign: "right", ...mono, fontWeight: 600, color: t.type === "income" ? "#10b981" : "#ef4444" }}>{t.type === "income" ? "+" : "-"}{fmt(t.amount)}</div>
                        </div>
                      ); })}
                      {gstTxns.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 12 }}>No GST transactions</div>}
                    </div>
                  </div>
                </div>);
              })()}
            </div>
          );
        })()}

        {/* ═══ P&L ═══ */}
        {hasData && view === "P&L" && (() => {
          const months = [...new Set(transactions.map((t) => t.date.substring(0, 7)))].sort();
          const filt = plPeriod === "all" ? transactions.filter((t) => t.isBusiness) : transactions.filter((t) => t.isBusiness && t.date.startsWith(plPeriod));
          const incL = {}; const expL = {};
          filt.forEach((t) => { const l = TAX_CATEGORIES[t.type]?.[t.category]?.label || t.category; if (t.type === "income") incL[l] = (incL[l] || 0) + t.amount; else expL[l] = (expL[l] || 0) + t.amount; });
          const tR = Object.values(incL).reduce((s, v) => s + v, 0);
          const tE = Object.values(expL).reduce((s, v) => s + v, 0);
          const nP = tR - tE;
          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Profit & Loss</h2>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button onClick={() => setPlPeriod("all")} style={pill(plPeriod === "all")}>All</button>
                  {months.slice(-6).map((m) => <button key={m} onClick={() => setPlPeriod(m)} style={pill(plPeriod === m)}>{new Date(m + "-15").toLocaleDateString("en-AU", { month: "short", year: "2-digit" })}</button>)}
                </div>
              </div>
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 10 }}>Business Profit Trend</div>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={stats.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickFormatter={(v) => fmt(v)} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }} formatter={(v) => fmt(v)} />
                    <Line type="monotone" dataKey="bizNet" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981" }} name="Business Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #1e293b" }}>Revenue</div>
                  {Object.entries(incL).sort(([, a], [, b]) => b - a).map(([l, a]) => (<div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 4px 12px", fontSize: 12 }}><span>{l}</span><span style={{ ...mono, color: "#10b981" }}>{fmt(a)}</span></div>))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4, borderTop: "1px solid #1e293b", fontWeight: 700 }}><span>Total Revenue</span><span style={{ ...mono, color: "#10b981" }}>{fmt(tR)}</span></div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #1e293b" }}>Expenses</div>
                  {Object.entries(expL).sort(([, a], [, b]) => b - a).map(([l, a]) => (<div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 4px 12px", fontSize: 12 }}><span>{l}</span><span style={{ ...mono, color: "#ef4444" }}>{fmt(a)}</span></div>))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4, borderTop: "1px solid #1e293b", fontWeight: 700 }}><span>Total Expenses</span><span style={{ ...mono, color: "#ef4444" }}>{fmt(tE)}</span></div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "2px solid #334155", fontSize: 16, fontWeight: 700 }}><span>Net Profit</span><span style={{ ...mono, color: nP >= 0 ? "#10b981" : "#ef4444" }}>{fmt(nP)}</span></div>
              </div>
            </div>
          );
        })()}

        {/* ═══ INVOICES ═══ */}
        {hasData && view === "invoices" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Invoices</h2>
              <button onClick={() => setShowNewInvoice(!showNewInvoice)} style={gBtn}>{showNewInvoice ? "Cancel" : "+ New Invoice"}</button>
            </div>
            {showNewInvoice && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 10 }}>Create Invoice</div>
                <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target); const a = parseFloat(fd.get("amount")) || 0; const g = a * GST_RATE;
                  setInvoices((p) => [{ id: crypto.randomUUID(), number: "INV-" + (1044 + p.length + 1), client: fd.get("client"), description: fd.get("description"), amount: a, gst: g, total: a + g, date: fd.get("date") || new Date().toISOString().split("T")[0], dueDate: fd.get("dueDate") || "", status: "draft" }, ...p]); setShowNewInvoice(false);
                }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[{ n: "client", l: "Client", t: "text", p: "Acme Corp" }, { n: "description", l: "Description", t: "text", p: "Web Design" }, { n: "amount", l: "Amount (ex GST)", t: "number", p: "1500" }, { n: "date", l: "Date", t: "date" }, { n: "dueDate", l: "Due Date", t: "date" }].map((f) => (
                    <div key={f.n}><label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, display: "block", marginBottom: 2 }}>{f.l}</label><input name={f.n} type={f.t} placeholder={f.p} required={f.n !== "dueDate"} style={{ width: "100%", padding: "7px 9px", background: "#0b1120", border: "1px solid #1e293b", borderRadius: 6, color: "#e2e8f0", fontSize: 12, boxSizing: "border-box" }} /></div>
                  ))}
                  <div style={{ display: "flex", alignItems: "end" }}><button type="submit" style={{ ...gBtn, width: "100%", padding: "9px" }}>Create</button></div>
                </form>
              </div>
            )}
            <div style={{ display: "grid", gap: 10 }}>
              {invoices.map((inv) => (
                <div key={inv.id} style={{ ...card, display: "grid", gridTemplateColumns: "70px 1fr 1fr 90px 80px 70px", alignItems: "center", gap: 8, padding: 12 }}>
                  <div style={{ ...mono, fontSize: 11, color: "#10b981", fontWeight: 600 }}>{inv.number}</div>
                  <div><div style={{ fontWeight: 600, fontSize: 13 }}>{inv.client}</div><div style={{ fontSize: 11, color: "#64748b" }}>{inv.description}</div></div>
                  <div style={{ fontSize: 11, color: "#64748b" }}><div>Issued: {new Date(inv.date).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}</div>{inv.dueDate && <div>Due: {new Date(inv.dueDate).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}</div>}</div>
                  <div style={{ textAlign: "right" }}><div style={{ ...mono, fontWeight: 700, fontSize: 13 }}>{fmt(inv.total)}</div><div style={{ fontSize: 9, color: "#64748b" }}>GST {fmt(inv.gst)}</div></div>
                  <div style={{ textAlign: "center" }}><span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: statusColors[inv.status]?.bg, color: statusColors[inv.status]?.color, fontWeight: 600, textTransform: "uppercase" }}>{inv.status}</span></div>
                  <select value={inv.status} onChange={(e) => setInvoices((p) => p.map((i) => i.id === inv.id ? { ...i, status: e.target.value } : i))} style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 4, padding: "2px 3px", fontSize: 10 }}><option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select>
                </div>
              ))}
              {invoices.length === 0 && <div style={{ ...card, textAlign: "center", color: "#64748b", padding: 36 }}>No invoices yet.</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
