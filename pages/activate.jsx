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
  Terminal,
  Search,
  DollarSign
} from 'lucide-react';

export default function ActivateKeyPortal() {
  const router = useRouter();
  const { key: queryKey, api_key: queryApiKey, days: queryDays, rail: queryRail } = router.query;

  // Key & Search State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState(null);

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
  const [customDays, setCustomDays] = useState('');

  // Submission & Result State
  const [isActivating, setIsActivating] = useState(false);
  const [activatedKey, setActivatedKey] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Initialize from Query Params
  useEffect(() => {
    const initialKey = queryKey || queryApiKey || '';
    if (initialKey) {
      setApiKeyInput(initialKey);
      inspectKey(initialKey);
    }
    if (queryDays) {
      const d = parseInt(queryDays, 10);
      if (!isNaN(d) && d > 0) {
        setDurationDays(d);
        if (![7, 30, 90, 180, 365, 9999].includes(d)) {
          setIsCustomDays(true);
          setCustomDays(String(d));
        }
      }
    }
    if (queryRail && ['bakong', 'aba', 'bundle'].includes(queryRail)) {
      setRail(queryRail);
    }
  }, [queryKey, queryApiKey, queryDays, queryRail]);

  // Inspect existing API Key details from API
  const inspectKey = async (keyToInspect) => {
    const targetKey = (keyToInspect || apiKeyInput).trim();
    if (!targetKey) return;

    setIsInspecting(true);
    setErrorMessage('');

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
      }
    } catch (_) {
      // Ignore network errors
    } finally {
      setIsInspecting(false);
    }
  };

  // Submit Activation Request
  const handleActivate = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const targetKey = apiKeyInput.trim();
    if (!targetKey) {
      setErrorMessage('Please enter an API Key to activate or reconfigure.');
      return;
    }

    const finalDays = isCustomDays ? (parseInt(customDays, 10) || 30) : durationDays;

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
        setActivatedKey(data.key);
        try {
          confetti({
            particleCount: 70,
            spread: 80,
            origin: { y: 0.6 }
          });
        } catch (_) {}
      } else {
        setErrorMessage(data.message || data.error || 'Failed to activate key. Please try again.');
      }
    } catch (err) {
      setErrorMessage(`Network connection error: ${err.message}`);
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
      } else if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else if (type === 'curl') {
        setCopiedCurl(true);
        setTimeout(() => setCopiedCurl(false), 2000);
      }
    }
  };

  const curlExample = activatedKey
    ? `curl -X POST https://paylinkapi-bot.onrender.com/api/v1/payment/create \\
  -H "Authorization: Bearer ${activatedKey.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 1.00, "currency": "USD"}'`
    : '';

  return (
    <>
      <Head>
        <title>PaylinkApi — Key Activation &amp; Renewal Portal</title>
        <meta name="description" content="Activate old keys, upgrade to v2 engine, and customize payment rails and expiration days." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" type="image/png" href="/logo.png" />
      </Head>

      <div className="app-container" style={{ maxWidth: '640px', margin: '0 auto', minHeight: '100vh' }}>
        
        {/* Header matching genkey.jsx */}
        <header className="app-header">
          <div className="brand-group" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
            <div className="brand-logo-mark">
              <img src="/logo.png" alt="PaylinkApi" className="brand-logo-img" />
            </div>
            <div className="brand-info">
              <span className="brand-name">PaylinkApi</span>
              <span className="brand-tagline">KEY ACTIVATION &amp; RENEWAL PORTAL</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="status-badge" style={{ borderColor: '#10b981', color: '#059669' }}>
              <span className="status-dot" style={{ background: '#10b981' }}></span>
              <span>Online v2</span>
            </div>
            <a
              href="https://t.me/PayLinkAPI_bot"
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '6px 12px',
                borderRadius: '9999px',
                background: '#002d56',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Bot size={14} />
              Telegram Bot
            </a>
          </div>
        </header>

        {/* Success Card (Shown after activation) */}
        {activatedKey ? (
          <div style={{
            width: '100%',
            background: '#ffffff',
            borderRadius: '24px',
            padding: '28px',
            border: '2px solid #10b981',
            boxShadow: '0 16px 40px rgba(16, 185, 129, 0.12)',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#dcfce7',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  KEY ត្រូវបានបើកដំណើរការជោគជ័យ!
                </h3>
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>
                  ✓ LIVE ACTIVE • High-Speed PayWay v2 &amp; KHQR Engine
                </span>
              </div>
            </div>

            {/* API Key Box */}
            <div style={{ marginBottom: '14px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Production Live API Key:
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#002d56',
                fontWeight: 700,
                wordBreak: 'break-all'
              }}>
                <span>{activatedKey.apiKey}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(activatedKey.apiKey, 'key')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: copiedKey ? '#10b981' : '#002d56',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                    marginLeft: '8px'
                  }}
                >
                  {copiedKey ? <Check size={12} /> : <Copy size={12} />}
                  {copiedKey ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Secret Box */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Client Secret:
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#475569',
                fontWeight: 600,
                wordBreak: 'break-all'
              }}>
                <span>{activatedKey.secret || 'whsec_live_default'}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(activatedKey.secret || 'whsec_live_default', 'secret')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: copiedSecret ? '#10b981' : '#f1f5f9',
                    color: copiedSecret ? '#ffffff' : '#002d56',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                    marginLeft: '8px'
                  }}
                >
                  {copiedSecret ? <Check size={12} /> : <Copy size={12} />}
                  {copiedSecret ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Telemetry Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '14px',
              background: '#f8fafc',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              marginBottom: '18px',
              fontSize: '12px'
            }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Payment Rail:</span>
                <strong style={{ color: '#0f172a' }}>{activatedKey.provider}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Validity:</span>
                <strong style={{ color: '#059669' }}>
                  {activatedKey.durationDays >= 9999 ? 'Permanent' : `${activatedKey.durationDays} Days`}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Store Name:</span>
                <strong style={{ color: '#0f172a' }}>{activatedKey.merchantName || 'Store'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Expires On:</span>
                <strong style={{ color: '#0f172a' }}>{(activatedKey.expiresAt || '').slice(0, 10)}</strong>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <a
                  href={`/test?key=${encodeURIComponent(activatedKey.apiKey)}`}
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
                  Test Payment
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
                onClick={() => {
                  setActivatedKey(null);
                  setApiKeyInput('');
                  setInspectResult(null);
                }}
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
                Activate Another Key
              </button>
            </div>
          </div>
        ) : null}

        {/* Activation Form matching genkey.jsx */}
        <form onSubmit={handleActivate} style={{
          width: '100%',
          background: '#ffffff',
          borderRadius: '24px',
          padding: '28px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 12px 36px rgba(0, 45, 86, 0.08)'
        }}>
          
          <div style={{ marginBottom: '20px' }}>
            <h2 className="card-title" style={{ fontSize: '20px', fontWeight: 800, color: '#002d56', marginBottom: '4px' }}>
              បើកដំណើរការ &amp; កំណត់ KEY លើ WEB
            </h2>
            <p className="card-desc" style={{ fontSize: '13px', color: '#64748b' }}>
              Reactivate old keys, upgrade to v2 engine (~200ms), and configure Bakong KHQR, ABA PayWay, and expiration duration.
            </p>
          </div>

          {/* Section 1: API Key Input & Inspection */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              1. Enter API Key to Activate / Reconfigure
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                required
                placeholder="Paste API Key (e.g. plk_live_xxxxxxxxxxxx or dp_live_xxxxxxxxxxxx)"
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  if (inspectResult) setInspectResult(null);
                }}
                onBlur={() => inspectKey(apiKeyInput)}
                style={{
                  width: '100%',
                  padding: '12px 90px 12px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: '#0f172a',
                  background: '#f8fafc'
                }}
              />
              <button
                type="button"
                onClick={() => inspectKey(apiKeyInput)}
                disabled={isInspecting || !apiKeyInput.trim()}
                style={{
                  position: 'absolute',
                  right: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  background: '#002d56',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: isInspecting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isInspecting ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                Inspect
              </button>
            </div>

            {inspectResult ? (
              <div style={{
                marginTop: '10px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                fontSize: '11px'
              }}>
                <div>
                  <span style={{ color: '#166534', display: 'block' }}>Status</span>
                  <strong style={{ color: inspectResult.isExpired ? '#dc2626' : '#15803d' }}>
                    {inspectResult.status || (inspectResult.isExpired ? 'EXPIRED' : 'ACTIVE')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#166534', display: 'block' }}>Current Rail</span>
                  <strong style={{ color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    {inspectResult.provider || 'Universal'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#166534', display: 'block' }}>Store Name</span>
                  <strong style={{ color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    {inspectResult.merchantName || 'Store'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#166534', display: 'block' }}>Expires On</span>
                  <strong style={{ color: '#0f172a' }}>
                    {inspectResult.expiresAt ? inspectResult.expiresAt.slice(0, 10) : 'N/A'}
                  </strong>
                </div>
              </div>
            ) : null}
          </div>

          {/* Section 2: Payment Rail Selection matching genkey.jsx */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              2. Select Payment Rail for This Key
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
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Universal Cambodian clearing for both Bakong KHQR &amp; ABA PayWay</span>
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
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Direct ABA PayWay gateway links (USD, KHR, or Both)</span>
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
                    <span style={{ fontSize: '11px', color: '#64748b' }}>National KHQR EMVCo QR code deposits into Bakong ID</span>
                  </div>
                </div>
                {rail === 'bakong' ? <CheckCircle2 size={20} color="#e11900" /> : null}
              </div>

            </div>
          </div>

          {/* Section 3: Merchant Bank Setup & Customization */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '22px'
          }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
              3. Merchant Bank Setup &amp; Customization
            </label>

            {/* Bakong Account ID (for Bakong & Dual) */}
            {rail !== 'aba' ? (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#e11900' }}>
                    🔴 Bakong Account ID / Phone:
                  </span>
                  <button
                    type="button"
                    onClick={() => setBakongId('soksitchey1@aclb')}
                    style={{ background: 'none', border: 'none', color: '#004f71', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Use Demo (soksitchey1@aclb)
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. hut_soksitchey1@aclb or 0977416126"
                  value={bakongId}
                  onChange={(e) => setBakongId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a',
                    background: '#ffffff'
                  }}
                />
              </div>
            ) : null}

            {/* Merchant Custom Name ("merchan customice") */}
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                🏪 ឈ្មោះហាងផ្ទាល់ខ្លួន (Custom Merchant / Store Display Name):
              </span>
              <input
                type="text"
                placeholder="e.g. Kai Coffee Shop, Riki Store"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  background: '#ffffff'
                }}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
                ឈ្មោះនេះនឹងបង្ហាញលើវិក្កយបត្រ និង QR Code ពេលអតិថិជនស្កេនទូទាត់។
              </span>
            </div>

            {/* ABA Currency Options (for ABA & Dual) */}
            {rail !== 'bakong' ? (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#004f71', display: 'block', marginBottom: '6px' }}>
                  🔵 ABA Currency Options:
                </span>
                
                {/* 3 Pills: USD only, KHR only, Both */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
                  {[
                    { mode: 'usd', label: '💵 USD Only' },
                    { mode: 'khr', label: '៛ KHR Only' },
                    { mode: 'both', label: '💵+៛ Both ($ & ៛)' }
                  ].map(item => {
                    const active = abaMode === item.mode;
                    return (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => setAbaMode(item.mode)}
                        style={{
                          padding: '8px 4px',
                          borderRadius: '8px',
                          border: active ? '2px solid #004f71' : '1px solid #cbd5e1',
                          background: active ? '#004f71' : '#ffffff',
                          color: active ? '#ffffff' : '#475569',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* USD Link Input */}
                {abaMode === 'usd' || abaMode === 'both' ? (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                        💵 ABA PayWay USD Payment Link:
                      </span>
                      <button
                        type="button"
                        onClick={() => setUsdLink('https://link.payway.com.kh/ABAPAYusdstandard')}
                        style={{ background: 'none', border: 'none', color: '#004f71', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Use Default
                      </button>
                    </div>
                    <input
                      type="url"
                      placeholder="https://link.payway.com.kh/ABAPAYxxxxxxx"
                      value={usdLink}
                      onChange={(e) => setUsdLink(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        background: '#ffffff'
                      }}
                    />
                  </div>
                ) : null}

                {/* KHR Link Input */}
                {abaMode === 'khr' || abaMode === 'both' ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                        ៛ ABA PayWay KHR (Riel) Payment Link:
                      </span>
                      <button
                        type="button"
                        onClick={() => setKhrLink('https://link.payway.com.kh/ABAPAYkhrstandard')}
                        style={{ background: 'none', border: 'none', color: '#004f71', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Use Default
                      </button>
                    </div>
                    <input
                      type="url"
                      placeholder="https://link.payway.com.kh/ABAPAYxxxxxxx"
                      value={khrLink}
                      onChange={(e) => setKhrLink(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        background: '#ffffff'
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Section 4: Key Validity Duration matching genkey.jsx */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                4. Key Validity Duration (Expire Days)
              </label>
              <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>
                {isCustomDays
                  ? `Custom: ${customDays || 30} Days`
                  : (durationDays >= 9999 ? 'Permanent Active' : `${durationDays} Days Active`)}
              </span>
            </div>

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
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
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
                min="1"
                max="9999"
                placeholder="Enter duration in days (e.g. 60, 90, 180, 9999)"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #004f71',
                  marginTop: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a'
                }}
              />
            ) : null}
          </div>

          {/* Error Alert */}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isActivating || !apiKeyInput.trim()}
            style={{
              width: '100%',
              padding: '15px 20px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #002d56 0%, #004f71 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '16px',
              cursor: isActivating ? 'not-allowed' : 'pointer',
              opacity: isActivating ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 6px 20px rgba(0, 45, 86, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            {isActivating ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Activating Key...
              </>
            ) : (
              <>
                <Zap size={18} />
                Activate &amp; Reconfigure Key Now
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <footer style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
          <p>© 2026 PaylinkApi Gateway Studio. Authentic Cambodian Payment Infrastructure.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '6px' }}>
            <button onClick={() => router.push('/test')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}>Test Studio</button>
            <span>•</span>
            <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}>Registration Portal</button>
            <span>•</span>
            <a href="https://t.me/PayLinkAPI_bot" target="_blank" rel="noreferrer" style={{ color: '#64748b', textDecoration: 'none' }}>Telegram Bot</a>
          </div>
        </footer>

      </div>
    </>
  );
}
