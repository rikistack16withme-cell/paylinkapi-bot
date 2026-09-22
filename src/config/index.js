require('dotenv').config();

const config = {
  bot: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10
      }
    }
  },
  adminChatId: process.env.ADMIN_CHAT_ID || '-5393647415',
  brand: {
    name: process.env.BRAND_NAME || 'PaylinkApi',
    tagline: process.env.BRAND_TAGLINE || 'FAST • SECURE • EASY',
    providers: ['Bakong', 'ABA Gateway']
  },
  support: {
    username: process.env.SUPPORT_USERNAME || 'paylinkapi_support',
    url: process.env.SUPPORT_URL || 'https://t.me/paylinkapi_support'
  },
  i18n: {
    defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
    supportedLanguages: ['en', 'km']
  },
  system: {
    phase: parseInt(process.env.PHASE || '1', 10),
    isMock: process.env.MOCK_MODE === 'true'
  }
};

module.exports = config;
