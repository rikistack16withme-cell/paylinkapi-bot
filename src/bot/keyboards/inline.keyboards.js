const i18n = require('../../services/i18n.service');
const config = require('../../config');
const { makeButton } = require('../../config/emojis');

const inlineKeyboards = {
  // 1. Welcome / Unregistered Board
  welcome: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(i18n.t('btn_get_started', lang), 'start_register', 'rocket', 'success')],
        [
          makeButton(i18n.t('btn_pricing', lang), 'nav_pricing', 'pricing', 'primary'),
          makeButton(i18n.t('btn_documentation', lang), 'nav_docs', 'docs', 'primary')
        ],
        [makeButton(i18n.t('btn_support', lang), 'nav_support', 'support', 'primary')],
        [makeButton(lang === 'en' ? 'បកប្រែជាភាសាខ្មែរ (Khmer)' : 'Switch to English', 'toggle_lang_welcome', null, 'success')]
      ]
    }
  }),

  // 2. Registration Completed
  registrationSuccess: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(i18n.t('btn_continue', lang), 'nav_dashboard', 'brand', 'success')]
      ]
    }
  }),

  // 3. Main Dashboard (Clean professional streamlined 5-core board)
  dashboard: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(i18n.t('btn_get_payment_api', lang), 'nav_get_api', 'get_api', 'primary')],
        [makeButton(i18n.t('btn_test_live_payment', lang), 'start_live_pay_test', 'rocket', 'success')],
        [
          makeButton(i18n.t('btn_my_api_keys', lang), 'nav_api_keys', 'keys', 'primary'),
          makeButton(i18n.t('btn_my_orders', lang), 'nav_orders', 'orders', 'primary')
        ],
        [makeButton(i18n.t('btn_doc_pdf', lang), 'doc_download_pdf', 'docs', 'primary')],
        [
          { text: lang === 'km' ? '💬 ជំនួយ Support (@kaixite)' : '💬 Developer Support (@kaixite)', url: config.support.url || 'https://t.me/kaixite' }
        ],
        [makeButton(lang === 'en' ? 'ប្តូរជាភាសាខ្មែរ (Khmer)' : 'Switch to English', 'toggle_lang_dash', null, 'success')]
      ]
    }
  }),

  // 4. Provider Selection: BAKONG is RED (danger), ABA is BLUE (primary)
  providerSelection: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(i18n.t('provider_bundle', lang), 'prov_bundle', 'bundle', 'primary')],
        [makeButton(i18n.t('provider_bakong', lang), 'prov_bakong', 'bakong', 'danger')], // RED BAKONG
        [makeButton(i18n.t('provider_aba', lang), 'prov_aba', 'aba', 'primary')],       // BLUE ABA
        [
          makeButton(lang === 'en' ? 'បកប្រែជាភាសាខ្មែរ' : 'Switch to English', 'toggle_lang_provider', null, 'success'),
          makeButton(i18n.t('btn_back', lang), 'nav_dashboard', null, 'danger')
        ]
      ]
    }
  }),

  // 6. Confirmation Keyboard
  confirmation: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(i18n.t('btn_confirm', lang), 'confirm_order_submit', 'verified', 'success')],
        [
          makeButton(i18n.t('btn_cancel', lang), 'nav_cancel', null, 'danger'),
          makeButton(lang === 'en' ? 'បកប្រែជាភាសាខ្មែរ' : 'Switch to English', 'toggle_lang_wizard', null, 'primary')
        ]
      ]
    }
  }),

  // 7. Post-Submission Completed
  orderSubmitted: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(lang === 'km' ? 'ធ្វើការស្កេនទូទាត់ជាក់ស្តែង (Test Pay Now) ❯' : 'Test Live Payment (Scan QR) ❯', 'start_live_pay_test', 'rocket', 'success')],
        [
          makeButton(lang === 'km' ? 'មើលកូដ API Keys' : 'View API Keys', 'nav_api_keys', 'keys', 'primary'),
          makeButton(i18n.t('btn_view_orders', lang), 'nav_orders', 'orders', 'primary')
        ],
        [makeButton(i18n.t('btn_dashboard', lang), 'nav_dashboard', 'brand', 'primary')]
      ]
    }
  }),

  // 8. Pricing Board
  pricing: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(i18n.t('btn_get_payment_api', lang), 'nav_get_api', 'get_api', 'success')],
        [makeButton(i18n.t('btn_back', lang), 'nav_dashboard', null, 'danger')]
      ]
    }
  }),

  // 9. Orders Board
  orders: (hasOrders, lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(i18n.t('btn_test_live_payment', lang), 'start_live_pay_test', 'rocket', 'success')],
        [makeButton(i18n.t('btn_doc_pdf', lang), 'doc_download_pdf', 'docs', 'primary')],
        [makeButton(i18n.t('btn_get_payment_api', lang), 'nav_get_api', 'get_api', 'primary')],
        [makeButton(i18n.t('btn_back', lang), 'nav_dashboard', null, 'danger')]
      ]
    }
  }),

  // 10. API Keys Board
  apiKeys: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(lang === 'km' ? '🔄 បន្តគម្រោង (Renew Subscription)' : '🔄 Renew Subscription', 'sub_back_plans', 'refresh', 'success')],
        [makeButton(i18n.t('btn_test_live_payment', lang), 'start_live_pay_test', 'rocket', 'primary')],
        [makeButton(i18n.t('btn_doc_pdf', lang), 'doc_download_pdf', 'docs', 'primary')],
        [makeButton(i18n.t('btn_get_payment_api', lang), 'nav_get_api', 'get_api', 'primary')],
        [makeButton(i18n.t('btn_back', lang), 'nav_dashboard', null, 'danger')]
      ]
    }
  }),

  // 11. Documentation Hub
  documentationHub: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(i18n.t('btn_how_to_connect', lang), 'nav_how_to_connect', 'rocket', 'success')],
        [
          makeButton(i18n.t('btn_doc_quickstart', lang), 'doc_quickstart', 'rocket', 'primary'),
          makeButton(i18n.t('btn_doc_auth', lang), 'doc_auth', 'keys', 'primary')
        ],
        [
          makeButton(i18n.t('btn_doc_create_payment', lang), 'doc_create_payment', 'get_api', 'primary'),
          makeButton(i18n.t('btn_doc_status', lang), 'doc_status', 'orders', 'primary')
        ],
        [
          makeButton(i18n.t('btn_doc_webhooks', lang), 'doc_webhooks', 'brand', 'primary'),
          makeButton(i18n.t('btn_doc_errors', lang), 'doc_errors', 'security', 'primary')
        ],
        [makeButton(i18n.t('btn_doc_examples', lang), 'doc_examples', 'docs', 'primary')],
        [makeButton(i18n.t('btn_back', lang), 'nav_dashboard', null, 'danger')]
      ]
    }
  }),

  // Documentation Sub-Page Back
  docSubBack: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [
          makeButton(lang === 'km' ? 'បញ្ជីឯកសារ' : 'Docs Menu', 'nav_docs', 'docs', 'primary'),
          makeButton(i18n.t('btn_dashboard', lang), 'nav_dashboard', 'brand', 'success')
        ]
      ]
    }
  }),

  // 12. Support Board
  support: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: i18n.t('btn_contact_support', lang), url: config.support.url, style: 'primary' }],
        [makeButton(i18n.t('btn_help_center', lang), 'support_help_center', 'docs', 'primary')],
        [makeButton(i18n.t('btn_back', lang), 'nav_dashboard', null, 'danger')]
      ]
    }
  }),

  // 13. Settings Board
  settings: (lang = 'en') => ({
    reply_markup: {
      inline_keyboard: [
        [makeButton(i18n.t('btn_toggle_lang', lang), 'settings_toggle_lang', 'brand', 'primary')],
        [makeButton(i18n.t('btn_toggle_notif', lang), 'settings_toggle_notif', 'active', 'success')],
        [makeButton(i18n.t('btn_account_info', lang), 'settings_account_info', 'keys', 'primary')],
        [makeButton(i18n.t('btn_back', lang), 'nav_dashboard', null, 'danger')]
      ]
    }
  })
};

module.exports = inlineKeyboards;
