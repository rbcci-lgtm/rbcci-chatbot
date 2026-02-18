const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Serve HTML frontend statically
app.use(express.static(__dirname));

// Groq API Key (set GROQ_API_KEY in Railway Variables tab)
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Response Sanitizer
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
- Regulated by: Bangko Sentral ng Pilipinas (BSP)
- Deposits insured by: PDIC up to Php 1,000,000 per depositor

BANKING HOURS:
- Monday to Friday, 8:30 AM to 4:00 PM (banking transactions)
- Monday to Friday, 8:00 AM to 5:00 PM (office hours)
- Closed on weekends and public holidays

==================================================
DEPOSIT ACCOUNTS
==================================================
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

NOTE: For specific interest rates, direct clients to call 0965-308-7958.

==================================================
LOAN PRODUCTS
==================================================
1. SALARY-BASED GENERAL PURPOSE LOAN
   - Amount: Up to Php 200,000 (unsecured)
   - Purpose: Various personal needs
   - Eligible: Regularly employed, net take-home pay at least Php 7,500/month, max age 60 at last amortization

2. AGRICULTURAL LOAN
   - Amount: Up to Php 200,000 (unsecured) or up to 60% of appraised value (secured)
   - Term: Up to 5 years (unsecured) or up to 15 years (secured)
   - Purpose: Agricultural production, agribusiness, equipment, facilities
   - Eligible: Farmers, fisherfolk, agrarian reform beneficiaries

3. MICROFINANCE AND MSME LOANS
   - Microfinance: Up to Php 150,000 (general/house repairs) or Php 300,000 (house construction)
   - SME Loans: For businesses with assets Php 3 Million to Php 100 Million
   - Term: Up to 5 years (unsecured) or 15 years (secured)
   - Eligible: Businesses operating at least 1 year

4. OTHER LOANS - Contact the bank for details

==================================================
OTHER SERVICES
==================================================
- Bills Payment: Electric bill payment, service charge Php 5.00 per receipt
- ATM/BancNet Transactions accepted
- Digital Banking expansion for OFWs and Samareños
- Partnership with Small Business Corporation (SB Corp)
- Properties for Sale: contact branch or visit website

==================================================
REGULATORY INFO
==================================================
- Regulated by Bangko Sentral ng Pilipinas (BSP)
- Deposits insured by PDIC up to Php 1,000,000
- Complies with Republic Act No. 7353 (Rural Banks Act)

==================================================
MISSION AND VISION
==================================================
MISSION: Empowering MSMEs, supporting agricultural livelihood, catalyzing agribusiness in Samar, expanding digital banking for OFWs and Samareños globally.
VISION: To be the benchmark for excellence among financial institutions on Samar Island.
CORE VALUES: Integrity, Client-Centered Service, High-Level Performance, Effectiveness, Diligence, Innovation, Teamwork.

==================================================
RESPONSE INSTRUCTIONS
==================================================
LANGUAGE: ${language === 'tagalog' ? 'Respond ONLY in Tagalog (Filipino).' : 'Respond ONLY in Waray-Waray (Samar dialect).'}

1. Answer ONLY based on verified bank info above. NEVER invent loan rates, interest percentages, or services not listed.
2. If asked for specific interest rates or anything not in this knowledge base, say you do not have that exact figure and direct them to call 0965-308-7958, email rbcci@rbcalbayogcity.com, visit 82 T. Bugallon St. Calbayog City, or go to https://rbcalbayog.com.
3. Be warm, friendly, and professional like a helpful bank staff member.
4. Keep responses SHORT and conversational, 3 to 5 sentences MAX.
5. Use 1-2 emojis naturally.
6. NEVER ask for sensitive info like PIN, password, full account numbers, or OTP.
7. For loan applications, account opening, or complex transactions, encourage branch visit or website.
8. CRITICAL FORMATTING RULES:
   - NEVER use markdown: no bold, no italic, no headers, no bullet dashes, no backticks.
   - Write in plain conversational sentences only.
   - NEVER repeat the same word or phrase more than twice in a row.
   - Summarize briefly when listing loan types, do not list every detail.
9. End every response with: ${language === 'tagalog' ? '"May iba pa po ba kayong katanungan? 😊"' : '"Mayda pa ba kamo iba nga pangutana? 😊"'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ];

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: 0.5,
        max_tokens: 800,
        frequency_penalty: 0.6,
        presence_penalty: 0.4
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq API Error:', data);
      throw new Error(data?.error?.message || 'Groq API failed');
    }

    const rawText = data.choices[0].message.content;
    const aiResponse = sanitizeResponse(rawText);

    console.log('✅ Groq responded successfully');
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
    ai: 'Groq LLaMA 3.3 70B (FREE)',
    bank: 'Rural Bank of Calbayog City Inc.'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`🤖 Using: Groq LLaMA 3.3 70B (100% FREE)`);
  console.log(`🏦 Bank: Rural Bank of Calbayog City Inc.`);
  console.log(`📡 Ready for chat!\n`);
});
