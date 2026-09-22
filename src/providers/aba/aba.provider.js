const { BasePaymentProvider, ProviderStatus } = require('../base.provider');
const { generateAbaQrCore, checkAbaPaymentCore } = require('../../controllers/abaPaywayController');

/**
 * ABA PayWay Live Gateway Provider (Phase 2 Connected)
 * Directly connects to ABA Bank PayWay APIs for real KHQR generation and status tracking.
 */
class ABAProvider extends BasePaymentProvider {
  constructor() {
    super('ABA PayWay Gateway');
    this.status = ProviderStatus.CONNECTED;
  }

  /**
   * Generates real ABA PayWay dynamic KHQR Code
   * @param {Object} params - { amount, currency, merchantLink }
   */
  async createPayment(params = {}) {
    try {
      const result = await generateAbaQrCore(params);
      return {
        status: ProviderStatus.CONNECTED,
        success: true,
        ...result
      };
    } catch (err) {
      return {
        status: ProviderStatus.ERROR,
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Checks real ABA transaction settlement status
   * @param {Object} params - { tranId, clientId, requestTime, token, merchantLink }
   */
  async checkStatus(params = {}) {
    try {
      const result = await checkAbaPaymentCore(params);
      return result;
    } catch (err) {
      return {
        success: false,
        paid: false,
        status: 'ERROR',
        error: err.message
      };
    }
  }

  /**
   * Verification hook for ABA transactions
   */
  async verifyTransaction(params) {
    return await this.checkStatus(params);
  }
}

module.exports = new ABAProvider();
