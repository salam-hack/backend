'use strict';
const OpenAI = require('openai');
const { env } = require('../../../config/env');

const CLASSIFICATION_SYSTEM_PROMPT = `You are an AI financial assistant.

You MUST classify all transactions using predefined categories.

⚠️ IMPORTANT RULES:

* You are NOT allowed to create new categories
* You MUST choose from the provided category list
* You MUST return category_id (not name)

---

# Categories:

## Expense Categories:

* EXP_FOOD: Food & Drinks (restaurants, coffee, delivery)
* EXP_SHOPPING: Shopping (clothes, electronics)
* EXP_HOUSING: Housing (rent, utilities)
* EXP_TRANSPORT: Transportation (uber, fuel)
* EXP_HEALTH: Healthcare (doctor, medicine)
* EXP_ENTERTAINMENT: Entertainment (games, netflix)
* EXP_EDUCATION: Education (courses, books)
* EXP_BILLS: Bills & Subscriptions (internet, mobile)
* EXP_GIFTS: Gifts & Donations
* EXP_OTHER: Other

## Income Categories:

* INC_SALARY
* INC_FREELANCE
* INC_INVESTMENTS
* INC_GIFTS
* INC_OTHER

## Goal Categories:

* GOAL_ELECTRONICS
* GOAL_TRAVEL
* GOAL_CAR
* GOAL_HOME
* GOAL_PERSONAL

---

# Output Format:

{
"type": "expense | income",
"category_id": "string",
"confidence": 0-1
}

---

Return ONLY valid JSON matching the output format.`;

const SYSTEM_PROMPT = `You are a financial data extraction AI.
Extract structured transaction data from user input and return ONLY valid JSON.
Rules:
- amount: number or null
- currency: ISO 4217 string or null (use defaultCurrency if not mentioned)
- category: simple common name (Food, Transport, Bills, Shopping, Entertainment, Health, Income, Salary, Other) or null
- item: specific item name in English or null
- quantity: number or null (default 1 if item mentioned)
- type: "expense" or "income" or null
- confidence: float 0 to 1
Be conservative: if unsure, lower confidence. Return nothing except the JSON object.`;

class AiService {
  constructor() {
    this.client = env.openAiApiKey ? new OpenAI({ apiKey: env.openAiApiKey }) : null;
  }

  /**
   * Classify a transaction description into type, category_id, and confidence.
   */
  async classifyTransaction(description) {
    if (!this.client) {
      return this._localClassificationFallback(description);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: env.openAiModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: description },
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (err) {
      console.error('[AI] Classification error:', err.message);
      return this._localClassificationFallback(description);
    }
  }

  /**
   * Parse a raw text note into structured transaction data.
   * Falls back to regex-based local parser if OpenAI key is missing.
   */
  async parseTransaction({ text, defaultCurrency, memoryHints = [] }) {
    if (!this.client) {
      return this._localFallback(text, defaultCurrency);
    }

    try {
      const memoryContext = memoryHints.length
        ? `\nUser memory hints: ${JSON.stringify(memoryHints)}`
        : '';

      const response = await this.client.chat.completions.create({
        model: env.openAiModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Text: "${text}"\nDefault currency: ${defaultCurrency}${memoryContext}`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      return this._normalize(JSON.parse(content), defaultCurrency);
    } catch (err) {
      console.error('[AI] Parse error:', err.message);
      return this._localFallback(text, defaultCurrency);
    }
  }

  /** Minimal fallback for classification when OpenAI is unavailable */
  _localClassificationFallback(description) {
    const lower = description.toLowerCase();

    // Determine type
    const incomeWords = ['salary', 'received', 'income', 'راتب', 'دخل', 'استلمت', 'paid me'];
    const type = incomeWords.some((w) => lower.includes(w)) ? 'income' : 'expense';

    // Determine category
    let category_id = 'EXP_OTHER';
    if (type === 'income') {
      if (lower.includes('salary') || lower.includes('راتب')) category_id = 'INC_SALARY';
      else if (lower.includes('freelance')) category_id = 'INC_FREELANCE';
      else category_id = 'INC_OTHER';
    } else {
      const foodWords = ['coffee', 'food', 'قهوة', 'أكل', 'طعام', 'restaurant', 'lunch', 'dinner'];
      if (foodWords.some(w => lower.includes(w))) category_id = 'EXP_FOOD';
      // Add more mappings as needed
    }

    return {
      type,
      category_id,
      confidence: 0.5,
    };
  }

  /** Minimal regex-based fallback when OpenAI is unavailable */
  _localFallback(text, defaultCurrency) {
    const amountMatch = text.match(/[\d]+(?:[.,]\d+)?/);
    const amount = amountMatch ? Number(amountMatch[0].replace(',', '.')) : null;
    const lower = text.toLowerCase();

    const incomeWords = ['salary', 'received', 'income', 'راتب', 'دخل', 'استلمت', 'paid me'];
    const type = incomeWords.some((w) => lower.includes(w)) ? 'income' : amount ? 'expense' : null;

    const currencyMap = {
      dollar: 'USD',
      جنيه: 'EGP',
      جنية: 'EGP',
      pound: 'EGP',
      pounds: 'EGP',
      egp: 'EGP',
      'e£': 'EGP',
      دولار: 'USD',
      sar: 'SAR',
      ريال: 'SAR',
      euro: 'EUR',
      يورو: 'EUR',
    };
    let currency = defaultCurrency;
    for (const [word, code] of Object.entries(currencyMap)) {
      if (lower.includes(word)) {
        currency = code;
        break;
      }
    }

    const foodWords = ['coffee', 'food', 'قهوة', 'أكل', 'طعام', 'restaurant', 'lunch', 'dinner'];
    const category = foodWords.some((w) => lower.includes(w))
      ? 'Food'
      : type === 'income'
        ? 'Income'
        : 'Other';

    return {
      amount,
      currency,
      category,
      item: null,
      quantity: amount ? 1 : null,
      type,
      confidence: amount ? 0.45 : 0.1,
    };
  }

  _normalize(raw, defaultCurrency) {
    return {
      amount: typeof raw.amount === 'number' ? raw.amount : null,
      currency: typeof raw.currency === 'string' ? raw.currency.toUpperCase() : defaultCurrency,
      category: typeof raw.category === 'string' ? raw.category : null,
      item: typeof raw.item === 'string' ? raw.item : null,
      quantity: typeof raw.quantity === 'number' ? raw.quantity : null,
      type: raw.type === 'expense' || raw.type === 'income' ? raw.type : null,
      confidence:
        typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.3,
    };
  }

  /**
   * Generic text analysis for AI insights generation
   * @param {string} prompt - Analysis prompt for AI
   * @returns {Promise<string>} AI response
   */
  async analyzeText(prompt) {
    if (!this.client) {
      // Return mock response when OpenAI is not available
      return JSON.stringify({
        financial_analysis: { spending_categories: { dominant: [], percentages: {} }, patterns: [], anomalies: [], monthly_trends: { increasing: [], decreasing: [], stable: [] } },
        behavioral_analysis: { communication_style: 'neutral', response_preference: 'balanced', decision_style: 'balanced', behavioral_traits: [], interaction_frequency: 'occasional', tone_indicators: [] },
        goal_comparison: { goal_progress: { overall_status: 'unknown', individual_goals: [] }, alignment_score: 0.5, recommendations: [], time_to_completion: { realistic: 'unknown', optimistic: 'unknown' } },
        risk_detection: { risk_level: 'low', alerts: [], risk_factors: [], mitigation_suggestions: [] }
      });
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: env.openAiModel || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a financial behavior analyst. Analyze the provided data and return structured insights in the requested JSON format. Be precise and data-driven.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
        max_tokens: 2000
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('[AiService] analyzeText error:', error.message);
      throw new Error('Failed to analyze text with AI');
    }
  }
}

const aiService = new AiService();
module.exports = { aiService };
