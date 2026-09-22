const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PdfGeneratorService {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp');
    this.logoPath = path.join(__dirname, '../../public/logo.png');
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
      } catch (_) {}
    }
  }

  /**
   * Helper: draws the top executive header banner
   */
  drawHeader(doc, title, subtitle, pageNum, totalPages, devName, devId) {
    // Header background banner
    doc.rect(0, 0, 595.28, 80).fill('#0B1120');
    doc.rect(0, 78, 595.28, 2).fill('#2563EB'); // accent line

    // Embed logo if exists
    let titleX = 40;
    if (fs.existsSync(this.logoPath)) {
      try {
        doc.image(this.logoPath, 35, 16, { height: 48 });
        titleX = 92;
      } catch (_) {}
    }

    // Title & Tagline
    doc.fillColor('#FFFFFF')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(title, titleX, 22);

    doc.fillColor('#38BDF8')
      .fontSize(8.5)
      .font('Helvetica-Bold')
      .text(subtitle, titleX, 45);

    doc.fillColor('#94A3B8')
      .fontSize(7.5)
      .font('Helvetica')
      .text('NBC BAKONG KHQR & ABA PAYWAY INFRASTRUCTURE', titleX, 58);

    // Developer metadata on top right
    doc.fillColor('#E2E8F0')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(`Developer: ${devName || 'Developer'}`, 380, 22, { align: 'right', width: 175 });

    doc.fillColor('#94A3B8')
      .fontSize(7.5)
      .font('Helvetica')
      .text(`ID: ${devId || 'N/A'} | Page ${pageNum} of ${totalPages}`, 380, 36, { align: 'right', width: 175 })
      .text(`Issued: ${new Date().toISOString().slice(0, 10)}`, 380, 48, { align: 'right', width: 175 });

    // Clean vector green dot + verified text (100% ASCII, zero mojibake)
    doc.circle(466, 64, 3.5).fill('#10B981');
    doc.fillColor('#10B981')
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .text('VERIFIED ACTIVE', 474, 61, { align: 'left', width: 90 });
  }

  /**
   * Helper: draws the bottom footer
   */
  drawFooter(doc, pageNum, totalPages) {
    const footerY = 800;
    doc.rect(40, footerY - 10, 515.28, 0.5).fill('#CBD5E1');
    doc.fillColor('#64748B')
      .fontSize(7.5)
      .font('Helvetica')
      .text('PaylinkApi Official Platform Documentation | Telegram Support: @paylinkapi_support', 40, footerY, { width: 350 });

    doc.fillColor('#64748B')
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .text(`Page ${pageNum} of ${totalPages}`, 395, footerY, { align: 'right', width: 160 });
  }

  /**
   * Helper: draws a section header with an electric blue accent pill
   */
  drawSectionHeader(doc, text, y) {
    doc.roundedRect(40, y + 2, 4, 14, 2).fill('#2563EB');
    doc.fillColor('#0F172A')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(text, 50, y + 3);
    return y + 26;
  }

  /**
   * Helper: draws a code box with macOS-style window header
   * Code text starts strictly BELOW the header bar so it NEVER collides with badges!
   */
  drawCodeBox(doc, langLabel, code, y, options = {}) {
    const boxX = 40;
    const boxWidth = 515;
    const padding = 12;
    const headerHeight = 22;
    const contentWidth = boxWidth - (padding * 2);
    const fontSize = options.fontSize || 7.5;
    const lineGap = options.lineGap || 2;
    const codeFont = 'Courier';

    doc.font(codeFont).fontSize(fontSize);
    const textHeight = doc.heightOfString(code, { width: contentWidth, lineGap });
    const boxHeight = textHeight + (padding * 2) + headerHeight;

    // Draw dark code container
    doc.roundedRect(boxX, y, boxWidth, boxHeight, 6).fillAndStroke('#0B132B', '#1E293B');

    // Header bar of the code container
    doc.roundedRect(boxX, y, boxWidth, headerHeight, 6).fill('#1E293B');
    // Draw 3 macOS-style window dots on the left
    doc.circle(boxX + 14, y + 11, 3.5).fill('#EF4444');
    doc.circle(boxX + 24, y + 11, 3.5).fill('#F59E0B');
    doc.circle(boxX + 34, y + 11, 3.5).fill('#10B981');

    // Language label on the right (with plenty of width so text never wraps or clips)
    doc.fillColor('#94A3B8')
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .text(langLabel.toUpperCase(), boxX + 60, y + 7, { align: 'right', width: boxWidth - 75 });

    // Render code text STRICTLY BELOW the header bar!
    const codeStartY = y + headerHeight + padding;
    doc.fillColor(options.codeColor || '#38BDF8')
      .fontSize(fontSize)
      .font(codeFont)
      .text(code, boxX + padding, codeStartY, {
        width: contentWidth,
        lineGap
      });

    return y + boxHeight + 16;
  }

  /**
   * Generates a clean, executive-grade Developer Integration Guide PDF
   * including an AI Vibe Coding Master Prompt for ChatGPT / Claude / Cursor / v0
   */
  async generateIntegrationPdf({ telegramId, userName = 'Developer', apiKeys = [], baseUrl = 'http://localhost:5000' }) {
    return new Promise((resolve, reject) => {
      try {
        const fileName = `PaylinkApi_Integration_Guide_${telegramId}_${Date.now()}.pdf`;
        const filePath = path.join(this.tempDir, fileName);

        const doc = new PDFDocument({
          margin: 0,
          size: 'A4',
          autoFirstPage: false,
          info: {
            Title: 'PaylinkApi Developer Integration Manual',
            Author: 'PaylinkApi Technologies',
            Subject: 'Unified Cambodian Banking API & Webhooks',
            Keywords: 'PaylinkApi, Bakong, KHQR, ABA PayWay, Vibe Coding, AI Prompt'
          }
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const totalPages = 4;
        const sampleKey = (apiKeys && apiKeys[0]?.apiKey) || 'dp_live_your_api_key';
        const sampleSecret = (apiKeys && apiKeys[0]?.secret) || 'whsec_sample_secret';
        const sampleMerchant = (apiKeys && apiKeys[0]?.merchantName) || 'Merchant Store';

        // =========================================================================
        // PAGE 1: CREDENTIALS, ENDPOINTS & WORKFLOW
        // =========================================================================
        doc.addPage();
        this.drawHeader(doc, 'PAYLINKAPI GATEWAY', 'OFFICIAL DEVELOPER INTEGRATION MANUAL', 1, totalPages, userName, telegramId);

        let curY = 96;

        // --- 1. Production Credentials ---
        curY = this.drawSectionHeader(doc, '1. YOUR PRODUCTION CREDENTIALS', curY);

        if (!apiKeys || apiKeys.length === 0) {
          doc.rect(40, curY, 515, 45).fillAndStroke('#F8FAFC', '#E2E8F0');
          doc.fillColor('#64748B')
            .fontSize(9)
            .font('Helvetica')
            .text('No active API keys found. Activate an API key from @PayLinkAPI_bot.', 55, curY + 16);
          curY += 60;
        } else {
          apiKeys.forEach((k, idx) => {
            const cardH = 76;
            doc.roundedRect(40, curY, 515, cardH, 6).fillAndStroke('#F8FAFC', '#CBD5E1');

            // Header of credential card
            doc.roundedRect(40, curY, 515, 22, 6).fill('#1E293B');
            doc.fillColor('#FFFFFF')
              .fontSize(9)
              .font('Helvetica-Bold')
              .text(`KEY #${idx + 1}: ${k.merchantName || 'Merchant Store'}`, 52, curY + 6);

            doc.fillColor('#38BDF8')
              .fontSize(8)
              .font('Helvetica-Bold')
              .text(k.provider || 'Bakong KHQR & ABA PayWay Dual Rail', 350, curY + 6, { align: 'right', width: 190 });

            // Keys & Secrets
            const textY = curY + 28;
            doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold').text('API Key:', 52, textY);
            doc.fillColor('#0F172A').font('Courier-Bold').text(k.apiKey || 'N/A', 130, textY);

            doc.fillColor('#334155').font('Helvetica-Bold').text('Webhook Secret:', 52, textY + 16);
            doc.fillColor('#0F172A').font('Courier-Bold').text(k.secret || 'whsec_live_default', 130, textY + 16);

            doc.fillColor('#334155').font('Helvetica-Bold').text('Settlement:', 52, textY + 32);
            const bankInfo = k.bakongId ? `Bakong: ${k.bakongId}` : (k.usdLink ? 'ABA PayWay Direct Link' : 'Automated Dual Rail');
            doc.fillColor('#2563EB').font('Helvetica-Bold').text(bankInfo, 130, textY + 32);

            curY += cardH + 12;
          });
        }

        // --- 2. Endpoints Reference ---
        curY = this.drawSectionHeader(doc, '2. API BASE URL & PAYMENT ENDPOINTS', curY);

        doc.fillColor('#475569')
          .fontSize(8.5)
          .font('Helvetica')
          .text('Base URL: ', 40, curY, { continued: true })
          .font('Courier-Bold')
          .fillColor('#0F172A')
          .text(`${baseUrl}`);

        curY += 16;

        const endpoints = [
          { method: 'POST', path: '/api/aba/generate-qr', desc: 'Create dynamic ABA/Bakong KHQR string & deeplink' },
          { method: 'POST', path: '/api/aba/check-payment', desc: 'Verify transaction status (PAID or PENDING)' },
          { method: 'GET',  path: '/api/bakong/check/:md5', desc: 'Direct National Bank of Cambodia hash status query' }
        ];

        endpoints.forEach(ep => {
          doc.roundedRect(40, curY, 515, 24, 4).fillAndStroke('#F8FAFC', '#E2E8F0');
          doc.roundedRect(48, curY + 4, 38, 16, 3).fill(ep.method === 'POST' ? '#2563EB' : '#059669');
          doc.fillColor('#FFFFFF')
            .fontSize(7.5)
            .font('Helvetica-Bold')
            .text(ep.method, 48, curY + 8, { align: 'center', width: 38 });

          doc.fillColor('#0F172A')
            .font('Courier-Bold')
            .fontSize(8.5)
            .text(ep.path, 95, curY + 7);

          doc.fillColor('#64748B')
            .font('Helvetica')
            .fontSize(8)
            .text(ep.desc, 260, curY + 7);

          curY += 28;
        });

        curY += 8;

        // --- 3. Quick Integration Flow ---
        curY = this.drawSectionHeader(doc, '3. QUICK INTEGRATION WORKFLOW (POLLING)', curY);

        const steps = [
          { num: 'STEP 1', title: 'Generate QR Code', desc: 'Send POST to /api/aba/generate-qr with amount, currency & API Key header.' },
          { num: 'STEP 2', title: 'Customer Scans & Pays', desc: 'Display the returned qrString or image. Customer scans with ABA or Bakong.' },
          { num: 'STEP 3', title: 'Verify Settlement', desc: 'Poll /api/aba/check-payment every 2-3s until status returns "PAID".' }
        ];

        steps.forEach((st) => {
          doc.roundedRect(40, curY, 515, 28, 4).fillAndStroke('#F1F5F9', '#E2E8F0');
          doc.fillColor('#2563EB').fontSize(8).font('Helvetica-Bold').text(st.num, 52, curY + 9);
          doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold').text(st.title, 110, curY + 9);
          doc.fillColor('#475569').fontSize(8).font('Helvetica').text(st.desc, 230, curY + 9);
          curY += 34;
        });

        this.drawFooter(doc, 1, totalPages);

        // =========================================================================
        // PAGE 2: AI VIBE CODING PROMPT (FOR CURSOR, CHATGPT, CLAUDE, V0, BOLT)
        // =========================================================================
        doc.addPage();
        this.drawHeader(doc, 'PAYLINKAPI GATEWAY', 'AI VIBE CODING MASTER PROMPT', 2, totalPages, userName, telegramId);

        let p2Y = 96;

        p2Y = this.drawSectionHeader(doc, 'AI PROMPT FOR VIBE CODING (CURSOR / CLAUDE / CHATGPT / V0)', p2Y);

        // Explain callout (with vector badge, ZERO broken emojis)
        doc.roundedRect(40, p2Y, 515, 42, 6).fillAndStroke('#EFF6FF', '#93C5FD');
        doc.roundedRect(50, p2Y + 7, 56, 13, 3).fill('#2563EB');
        doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold')
          .text('PRO TIP', 50, p2Y + 9, { align: 'center', width: 56 });

        doc.fillColor('#1D4ED8').fontSize(8.5).font('Helvetica-Bold')
          .text('How to use with AI Vibe Coding (Cursor, Claude, ChatGPT, v0):', 114, p2Y + 8);
        doc.fillColor('#334155').fontSize(7.8).font('Helvetica')
          .text(
            'Copy the entire prompt below and paste it directly into Cursor, Claude 3.7 / Sonnet, ChatGPT 4o, Bolt.new, Windsurf, or v0.dev.\nThe AI will automatically generate complete checkout components, KHQR display modal, and payment auto-check logic for your app!',
            52, p2Y + 23, { width: 491, lineGap: 1.5 }
          );

        p2Y += 52;

        const vibePrompt = 
`You are an expert full-stack engineer. Build a Cambodian Payment Checkout integration using PaylinkApi Gateway (NBC Bakong KHQR & ABA PayWay) with the following specifications:

1. CONFIGURATION & CREDENTIALS:
   - Base URL: "${baseUrl}"
   - API Key: "${sampleKey}"
   - Webhook Secret: "${sampleSecret}"
   - Merchant Name: "${sampleMerchant}"
   - Authorization Header: "Bearer ${sampleKey}"

2. STEP 1: INITIALIZE PAYMENT (GENERATE QR)
   - When customer clicks "Pay Now", send POST request:
     POST ${baseUrl}/api/aba/generate-qr
     Headers: { "Content-Type": "application/json", "Authorization": "Bearer ${sampleKey}" }
     Body: { "amount": <amount>, "currency": "USD" | "KHR" }
   - Response contains:
     { "status": "success", "qrString": "<KHQR_STRING>", "transactionId": "<TRAN_ID>", "deeplink": "<NBC_DEEPLINK>" }

3. STEP 2: RENDER PAYMENT MODAL & KHQR
   - Display a modern checkout modal with:
     a) QR Code generated from "qrString" (using qrcode.react or any QR renderer).
     b) Formatted price ($ USD and KHR), Merchant Name, and Transaction ID.
     c) Mobile Deep Link button: <a href="deeplink">Pay via Banking App</a>.

4. STEP 3: REAL-TIME PAYMENT VERIFICATION (AUTO-POLLING)
   - Set an automated 3-second interval polling:
     POST ${baseUrl}/api/aba/check-payment
     Headers: { "Content-Type": "application/json", "Authorization": "Bearer ${sampleKey}" }
     Body: { "transactionId": "<TRAN_ID>" }
   - If response { "status": "PAID" }:
     - Clear the polling interval.
     - Show congratulations checkmark animation.
     - Update order state to "PAID" and deliver goods.
   - If { "status": "PENDING" }, keep checking until 5-minute timeout.

5. STEP 4: OPTIONAL WEBHOOK LISTENER (BACKEND)
   - Listen for POST /api/webhook and verify 'X-Signature' header:
     const expected = crypto.createHmac('sha256', '${sampleSecret}').update(rawBody).digest('hex');
     if (req.headers['x-signature'] === expected) { /* fulfill order */ }`;

        p2Y = this.drawCodeBox(doc, 'AI VIBE PROMPT (COPY & PASTE)', vibePrompt, p2Y, {
          fontSize: 7.2,
          lineGap: 1.6,
          codeColor: '#67E8F9'
        });

        this.drawFooter(doc, 2, totalPages);

        // =========================================================================
        // PAGE 3: CODE IMPLEMENTATION SAMPLES (NODE.JS & PYTHON)
        // =========================================================================
        doc.addPage();
        this.drawHeader(doc, 'PAYLINKAPI GATEWAY', 'PRODUCTION CODE IMPLEMENTATION (PAGE 3)', 3, totalPages, userName, telegramId);

        let p3Y = 96;

        // --- Node.js Sample ---
        p3Y = this.drawSectionHeader(doc, 'A. Node.js (JavaScript / Fetch)', p3Y);
        const nodeCode = 
`// 1. Generate QR Code
const genRes = await fetch('${baseUrl}/api/aba/generate-qr', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${sampleKey}'
  },
  body: JSON.stringify({ amount: 1.00, currency: 'USD' })
});
const { qrString, transactionId } = await genRes.json();

// 2. Check Payment Status (Polling every 3 seconds)
const checkRes = await fetch('${baseUrl}/api/aba/check-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${sampleKey}'
  },
  body: JSON.stringify({ transactionId })
});
const result = await checkRes.json();
if (result.status === 'PAID') {
  console.log('Payment Verified Successfully!');
}`;
        p3Y = this.drawCodeBox(doc, 'JavaScript (Node.js)', nodeCode, p3Y, { fontSize: 7.5, lineGap: 1.8 });

        // --- Python Sample ---
        p3Y = this.drawSectionHeader(doc, 'B. Python (requests)', p3Y);
        const pythonCode = 
`import requests

headers = { "Authorization": "Bearer ${sampleKey}" }

# 1. Generate QR
res = requests.post("${baseUrl}/api/aba/generate-qr", json={"amount": 1.00, "currency": "USD"}, headers=headers)
data = res.json()
tran_id = data.get("transactionId")

# 2. Check Payment Status
check = requests.post("${baseUrl}/api/aba/check-payment", json={"transactionId": tran_id}, headers=headers)
if check.json().get("status") == "PAID":
    print("Payment Verified Successfully!")`;
        p3Y = this.drawCodeBox(doc, 'Python 3', pythonCode, p3Y, { fontSize: 7.5, lineGap: 1.8, codeColor: '#A7F3D0' });

        this.drawFooter(doc, 3, totalPages);

        // =========================================================================
        // PAGE 4: PHP, CURL, WEBHOOK VERIFICATION & SECURITY
        // =========================================================================
        doc.addPage();
        this.drawHeader(doc, 'PAYLINKAPI GATEWAY', 'PHP, CURL & WEBHOOK SECURITY (PAGE 4)', 4, totalPages, userName, telegramId);

        let p4Y = 96;

        // --- PHP Sample ---
        p4Y = this.drawSectionHeader(doc, 'C. PHP (cURL)', p4Y);
        const phpCode = 
`<?php
$url = "${baseUrl}/api/aba/generate-qr";
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "Authorization: Bearer ${sampleKey}"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["amount" => 1.00, "currency" => "USD"]));
$response = json_decode(curl_exec($ch), true);
curl_close($ch);

echo "QR String: " . $response["qrString"];
?>`;
        p4Y = this.drawCodeBox(doc, 'PHP (cURL)', phpCode, p4Y, { fontSize: 7.5, lineGap: 1.8, codeColor: '#FDE047' });

        // --- cURL CLI ---
        p4Y = this.drawSectionHeader(doc, 'D. cURL Command Line', p4Y);
        const curlCode = 
`curl -X POST "${baseUrl}/api/aba/generate-qr" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -d '{"amount": 1.00, "currency": "USD"}'`;
        p4Y = this.drawCodeBox(doc, 'cURL CLI', curlCode, p4Y, { fontSize: 7.5, lineGap: 1.8, codeColor: '#F1F5F9' });

        // --- Webhook Verification ---
        p4Y = this.drawSectionHeader(doc, 'E. Webhook Signature Verification (HMAC-SHA256)', p4Y);

        doc.fillColor('#475569')
          .fontSize(8)
          .font('Helvetica')
          .text(
            'When a customer pays, PaylinkApi pushes an HTTP POST to your webhook endpoint.\n' +
            'Every request includes an "X-Signature" header computed via HMAC-SHA256 of the raw payload using your Webhook Secret.',
            40, p4Y, { width: 515, lineGap: 2 }
          );

        p4Y += 26;

        const webhookCode = 
`const crypto = require('crypto');

app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-signature'];
  const expected = crypto.createHmac('sha256', '${sampleSecret}').update(req.body).digest('hex');

  if (signature !== expected) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body);
  if (event.event === 'payment.settled') {
    console.log('Payment Settled for Order:', event.data.orderId);
  }
  res.status(200).send('OK');
});`;
        p4Y = this.drawCodeBox(doc, 'Express.js Webhook', webhookCode, p4Y, { fontSize: 7.5, lineGap: 1.8, codeColor: '#67E8F9' });

        this.drawFooter(doc, 4, totalPages);

        doc.end();

        stream.on('finish', () => {
          resolve(filePath);
        });

        stream.on('error', (err) => {
          reject(err);
        });

      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new PdfGeneratorService();
