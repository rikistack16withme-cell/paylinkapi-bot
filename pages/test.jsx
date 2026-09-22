import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  QrCode,
  Zap,
  CheckCircle2,
  Clock,
  Smartphone,
  ChevronRight,
  AlertCircle,
  Code2,
  RefreshCw,
  CreditCard,
  Building2,
  Terminal,
  ShieldCheck
} from 'lucide-react';

export default function PaymentTestStudio() {
  const router = useRouter();
  const { key, tg_id } = router.query;

  // Configuration state
  const [apiKey, setApiKey] = useState('dp_live_7283817695_1fc2742f');
  const [bank, setBank] = useState('ABA'); // 'ABA' or 'BAKONG'
  const [currency, setCurrency] = useState('USD'); // 'USD' or 'KHR'
  const [amount, setAmount] = useState('1.00');

  // Key verification status
  const [keyDetails, setKeyDetails] = useState(null);
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [keyError, setKeyError] = useState('');

  // Payment execution state
  const [isGenerating, setIsGenerating] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('IDLE'); // 'IDLE', 'PENDING', 'PAID', 'EXPIRED'
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(180); // 3 mins

  // Developer Inspector
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' or 'api'
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Sync API Key from router query
  useEffect(() => {
    if (key) {
      setApiKey(String(key));
    }
  }, [key]);

  // Automatically verify API key on load or change
  useEffect(() => {
    if (!apiKey) return;
    const verify = async () => {
      setIsVerifyingKey(true);
      setKeyError('');
      try {
        const res = await fetch('/api/keys/verify', {
          headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
        });
        const data = await res.json();
        if (data.success) {
          setKeyDetails(data);
        } else {
          setKeyError(data.error || 'Invalid API Key');
          setKeyDetails(null);
        }
      } catch (err) {
        setKeyError(err.message);
        setKeyDetails(null);
      } finally {
        setIsVerifyingKey(false);
      }
    };

    const timer = setTimeout(verify, 400);
    return () => clearTimeout(timer);
  }, [apiKey]);

  // Real-time polling for payment status
  useEffect(() => {
    if (!paymentResult?.tranId || paymentStatus === 'PAID' || paymentStatus === 'EXPIRED') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/status/${paymentResult.tranId}`);
        const data = await res.json();
        if (data.paid || data.status === 'PAID') {
          setPaymentStatus('PAID');
          try {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch (_) {}
          clearInterval(interval);
        } else if (data.status === 'EXPIRED') {
          setPaymentStatus('EXPIRED');
          clearInterval(interval);
        }
      } catch (_) {}
    }, 2000);

    return () => clearInterval(interval);
  }, [paymentResult?.tranId, paymentStatus]);

  // Countdown timer for pending payment
  useEffect(() => {
    if (paymentStatus !== 'PENDING') return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setPaymentStatus('EXPIRED');
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentStatus]);

  const handleGeneratePayment = async () => {
    if (!apiKey) {
      setErrorMessage('Please enter your API Key');
      return;
    }

    setIsGenerating(true);
    setErrorMessage('');
    setPaymentResult(null);
    setPaymentStatus('PENDING');
    setCountdown(180);

    const amtNum = parseFloat(amount);
    if (!amtNum || amtNum <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0');
      setIsGenerating(false);
      return;
    }

    try {
      const endpoint = bank === 'ABA' ? '/api/aba/generate-qr' : '/api/bakong/generate-qr';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amtNum,
          currency: currency
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate payment QR');
      }

      setPaymentResult(data);
      setActiveTab('qr');
    } catch (err) {
      setErrorMessage(err.message || 'Payment generation failed');
      setPaymentStatus('IDLE');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getGeneratedCurl = () => {
    const endpoint = bank === 'ABA' ? '/api/aba/generate-qr' : '/api/bakong/generate-qr';
    const host = typeof window !== 'undefined' ? window.location.origin : 'https://api.paylinkapi.com';
    return `curl -X POST ${host}${endpoint} \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"amount": ${amount}, "currency": "${currency}"}'`;
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'curl') {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  return (
    <>
      <Head>
        <title>Live Payment Studio & API Tester | PaylinkApi</title>
        <meta name="description" content="Test live Bakong KHQR and ABA PayWay payments in real-time" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#0a0f1d', color: '#f8fafc', padding: '24px 16px', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          
          {/* Top Bar */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #005c9e, #00bcd4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 20 }}>
                ⚡
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  PaylinkApi Live Studio
                </h1>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Real-time Dual Rail Payment Tester & Simulator</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/register" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', textDecoration: 'none', fontSize: 13, border: '1px solid rgba(255,255,255,0.1)' }}>
                <span>Web Portal</span>
                <ExternalLink size={14} />
              </a>
              <a href="https://t.me/PayLinkAPI_bot" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#0088cc', color: '#ffffff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                <span>Telegram Bot</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </header>

          {/* Main Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'start' }}>
            
            {/* Left Column: Configuration Controls */}
            <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0' }}>
                <Terminal size={18} color="#00bcd4" />
                <span>Payment Configuration</span>
              </h2>

              {/* API Key Input */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                  API Key (Secret Token)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="dp_live_..."
                    style={{ width: '100%', padding: '12px 14px', background: '#0f172a', border: `1px solid ${keyDetails ? '#10b981' : keyError ? '#ef4444' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: '#ffffff', fontSize: 14, fontFamily: 'monospace', outline: 'none' }}
                  />
                  {isVerifyingKey && (
                    <div style={{ position: 'absolute', right: 12, top: 12 }}>
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  )}
                </div>

                {keyDetails && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 8, fontSize: 12, color: '#6ee7b7' }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldCheck size={14} /> Key Authorized: {keyDetails.merchantName} ({keyDetails.tier})
                    </div>
                    <div style={{ opacity: 0.85, marginTop: 2 }}>
                      Bakong: <code>{keyDetails.bakongId}</code>
                    </div>
                  </div>
                )}

                {keyError && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#f87171' }}>
                    ⚠️ {keyError}
                  </div>
                )}
              </div>

              {/* Bank Selection */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
                  Select Bank Clearing Rail
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setBank('ABA')}
                    style={{
                      padding: '14px 12px',
                      borderRadius: 10,
                      border: `2px solid ${bank === 'ABA' ? '#00a3e0' : 'rgba(255,255,255,0.08)'}`,
                      background: bank === 'ABA' ? 'rgba(0, 163, 224, 0.15)' : '#0f172a',
                      color: bank === 'ABA' ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontWeight: 700,
                      fontSize: 14,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#00a3e0' }} />
                    <div style={{ textAlign: 'left' }}>
                      <div>ABA PayWay</div>
                      <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>Blue Card</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBank('BAKONG')}
                    style={{
                      padding: '14px 12px',
                      borderRadius: 10,
                      border: `2px solid ${bank === 'BAKONG' ? '#e11900' : 'rgba(255,255,255,0.08)'}`,
                      background: bank === 'BAKONG' ? 'rgba(225, 25, 0, 0.15)' : '#0f172a',
                      color: bank === 'BAKONG' ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontWeight: 700,
                      fontSize: 14,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#e11900' }} />
                    <div style={{ textAlign: 'left' }}>
                      <div>Bakong KHQR</div>
                      <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>Red Card (NBC)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Currency Selection */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
                  Currency
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency('USD');
                      if (amount === '4000' || amount === '400') setAmount('1.00');
                    }}
                    style={{
                      padding: '10px',
                      borderRadius: 8,
                      border: `1px solid ${currency === 'USD' ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                      background: currency === 'USD' ? 'rgba(16, 185, 129, 0.15)' : '#0f172a',
                      color: currency === 'USD' ? '#6ee7b7' : '#94a3b8',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    💵 USD Dollar ($)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrency('KHR');
                      if (amount === '1.00' || amount === '0.10') setAmount('4000');
                    }}
                    style={{
                      padding: '10px',
                      borderRadius: 8,
                      border: `1px solid ${currency === 'KHR' ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                      background: currency === 'KHR' ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
                      color: currency === 'KHR' ? '#fcd34d' : '#94a3b8',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    🇰🇭 KHR Khmer Riel (៛)
                  </button>
                </div>
              </div>

              {/* Amount Selection & Presets */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
                  Test Amount ({currency})
                </label>
                
                {/* Quick Presets */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {currency === 'USD' ? (
                    <>
                      {['0.10', '0.50', '1.00', '5.00', '10.00'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmount(preset)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: `1px solid ${amount === preset ? '#00bcd4' : 'rgba(255,255,255,0.1)'}`,
                            background: amount === preset ? 'rgba(0, 188, 212, 0.2)' : 'rgba(255,255,255,0.04)',
                            color: amount === preset ? '#ffffff' : '#94a3b8',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          ${preset}
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {['400', '2000', '4000', '10000', '20000'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmount(preset)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: `1px solid ${amount === preset ? '#00bcd4' : 'rgba(255,255,255,0.1)'}`,
                            background: amount === preset ? 'rgba(0, 188, 212, 0.2)' : 'rgba(255,255,255,0.04)',
                            color: amount === preset ? '#ffffff' : '#94a3b8',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {Number(preset).toLocaleString()} ៛
                        </button>
                      ))}
                    </>
                  )}
                </div>

                <input
                  type="number"
                  step={currency === 'USD' ? '0.01' : '100'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={currency === 'USD' ? '1.00' : '4000'}
                  style={{ width: '100%', padding: '12px 14px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', fontSize: 16, fontWeight: 700, outline: 'none' }}
                />
              </div>

              {/* Error Notification */}
              {errorMessage && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>
                  ⚠️ {errorMessage}
                </div>
              )}

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGeneratePayment}
                disabled={isGenerating}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: 10,
                  background: isGenerating ? '#475569' : 'linear-gradient(135deg, #005c9e, #00bcd4)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  boxShadow: '0 4px 15px rgba(0, 188, 212, 0.35)',
                  transition: 'transform 0.1s ease'
                }}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Connecting to {bank}...</span>
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    <span>🚀 Generate Live Test Payment</span>
                  </>
                )}
              </button>
            </div>

            {/* Right Column: Live Payment QR Card & Real-time Status */}
            <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
              
              {/* Tabs: Visual QR vs API Inspector */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 6, background: '#0f172a', padding: 4, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('qr')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      background: activeTab === 'qr' ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: activeTab === 'qr' ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Payment Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('api')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      background: activeTab === 'api' ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: activeTab === 'api' ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    API Inspector
                  </button>
                </div>

                {paymentResult && (
                  <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {paymentStatus === 'PAID' ? (
                      <span style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={14} /> PAID & VERIFIED
                      </span>
                    ) : paymentStatus === 'EXPIRED' ? (
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>
                        ❌ EXPIRED
                      </span>
                    ) : (
                      <span style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={14} /> Expires in {formatSeconds(countdown)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Tab 1: Visual Card Display */}
              {activeTab === 'qr' && (
                <div>
                  {!paymentResult ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                      <QrCode size={64} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', margin: '0 0 6px 0' }}>
                        Ready to Generate Live Payment
                      </h3>
                      <p style={{ fontSize: 13, margin: 0 }}>
                        Configure your amount on the left and click "Generate Live Test Payment" to create your styled QR card.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {/* Authentic Styled Card Frame */}
                      <div
                        style={{
                          background: bank === 'BAKONG' ? '#e11900' : '#002d56',
                          borderRadius: 20,
                          padding: 24,
                          boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Header Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, color: '#ffffff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                              {bank === 'BAKONG' ? '🇰🇭' : '🏦'}
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 800 }}>{bank === 'BAKONG' ? 'Bakong KHQR' : 'ABA PayWay'}</div>
                              <div style={{ fontSize: 11, opacity: 0.8 }}>{keyDetails?.merchantName || 'Live Merchant'}</div>
                            </div>
                          </div>
                          
                          <div style={{ fontSize: 18, fontWeight: 800 }}>
                            {currency === 'KHR' ? `${Math.round(paymentResult.amount).toLocaleString()} ៛` : `$${parseFloat(paymentResult.amount).toFixed(2)}`}
                          </div>
                        </div>

                        {/* QR Code Container */}
                        <div style={{ background: '#ffffff', borderRadius: 16, padding: 20, textAlign: 'center', margin: '0 auto', maxWidth: 260 }}>
                          <QRCodeSVG
                            value={paymentResult.qrString}
                            size={220}
                            level="M"
                            style={{ margin: '0 auto', display: 'block' }}
                          />
                        </div>

                        {/* Status / Notice */}
                        <div style={{ textAlign: 'center', marginTop: 16, color: '#ffffff' }}>
                          {paymentStatus === 'PAID' ? (
                            <div style={{ padding: '10px 16px', background: '#10b981', borderRadius: 10, fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <CheckCircle2 size={18} />
                              <span>PAYMENT RECEIVED & CONFIRMED LIVE!</span>
                            </div>
                          ) : paymentStatus === 'EXPIRED' ? (
                            <div style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.6)', borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
                              ⚠️ QR Code Expired. Please generate a new card.
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, opacity: 0.9 }}>
                              ⏳ Auto-checking in real-time... Scan using {bank === 'BAKONG' ? 'Bakong App' : 'ABA Mobile'}!
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons Below Card */}
                      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Direct Banking App Launch Button */}
                        {paymentResult.deepLink && (
                          <a
                            href={bank === 'ABA' ? `/api/aba/open/${paymentResult.tranId}` : paymentResult.deepLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              padding: '12px 16px',
                              borderRadius: 10,
                              background: bank === 'BAKONG' ? '#e11900' : '#00a3e0',
                              color: '#ffffff',
                              textDecoration: 'none',
                              fontWeight: 700,
                              fontSize: 14,
                              boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
                            }}
                          >
                            <Smartphone size={16} />
                            <span>📲 Open in {bank === 'BAKONG' ? 'Bakong App' : 'ABA Mobile'} Directly</span>
                          </a>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', padding: '0 4px' }}>
                          <span>Tran ID: <code>{paymentResult.tranId}</code></span>
                          <span>Bank: <b>{paymentResult.bank}</b></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: API Inspector (cURL & Response JSON) */}
              {activeTab === 'api' && (
                <div>
                  {/* cURL Request */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>cURL Command (Direct Integration)</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(getGeneratedCurl(), 'curl')}
                        style={{ background: 'none', border: 'none', color: copiedCurl ? '#10b981' : '#00bcd4', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        {copiedCurl ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedCurl ? 'Copied!' : 'Copy cURL'}</span>
                      </button>
                    </div>
                    <pre style={{ margin: 0, padding: 12, background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#a5b4fc', fontSize: 12, overflowX: 'auto', fontFamily: 'monospace' }}>
                      {getGeneratedCurl()}
                    </pre>
                  </div>

                  {/* API JSON Response */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>API Response Output</span>
                      {paymentResult && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(JSON.stringify(paymentResult, null, 2), 'json')}
                          style={{ background: 'none', border: 'none', color: copiedJson ? '#10b981' : '#00bcd4', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          {copiedJson ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedJson ? 'Copied!' : 'Copy JSON'}</span>
                        </button>
                      )}
                    </div>
                    <pre style={{ margin: 0, padding: 12, background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: paymentResult ? '#86efac' : '#64748b', fontSize: 12, overflowX: 'auto', fontFamily: 'monospace', maxHeight: 260 }}>
                      {paymentResult ? JSON.stringify(paymentResult, null, 2) : '// No request dispatched yet. Click "Generate Live Test Payment".'}
                    </pre>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
      
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
