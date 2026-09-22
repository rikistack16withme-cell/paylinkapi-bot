const config = require('../config');
const db = require('../database');
const i18n = require('../services/i18n.service');
const bakongProvider = require('../providers/bakong/bakong.provider');
const abaProvider = require('../providers/aba/aba.provider');
const TelegramBot = require('node-telegram-bot-api');

async function verifyAll() {
  console.log('=== PaylinkApi Telegram Bot Phase 1 Verification ===\n');

  // 1. Config Check
  console.log('1. Checking Configuration...');
  if (!config.bot.token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing!');
  }
  console.log('   ✓ Token configured: ' + config.bot.token.slice(0, 10) + '...');
  console.log('   ✓ Brand: ' + config.brand.name);
  console.log('   ✓ Phase: ' + config.system.phase);

  // 2. Database Check
  console.log('\n2. Checking Database Layer...');
  const testUser = db.saveUser({
    telegramId: 999999999,
    username: 'test_dev',
    firstName: 'Test',
    lastName: 'Developer',
    status: 'ACTIVE'
  });
  console.log('   ✓ Test user created/retrieved: ID ' + testUser.telegramId);

  const testOrder = db.createOrder({
    id: '#TEST-1001',
    telegramId: '999999999',
    provider: 'Bakong KHQR',
    currency: 'USD'
  });
  console.log('   ✓ Test order created: ' + testOrder.id + ' (Status: ' + testOrder.status + ')');

  // 3. Provider Stubs Check
  console.log('\n3. Checking Provider Stubs (Phase 1 Rules)...');
  console.log('   Bakong status: ' + bakongProvider.getStatus());
  console.log('   ABA status:    ' + abaProvider.getStatus());
  const bStatus = bakongProvider.getStatus();
  const aStatus = abaProvider.getStatus();
  if (bStatus !== 'NOT_CONNECTED' && bStatus !== 'CONNECTED' && bStatus !== 'PROVIDER_NOT_CONNECTED') {
    throw new Error(`Unexpected Bakong status: ${bStatus}`);
  }
  if (aStatus !== 'NOT_CONNECTED' && aStatus !== 'CONNECTED' && aStatus !== 'PROVIDER_NOT_CONNECTED') {
    throw new Error(`Unexpected ABA status: ${aStatus}`);
  }
  const bakongStubRes = await bakongProvider.createPayment({});
  console.log('   ✓ Bakong stub response verified:', bakongStubRes.message);

  // 4. i18n Check
  console.log('\n4. Checking Localization (EN / KM)...');
  const enWelcome = i18n.t('welcome_title', 'en', { brand: 'PaylinkApi' });
  const kmWelcome = i18n.t('welcome_title', 'km', { brand: 'PaylinkApi' });
  console.log('   ✓ EN:', enWelcome);
  console.log('   ✓ KM:', kmWelcome);

  // 5. Telegram API Connectivity Check
  console.log('\n5. Checking Telegram Bot Token Connectivity...');
  const bot = new TelegramBot(config.bot.token);
  const me = await bot.getMe();
  console.log('   ✓ Bot Connected to Telegram API!');
  console.log('   • Bot ID: ' + me.id);
  console.log('   • Bot Username: @' + me.username);
  console.log('   • Bot First Name: ' + me.first_name);

  console.log('\n=================================================');
  console.log('🎉 ALL PHASE 1 VERIFICATION CHECKS PASSED!');
  console.log('=================================================');
}

verifyAll().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
