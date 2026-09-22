/**
 * ABA PayWay Frontend Gateway Utility
 * Connects to backend /api/aba/generate-qr and /api/aba/check-payment
 */

async function generateAbaPaymentQr({ amount = 1.00, currency = 'USD', merchantLink = null } = {}) {
  try {
    const response = await fetch('/api/aba/generate-qr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        amount: Number(amount),
        currency: currency.toUpperCase(),
        merchantLink
      })
    });

    if (!response.ok) {
      throw new Error(`ABA Gateway Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Frontend ABA QR Gen Error]:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to ABA PayWay'
    };
  }
}

async function checkAbaPaymentStatus({
  tranId,
  clientId,
  requestTime,
  token,
  merchantLink
} = {}) {
  if (!tranId || !clientId || !requestTime || !token) {
    return { success: false, paid: false, status: 'ERROR' };
  }

  try {
    const response = await fetch('/api/aba/check-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        tranId,
        clientId,
        requestTime,
        token,
        merchantLink
      })
    });

    if (!response.ok) {
      return { success: false, paid: false, status: 'ERROR' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, paid: false, status: 'ERROR', error: error.message };
  }
}

module.exports = {
  generateAbaPaymentQr,
  checkAbaPaymentStatus
};
