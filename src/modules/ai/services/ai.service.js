'use strict';

const { env } = require('../../../config/env');
const { getCategoryId } = require('../../transactions/constants/categories');

class AiService {
  async _sendToParser(text) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(env.aiParserUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI Parser service error: ${response.status}`);
      }

      const result = await response.json();
      return this._withCategoryId(result);
    } catch (err) {
      console.error('[AI] Parser unavailable:', err.message);
      return { error: 'AI_PARSER_UNAVAILABLE' };
    }
  }

  async parseTransaction({ text }) {
    return this._sendToParser(text);
  }

  async parseTransactionRaw({ text }) {
    return this._sendToParser(text);
  }

  async classifyTransaction(description) {
    return this._sendToParser(description);
  }

  _withCategoryId(result) {
    if (!result || typeof result !== 'object') return result;

    const data = result.data && typeof result.data === 'object' ? result.data : result;
    const category = data.category || data.Category;
    const categoryId = getCategoryId(category);

    if (!categoryId) return result;

    if (data === result) {
      return { ...result, categoryId };
    }

    return {
      ...result,
      data: {
        ...data,
        categoryId,
      },
    };
  }
}

const aiService = new AiService();
module.exports = { aiService };
