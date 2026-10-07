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
  User,
  AlertCircle,
  FileText,
  Terminal
} from 'lucide-react';

export default function AdminKeyGenerator() {
  const router = useRouter();
  const { aba_link, bakong_id, tg_id, rail: queryRail, days: queryDays, name: queryName } = router.query;

  // Form State
  const [mode, setMode] = useState('standalone'); // 'standalone' or 'merchant'
  const [targetId, setTargetId] = useState('');
  const [rail, setRail] = useState('bundle'); // 'bundle', 'bakong', 'aba'
  const [durationDays, setDurationDays] = useState(365);
  const [customDays, setCustomDays] = useState('');
  const [isCustomDays, setIsCustomDays] = useState(false);

  // Merchant Credentials
  const [bakongId, setBakongId] = useState('');
  const [usdLink, setUsdLink] = useState('');
  const [khrLink, setKhrLink] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [phone, setPhone] = useState('');

  // Merchants list from DB
  const [merchantsList, setMerchantsList] = useState([]);
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(false);

  // Submission & Result state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Sync URL query parameters
  useEffect(() => {
    if (aba_link) {
      setUsdLink(String(aba_link));
      if (!queryRail) setRail('aba');
    }
    if (bakong_id) {
      setBakongId(String(bakong_id));
      if (!queryRail && !aba_link) setRail('bakong');
    }
    if (queryRail && ['bundle', 'bakong', 'aba'].includes(String(queryRail).toLowerCase())) {
      setRail(String(queryRail).toLowerCase());
    }
    if (queryDays) {
      const d = parseInt(queryDays, 10);
      if (d) {
        setDurationDays(d);
        if (![7, 30, 365].includes(d)) {
          setIsCustomDays(true);
          setCustomDays(String(d));
        }
      }
    }
    if (queryName) {
      setMerchantName(String(queryName));
    }
    if (tg_id) {
      setTargetId(String(tg_id));
      setMode('merchant');
    }
  }, [aba_link, bakong_id, tg_id, queryRail, queryDays, queryName]);

  // Load merchants list for dropdown
  useEffect(() => {
    async function loadMerchants() {
      setIsLoadingMerchants(true);
      try {
        const res = await fetch('/api/admin/merchants-list');
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setMerchantsList(data.users);
        }
      } catch (_) {}
      setIsLoadingMerchants(false);
    }
    loadMerchants();
  }, []);

  // Handle merchant select
  const handleSelectMerchant = (merchant) => {
    if (!merchant) return;
    setTargetId(merchant.telegramId);
    if (merchant.bakongId) setBakongId(merchant.bakongId);
    if (merchant.usdLink) setUsdLink(merchant.usdLink);
    if (merchant.khrLink) setKhrLink(merchant.khrLink);
    if (merchant.merchantName) setMerchantName(merchant.merchantName);
  };

  // Generate Key Handler
  const handleGenerateKey = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setIsGenerating(true);

    try {
      const finalDays = isCustomDays ? (parseInt(customDays, 10) || 365) : durationDays;
      const payload = {
        targetId: mode === 'standalone' ? 'standalone' : (targetId || 'standalone'),
        rail,
        durationDays: finalDays,
        bakongId: (rail === 'aba') ? null : (bakongId.trim() || null),
        usdLink: (rail === 'bakong') ? null : (usdLink.trim() || null),
        khrLink: (rail === 'bakong') ? null : (khrLink.trim() || null),
        merchantName: merchantName.trim() || null,
        phone: phone.trim() || null
      };

      const res = await fetch('/api/admin/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate API Key');
      }

      setGeneratedKey(data.key);

      // Trigger Confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (_) {}

    } catch (err) {
      setErrorMessage(err.message || 'Error communicating with server');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text, type) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } else if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else if (type === 'curl') {
        setCopiedCurl(true);
        setTimeout(() => setCopiedCurl(false), 2000);
      }
    }
  };

  const curlExample = generatedKey ? `curl -X POST https://paylinkapi-bot.onrender.com/api/payment/generate-qr \\
  -H "Authorization: Bearer ${generatedKey.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 1.00, "currency": "USD"}'` : '';

  return (
    <>
      <Head>
        <title>PaylinkApi — Admin API Key Generator Portal</title>
        <meta name="description" content="Generate production API keys and configure NBC Bakong and ABA PayWay credentials on demand." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" type="image/png" href="/logo.png" />
      </Head>

      <div className="app-container" style={{ maxWidth: '640px', margin: '0 auto' }}>
        
        {/* Header */}
        <header className="app-header">
          <div className="brand-group">
            <div className="brand-logo-mark">
              <img src="/logo.png" alt="PaylinkApi" className="brand-logo-img" />
            </div>
            <div className="brand-info">
              <span className="brand-name">PaylinkApi</span>
              <span className="brand-tagline">ADMIN KEY GENERATOR PORTAL</span>
            </div>
          </div>
          <div className="status-badge" style={{ borderColor: '#10b981', color: '#059669' }}>
            <span className="status-dot"></span>
            <span>Master Admin Gateway</span>
          </div>
        </header>

        {/* Top Announcement Banner */}
        <div style={{
          width: '100%',
          background: 'linear-gradient(135deg, #002d56 0%, #004f71 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '18px 20px',
          marginBottom: '20px',
          boxShadow: '0 8px 24px rgba(0, 45, 86, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={18} color="#00a3e0" />
              <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em' }}>Direct Production Key Generator</span>
            </div>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>
              Generate standalone API keys or provision merchant keys instantly without Telegram bot commands.
            </p>
          </div>
          <a
            href="https://t.me/PayLinkAPI_bot"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '8px 14px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          >
            <Bot size={14} />
            Bot Hub
          </a>
        </div>

        {/* Generated Key Result Card */}
        {generatedKey ? (
          <div style={{
            width: '100%',
            background: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            border: '2px solid #10b981',
            boxShadow: '0 12px 32px rgba(16, 185, 129, 0.12)',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981'
                }}>
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>API Key Generated & Active!</h3>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                    {generatedKey.isStandalone ? '⚡ Standalone Production Key' : `👤 Merchant ID: ${generatedKey.targetId}`}
                  </span>
                </div>
              </div>
              <span style={{
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 800,
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0'
              }}>
                VALID FOR {generatedKey.durationDays} DAYS
              </span>
            </div>

            {/* API Key Box */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Production API Key</span>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>Tap to copy</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '10px 14px'
              }}>
                <code style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#002d56', wordBreak: 'break-all' }}>
                  {generatedKey.apiKey}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedKey.apiKey, 'key')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: copiedKey ? '#10b981' : '#004f71',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Webhook Secret Box */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Webhook Secret</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '10px 14px'
              }}>
                <code style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 700, color: '#475569', wordBreak: 'break-all' }}>
                  {generatedKey.secret}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedKey.secret, 'secret')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: copiedSecret ? '#10b981' : '#475569',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copiedSecret ? <Check size={14} /> : <Copy size={14} />}
                  {copiedSecret ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Config Summary Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '14px',
              background: '#f1f5f9',
              borderRadius: '12px',
              marginBottom: '16px',
              fontSize: '12px'
            }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Payment Rail:</span>
                <strong style={{ color: '#0f172a' }}>{generatedKey.provider}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Expires On:</span>
                <strong style={{ color: '#0f172a' }}>{(generatedKey.expiresAt || '').slice(0, 10)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Store Name:</span>
                <strong style={{ color: '#0f172a' }}>{generatedKey.merchantName || 'Store'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Telegram ID:</span>
                <strong style={{ color: '#0f172a' }}>{generatedKey.targetId}</strong>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <a
                  href={`/test?key=${encodeURIComponent(generatedKey.apiKey)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#002d56',
                    color: '#ffffff',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <CreditCard size={16} />
                  Test in Studio
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(curlExample, 'curl')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: copiedCurl ? '#10b981' : '#f8fafc',
                    color: copiedCurl ? '#ffffff' : '#002d56',
                    border: '1px solid #cbd5e1',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Terminal size={16} />
                  {copiedCurl ? 'cURL Copied!' : 'Copy cURL'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setGeneratedKey(null)}
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  background: 'transparent',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} />
                Generate Another Key
              </button>
            </div>
          </div>
        ) : null}

        {/* Key Generator Form */}
        <form onSubmit={handleGenerateKey} style={{
          width: '100%',
          background: '#ffffff',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04)'
        }}>
          
          {/* Section 1: Mode Switcher */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              1. Key Assignment Target
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setMode('standalone')}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: mode === 'standalone' ? '2px solid #004f71' : '1px solid #e2e8f0',
                  background: mode === 'standalone' ? '#f0f9ff' : '#ffffff',
                  color: mode === 'standalone' ? '#004f71' : '#64748b',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Zap size={16} color={mode === 'standalone' ? '#004f71' : '#94a3b8'} />
                Standalone Key
              </button>
              <button
                type="button"
                onClick={() => setMode('merchant')}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: mode === 'merchant' ? '2px solid #004f71' : '1px solid #e2e8f0',
                  background: mode === 'merchant' ? '#f0f9ff' : '#ffffff',
                  color: mode === 'merchant' ? '#004f71' : '#64748b',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <User size={16} color={mode === 'merchant' ? '#004f71' : '#94a3b8'} />
                Assign to Merchant
              </button>
            </div>
          </div>

          {/* If Merchant Mode, show dropdown & Telegram ID */}
          {mode === 'merchant' ? (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '14px',
              marginBottom: '20px'
            }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Pick Registered Merchant or Enter Telegram ID:
              </label>
              {merchantsList.length > 0 ? (
                <select
                  onChange={(e) => {
                    const selected = merchantsList.find(m => String(m.telegramId) === e.target.value);
                    if (selected) handleSelectMerchant(selected);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    marginBottom: '8px',
                    fontWeight: 600,
                    background: '#ffffff'
                  }}
                >
                  <option value="">-- Choose from registered merchants ({merchantsList.length}) --</option>
                  {merchantsList.map(m => (
                    <option key={m.telegramId} value={m.telegramId}>
                      {m.name} ({m.telegramId}) {m.merchantName ? `— ${m.merchantName}` : ''}
                    </option>
                  ))}
                </select>
              ) : null}

              <input
                type="text"
                placeholder="Or type Telegram ID directly (e.g. 7283817695)"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontWeight: 700,
                  color: '#0f172a'
                }}
              />
            </div>
          ) : null}

          {/* Section 2: Payment Rail Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              2. Select Payment Rail
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              
              {/* Dual Suite */}
              <div
                onClick={() => setRail('bundle')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: rail === 'bundle' ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                  background: rail === 'bundle' ? 'rgba(139, 92, 246, 0.05)' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}>
                    <Zap size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      🟣 Dual Suite (Bakong KHQR + ABA PayWay)
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Universal clearing for both NBC Bakong &amp; ABA PayWay</span>
                  </div>
                </div>
                {rail === 'bundle' ? <CheckCircle2 size={20} color="#8b5cf6" /> : null}
              </div>

              {/* ABA PayWay Only */}
              <div
                onClick={() => setRail('aba')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: rail === 'aba' ? '2px solid #004f71' : '1px solid #e2e8f0',
                  background: rail === 'aba' ? 'rgba(0, 79, 113, 0.05)' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#002d56',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      🔵 ABA PayWay Gateway Only
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Direct ABA PayWay dynamic links &amp; webhooks</span>
                  </div>
                </div>
                {rail === 'aba' ? <CheckCircle2 size={20} color="#004f71" /> : null}
              </div>

              {/* Bakong KHQR Only */}
              <div
                onClick={() => setRail('bakong')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: rail === 'bakong' ? '2px solid #e11900' : '1px solid #e2e8f0',
                  background: rail === 'bakong' ? 'rgba(225, 25, 0, 0.05)' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#e11900',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      🔴 NBC Bakong KHQR Only
                    </h4>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>National KHQR EMVCo QR code deposits</span>
                  </div>
                </div>
                {rail === 'bakong' ? <CheckCircle2 size={20} color="#e11900" /> : null}
              </div>

            </div>
          </div>

          {/* Section 3: Bank Credentials Inputs */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              3. Merchant Bank Setup
            </label>

            {/* ABA PayWay USD Link (if rail is aba or bundle) */}
            {rail !== 'bakong' ? (
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#004f71', display: 'block', marginBottom: '4px' }}>
                  🔵 ABA PayWay USD Link:
                </span>
                <input
                  type="url"
                  placeholder="https://link.payway.com.kh/ABAPAY86523639G"
                  value={usdLink}
                  onChange={(e) => setUsdLink(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a'
                  }}
                />
              </div>
            ) : null}

            {/* ABA PayWay KHR Link (optional) */}
            {rail !== 'bakong' ? (
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  🔵 ABA PayWay KHR Link (Optional):
                </span>
                <input
                  type="url"
                  placeholder="https://link.payway.com.kh/ABAPAYk8523640S"
                  value={khrLink}
                  onChange={(e) => setKhrLink(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a'
                  }}
                />
              </div>
            ) : null}

            {/* Bakong Account ID (if rail is bakong or bundle) */}
            {rail !== 'aba' ? (
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#e11900', display: 'block', marginBottom: '4px' }}>
                  🔴 Bakong Account ID / Phone:
                </span>
                <input
                  type="text"
                  placeholder="e.g. hut_soksitchey1@aclb or 0977416126"
                  value={bakongId}
                  onChange={(e) => setBakongId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a'
                  }}
                />
              </div>
            ) : null}

            {/* Store Name */}
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                🏪 Merchant / Store Display Name:
              </span>
              <input
                type="text"
                placeholder="e.g. VIP Merchant Store"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a'
                }}
              />
            </div>
          </div>

          {/* Section 4: Key Duration */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              4. Key Validity Duration
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: isCustomDays ? '10px' : '0' }}>
              {[
                { label: '7 Days', val: 7 },
                { label: '30 Days', val: 30 },
                { label: '365 Days (1y)', val: 365 },
                { label: 'Custom', val: 'custom' }
              ].map(opt => {
                const isSelected = opt.val === 'custom' ? isCustomDays : (!isCustomDays && durationDays === opt.val);
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      if (opt.val === 'custom') {
                        setIsCustomDays(true);
                      } else {
                        setIsCustomDays(false);
                        setDurationDays(opt.val);
                      }
                    }}
                    style={{
                      padding: '10px 4px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #004f71' : '1px solid #cbd5e1',
                      background: isSelected ? '#004f71' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#0f172a',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {isCustomDays ? (
              <input
                type="number"
                placeholder="Enter duration in days (e.g. 180)"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  marginTop: '8px',
                  fontSize: '14px'
                }}
              />
            ) : null}
          </div>

          {/* Error Message */}
          {errorMessage ? (
            <div style={{
              padding: '12px',
              borderRadius: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              {errorMessage}
            </div>
          ) : null}

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={isGenerating}
            style={{
              width: '100%',
              padding: '15px 20px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #002d56 0%, #004f71 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '16px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              opacity: isGenerating ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 6px 20px rgba(0, 45, 86, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Generating API Key...
              </>
            ) : (
              <>
                <Zap size={18} />
                Generate Production API Key Now
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <footer style={{ marginTop: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', lineHeight: '1.6' }}>
          <div>PaylinkApi Financial Infrastructure • Institutional Gateway</div>
          <div>Master Admin ID: <code>7283817695</code> • Production Engine v1.0.0</div>
        </footer>

      </div>
    </>
  );
}
