const QRCode = require('qrcode');
const sharp = require('sharp');

/**
 * Generates an official styled payment card image buffer
 * matching the authentic card presentation from the website portal.
 */
async function generateStyledQrCard({
  bank = 'BAKONG',
  amountFormatted = '0.10',
  currency = 'USD',
  merchantName = 'Rikidev',
  qrString = ''
}) {
  const isAba = (bank || '').toUpperCase() === 'ABA';
  const curr = (currency || 'USD').toUpperCase();
  const amtDisplay = curr === 'KHR' ? `${amountFormatted} ៛` : `$${amountFormatted} USD`;

  // 1. Generate clean PNG buffer of the QR Code
  const qrBuffer = await QRCode.toBuffer(qrString, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 320,
    color: {
      dark: isAba ? '#002D56' : '#000000',
      light: '#ffffff'
    }
  });

  const qrBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;

  const headerColor = isAba ? '#002D56' : '#E21A1A';
  const triangleColor = isAba ? '#001833' : '#B31414';
  const safeMerchantName = (merchantName || (isAba ? 'HUT SOKSITCHEY' : 'Rikidev')).slice(0, 26).toUpperCase();

  // Authentic Bakong KHQR vector logo from PayWay checkout
  const bakongLogoSvg = `
    <g transform="translate(185, 48) scale(2.2)">
      <path d="M39.006 5.19439V9.59764H34.5318C34.0729 9.59764 33.7288 9.2307 33.7288 8.80731V5.22264C33.7288 4.77103 34.1016 4.43231 34.5318 4.43231H38.1743C38.6619 4.40408 39.006 4.74278 39.006 5.19439Z" fill="white"/>
      <path d="M59.9717 6.97176H57.7345C57.7345 4.34676 55.5548 2.20159 52.8875 2.20159C50.7651 2.20159 48.9008 3.55645 48.2699 5.53225C48.1265 6.01209 48.0404 6.49192 48.0404 6.97176V13.9718H47.9831C46.7785 13.9718 45.8033 13.0121 45.8033 11.8266V6.97176H45.832C45.832 5.05241 46.6351 3.21773 48.0691 1.89112C49.3884 0.677406 51.1093 0 52.9162 0C56.8168 0 59.9717 3.13305 59.9717 6.97176Z" fill="white"/>
      <path d="M59.9999 13.9718L56.845 14L56.0706 13.2379L54.3497 11.5444L51.9692 9.20166H55.1241L59.9999 13.9718Z" fill="white"/>
      <path d="M39.7517 11.7702H33.0117C32.1799 11.7702 31.5203 11.121 31.5203 10.3024V3.66936C31.5203 2.85081 32.1799 2.20159 33.0117 2.20159H39.7517C40.5834 2.20159 41.2431 2.85081 41.2431 3.66936V10.3024L43.4802 12.504V2.14515C43.4802 0.959671 42.505 0 41.3005 0H31.4629C30.2583 0 29.2832 0.959671 29.2832 2.14515V11.8266C29.2832 13.0121 30.2583 13.9718 31.4629 13.9718H41.9888L39.7517 11.7702Z" fill="white"/>
      <path d="M12.3614 14H9.20656L2.60996 7.47984V14H0V0H2.60996V6.2379L8.94843 0H12.046L5.16255 6.71772L12.3614 14Z" fill="white"/>
      <path d="M24.1492 0H26.7018V14H24.1492V7.93145H16.8643V14H14.3117V0H16.8643V5.84273H24.1492V0Z" fill="white"/>
    </g>
  `;

  // Authentic ABA PayWay logo
  const abaLogoSvg = `
    <g transform="translate(160, 42)">
      <rect x="0" y="0" width="180" height="42" rx="10" fill="rgba(255,255,255,0.15)"/>
      <text x="90" y="28" text-anchor="middle" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="20" font-weight="900" fill="#ffffff" letter-spacing="2">ABA PAYWAY</text>
    </g>
  `;

  const centerBadgeSvg = isAba
    ? `<rect x="226" y="396" width="48" height="48" rx="12" fill="#002D56" stroke="#ffffff" stroke-width="3"/>
       <text x="250" y="426" text-anchor="middle" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="14" font-weight="900" fill="#ffffff">ABA</text>`
    : `<circle cx="250" cy="420" r="24" fill="#E21A1A" stroke="#ffffff" stroke-width="3.5"/>
       <text x="250" y="425" text-anchor="middle" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="11" font-weight="800" fill="#ffffff">KHQR</text>`;

  const svgTemplate = `
  <svg width="500" height="740" viewBox="0 0 500 740" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.10"/>
      </filter>
    </defs>

    <!-- Outer Background -->
    <rect width="500" height="740" fill="#f1f5f9"/>

    <!-- Main Card Body -->
    <rect x="30" y="24" width="440" height="692" rx="26" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" filter="url(#cardShadow)"/>

    <!-- Header Banner with Top Rounded Corners -->
    <path d="M 30 50 Q 30 24 56 24 L 444 24 Q 470 24 470 50 L 470 106 L 30 106 Z" fill="${headerColor}"/>

    <!-- Header Logo -->
    ${isAba ? abaLogoSvg : bakongLogoSvg}

    <!-- The Iconic 3D Triangle Fold Notch -->
    <polygon points="470,106 470,140 436,106" fill="${triangleColor}"/>

    <!-- Merchant Details Section -->
    <g transform="translate(68, 142)">
      <text x="0" y="0" font-family="'Nunito Sans', 'SF Pro Display', Arial, sans-serif" font-size="13" font-weight="600" fill="#64748b" letter-spacing="0.5">${safeMerchantName}</text>
      <text x="0" y="38" font-family="'Nunito Sans', 'SF Pro Display', Arial, sans-serif" font-size="34" font-weight="800" fill="#081b37">${amountFormatted}</text>
      <text x="${amountFormatted.length * 20 + 8}" y="26" font-family="'Nunito Sans', Arial, sans-serif" font-size="14" font-weight="700" fill="#081b37">${curr}</text>
    </g>

    <!-- Dashed Line Divider -->
    <line x1="68" y1="216" x2="432" y2="216" stroke="#94a3b8" stroke-width="1.8" stroke-dasharray="7,5"/>

    <!-- QR Code Section -->
    <g transform="translate(85, 240)">
      <rect x="0" y="0" width="330" height="330" rx="20" fill="#ffffff" stroke="#f1f5f9" stroke-width="1"/>
      <image href="${qrBase64}" x="15" y="15" width="300" height="300"/>
    </g>

    <!-- Dynamic Center Emblem Badge -->
    ${centerBadgeSvg}

    <!-- Bottom Instructions Footer -->
    <text x="250" y="624" text-anchor="middle" font-family="'Nunito Sans', Arial, sans-serif" font-size="15" font-weight="700" fill="#081b37">Scan to Pay</text>
    <text x="250" y="652" text-anchor="middle" font-family="'Nunito Sans', Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">Scan with ABA Mobile, or other Mobile Banking App</text>
    <text x="250" y="670" text-anchor="middle" font-family="'Nunito Sans', Arial, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">supporting NBC KHQR standard</text>
  </svg>
  `;

  return sharp(Buffer.from(svgTemplate))
    .png({ quality: 95 })
    .toBuffer();
}

module.exports = {
  generateStyledQrCard
};
