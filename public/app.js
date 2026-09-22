/**
 * PaylinkApi — FAST • SECURE • EASY
 * Vanta.js 3D Globe • Anti-Inspect Security • Real ABA PayWay & Bakong KHQR
 */

// Global State
const state = {
  telegramId: null,
  provider: null, // User must click choice first!
  merchantData: {},
  selectedPlan: null,
  activeTx: null,
  pollTimer: null,
  vantaEffect: null
};

// --------------------------------------------------------------------------
// 1. 🛡️ Anti-Inspect & DevTools Protection Suite
// --------------------------------------------------------------------------
(function setupAntiInspect() {
  // 1. Disable Right Click
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showToast('Inspection is restricted for security.');
    return false;
  }, false);

  // 2. Disable DevTools Shortcuts
  document.addEventListener('keydown', (e) => {
    const isF12 = e.key === 'F12' || e.keyCode === 123;
    const isCtrlShiftI = e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73);
    const isCtrlShiftJ = e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74);
    const isCtrlShiftC = e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67);
    const isCtrlU = e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85);
    const isCtrlS = e.ctrlKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83);
    const isMacDevTools = e.metaKey && e.altKey && (e.key === 'i' || e.key === 'I');

    if (isF12 || isCtrlShiftI || isCtrlShiftJ || isCtrlShiftC || isCtrlU || isCtrlS || isMacDevTools) {
      e.preventDefault();
      e.stopPropagation();
      showToast('Developer inspection is restricted.');
      return false;
    }
  }, false);

})();

// --------------------------------------------------------------------------
// 2. 🌐 Vanta.js 3D Interactive Globe Background
// --------------------------------------------------------------------------
function initVantaGlobe() {
  try {
    if (typeof VANTA !== 'undefined' && VANTA.GLOBE) {
      state.vantaEffect = VANTA.GLOBE({
        el: "#vanta-bg",
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: 0x985e71,
        color2: 0xe31e1e,
        size: 1.40,
        backgroundColor: 0x030712
      });
    }
  } catch (err) {
    console.warn('Vanta initialization notice:', err);
  }
}

// --------------------------------------------------------------------------
// 3. DOM Ready Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Parse Telegram ID from URL parameters
  const params = new URLSearchParams(window.location.search);
  state.telegramId = params.get('tg_id') || params.get('telegramId') || '7283817695';

  initVantaGlobe();
  initRailSelector();
  initQuickFill();
  initFormSubmission();
  initPlanSelection();
  initCheckoutActions();
  initCheckoutRailToggle();
  initCurrencyToggle();
});

// Toast Feedback Helper
function showToast(msg, duration = 2400) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// --------------------------------------------------------------------------
// 4. Payment Rail Selection (Click Choice First -> Reveal Inputs)
// --------------------------------------------------------------------------
function initRailSelector() {
  const cards = document.querySelectorAll('.rail-card');
  const promptBox = document.getElementById('railSelectPrompt');
  const dynamicContainer = document.getElementById('dynamicInputsContainer');
  const bakongGroup = document.getElementById('bakongFieldsGroup');
  const phoneGroup = document.getElementById('phoneFieldGroup');
  const abaGroup = document.getElementById('abaLinksGroup');

  const merchantIdInput = document.getElementById('merchantId');
  const merchantNameInput = document.getElementById('merchantName');
  const phoneInput = document.getElementById('phone');
  const khrInput = document.getElementById('khrLink');
  const usdInput = document.getElementById('usdLink');

  function applyRail(rail) {
    state.provider = rail;

    // Highlight selected card & check radio
    cards.forEach(c => {
      const isCurrent = c.getAttribute('data-rail') === rail;
      c.classList.toggle('active', isCurrent);
      const radio = c.querySelector('input[type="radio"]');
      if (radio) radio.checked = isCurrent;
    });

    // Hide prompt card and show dynamic inputs container
    if (promptBox) promptBox.style.display = 'none';
    if (dynamicContainer) dynamicContainer.classList.remove('hidden');

    if (rail === 'aba') {
      // ABA Direct: Show ABA links and contact phone, hide Bakong fields
      if (bakongGroup) bakongGroup.style.display = 'none';
      if (phoneGroup) phoneGroup.style.display = 'block';
      if (abaGroup) abaGroup.style.display = 'flex';

      if (merchantIdInput) {
        merchantIdInput.removeAttribute('required');
      }
      if (merchantNameInput) {
        merchantNameInput.removeAttribute('required');
      }
      if (phoneInput) phoneInput.setAttribute('required', 'true');
      if (khrInput) khrInput.setAttribute('required', 'true');
      if (usdInput) usdInput.setAttribute('required', 'true');

    } else if (rail === 'bakong') {
      // Bakong Direct: Show Bakong fields and phone, hide ABA links
      if (bakongGroup) bakongGroup.style.display = 'block';
      if (phoneGroup) phoneGroup.style.display = 'block';
      if (abaGroup) abaGroup.style.display = 'none';

      if (merchantIdInput) merchantIdInput.setAttribute('required', 'true');
      if (merchantNameInput) merchantNameInput.setAttribute('required', 'true');
      if (phoneInput) phoneInput.setAttribute('required', 'true');
      if (khrInput) khrInput.removeAttribute('required');
      if (usdInput) usdInput.removeAttribute('required');

    } else { // 'bundle'
      // Dual Suite: Show all parameters
      if (bakongGroup) bakongGroup.style.display = 'block';
      if (phoneGroup) phoneGroup.style.display = 'block';
      if (abaGroup) abaGroup.style.display = 'flex';

      if (merchantIdInput) merchantIdInput.setAttribute('required', 'true');
      if (merchantNameInput) merchantNameInput.setAttribute('required', 'true');
      if (phoneInput) phoneInput.setAttribute('required', 'true');
      if (khrInput) khrInput.setAttribute('required', 'true');
      if (usdInput) usdInput.setAttribute('required', 'true');
    }
  }

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const rail = card.getAttribute('data-rail');
      applyRail(rail);
    });
  });

  window.applyRail = applyRail;
}

// --------------------------------------------------------------------------
// 5. Quick-Fill Sandbox Test
// --------------------------------------------------------------------------
function initQuickFill() {
  const btn = document.getElementById('btnQuickSandbox');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // If no rail chosen yet, select 'bundle' so all fields show and populate
    const currentRail = state.provider || 'bundle';
    if (window.applyRail) window.applyRail(currentRail);

    if (document.getElementById('merchantId')) document.getElementById('merchantId').value = 'hut_soksitchey1@aclb';
    if (document.getElementById('merchantName')) document.getElementById('merchantName').value = 'Rikidev';
    if (document.getElementById('phone')) document.getElementById('phone').value = '0977416126';
    if (document.getElementById('khrLink')) document.getElementById('khrLink').value = 'https://link.payway.com.kh/ABAPAYk8523640S';
    if (document.getElementById('usdLink')) document.getElementById('usdLink').value = 'https://link.payway.com.kh/ABAPAY86523639G';

    showToast('Verified test credentials auto-filled.');
  });
}

// --------------------------------------------------------------------------
// 6. Step 1: Form Submission -> Step 2
// --------------------------------------------------------------------------
function initFormSubmission() {
  const form = document.getElementById('merchantForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!state.provider) {
      showToast('Please select a payment rail first.');
      return;
    }

    state.merchantData = {
      telegramId: state.telegramId,
      provider: state.provider,
      merchantId: document.getElementById('merchantId')?.value.trim() || '',
      merchantName: document.getElementById('merchantName')?.value.trim() || '',
      phone: document.getElementById('phone')?.value.trim() || '',
      khrLink: document.getElementById('khrLink')?.value.trim() || '',
      usdLink: document.getElementById('usdLink')?.value.trim() || ''
    };

    if (state.provider === 'aba' && !state.merchantData.merchantName) {
      state.merchantData.merchantName = 'ABA PayWay Store';
    }

    goToStep(2);
  });

  const btnBack1 = document.getElementById('btnBackToStep1');
  if (btnBack1) {
    btnBack1.addEventListener('click', () => goToStep(1));
  }
}

// --------------------------------------------------------------------------
// 7. Step 2: Plan Selection -> Step 3
// --------------------------------------------------------------------------
function initPlanSelection() {
  const planButtons = document.querySelectorAll('.btn-plan-select');
  const planItems = document.querySelectorAll('.plan-item');

  planButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const plan = btn.getAttribute('data-plan');
      selectPlan(plan);
    });
  });

  planItems.forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-plan-select')) return;
      const plan = item.getAttribute('data-plan');
      selectPlan(plan);
    });
  });
}

async function selectPlan(plan) {
  state.selectedPlan = plan;

  let amount = 0.10;
  let label = '1 Week ($0.10)';

  if (plan === '1m') {
    amount = 1.00;
    label = '1 Month ($1.00)';
  } else if (plan === '1y') {
    amount = 10.00;
    label = '1 Year ($10.00)';
  }

  state.selectedAmount = amount;

  // Initialize checkout rail choice based on step 1 provider or default to Bakong
  if (!state.checkoutMethod) {
    state.checkoutMethod = (state.provider === 'aba') ? 'aba' : 'bakong';
  }

  const btnBakong = document.getElementById('payMethodBakong');
  const btnAba = document.getElementById('payMethodAba');
  if (btnBakong && btnAba) {
    btnBakong.classList.toggle('active', state.checkoutMethod === 'bakong');
    btnAba.classList.toggle('active', state.checkoutMethod === 'aba');
  }

  document.getElementById('checkoutPlanLabel').textContent = label;

  goToStep(3);
  await initiateLivePayment(amount);
}

// --------------------------------------------------------------------------
// 8. Payment Rail Switcher (Bakong Red vs ABA Blue)
// --------------------------------------------------------------------------
// 8. Payment Rail Switcher (Bakong Red vs ABA Blue)
// --------------------------------------------------------------------------
function initCheckoutRailToggle() {
  const btnBakong = document.getElementById('payMethodBakong');
  const btnAba = document.getElementById('payMethodAba');

  function switchRail(rail) {
    if (state.checkoutMethod === rail && state.activeTx) return;
    state.checkoutMethod = rail;

    if (btnBakong && btnAba) {
      btnBakong.classList.toggle('active', rail === 'bakong');
      btnAba.classList.toggle('active', rail === 'aba');
    }

    if (state.selectedAmount) {
      initLivePaymentDebounced(state.selectedAmount);
    }
  }

  if (btnBakong) {
    btnBakong.addEventListener('click', () => switchRail('bakong'));
  }
  if (btnAba) {
    btnAba.addEventListener('click', () => switchRail('aba'));
  }

  window.switchCheckoutRail = switchRail;
}

// --------------------------------------------------------------------------
// 8.1 Currency Switcher (USD Dollar vs KHR Riel)
// --------------------------------------------------------------------------
function initCurrencyToggle() {
  const btnUsd = document.getElementById('btnCurrUsd');
  const btnKhr = document.getElementById('btnCurrKhr');

  function switchCurrency(curr) {
    if (state.selectedCurrency === curr) return;
    state.selectedCurrency = curr;

    if (btnUsd && btnKhr) {
      btnUsd.classList.toggle('active', curr === 'USD');
      btnKhr.classList.toggle('active', curr === 'KHR');
    }

    // Recalculate amount based on plan
    const plan = state.selectedPlan || '1w';
    let amt = 0.10;
    if (curr === 'KHR') {
      amt = (plan === '1m') ? 4000 : (plan === '1y') ? 40000 : 400;
    } else {
      amt = (plan === '1m') ? 1.00 : (plan === '1y') ? 10.00 : 0.10;
    }
    state.selectedAmount = amt;

    initLivePaymentDebounced(amt);
  }

  if (btnUsd) btnUsd.addEventListener('click', () => switchCurrency('USD'));
  if (btnKhr) btnKhr.addEventListener('click', () => switchCurrency('KHR'));

  window.switchCheckoutCurrency = switchCurrency;
}

let paymentDebounceTimer = null;
function initLivePaymentDebounced(amount) {
  clearTimeout(paymentDebounceTimer);
  paymentDebounceTimer = setTimeout(() => {
    initiateLivePayment(amount);
  }, 100);
}

// --------------------------------------------------------------------------
// 9. Step 3: Initiate Live Payment & Render Authentic KHQR Card
// --------------------------------------------------------------------------
async function initiateLivePayment(amount) {
  const qrLoading = document.getElementById('qrLoadingState');
  const qrLoadingText = document.getElementById('qrLoadingText');
  const qrImage = document.getElementById('liveQrImage');
  const tranIdElem = document.getElementById('checkoutTranId');
  const statusBadge = document.getElementById('checkoutStatusBadge');
  const webLinkBtn = document.getElementById('linkWebCheckout');
  const khqrCard = document.getElementById('khqrCard');
  const khqrTriangle = document.getElementById('khqrTriangle');
  const khqrMerchantName = document.getElementById('khqrMerchantName');
  const khqrAmount = document.getElementById('khqrAmount');
  const khqrCurrency = document.getElementById('khqrCurrency');
  const khqrFooterText = document.getElementById('khqrFooterText');
  const railBadge = document.getElementById('checkoutRailBadge');
  const railText = document.getElementById('checkoutRailText');

  const method = state.checkoutMethod || 'bakong';
  const curr = state.selectedCurrency || 'USD';
  const isKhr = curr === 'KHR';

  // Apply card visual styling: Bakong Red vs ABA Blue
  if (method === 'bakong') {
    if (khqrCard) {
      khqrCard.classList.remove('theme-aba');
      khqrCard.classList.add('theme-bakong');
    }
    if (khqrTriangle) {
      khqrTriangle.className = 'khqr-triangle red-triangle';
    }
    if (railBadge) {
      railBadge.className = 'status-pill rail-pill-bakong';
    }
    if (railText) {
      railText.textContent = 'NBC Bakong KHQR';
    }
    if (khqrFooterText) {
      khqrFooterText.textContent = 'Scan with Bakong, ABA Mobile, or any Banking App';
    }
    if (qrLoadingText) {
      qrLoadingText.textContent = 'Generating NBC Bakong KHQR...';
    }
  } else {
    if (khqrCard) {
      khqrCard.classList.remove('theme-bakong');
      khqrCard.classList.add('theme-aba');
    }
    if (khqrTriangle) {
      khqrTriangle.className = 'khqr-triangle blue-triangle';
    }
    if (railBadge) {
      railBadge.className = 'status-pill rail-pill-aba';
    }
    if (railText) {
      railText.textContent = 'ABA PayWay Gateway';
    }
    if (khqrFooterText) {
      khqrFooterText.textContent = 'Scan with ABA Mobile, or other Mobile Banking App';
    }
    if (qrLoadingText) {
      qrLoadingText.textContent = 'Generating ABA PayWay KHQR...';
    }
  }

  // Subscription payment recipient is the platform PaylinkApi
  const storeName = 'PaylinkApi';
  if (khqrMerchantName) khqrMerchantName.textContent = storeName;

  // Amount & Currency on KHQR Card
  state.selectedAmount = amount;
  if (khqrAmount) {
    khqrAmount.textContent = isKhr ? String(Math.round(amount)) : parseFloat(amount).toFixed(2);
  }
  if (khqrCurrency) {
    khqrCurrency.textContent = isKhr ? 'KHR' : 'USD';
  }

  if (qrLoading) qrLoading.classList.remove('hidden');
  if (qrImage) qrImage.classList.add('hidden');
  const overlay = document.getElementById('qrOverlayStatus');
  if (overlay) overlay.classList.add('hidden');
  if (tranIdElem) tranIdElem.textContent = 'Generating...';
  if (statusBadge) {
    statusBadge.innerHTML = `<span class="dot-blink ${method === 'bakong' ? 'red-blink' : 'blue-blink'}"></span><span>Awaiting Scan in Banking App</span>`;
  }

  try {
    const payload = {
      telegramId: state.telegramId,
      amount,
      currency: curr,
      plan: state.selectedPlan,
      merchantData: {
        ...state.merchantData,
        merchantName: storeName
      },
      payMethod: method
    };

    const res = await fetch('/api/web/register-and-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success || !data.qrString) {
      throw new Error(data.error || 'Failed to generate KHQR.');
    }

    state.activeTx = data;

    // Load QR Image
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(data.qrString)}`;
    if (qrImage) {
      qrImage.src = qrUrl;
      qrImage.onload = () => {
        if (qrLoading) qrLoading.classList.add('hidden');
        qrImage.classList.remove('hidden');
      };
    }

    if (tranIdElem) tranIdElem.textContent = data.tranId;

    if (data.merchantLink && method === 'aba' && webLinkBtn) {
      webLinkBtn.href = data.merchantLink;
      webLinkBtn.classList.remove('hidden');
    } else if (webLinkBtn) {
      webLinkBtn.classList.add('hidden');
    }

    // Auto-poll payment status every 1.5s
    startPaymentPolling(data.tranId, data.md5);

  } catch (err) {
    console.error('Payment initialization error:', err);
    if (qrLoading) {
      qrLoading.innerHTML = `<span style="color: #f43f5e; font-size: 13px;">Error: ${escapeHtml(err.message)}</span>`;
    }
    showToast('Failed to connect to gateway.');
  }
}

// --------------------------------------------------------------------------
// 10. Real-Time Status Polling (Dual-Rail Auto Checking)
// --------------------------------------------------------------------------
function startPaymentPolling(tranId, md5) {
  if (state.pollTimer) clearInterval(state.pollTimer);

  state.pollTimer = setInterval(async () => {
    await checkPaymentStatus(tranId, md5, false);
  }, 1500);
}

async function checkPaymentStatus(tranId, md5, isManual = false) {
  if (!tranId && !md5) return;

  try {
    const res = await fetch('/api/web/check-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tranId, md5 })
    });

    const result = await res.json();
    const statusBadge = document.getElementById('checkoutStatusBadge');

    if (result.status === 'PAID' || result.paid || result.status === 'SUCCESS') {
      clearInterval(state.pollTimer);

      const overlay = document.getElementById('qrOverlayStatus');
      if (overlay) overlay.classList.remove('hidden');
      if (statusBadge) {
        statusBadge.innerHTML = `<span style="color: #10b981; font-weight: 700;">✓ Payment Confirmed</span>`;
      }

      showToast('Payment verified! API credentials issued.');

      // Trigger high-end celebration animation & thank you modal!
      triggerPaymentCelebration(result);

      return true;
    } else if (result.status === 'SCANNED') {
      if (statusBadge) {
        statusBadge.innerHTML = `<span style="color: #00d2ff; font-weight: 700;">Scanned - Approving...</span>`;
      }
      if (isManual) showToast('Scanned. Please confirm in your banking app.');
    }
  } catch (err) {
    if (isManual) showToast(`Query error: ${err.message}`);
  }

  return false;
}

// --------------------------------------------------------------------------
// 11. Celebration Fireworks Confetti Cannon & Thank You Experience
// --------------------------------------------------------------------------
function triggerPaymentCelebration(result) {
  // 1. Launch dynamic confetti explosion
  launchConfetti();

  // 2. Open Celebration Modal
  const modal = document.getElementById('celebrationModal');
  const routeElem = document.getElementById('clearedRouteName');
  if (routeElem) {
    routeElem.textContent = state.checkoutMethod === 'aba' 
      ? 'Cleared via ABA Bank PayWay Gateway'
      : 'Cleared via NBC Bakong National KHQR';
  }
  if (modal) {
    modal.classList.remove('hidden');
  }

  const btnView = document.getElementById('btnViewCredentialsNow');
  if (btnView) {
    btnView.onclick = () => {
      if (modal) modal.classList.add('hidden');
      showSuccessScreen(result);
    };
  }

  // Auto transition to credentials after 4.5s
  setTimeout(() => {
    if (modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
      showSuccessScreen(result);
    }
  }, 4500);
}

function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.classList.remove('hidden');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = ['#10b981', '#00d2ff', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#ffd700'];

  for (let i = 0; i < 180; i++) {
    pieces.push({
      x: canvas.width / 2 + (Math.random() * 240 - 120),
      y: canvas.height / 2 + (Math.random() * 120 - 60),
      vx: (Math.random() - 0.5) * 22,
      vy: (Math.random() - 0.7) * 24,
      size: Math.random() * 9 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 14,
      opacity: 1
    });
  }

  let animationFrame;
  const startTime = Date.now();

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = Date.now() - startTime;

    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.48; // gravity
      p.vx *= 0.98; // air resistance
      p.rotation += p.rotSpeed;
      if (elapsed > 2000) {
        p.opacity = Math.max(0, 1 - (elapsed - 2000) / 1500);
      }

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctx.restore();
    });

    if (elapsed < 3500) {
      animationFrame = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.classList.add('hidden');
      cancelAnimationFrame(animationFrame);
    }
  }

  render();
}

function initCheckoutActions() {
  const btnChange = document.getElementById('btnChangePlan');
  if (btnChange) {
    btnChange.addEventListener('click', () => {
      if (state.pollTimer) clearInterval(state.pollTimer);
      goToStep(2);
    });
  }

  const btnReturn = document.getElementById('btnReturnToBot');
  if (btnReturn) {
    btnReturn.addEventListener('click', () => {
      window.location.href = 'https://t.me/PayLinkAPI_bot';
    });
  }
}

// --------------------------------------------------------------------------
// 10. Step 4: Success Screen
// --------------------------------------------------------------------------
function showSuccessScreen(paymentResult) {
  goToStep(4);

  const apiKey = paymentResult.apiKey || state.activeTx?.apiKey || `plk_live_${state.telegramId || 'usr'}_${Math.random().toString(16).slice(2, 10)}`;
  const secret = state.activeTx?.secret || `whsec_${Math.random().toString(16).slice(2, 12)}`;

  document.getElementById('issuedApiKey').textContent = apiKey;
  document.getElementById('issuedSecret').textContent = secret;
  document.getElementById('issuedEndpoint').textContent = `${window.location.origin}/api/aba/generate-qr`;
}

// --------------------------------------------------------------------------
// 11. Navigation Stepper Controls
// --------------------------------------------------------------------------
function goToStep(stepNum) {
  document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));

  const target = document.getElementById(`step${stepNum}Section`);
  if (target) target.classList.add('active');

  for (let i = 1; i <= 3; i++) {
    const item = document.getElementById(`stepIndicator${i}`);
    const line = document.getElementById(`stepLine${i}`);

    if (item) {
      if (i < stepNum) {
        item.classList.add('completed');
        item.classList.remove('active');
      } else if (i === stepNum) {
        item.classList.add('active');
        item.classList.remove('completed');
      } else {
        item.classList.remove('active', 'completed');
      }
    }

    if (line) {
      if (i < stepNum) {
        line.classList.add('completed');
      } else {
        line.classList.remove('completed');
      }
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Clipboard Copy Helper
function copyText(elementId) {
  const elem = document.getElementById(elementId);
  if (!elem) return;
  const text = elem.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard.');
  }).catch(() => {
    showToast('Failed to copy.');
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
