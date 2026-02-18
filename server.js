const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ─── Serve HTML frontend statically ──────────────────────────────────────────
app.use(express.static(__dirname));
// ─────────────────────────────────────────────────────────────────────────────

// Your OpenRouter API Key
const API_KEY = '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';

// ─── Free Model Fallback List ─────────────────────────────────────────────────
// openrouter/free auto-picks any working free model — best for avoiding downtime.
// The rest are reliable newer models as manual fallbacks.
const FREE_MODELS = [
  'openrouter/free',                              // Auto-picks any available free model
  'meta-llama/llama-4-scout:free',               // Llama 4 Scout - reliable & fast
  'meta-llama/llama-4-maverick:free',            // Llama 4 Maverick - larger, smarter
  'deepseek/deepseek-chat-v3-0324:free',         // DeepSeek V3 - highly capable
  'mistralai/mistral-small-3.1-24b-instruct:free', // Mistral Small - good multilingual
  'nvidia/llama-3.1-nemotron-nano-8b-v1:free',  // NVIDIA Nemotron - fast responses
  'meta-llama/llama-3.2-3b-instruct:free',       // Original (kept as last resort)
];
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Response Sanitizer ───────────────────────────────────────────────────────
function sanitizeResponse(text) {
  // 1. Strip markdown bold/italic/code
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');
  text = text.replace(/`(.*?)`/g, '$1');

  // 2. Strip markdown headers
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 3. Fix repetition loops (e.g. "Iba't Iba't Iba't..." repeating 4+ times)
  text = text.replace(/(\b[\w'']{2,30}(?:\s+[\w'']{1,20}){0,5})\s+(?:\1\s+){3,}/gi, '$1 ');

  // 4. Cut off only if response is absurdly long (over 3000 chars is likely a loop)
  if (text.length > 3000) {
    text = text.substring(0, 3000);
    const lastPeriod = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'));
    if (lastPeriod > 1000) text = text.substring(0, lastPeriod + 1);
    text += '\n\nPara sa kumpletong impormasyon, makipag-ugnayan sa amin sa 0965-308-7958. 😊';
  }

  // 5. Clean up excess whitespace/newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Fetch with per-model retry + fallback ────────────────────────────────────
async function fetchWithFallback(url, baseOptions, messages) {
  for (let modelIndex = 0; modelIndex < FREE_MODELS.length; modelIndex++) {
    const model = FREE_MODELS[modelIndex];
    console.log(`🤖 Trying model: ${model}`);

    const options = {
      ...baseOptions,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,         // Lower = more focused, less repetition
        max_tokens: 800,           // Enough for complete answers without loops
        frequency_penalty: 0.6,   // Penalize repeating the same words/phrases
        presence_penalty: 0.4,    // Encourage topic variety
      })
    };

    let success = false;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await fetch(url, options);
      const data = await response.json();

      if (response.ok) {
        console.log(`✅ Success with model: ${model}`);
        return { response, data };
      }

      const isRateLimited = response.status === 429 || data?.error?.code === 429;

      if (isRateLimited) {
        if (attempt < maxRetries) {
          const delay = 5000 * attempt;
          console.warn(`⚠️  Rate limited on ${model}. Retrying in ${delay / 1000}s... (Attempt ${attempt}/${maxRetries})`);
          await sleep(delay);
        } else {
          console.warn(`⛔ Model ${model} is rate-limited. Switching to next model...`);
          break; // move to next model
        }
      } else {
        // Non-rate-limit error — log and try next model
        console.error(`❌ Error on model ${model}:`, data?.error?.message || data);
        break;
      }
    }
  }

  throw new Error('All available models are currently unavailable. Please try again later.');
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
- Bills Payment: Electric bill payment accepted at branch (service charge: Php 5.00 per receipt — just bring your official electric bill receipt)
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
2. If the client asks for specific interest rates or anything not in this knowledge base, honestly say you don't have that exact figure and direct them to:
   - Call: 0965-308-7958
   - Email: rbcci@rbcalbayogcity.com
   - Visit: 82 T. Bugallon St., Calbayog City
   - Website: https://rbcalbayog.com
3. Be warm, friendly, and professional — like a helpful bank staff member.
4. Keep responses SHORT and conversational — 3 to 5 sentences MAX. Never write long lists unless absolutely necessary.
5. Use 1-2 emojis naturally.
6. NEVER ask for sensitive info (PIN, password, full account numbers, OTP).
7. For loan applications, account opening, or complex transactions, encourage branch visit or website.
8. CRITICAL FORMATTING RULES — you MUST follow these:
   - NEVER use markdown: no **bold**, no *italic*, no headers (#), no bullet dashes (-), no backticks.
   - Write in plain conversational sentences only.
   - NEVER repeat the same word or phrase more than twice in a row. If you catch yourself repeating, stop and rephrase.
   - If you are listing multiple loan types, summarize them briefly — do not list every detail of every product.
9. End every response with: ${language === 'tagalog' ? '"May iba pa po ba kayong katanungan? 😊"' : '"Mayda pa ba kamo iba nga pangutana? 😊"'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ];

    const baseOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'RBCCI Chatbot'
      }
    };

    const { data } = await fetchWithFallback(
      'https://openrouter.ai/api/v1/chat/completions',
      baseOptions,
      messages
    );

    const aiResponse = sanitizeResponse(data.choices[0].message.content);
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
    ai: 'OpenRouter FREE (with fallback)',
    bank: 'Rural Bank of Calbayog City Inc.',
    models_available: FREE_MODELS.length
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`🤖 Using: OpenRouter AI (100% FREE) with auto-routing + ${FREE_MODELS.length - 1} fallbacks`);
  console.log(`🏦 Bank: Rural Bank of Calbayog City Inc.`);
  console.log(`📡 Ready for chat!\n`);
});
