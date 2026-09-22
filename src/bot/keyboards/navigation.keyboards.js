const i18n = require('../../services/i18n.service');
const { makeButton } = require('../../config/emojis');

const navigationKeyboards = {
  backToDashboard: (lang = 'en') => [
    [
      makeButton(i18n.t('btn_dashboard', lang), 'nav_dashboard', 'brand', 'primary')
    ]
  ],

  backAndDashboard: (backCallback, lang = 'en') => [
    [
      makeButton(i18n.t('btn_back', lang), backCallback, null, 'danger'),
      makeButton(i18n.t('btn_dashboard', lang), 'nav_dashboard', 'brand', 'primary')
    ]
  ],

  cancelOnly: (lang = 'en') => [
    [
      makeButton(i18n.t('btn_cancel', lang), 'nav_cancel', null, 'danger'),
      makeButton(lang === 'en' ? 'បកប្រែជាភាសាខ្មែរ' : 'Switch to English', 'toggle_lang_wizard', lang === 'en' ? 'khmer_flag' : 'english_flag', 'primary')
    ]
  ],

  wizardStep: (_quickCallback, _quickText, lang = 'en') => [
    [
      makeButton(i18n.t('btn_cancel', lang), 'nav_cancel', null, 'danger'),
      makeButton(lang === 'en' ? 'បកប្រែជាភាសាខ្មែរ' : 'Switch to English', 'toggle_lang_wizard', lang === 'en' ? 'khmer_flag' : 'english_flag', 'primary')
    ]
  ]
};

module.exports = navigationKeyboards;
