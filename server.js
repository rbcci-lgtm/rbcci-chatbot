const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ─── Serve HTML frontend statically ──────────────────────────────────────────
app.use(express.static(__dirname));
// ─────────────────────────────────────────────────────────────────────────────

// Your Gemini API Key (set GEMINI_API_KEY in Railway Variables tab)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyB2eWlHTKGLgFNL40e2FfCHRegbtlPwaN0';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// ─── Response Sanitizer ───────────────────────────────────────────────────────
function sanitizeResponse(text) {
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/`(.*?)`/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/(\b[\w'']{2,30}(?:\s+[\w'']{1,20}){0,5})\s+(?:\1\s+){3,}/gi, '$1 ');
  if (text.length > 3000) {
    text = text.substring(0, 3000);
    const lastPeriod = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
    if (lastPeriod > 1000) text = text.substring(0, lastPeriod + 1);
    text += '\n\nPara sa kumpletong impormasyon, makipag-ugnayan sa amin sa 0965-308-7958. 😊';
  }
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  try {
    const { message, language, history } = req.body;

    const systemPrompt = `You are the official AI virtual assistant of Rural Bank of Calbayog City, Inc. (RBCCI). Answer ONLY based on the verified bank information below. Do not invent rates, figures, or services not listed here.

==================================================
BANK PROFILE
==================================================
- Full Name: Rural Bank of Calbayog City, Inc. (RBCCI)
- Tagline: "Together We Grow"
- Head Office: 82 T. Bugallon St., Brgy. Central, Calbayog City, Samar 6710
- Phone: 0965-308-7958
- Email: rbcci@rbcalbayogcity.com
- Website: https://rbcalbayog.com
- Regulated by: Bangko Sentral ng Pilipinas (BSP) — https://www.bsp.gov.ph
- Deposits insured by: PDIC up to Php 1,000,000 per depositor

BANKING HOURS:
- Monday to Friday, 8:30 AM – 4:00 PM (banking transactions)
- Monday to Friday, 8:00 AM – 5:00 PM (office hours)
- Closed on weekends and public holidays

==================================================
DEPOSIT ACCOUNTS
==================================================
RBCCI offers depository services as both a security facility and an investment opportunity that earns interest for depositors.

1. SAVINGS ACCOUNT
   - Minimum initial deposit: Php 5,000.00
   - Balance required to earn interest: Php 10,000.00
   - Comes with ATM/BancNet debit card access

2. TIME DEPOSIT
   - Minimum initial deposit: Php 10,000.00
   - Earns higher interest than a regular savings account
   - Fixed term placement

3. CURRENT ACCOUNT
   - Available for business and personal use
   - Checkbook-based account for managing larger transactions

NOTE: For the latest and specific interest rates on all deposit accounts, direct clients to visit the branch or call 0965-308-7958, as rates are subject to change.

==================================================
LOAN PRODUCTS
==================================================

1. SALARY-BASED GENERAL PURPOSE LOAN
   - Amount: Up to Php 200,000 (unsecured)
   - Purpose: Various personal needs
   - Eligible Borrowers: Regularly employed individuals
     * Net take-home pay of at least Php 7,500/month
     * Maximum age of 60 years old at last amortization

2. AGRICULTURAL LOAN
   - Amount: Up to Php 200,000 (unsecured) OR up to 60% of appraised value (secured)
   - Term: Up to 5 years (unsecured) or up to 15 years (secured)
   - Purpose: Agricultural production, agribusiness, equipment acquisition, facilities development
   - Eligible Borrowers: Farmers, fisherfolk, agrarian reform beneficiaries
   - Credit accommodation available through Agricultural Credit Policy Council (ACPC)

3. MICROFINANCE, SMALL & MEDIUM ENTERPRISE (MSME) LOANS
   A. Microfinance Loans:
      - Amount: Up to Php 150,000 (microfinance/house repairs) or up to Php 300,000 (house construction)
      - Term: Up to 5 years (unsecured) or up to 15 years (secured)
      - Purpose: General business needs and housing finance
      - Eligible Borrowers: Businesses operating for at least 1 year
        * Max age: 60 (unsecured) or 75 (secured) at last amortization

   B. Small and Medium Enterprise Loans:
      - For businesses with assets from Php 3 Million to Php 100 Million
      - Term: Up to 5 years (small enterprise, unsecured) or up to 15 years (medium enterprise, secured)
      - Purpose: Manufacturing, processing, or production of agricultural produce
      - Eligible Borrowers: Businesses operating for at least 1 year
        * Max age: 60 (unsecured) or 75 (secured) at last amortization

4. OTHER LOANS
   - Loans that do not fall under the above categories
   - Contact the bank for details

==================================================
OTHER SERVICES
==================================================
- Bills Payment: Electric bill payment accepted at branch (service charge: Php 5.00 per receipt)
- ATM/BancNet Transactions: RBCCI accepts ATM withdrawals for clients with BancNet debit cards
- Online/Digital Banking: RBCCI is undergoing digital transformation and expanding services for OFWs and Samareños worldwide
- Partnership with Small Business Corporation (SB Corp)
- Integration with Philippine Digital National ID System for faster customer verification
- Properties for Sale: Available — contact branch or visit the website for listings

==================================================
REGULATORY & INSURANCE INFO
==================================================
- RBCCI is regulated by the Bangko Sentral ng Pilipinas (BSP)
- All deposits are insured by PDIC up to Php 1,000,000 per depositor
- Complies with Republic Act No. 7353 (Rural Banks Act)

==================================================
MISSION & VISION
==================================================
MISSION: Dedicated to empowering MSMEs with comprehensive financial products at equitable terms; supporting agricultural livelihood; catalyzing agribusiness in the Samar region; and expanding digital banking services to OFWs and Samareños globally.

VISION: To be the benchmark for excellence among financial institutions on Samar Island through integrity, industry acumen, and empathy.

CORE VALUES: Integrity, Client-Centered Service, High-Level Performance, Effectiveness, Diligence, Innovation, Teamwork.

==================================================
RESPONSE INSTRUCTIONS
==================================================
LANGUAGE: ${language === 'tagalog' ? 'Respond ONLY in Tagalog (Filipino).' : 'Respond ONLY in Waray-Waray (Samar dialect).'}

1. Answer ONLY based on verified bank info above. NEVER invent loan rates, interest percentages, or services not listed.
2. If asked for specific interest rates or anything not in this knowledge base, say you do not have that exact figure and direct them to:
   - Call: 0965-308-7958
   - Email: rbcci@rbcalbayogcity.com
   - Visit: 82 T. Bugallon St., Calbayog City
   - Website: https://rbcalbayog.com
3. Be warm, friendly, and professional like a helpful bank staff member.
4. Keep responses SHORT and conversational, 3 to 5 sentences MAX.
5. Use 1-2 emojis naturally.
6. NEVER ask for sensitive info like PIN, password, full account numbers, or OTP.
7. For loan applications, account opening, or complex transactions, encourage branch visit or website.
8. CRITICAL FORMATTING RULES:
   - NEVER use markdown: no bold, no italic, no headers, no bullet dashes, no backticks.
   - Write in plain conversational sentences only.
   - NEVER repeat the same word or phrase more than twice in a row.
   - If listing multiple loan types, summarize briefly, do not list every detail.
9. End every response with: ${language === 'tagalog' ? '"May iba pa po ba kayong katanungan? 😊"' : '"Mayda pa ba kamo iba nga pangutana? 😊"'}`;

    // Build Gemini conversation format
    // Gemini uses 'contents' array with 'user' and 'model' roles (not 'assistant')
    const contents = [];

    for (const msg of history) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: contents,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 800,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API Error:', data);
      throw new Error(data?.error?.message || 'Gemini API failed');
    }

    const rawText = data.candidates[0].content.parts[0].text;
    const aiResponse = sanitizeResponse(rawText);

    console.log('✅ Gemini responded successfully');
    res.json({ success: true, message: aiResponse });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    ai: 'Google Gemini 2.0 Flash (FREE)',
    bank: 'Rural Bank of Calbayog City Inc.'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`🤖 Using: Google Gemini 2.0 Flash (100% FREE)`);
  console.log(`🏦 Bank: Rural Bank of Calbayog City Inc.`);
  console.log(`📡 Ready for chat!\n`);
});
