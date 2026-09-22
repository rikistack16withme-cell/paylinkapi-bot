const { BasePaymentProvider, ProviderStatus } = require('../base.provider');
const { queryBakongByMd5 } = require('../../controllers/bakongController');

/**
 * Bakong KHQR Live Provider (Direct NBC Bypass Connected)
 */
class BakongProvider extends BasePaymentProvider {
  constructor() {
    super('Bakong KHQR');
    this.status = ProviderStatus.CONNECTED;
  }

  async createPayment(params) {
    return {
      status: ProviderStatus.CONNECTED,
      provider: 'Bakong KHQR',
      ...params
    };
  }

  async checkStatus(md5) {
    return await queryBakongByMd5(md5);
  }

  async verifyTransaction(md5) {
    return await this.checkStatus(md5);
  }
}

module.exports = new BakongProvider();
