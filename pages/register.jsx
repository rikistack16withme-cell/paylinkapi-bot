import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { QRCodeSVG } from 'qrcode.react';
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
  Info,
  Download,
  FileText,
  Bot
} from 'lucide-react';

export default function RegisterPortal() {
  const router = useRouter();
  const { tg_id } = router.query;

  // Wizard Steps: 1: Setup, 2: Subscription, 3: Scan QR, 4: Success
  const [step, setStep] = useState(1);

  // Form State
  const [telegramId, setTelegramId] = useState('7283817695');
  const [currency, setCurrency] = useState('USD');
  const [paymentRail, setPaymentRail] = useState('bundle'); // 'bundle', 'bakong', 'aba'
  const [payMethod, setPayMethod] = useState('aba'); // 'aba' or 'bakong' for subscription checkout
  const [plan, setPlan] = useState('1w'); // '1w', '1m', '1y'

  // Merchant Credentials (empty by default as requested)
  const [bakongAccount, setBakongAccount] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [abaUsdLink, setAbaUsdLink] = useState('');
  const [abaKhrLink, setAbaKhrLink] = useState('');

  // QR & Transaction State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [qrData, setQrData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [countdown, setCountdown] = useState(900); // 15 mins

  // Sync telegramId from URL query
  useEffect(() => {
    if (tg_id) {
      setTelegramId(String(tg_id));
    }
  }, [tg_id]);

  // Vanta.js 3D Animated Globe Background
  useEffect(() => {
    let vantaEffect;
    const initVanta = () => {
      if (typeof window !== 'undefined' && window.VANTA && window.VANTA.GLOBE) {
        try {
          vantaEffect = window.VANTA.GLOBE({
            el: '#vanta-bg',
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.0,
            minWidth: 200.0,
            scale: 1.0,
            scaleMobile: 1.0,
            color: 0x004f71, // ABA navy
            color2: 0xe11900, // Bakong red
            size: 1.15,
            backgroundColor: 0xf8fafc // Clean white/light
          });
        } catch (e) {
          console.warn('Vanta globe notice:', e);
        }
      }
    };

    if (typeof window !== 'undefined') {
      if (window.VANTA) {
        initVanta();
      } else {
        const timer = setInterval(() => {
          if (window.VANTA) {
            clearInterval(timer);
            initVanta();
          }
        }, 300);
        return () => clearInterval(timer);
      }
    }

    return () => {
      if (vantaEffect && vantaEffect.destroy) vantaEffect.destroy();
    };
  }, []);

  // Countdown timer for QR
  useEffect(() => {
    let timer;
    if (step === 3 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // 100% Automated Background Payment Status Polling
  useEffect(() => {
    let pollInterval;
    if (step === 3 && qrData) {
      pollInterval = setInterval(async () => {
        try {
          if (qrData.bank === 'BAKONG' && qrData.md5) {
            const res = await fetch(`/api/bakong/check/${qrData.md5}`);
            const result = await res.json();
            if (result.status === 'SUCCESS' || result.responseCode === 0) {
              if (result.apiKey) {
                setQrData(prev => ({ ...prev, ...result }));
              }
              setStep(4);
            }
          } else if (qrData.bank === 'ABA') {
            const res = await fetch('/api/aba/check-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tranId: qrData.tranId,
                clientId: qrData.clientId,
                merchantLink: qrData.merchantLink
              })
            });
            const result = await res.json();
            if (result.paid || result.status === 'SUCCESS') {
              if (result.apiKey) {
                setQrData(prev => ({ ...prev, ...result }));
              }
              setStep(4);
            }
          }
        } catch (e) {
          // Silent polling retry
        }
      }, 2500);
    }
    return () => clearInterval(pollInterval);
  }, [step, qrData]);

  // Auto-fill verified test credentials if user explicitly clicks
  const handleAutoFill = () => {
    setBakongAccount('hut_soksitchey1@aclb');
    setStoreName('Rikidev');
    setPhone('0977416126');
    setAbaUsdLink('https://link.payway.com.kh/ABAPAY86523639G');
    setAbaKhrLink('https://link.payway.com.kh/ABAPAYk8523640S');
  };

  // Plan Prices helper
  const getPlanPrice = (planKey, curr) => {
    if (curr === 'KHR') {
      if (planKey === '1w') return { amount: 400, label: '400 ៛', period: '7 Days Trial' };
      if (planKey === '1m') return { amount: 4000, label: '4,000 ៛', period: '30 Days Standard' };
      return { amount: 40000, label: '40,000 ៛', period: '1 Year Enterprise' };
    }
    if (planKey === '1w') return { amount: 0.10, label: '$0.10', period: '7 Days Trial' };
    if (planKey === '1m') return { amount: 1.00, label: '$1.00', period: '30 Days Standard' };
    return { amount: 10.00, label: '$10.00', period: '1 Year Enterprise' };
  };

  // Generate KHQR & Register
  const handleGenerateCheckout = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const planInfo = getPlanPrice(plan, currency);

      const payload = {
        telegramId,
        currency,
        plan,
        amount: planInfo.amount,
        rail: paymentRail,
        paymentRail,
        payMethod: payMethod || 'aba',
        merchantData: {
          merchantId: paymentRail === 'aba' ? '' : (bakongAccount || ''),
          merchantName: storeName || '',
          phone: phone || '',
          usdLink: paymentRail === 'bakong' ? '' : (abaUsdLink || ''),
          khrLink: paymentRail === 'bakong' ? '' : (abaKhrLink || '')
        }
      };

      const response = await fetch('/api/web/register-and-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate checkout QR');
      }

      setQrData(data);
      setCountdown(900);
      setStep(3);
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMessage(err.message || 'Error communicating with payment gateway');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const copyToClipboard = (text, type) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } else if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else if (type === 'prompt') {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
      }
    }
  };

  return (
    <div className="app-container">
      <Head>
        <title>PaylinkApi — FAST • SECURE • EASY</title>
      </Head>

      {/* Vanta.js 3D Interactive Animated Globe Canvas */}
      <div id="vanta-bg" />

      {/* Brand Navigation Header */}
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-logo-mark">
            <img src="/logo.png" alt="PaylinkApi" className="brand-logo-img" />
          </div>
          <div className="brand-info">
            <span className="brand-name">PaylinkApi</span>
            <span className="brand-tagline">FAST • SECURE • EASY</span>
          </div>
        </div>

        <div className="status-badge">
          <span className="status-dot" />
          <span>Production Rails</span>
        </div>
      </header>

      {/* Stepper Navigation */}
      <nav className="stepper-nav" aria-label="Setup steps">
        <div className={`step-pill ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
          <span className="step-num">{step > 1 ? <Check size={12} /> : '1'}</span>
          <span>Merchant Setup</span>
        </div>
        <div className={`step-pill ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
          <span className="step-num">{step > 2 ? <Check size={12} /> : '2'}</span>
          <span>Subscription</span>
        </div>
        <div className={`step-pill ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
          <span className="step-num">{step > 3 ? <Check size={12} /> : '3'}</span>
          <span>Scan KHQR</span>
        </div>
      </nav>

      {/* Error Alert */}
      {errorMessage && (
        <div style={{
          width: '100%',
          maxWidth: '560px',
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '14px',
          color: '#b91c1c',
          fontSize: '14px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 1: MERCHANT SETUP & THREE PAYMENT RAILS             */}
      {/* ======================================================== */}
      {step === 1 && (
        <main className="portal-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h1 className="card-title">Connect Payment Gateway</h1>
              <p className="card-desc">Configure your merchant credentials for automated clearing.</p>
            </div>
            <button
              type="button"
              onClick={handleAutoFill}
              style={{
                padding: '6px 12px',
                borderRadius: '9999px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                color: '#0284c7',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0
              }}
            >
              <Zap size={13} /> Auto-Fill Test
            </button>
          </div>

          {/* Rail Selector: 3 Options */}
          <div className="form-group">
            <label className="field-label">Select Payment Rail</label>
            <div className="rail-grid">
              
              {/* Option 1: Dual Suite (Bakong + ABA) */}
              <div
                className={`rail-card ${paymentRail === 'bundle' ? 'selected-bundle' : ''}`}
                onClick={() => setPaymentRail('bundle')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="rail-duo-logos">
                    <div className="rail-logo-box">
                      <img src="/bakong-logo.svg" alt="Bakong" className="img-logo" />
                    </div>
                    <span style={{ fontWeight: 800, color: '#94a3b8', fontSize: '14px' }}>+</span>
                    <div className="rail-logo-box">
                      <img src="/aba-logo.svg" alt="ABA Bank" className="img-logo" />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '15px', color: '#002d56' }}>Dual Suite (Bakong + ABA)</strong>
                      <span className="field-badge" style={{ background: '#ecfdf5', color: '#059669' }}>Standard</span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Automated dual-currency clearing for both USD ($) and KHR (៛)
                    </span>
                  </div>
                </div>
                <div className={`radio-circle ${paymentRail === 'bundle' ? 'active' : ''}`}>
                  {paymentRail === 'bundle' && <div className="radio-inner-dot" />}
                </div>
              </div>

              {/* Option 2: NBC Bakong National KHQR */}
              <div
                className={`rail-card ${paymentRail === 'bakong' ? 'selected-bakong' : ''}`}
                onClick={() => setPaymentRail('bakong')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="rail-logo-box">
                    <img src="/bakong-logo.svg" alt="Bakong" className="img-logo" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '15px', color: '#002d56' }}>NBC Bakong National KHQR</strong>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      EMVCo national QR standard with customizable store display name
                    </div>
                  </div>
                </div>
                <div className={`radio-circle ${paymentRail === 'bakong' ? 'active bakong' : ''}`}>
                  {paymentRail === 'bakong' && <div className="radio-inner-dot" />}
                </div>
              </div>

              {/* Option 3: ABA PayWay Gateway */}
              <div
                className={`rail-card ${paymentRail === 'aba' ? 'selected-aba' : ''}`}
                onClick={() => setPaymentRail('aba')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="rail-logo-box">
                    <img src="/aba-logo.svg" alt="ABA Bank" className="img-logo" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '15px', color: '#002d56' }}>ABA PayWay Gateway</strong>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Direct dynamic KHQR, in-app deep links, and instant webhook callbacks
                    </div>
                  </div>
                </div>
                <div className={`radio-circle ${paymentRail === 'aba' ? 'active' : ''}`}>
                  {paymentRail === 'aba' && <div className="radio-inner-dot" />}
                </div>
              </div>

            </div>
          </div>

          {/* Dynamic Credential Inputs based on selected rail */}
          {(paymentRail === 'bundle' || paymentRail === 'bakong') && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <img src="/bakong-logo.svg" alt="Bakong" style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#e11900' }}>NBC Bakong KHQR Parameters</span>
              </div>

              <div className="form-group">
                <label className="field-label">
                  <span>Bakong / Clearing Account ID</span>
                  <span className="field-badge">Required</span>
                </label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. hut_soksitchey1@aclb"
                  value={bakongAccount}
                  onChange={(e) => setBakongAccount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="field-label">
                  <span>Store Display Name</span>
                  <span className="field-badge">Bakong Tag 59</span>
                </label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Rikidev"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                />
              </div>

              {/* Note for Bakong */}
              <div className="note-box bakong">
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Bakong Note:</strong> You can freely customize your <strong>Store Display Name</strong> above. Customers scanning with Bakong or any bank will see this name on their payment screen.
                </span>
              </div>

              <div className="form-group">
                <label className="field-label">
                  <span>Merchant Contact Phone</span>
                  <span className="field-badge">Optional</span>
                </label>
                <input
                  type="tel"
                  className="input-text"
                  placeholder="e.g. 0977416126"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          )}

          {(paymentRail === 'bundle' || paymentRail === 'aba') && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <img src="/aba-logo.svg" alt="ABA Bank" style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#004f71' }}>ABA PayWay Parameters</span>
              </div>

              <div className="form-group">
                <label className="field-label">
                  <span>ABA PayWay USD Link</span>
                  <span className="field-badge">USD Rail</span>
                </label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. https://link.payway.com.kh/ABAPAY86523639G"
                  value={abaUsdLink}
                  onChange={(e) => setAbaUsdLink(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="field-label">
                  <span>ABA PayWay KHR Link</span>
                  <span className="field-badge">KHR Rail</span>
                </label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. https://link.payway.com.kh/ABAPAYk8523640S"
                  value={abaKhrLink}
                  onChange={(e) => setAbaKhrLink(e.target.value)}
                />
              </div>

              {/* Note for ABA */}
              <div className="note-box aba">
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>ABA Note:</strong> The merchant name for ABA PayWay is permanently linked to your official <strong>ABA Merchant account profile</strong>. To edit your name or request new payment links, please use the <strong>ABA Merchant App</strong>.
                </span>
              </div>
            </div>
          )}

          <div style={{ marginTop: '24px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setStep(2)}
            >
              Continue to Subscription <ArrowRight size={18} />
            </button>
          </div>
        </main>
      )}

      {/* ======================================================== */}
      {/* STEP 2: SUBSCRIPTION PLAN & CURRENCY SWITCHER            */}
      {/* ======================================================== */}
      {step === 2 && (
        <main className="portal-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h1 className="card-title">Choose Subscription Plan</h1>
              <p className="card-desc">Select tier to activate live dispatch and webhook endpoints.</p>
            </div>

            {/* Currency Switcher */}
            <div style={{
              display: 'inline-flex',
              padding: '4px',
              background: '#f1f5f9',
              borderRadius: '9999px',
              gap: '4px'
            }}>
              <button
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: currency === 'USD' ? '#004f71' : 'transparent',
                  color: currency === 'USD' ? '#ffffff' : '#64748b'
                }}
                onClick={() => setCurrency('USD')}
              >
                USD ($)
              </button>
              <button
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: currency === 'KHR' ? '#004f71' : 'transparent',
                  color: currency === 'KHR' ? '#ffffff' : '#64748b'
                }}
                onClick={() => setCurrency('KHR')}
              >
                KHR (៛)
              </button>
            </div>
          </div>

          {/* Plan Cards */}
          <div className="plan-grid">
            <div
              className={`plan-card ${plan === '1w' ? 'active' : ''}`}
              onClick={() => setPlan('1w')}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#004f71', textTransform: 'uppercase', marginBottom: '4px' }}>
                Test Trial
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#002d56', marginBottom: '2px' }}>
                {getPlanPrice('1w', currency).label}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {getPlanPrice('1w', currency).period}
              </div>
            </div>

            <div
              className={`plan-card ${plan === '1m' ? 'active' : ''}`}
              onClick={() => setPlan('1m')}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: '4px' }}>
                Developer
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#002d56', marginBottom: '2px' }}>
                {getPlanPrice('1m', currency).label}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {getPlanPrice('1m', currency).period}
              </div>
            </div>

            <div
              className={`plan-card ${plan === '1y' ? 'active' : ''}`}
              onClick={() => setPlan('1y')}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', marginBottom: '4px' }}>
                Enterprise
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#002d56', marginBottom: '2px' }}>
                {getPlanPrice('1y', currency).label}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {getPlanPrice('1y', currency).period}
              </div>
            </div>
          </div>

          {/* Payment Method Selector for Subscription Fee */}
          <div style={{ marginTop: '20px' }}>
            <label className="field-label" style={{ marginBottom: '8px', display: 'block' }}>Pay Subscription Fee Via</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `2px solid ${payMethod === 'bakong' ? '#e11900' : '#e2e8f0'}`,
                  background: payMethod === 'bakong' ? '#fff5f5' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setPayMethod('bakong')}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e11900', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '9px', flexShrink: 0 }}>
                  KHQR
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>Bakong KHQR</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Scan Any Banking App</div>
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `2px solid ${payMethod === 'aba' ? '#002D56' : '#e2e8f0'}`,
                  background: payMethod === 'aba' ? '#f0f7ff' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setPayMethod('aba')}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#002D56', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '10px', flexShrink: 0 }}>
                  ABA
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>ABA PayWay</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Open ABA Mobile App</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            margin: '20px 0',
            padding: '14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Linked Telegram ID: <strong style={{ color: '#0f172a' }}>{telegramId}</strong>
            </div>
            <div style={{ fontSize: '13px', color: '#004f71' }}>
              Merchant Rail: <strong style={{ color: paymentRail === 'bakong' ? '#e11900' : (paymentRail === 'aba' ? '#004f71' : '#7c3aed') }}>{paymentRail === 'bundle' ? 'DUAL SUITE' : paymentRail.toUpperCase()}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '14px',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '14px',
                color: '#334155',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 2 }}
              disabled={isLoading}
              onClick={handleGenerateCheckout}
            >
              {isLoading ? 'Generating KHQR...' : 'Generate Live KHQR'} <QrCode size={18} />
            </button>
          </div>
        </main>
      )}

      {/* ======================================================== */}
      {/* STEP 3: SCAN KHQR PRESENTATION (AUTOMATED POLLING)       */}
      {/* ======================================================== */}
      {step === 3 && qrData && (
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div className="bill-card">
            {/* Header */}
            <div className={qrData.bank === 'ABA' ? 'bill-header-aba' : 'bill-header-bakong'}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.9 }}>
                {qrData.bank === 'ABA' ? 'ABA PAYWAY INSTANT CHECKOUT' : 'NBC BAKONG NATIONAL KHQR'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px' }}>
                {qrData.merchantName || storeName || 'Rikidev'}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
                {qrData.bank === 'ABA' ? 'PayWay Rail • Direct KHQR' : 'Acquired via NBC Interbank Clearing'}
              </div>
            </div>

            {/* Body */}
            <div className="bill-body">
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Amount Payable
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#002d56' }}>
                  {qrData.currency === 'KHR'
                    ? `${qrData.amountFormatted || qrData.amount} ៛`
                    : `$${qrData.amountFormatted || qrData.amount} USD`}
                </div>
              </div>

              {/* QR Container */}
              <div className="qr-box">
                <QRCodeSVG
                  value={qrData.qrString}
                  size={240}
                  level="H"
                  marginSize={1}
                  fgColor={qrData.bank === 'ABA' ? '#002D56' : '#000000'}
                  bgColor="#ffffff"
                />

                {/* Center Badge */}
                {qrData.bank === 'ABA' ? (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: '#002D56',
                    border: '3px solid #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                    pointerEvents: 'none'
                  }}>
                    <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '13px' }}>ABA</span>
                  </div>
                ) : (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: '#e11900',
                    border: '3px solid #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                    pointerEvents: 'none',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 800
                  }}>
                    KHQR
                  </div>
                )}
              </div>

              {/* Expiration Countdown */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#64748b',
                fontSize: '13px',
                marginTop: '6px'
              }}>
                <Clock size={15} />
                <span>Expires in: <strong>{formatTimer(countdown)}</strong></span>
              </div>

              {/* Mobile Deep Link */}
              {qrData.deepLink && (
                <a
                  href={qrData.deepLink}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '13px',
                    borderRadius: '14px',
                    background: qrData.bank === 'ABA' ? '#002D56' : '#e11900',
                    color: '#ffffff',
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '14.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
                  }}
                >
                  <Smartphone size={16} /> Open in {qrData.bank === 'ABA' ? 'ABA Mobile' : 'Bakong App'}
                </a>
              )}

              {/* Automated Background Verification Indicator (No manual buttons) */}
              <div style={{
                width: '100%',
                marginTop: '14px',
                padding: '11px 14px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '12.5px',
                color: '#475569',
                fontWeight: 600
              }}>
                <span className="auto-pulse-dot" />
                <span>Automated clearing active — listening for payment...</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={14} /> Back to Plan Selection
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 4: CLEAN ENTERPRISE RECEIPT & API KEYS (NON-AI)     */}
      {/* ======================================================== */}
      {step === 4 && (
        <div className="receipt-card">
          <div className="verified-icon-circle">
            <CheckCircle2 size={32} />
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#002d56', marginBottom: '4px' }}>
            Payment Verified!
          </h2>
          <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '20px' }}>
            Your account is now activated. Your production API keys and webhook credentials are ready.
          </p>

          <div className="receipt-table">
            <div className="receipt-row">
              <span style={{ color: '#64748b' }}>Reference ID</span>
              <strong style={{ color: '#0f172a' }}>{qrData?.tranId || `TX-${Date.now()}`}</strong>
            </div>
            <div className="receipt-row">
              <span style={{ color: '#64748b' }}>Registered Merchant Rail</span>
              <strong style={{ color: paymentRail === 'bakong' ? '#e11900' : (paymentRail === 'aba' ? '#004f71' : '#7c3aed') }}>
                {paymentRail === 'bakong' ? 'NBC Bakong National KHQR' : (paymentRail === 'aba' ? 'ABA PayWay Gateway' : 'Bakong + ABA Dual Suite')}
              </strong>
            </div>
            <div className="receipt-row">
              <span style={{ color: '#64748b' }}>Subscription Paid Via</span>
              <strong style={{ color: qrData?.bank === 'ABA' ? '#004f71' : '#e11900' }}>
                {qrData?.bank === 'ABA' ? 'ABA PayWay Checkout' : 'NBC Bakong KHQR'}
              </strong>
            </div>
            <div className="receipt-row">
              <span style={{ color: '#64748b' }}>Linked Telegram</span>
              <strong style={{ color: '#0f172a' }}>{telegramId}</strong>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                <span>PRODUCTION API KEY</span>
                {copiedKey && <span style={{ color: '#10b981' }}>Copied</span>}
              </div>
              <div className="copy-pill">
                <span>{qrData?.apiKey || `plk_live_${telegramId}_active`}</span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => copyToClipboard(qrData?.apiKey || `plk_live_${telegramId}_active`, 'key')}
                >
                  <Copy size={13} style={{ display: 'inline', marginRight: '4px' }} /> Copy
                </button>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                <span>WEBHOOK SIGNING SECRET</span>
                {copiedSecret && <span style={{ color: '#10b981' }}>Copied</span>}
              </div>
              <div className="copy-pill">
                <span>{qrData?.secret || `whsec_${telegramId}_active`}</span>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => copyToClipboard(qrData?.secret || `whsec_${telegramId}_active`, 'secret')}
                >
                  <Copy size={13} style={{ display: 'inline', marginRight: '4px' }} /> Copy
                </button>
              </div>
            </div>

            <div style={{ marginTop: '14px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                How to Create Payment QR (POST)
              </div>
              <code style={{ fontSize: '12px', color: '#0f172a', wordBreak: 'break-all', display: 'block' }}>
                {paymentRail === 'bakong'
                  ? '/api/payment/generate-qr (or /api/bakong/generate-qr)'
                  : (paymentRail === 'aba' ? '/api/payment/generate-qr (or /api/aba/generate-qr)' : '/api/payment/generate-qr')}
              </code>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Header: <code>Authorization: Bearer {'<API_KEY>'}</code>
              </div>
            </div>

            {/* Direct PDF Integration Manual Download */}
            <a
              href={`/api/user/download-pdf?telegramId=${telegramId}&key=${qrData?.apiKey || ''}`}
              download={`PaylinkApi_Integration_Guide_${telegramId}.pdf`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '16px',
                padding: '13px 18px',
                borderRadius: '12px',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13.5px',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              <Download size={16} /> Download Integration Guide (PDF)
            </a>

            {/* AI Master Coding Prompt for Vibe Coding (Cursor / Claude / ChatGPT / v0) */}
            <div style={{ marginTop: '16px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', textAlign: 'left' }}>
              <div style={{
                background: '#0b132b',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '11.5px', fontWeight: 700 }}>
                  <Bot size={15} />
                  <span>AI MASTER PROMPT ({paymentRail === 'bakong' ? 'BAKONG KHQR ONLY' : (paymentRail === 'aba' ? 'ABA PAYWAY ONLY' : 'DUAL RAIL')})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://paylinkapi-bot.onrender.com';
                    const effectiveKey = qrData?.apiKey || `plk_live_${telegramId}_active`;
                    const effectiveSecret = qrData?.secret || `whsec_${telegramId}_active`;
                    const effectiveMerchant = storeName || 'Merchant Store';

                    let aiRailText = '';
                    let aiEndpointText = '';
                    if (paymentRail === 'bakong') {
                      aiRailText = `   - System Rail: NBC BAKONG KHQR ONLY (Account: ${bakongAccount || 'your_bakong_id'})\n   - CRITICAL REQUIREMENT FOR AI:\n     This merchant is registered EXCLUSIVELY for NBC Bakong KHQR. All customer payments MUST route directly to the merchant's Bakong ID (${bakongAccount || 'your_bakong_id'}). DO NOT generate ABA PayWay links. Customers can scan the generated KHQR using ANY Cambodian banking app (Bakong, ACLEDA, ABA Mobile, Wing, Canadia, TrueMoney, Sathapana, etc.).`;
                      aiEndpointText = `   - Generate QR: POST ${baseUrl}/api/payment/generate-qr (or /api/bakong/generate-qr)\n     Body: { "amount": <amount>, "currency": "USD" | "KHR", "orderId": "<ORDER_ID>" }`;
                    } else if (paymentRail === 'aba') {
                      aiRailText = `   - System Rail: ABA PAYWAY ONLY\n   - CRITICAL REQUIREMENT FOR AI:\n     This merchant is registered EXCLUSIVELY for ABA PayWay Gateway. All customer payments generate ABA PayWay QR codes and deeplinks for ABA Mobile banking. DO NOT generate Bakong-only payloads.`;
                      aiEndpointText = `   - Generate QR: POST ${baseUrl}/api/payment/generate-qr (or /api/aba/generate-qr)\n     Body: { "amount": <amount>, "currency": "USD" | "KHR", "orderId": "<ORDER_ID>" }`;
                    } else {
                      aiRailText = `   - System Rail: DUAL-RAIL (NBC Bakong KHQR & ABA PayWay)\n   - CRITICAL REQUIREMENT FOR AI:\n     This merchant supports BOTH Bakong KHQR (for all Cambodian bank apps) AND ABA PayWay (for ABA Mobile). Use the unified auto-routing endpoint.`;
                      aiEndpointText = `   - Generate QR: POST ${baseUrl}/api/payment/generate-qr\n     Body: { "amount": <amount>, "currency": "USD" | "KHR", "orderId": "<ORDER_ID>" }`;
                    }

                    const prompt = `You are an expert full-stack engineer. Build a Cambodian Payment Checkout integration using PaylinkApi Gateway with the following exact specifications:\n\n1. CONFIGURATION & MERCHANT CREDENTIALS:\n   - Live Base URL: "${baseUrl}"\n   - Production API Key: "${effectiveKey}"\n   - Webhook Secret: "${effectiveSecret}"\n   - Merchant Name: "${effectiveMerchant}"\n   - Authorization Header: "Bearer ${effectiveKey}"\n${aiRailText}\n\n2. STEP 1: INITIALIZE PAYMENT (GENERATE QR CODE)\n${aiEndpointText}\n   - Headers: { "Content-Type": "application/json", "Authorization": "Bearer ${effectiveKey}" }\n   - Response contains:\n     { "success": true, "qrString": "<EMV_QR_STRING>", "tranId": "<TRAN_ID>", "deepLink": "<BANK_DEEPLINK>" }\n\n3. STEP 2: RENDER PAYMENT MODAL & KHQR\n   - Display a modern checkout modal with:\n     a) QR Code rendered from "qrString" (using 'qrcode.react' or standard QR canvas).\n     b) Formatted price ($ USD and KHR), Store Name ("${effectiveMerchant}"), and Order ID.\n     c) Mobile Deep Link button: <a href="deepLink">Open Banking App to Pay</a>.\n\n4. STEP 3: AUTOMATED SETTLEMENT VERIFICATION\n   - Set an automated 2-3 second polling interval:\n     POST ${baseUrl}/api/payment/check\n     Headers: { "Content-Type": "application/json", "Authorization": "Bearer ${effectiveKey}" }\n     Body: { "tranId": "<TRAN_ID>" }\n   - When response { "status": "PAID", "paid": true }:\n     a) Clear interval, display success checkmark, and complete the customer order.\n     b) PaylinkApi automatically sends an instant transaction alert to your Telegram Bot!\n\n5. STEP 4: OPTIONAL WEBHOOK LISTENER (BACKEND)\n   - Listen for POST /api/webhook and verify 'X-Signature' header:\n     const expected = crypto.createHmac('sha256', '${effectiveSecret}').update(rawBody).digest('hex');\n     if (req.headers['x-signature'] === expected);\n`;
                    copyToClipboard(prompt, 'prompt');
                  }}
                  style={{
                    background: copiedPrompt ? '#10b981' : '#1e293b',
                    color: '#ffffff',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {copiedPrompt ? <Check size={12} /> : <Copy size={12} />}
                  {copiedPrompt ? 'Copied Prompt!' : 'Copy for AI'}
                </button>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 14px', fontSize: '11.5px', color: '#475569' }}>
                💡 Click <strong>"Copy for AI"</strong> and paste into <strong>Cursor</strong>, <strong>Claude 3.7</strong>, <strong>ChatGPT 4o</strong>, or <strong>v0.dev</strong> to auto-generate your full checkout code!
              </div>
            </div>
          </div>

          <a
            href="https://t.me/PayLinkAPI_bot"
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
            style={{ textDecoration: 'none' }}
          >
            Return to Telegram Console <ExternalLink size={16} />
          </a>
        </div>
      )}
    </div>
  );
}
