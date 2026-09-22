const db = require('../database');

class OrderService {
  createPlaceholderOrder(telegramId, provider, currency, details = {}) {
    const orderNumber = Math.floor(10000 + Math.random() * 90000);
    const order = {
      id: `#${orderNumber}`,
      telegramId: String(telegramId),
      provider,
      currency,
      details,
      status: 'ACTIVE',
      isMock: false,
      note: 'Live Dual-Rail Pipeline active and ready for payments.'
    };

    // Also persist user merchant links into their user record
    if (details.usdLink || details.khrLink || details.merchantName) {
      const user = db.getUser(telegramId) || {};
      db.saveUser({
        telegramId,
        usdLink: details.usdLink || user.usdLink,
        khrLink: details.khrLink || user.khrLink,
        merchantName: details.merchantName || user.merchantName
      });
    }

    return db.createOrder(order);
  }

  savePaymentTransaction(txData) {
    const orderId = String(txData.tranId || `TX-${Date.now()}`);
    const bank = (txData.bank || (txData.md5 && !txData.clientId ? 'BAKONG' : 'ABA')).toUpperCase();
    const record = {
      id: orderId,
      telegramId: String(txData.telegramId || ''),
      provider: bank === 'ABA' ? 'ABA PayWay Gateway' : 'Bakong KHQR',
      bank,
      currency: txData.currency || 'USD',
      amount: txData.amount || 1.00,
      amountFormatted: txData.amountFormatted,
      status: txData.status || 'PENDING',
      plan: txData.plan || null,
      details: {
        tranId: txData.tranId,
        clientId: txData.clientId,
        requestTime: txData.requestTime,
        token: txData.token,
        merchantLink: txData.merchantLink,
        qrString: txData.qrString,
        md5: txData.md5,
        deepLink: txData.deepLink,
        phone: txData.phone,
        plan: txData.plan,
        bank
      },
      createdAt: new Date().toISOString()
    };
    return db.createOrder(record);
  }

  getPaymentTransaction(tranId) {
    return db.getOrder(String(tranId));
  }

  updatePaymentTransactionStatus(tranId, status, rawResponse = null) {
    const order = db.getOrder(String(tranId));
    if (!order) return null;
    order.status = status;
    if (rawResponse) {
      order.rawResponse = rawResponse;
    }
    order.updatedAt = new Date().toISOString();
    return db.createOrder(order);
  }

  getUserOrders(telegramId) {
    return db.getUserOrders(telegramId);
  }
}

module.exports = new OrderService();
