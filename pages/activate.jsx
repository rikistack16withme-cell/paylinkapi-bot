import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';
import {
  Key,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Building2,
  Calendar,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Bot,
  CreditCard,
  Sliders,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Search,
  DollarSign,
  Layers,
  ChevronRight
} from 'lucide-react';

const DURATION_PRESETS = [
  { days: 7, label: '7 Days', desc: 'Trial / Sandbox', badge: 'Fast Test' },
  { days: 30, label: '30 Days', desc: '1 Month Standard', badge: 'Popular' },
  { days: 90, label: '90 Days', desc: '3 Months Quarter', badge: 'Value' },
  { days: 180, label: '180 Days', desc: '6 Months Half-Year', badge: 'Pro' },
  { days: 365, label: '365 Days', desc: '1 Year License', badge: 'VIP' },
  { days: 9999, label: 'Permanent', desc: 'Lifetime Active', badge: 'Enterprise' }
];

export default function ActivateKeyPortal() {
  const router = useRouter();
  const { key: queryKey, api_key: queryApiKey, days: queryDays, rail: queryRail } = router.query;

  // Key & Search State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState(null);
  const [inspectError, setInspectError] = useState('');

  // Configuration State
  const [rail, setRail] = useState('bundle'); // 'bundle', 'bakong', 'aba'
  const [abaMode, setAbaMode] = useState('both'); // 'both', 'usd', 'khr'
  const [bakongId, setBakongId] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [usdLink, setUsdLink] = useState('');
  const [khrLink, setKhrLink] = useState('');

  // Duration State
  const [durationDays, setDurationDays] = useState(30);
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState('');

  // Submission & Result State
  const [isActivating, setIsActivating] = useState(false);
  const [activatedResult, setActivatedResult] = useState(null);
  const [actionError, setActionError] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Initialize from Query Params
  useEffect(() => {
    const initialKey = queryKey || queryApiKey || '';
    if (initialKey) {
      setApiKeyInput(initialKey);
      inspectApiKey(initialKey);
    }
    if (queryDays) {
      const d = parseInt(queryDays, 10);
      if (!isNaN(d) && d > 0) {
        setDurationDays(d);
        if (![7, 30, 90, 180, 365, 9999].includes(d)) {
          setIsCustomDays(true);
          setCustomDaysInput(String(d));
        }
      }
    }
    if (queryRail && ['bakong', 'aba', 'bundle'].includes(queryRail)) {
      setRail(queryRail);
    }
  }, [queryKey, queryApiKey, queryDays, queryRail]);

  // Inspect existing API Key details from API
  const inspectApiKey = async (keyToInspect) => {
    const targetKey = (keyToInspect || apiKeyInput).trim();
    if (!targetKey) return;

    setIsInspecting(true);
    setInspectError('');

    try {
      const res = await fetch(`/api/keys/status?api_key=${encodeURIComponent(targetKey)}`);
      const data = await res.json();

      if (data && data.success) {
        setInspectResult(data);
        if (data.merchantName && !merchantName) setMerchantName(data.merchantName);
        if (data.bakongId && !bakongId) setBakongId(data.bakongId);
        if (data.usdLink && !usdLink) setUsdLink(data.usdLink);
        if (data.khrLink && !khrLink) setKhrLink(data.khrLink);

        // Deduce rail from provider
        const prov = (data.provider || '').toLowerCase();
        if (prov.includes('bakong') && !prov.includes('aba')) {
          setRail('bakong');
        } else if (prov.includes('aba') && !prov.includes('bakong')) {
          setRail('aba');
          if (data.usdLink && !data.khrLink) setAbaMode('usd');
          else if (data.khrLink && !data.usdLink) setAbaMode('khr');
          else setAbaMode('both');
        } else {
          setRail('bundle');
          if (data.usdLink && !data.khrLink) setAbaMode('usd');
          else if (data.khrLink && !data.usdLink) setAbaMode('khr');
          else setAbaMode('both');
        }

        if (data.durationDays && !queryDays) {
          setDurationDays(data.durationDays);
        }
      } else {
        setInspectResult(null);
        // If not found in DB, it's totally fine (migrated / new standalone key)
      }
    } catch (_) {
      // Offline or network error
    } finally {
      setIsInspecting(false);
    }
  };

  // Calculate target expiry date preview
  const calculateExpiryPreview = () => {
    const days = isCustomDays ? (parseInt(customDaysInput, 10) || 30) : durationDays;
    if (days >= 9999) return '♾️ Permanent (No Expiration)';
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) + ` (+${days} days)`;
  };

  // Submit Activation Request
  const handleActivate = async (e) => {
    if (e) e.preventDefault();
    setActionError('');

    const targetKey = apiKeyInput.trim();
    if (!targetKey) {
      setActionError('សូមបញ្ចូល API Key របស់អ្នក (Please enter your API Key).');
      return;
    }

    const finalDays = isCustomDays ? (parseInt(customDaysInput, 10) || 30) : durationDays;

    let resolvedProvider = 'Dual Suite (ABA & Bakong)';
    let finalBakong = null;
    let finalUsd = null;
    let finalKhr = null;

    if (rail === 'bakong') {
      resolvedProvider = 'Bakong KHQR';
      finalBakong = bakongId.trim() || 'soksitchey1@aclb';
    } else if (rail === 'aba') {
      resolvedProvider = 'ABA PayWay Gateway';
      if (abaMode === 'usd') {
        finalUsd = usdLink.trim() || 'https://link.payway.com.kh/ABAPAYdefaultusd';
      } else if (abaMode === 'khr') {
        finalKhr = khrLink.trim() || 'https://link.payway.com.kh/ABAPAYdefaultkhr';
      } else {
        finalUsd = usdLink.trim() || 'https://link.payway.com.kh/ABAPAYdefaultusd';
        finalKhr = khrLink.trim() || 'https://link.payway.com.kh/ABAPAYdefaultkhr';
      }
    } else {
      // Dual
      resolvedProvider = 'Dual Suite (ABA & Bakong)';
      finalBakong = bakongId.trim() || 'soksitchey1@aclb';
      if (abaMode === 'usd') {
        finalUsd = usdLink.trim() || 'https://link.payway.com.kh/ABAPAYdefaultusd';
      } else if (abaMode === 'khr') {
        finalKhr = khrLink.trim() || 'https://link.payway.com.kh/ABAPAYdefaultkhr';
      } else {
        finalUsd = usdLink.trim() || 'https://link.payway.com.kh/ABAPAYdefaultusd';
        finalKhr = khrLink.trim() || 'https://link.payway.com.kh/ABAPAYdefaultkhr';
      }
    }

    setIsActivating(true);

    try {
      const res = await fetch('/api/keys/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: targetKey,
          provider: resolvedProvider,
          merchantName: merchantName.trim() || 'Merchant Store',
          bakongId: finalBakong,
          usdLink: finalUsd,
          khrLink: finalKhr,
          durationDays: finalDays
        })
      });

      const data = await res.json();

      if (data && data.success && data.key) {
        setActivatedResult(data.key);
        try {
          confetti({
            particleCount: 70,
            spread: 80,
            origin: { y: 0.6 }
          });
        } catch (_) {}
      } else {
        setActionError(data.message || data.error || 'Failed to activate key. Please try again.');
      }
    } catch (err) {
      setActionError(`Network connection error: ${err.message}`);
    } finally {
      setIsActivating(false);
    }
  };

  const copyToClipboard = (text, type) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } else {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      }
    }
  };

  return (
    <>
      <Head>
        <title>Key Activation & Configuration Portal • PayLinkAPI</title>
        <meta name="description" content="Reactivate, customize payment rails, and set expiration duration for your PayLinkAPI key." />
      </Head>

      <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white pb-12">
        {/* Background glow effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-[128px]" />
          <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-[128px]" />
          <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-[128px]" />
        </div>

        {/* Top Navbar */}
        <header className="relative z-10 border-b border-slate-800/80 bg-[#070b14]/80 backdrop-blur-md px-4 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base">PayLinkAPI</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Key Portal
                </span>
              </div>
              <p className="text-xs text-slate-400">Universal Payment Gateway Infrastructure</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.push('/test')}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all flex items-center gap-1.5 border border-slate-700/60"
            >
              <CreditCard className="w-3.5 h-3.5 text-blue-400" />
              <span>Test Pay</span>
            </button>
            <a
              href="https://t.me/PayLinkAPI_bot"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Telegram Bot</span>
            </a>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 max-w-4xl w-full mx-auto px-4 py-8 flex-1">
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>API Key Activation & Customization Suite</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-2">
              បើកដំណើរការ & កំណត់ KEY លើ WEB
            </h1>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
              Activate old keys, upgrade to v2 high-speed engine (~200ms), and configure Bakong KHQR, ABA PayWay, and expiration validity.
            </p>
          </div>

          {/* Success Result View */}
          {activatedResult ? (
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-emerald-500/10 relative overflow-hidden animate-fadeIn">
              <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="flex items-center gap-3.5 mb-6 pb-6 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    KEY ត្រូវបានបើកដំណើរការជោគជ័យ!
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      LIVE ACTIVE
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Your key is now live with high-speed response (~200ms) and verified Cambodian payment rails.
                  </p>
                </div>
              </div>

              {/* API Key Box */}
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Production API Key
                </label>
                <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl p-3 font-mono text-sm text-blue-400">
                  <span className="flex-1 break-all select-all">{activatedResult.apiKey}</span>
                  <button
                    onClick={() => copyToClipboard(activatedResult.apiKey, 'key')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-xs"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Webhook Secret Box */}
              <div className="mb-6">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Client Webhook Secret
                </label>
                <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl p-3 font-mono text-sm text-purple-400">
                  <span className="flex-1 break-all select-all">{activatedResult.secret || 'whsec_live_default'}</span>
                  <button
                    onClick={() => copyToClipboard(activatedResult.secret || 'whsec_live_default', 'secret')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-xs"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Telemetry Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">Payment Rail</span>
                  <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    {activatedResult.provider}
                  </span>
                </div>
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">Store / Brand</span>
                  <span className="text-sm font-semibold text-white truncate block">
                    {activatedResult.merchantName || 'Merchant Store'}
                  </span>
                </div>
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">Validity Duration</span>
                  <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {activatedResult.durationDays >= 9999 ? 'Permanent' : `${activatedResult.durationDays} Days`}
                  </span>
                </div>
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">Expires At</span>
                  <span className="text-sm font-semibold text-slate-200">
                    {activatedResult.expiresAt ? new Date(activatedResult.expiresAt).toLocaleDateString() : 'Active'}
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => router.push(`/test?api_key=${encodeURIComponent(activatedResult.apiKey)}`)}
                  className="flex-1 min-w-[160px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>ធ្វើតេស្តបង់ប្រាក់ (Test Pay)</span>
                </button>
                <button
                  onClick={() => {
                    setActivatedResult(null);
                    setApiKeyInput('');
                    setInspectResult(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors flex items-center gap-2 border border-slate-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Activate Another Key</span>
                </button>
                <a
                  href="https://t.me/PayLinkAPI_bot"
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors flex items-center gap-2 border border-slate-700"
                >
                  <Bot className="w-4 h-4 text-blue-400" />
                  <span>Telegram Dashboard</span>
                </a>
              </div>
            </div>
          ) : (
            /* Activation Form */
            <form onSubmit={handleActivate} className="space-y-6">
              {/* Step 1: Input API Key */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">
                      1
                    </span>
                    <h2 className="text-base font-bold text-white">បញ្ចូល API Key របស់អ្នក (Enter Your API Key)</h2>
                  </div>
                  {inspectResult && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Key Found in System
                    </span>
                  )}
                </div>

                <div className="relative flex items-center">
                  <Key className="absolute left-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      if (inspectResult) setInspectResult(null);
                    }}
                    onBlur={() => inspectApiKey(apiKeyInput)}
                    placeholder="e.g. plk_live_xxxxxxxxxxxx or dp_live_xxxxxxxxxxxx"
                    className="w-full pl-11 pr-28 py-3 bg-slate-950/70 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => inspectApiKey(apiKeyInput)}
                    disabled={isInspecting || !apiKeyInput.trim()}
                    className="absolute right-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-300 transition-colors flex items-center gap-1 border border-slate-700"
                  >
                    {isInspecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>Inspect</span>
                  </button>
                </div>

                {inspectResult && (
                  <div className="mt-3.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-slate-500 block">Status</span>
                      <span className={`font-semibold ${inspectResult.isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                        {inspectResult.status || (inspectResult.isExpired ? 'EXPIRED' : 'ACTIVE')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Current Rail</span>
                      <span className="font-semibold text-slate-200 truncate block">{inspectResult.provider || 'Universal'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Current Store</span>
                      <span className="font-semibold text-slate-200 truncate block">{inspectResult.merchantName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Expires</span>
                      <span className="font-semibold text-slate-200">{inspectResult.expiresAt ? new Date(inspectResult.expiresAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Choose Payment Rail */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">
                    2
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-white">ជ្រើសរើសប្រភេទប្រព័ន្ធទូទាត់ (Select Payment Rail)</h2>
                    <p className="text-xs text-slate-400">Configure what payment methods this key supports.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  {/* Bakong Only */}
                  <div
                    onClick={() => setRail('bakong')}
                    className={`cursor-pointer rounded-xl p-4 border transition-all relative ${
                      rail === 'bakong'
                        ? 'bg-red-950/30 border-red-500/60 shadow-lg shadow-red-500/10'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg">🔴</span>
                      {rail === 'bakong' && <CheckCircle2 className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="font-bold text-white text-sm">Bakong Only</div>
                    <div className="text-xs text-slate-400 mt-1">National KHQR QR standard. Customer payments deposit into Bakong.</div>
                  </div>

                  {/* ABA PayWay Only */}
                  <div
                    onClick={() => setRail('aba')}
                    className={`cursor-pointer rounded-xl p-4 border transition-all relative ${
                      rail === 'aba'
                        ? 'bg-blue-950/30 border-blue-500/60 shadow-lg shadow-blue-500/10'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg">🔵</span>
                      {rail === 'aba' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="font-bold text-white text-sm">ABA PayWay Only</div>
                    <div className="text-xs text-slate-400 mt-1">ABA PayWay checkout gateway. Supports USD, KHR, or Both.</div>
                  </div>

                  {/* Dual Suite */}
                  <div
                    onClick={() => setRail('bundle')}
                    className={`cursor-pointer rounded-xl p-4 border transition-all relative ${
                      rail === 'bundle'
                        ? 'bg-purple-950/30 border-purple-500/60 shadow-lg shadow-purple-500/10'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg">🟣</span>
                      {rail === 'bundle' && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                    </div>
                    <div className="font-bold text-white text-sm">Dual Suite (All-In-One)</div>
                    <div className="text-xs text-slate-400 mt-1">Universal Cambodian clearing: Bakong KHQR + ABA PayWay USD & KHR.</div>
                  </div>
                </div>

                {/* Sub-inputs for chosen rail */}
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-4">
                  {/* Bakong ID Input (for Bakong & Dual) */}
                  {(rail === 'bakong' || rail === 'bundle') && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          🔴 Bakong Account ID / Phone
                        </label>
                        <button
                          type="button"
                          onClick={() => setBakongId('soksitchey1@aclb')}
                          className="text-[11px] text-blue-400 hover:underline"
                        >
                          Use Demo (soksitchey1@aclb)
                        </button>
                      </div>
                      <input
                        type="text"
                        value={bakongId}
                        onChange={(e) => setBakongId(e.target.value)}
                        placeholder="e.g. soksitchey1@aclb or 0977416126"
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Store Name Customization ("merchan customice") */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      🏷️ ឈ្មោះហាងផ្ទាល់ខ្លួន (Custom Merchant / Store Name)
                    </label>
                    <input
                      type="text"
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      placeholder="e.g. Kai Coffee Shop, Riki Tech Store"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      ឈ្មោះនេះនឹងបង្ហាញលើវិក្កយបត្រ និង QR Code ពេលអតិថិជនស្កេនទូទាត់។
                    </span>
                  </div>

                  {/* ABA Currency Mode & Links (for ABA & Dual) */}
                  {(rail === 'aba' || rail === 'bundle') && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        🔵 ជម្រើសរូបិយប័ណ្ណ ABA PayWay (ABA Currency Option)
                      </label>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setAbaMode('usd')}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                            abaMode === 'usd'
                              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          💵 USD Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setAbaMode('khr')}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                            abaMode === 'khr'
                              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          ៛ KHR (Riel) Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setAbaMode('both')}
                          className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                            abaMode === 'both'
                              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          💵+៛ Both ($ & ៛)
                        </button>
                      </div>

                      {/* USD Link Input */}
                      {(abaMode === 'usd' || abaMode === 'both') && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-slate-300">
                              💵 ABA PayWay USD Payment Link
                            </label>
                            <button
                              type="button"
                              onClick={() => setUsdLink('https://link.payway.com.kh/ABAPAYusdstandard')}
                              className="text-[11px] text-blue-400 hover:underline"
                            >
                              Use Default
                            </button>
                          </div>
                          <input
                            type="url"
                            value={usdLink}
                            onChange={(e) => setUsdLink(e.target.value)}
                            placeholder="https://link.payway.com.kh/ABAPAYxxxxxxx"
                            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}

                      {/* KHR Link Input */}
                      {(abaMode === 'khr' || abaMode === 'both') && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-slate-300">
                              ៛ ABA PayWay KHR (Riel) Payment Link
                            </label>
                            <button
                              type="button"
                              onClick={() => setKhrLink('https://link.payway.com.kh/ABAPAYkhrstandard')}
                              className="text-[11px] text-blue-400 hover:underline"
                            >
                              Use Default
                            </button>
                          </div>
                          <input
                            type="url"
                            value={khrLink}
                            onChange={(e) => setKhrLink(e.target.value)}
                            placeholder="https://link.payway.com.kh/ABAPAYxxxxxxx"
                            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Set Expiry Duration ("set have many days for this key") */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">
                      3
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-white">កំណត់ចំនួនថ្ងៃផុតកំណត់ (Set Expiry Duration)</h2>
                      <p className="text-xs text-slate-400">Choose how many days this key will remain active.</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="text-[11px] text-slate-400 block">Preview Expiry:</span>
                    <span className="text-xs font-semibold text-emerald-400">{calculateExpiryPreview()}</span>
                  </div>
                </div>

                {/* Duration Presets Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
                  {DURATION_PRESETS.map((preset) => {
                    const isSelected = !isCustomDays && durationDays === preset.days;
                    return (
                      <div
                        key={preset.days}
                        onClick={() => {
                          setIsCustomDays(false);
                          setDurationDays(preset.days);
                        }}
                        className={`cursor-pointer rounded-xl p-3 border text-center transition-all relative ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 shadow-md shadow-blue-500/10'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider block mx-auto w-max mb-1.5 ${
                          isSelected ? 'bg-blue-500/30 text-blue-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {preset.badge}
                        </span>
                        <div className="font-bold text-sm text-white">{preset.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Days Input Toggle */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="customDaysCheck"
                      checked={isCustomDays}
                      onChange={(e) => {
                        setIsCustomDays(e.target.checked);
                        if (e.target.checked && !customDaysInput) setCustomDaysInput('45');
                      }}
                      className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="customDaysCheck" className="text-xs text-slate-300 cursor-pointer">
                      កំណត់ចំនួនថ្ងៃផ្ទាល់ខ្លួន (Custom Days Input)
                    </label>
                  </div>

                  {isCustomDays && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="9999"
                        value={customDaysInput}
                        onChange={(e) => setCustomDaysInput(e.target.value)}
                        placeholder="Enter days (e.g. 45)"
                        className="w-36 px-3 py-1.5 bg-slate-950 border border-blue-500/60 rounded-lg text-white font-mono text-sm focus:outline-none"
                      />
                      <span className="text-xs text-slate-400">ថ្ងៃ (days)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {actionError && (
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isActivating || !apiKeyInput.trim()}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-base transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-blue-600/30 cursor-pointer"
              >
                {isActivating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>កំពុងបើកដំណើរការ Key... (Activating Key...)</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 text-yellow-300" />
                    <span>បើកដំណើរការ Key ឥឡូវនេះ • ACTIVATE KEY NOW</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-slate-800/60 mt-12 py-6 px-4 text-center text-xs text-slate-500">
          <p>© 2026 PayLinkAPI Gateway Engine. High-Speed Cambodian Financial Infrastructure.</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <button onClick={() => router.push('/test')} className="hover:text-slate-300">Test Pay</button>
            <span>•</span>
            <button onClick={() => router.push('/')} className="hover:text-slate-300">Registration</button>
            <span>•</span>
            <a href="https://t.me/PayLinkAPI_bot" target="_blank" rel="noreferrer" className="hover:text-slate-300">Telegram Bot</a>
          </div>
        </footer>
      </div>
    </>
  );
}
