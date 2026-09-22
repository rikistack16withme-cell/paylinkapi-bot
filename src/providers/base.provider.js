/**
 * Abstract Base Payment Provider Interface
 * Defines standard lifecycle for Cambodian payment gateways.
 * Stubs return PROVIDER_NOT_CONNECTED / NOT_IMPLEMENTED in Phase 1.
 */

const ProviderStatus = {
  NOT_CONNECTED: 'PROVIDER_NOT_CONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR'
};

class BasePaymentProvider {
  constructor(name) {
    if (new.target === BasePaymentProvider) {
      throw new TypeError('Cannot construct BasePaymentProvider directly.');
    }
    this.name = name;
    this.status = ProviderStatus.NOT_CONNECTED;
  }

  getStatus() {
    return this.status;
  }

  /**
   * Generates or creates a payment transaction.
   * In Phase 1: Throws error or returns NOT_IMPLEMENTED.
   */
  async createPayment(params) {
    throw new Error(`[${this.name}] createPayment is NOT_IMPLEMENTED in Phase 1. Awaiting external package.`);
  }

  /**
   * Verifies an existing transaction.
   * In Phase 1: Throws error or returns NOT_IMPLEMENTED.
   */
  async verifyTransaction(txId) {
    throw new Error(`[${this.name}] verifyTransaction is NOT_IMPLEMENTED in Phase 1. Awaiting external package.`);
  }

  /**
   * Polls or checks payment status.
   */
  async checkStatus(txId) {
    throw new Error(`[${this.name}] checkStatus is NOT_IMPLEMENTED in Phase 1. Awaiting external package.`);
  }

  /**
   * Generates webhook verification signature.
   */
  async generateWebhookSignature(payload) {
    throw new Error(`[${this.name}] generateWebhookSignature is NOT_IMPLEMENTED in Phase 1. Awaiting external package.`);
  }
}

module.exports = {
  BasePaymentProvider,
  ProviderStatus
};
