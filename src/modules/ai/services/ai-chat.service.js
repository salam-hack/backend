"use strict";

const { env } = require("../../../config/env");

class AiChatService {
  async generateReply(messages, opts = {}) {
    const startedAt = Date.now();

    try {
      const response = await fetch(env.aiChatbotUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          user_id: opts.userId,
          conversation_id: opts.conversationId,
          message: opts.message || (messages.length > 0 ? messages[messages.length - 1].content : ""),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Chatbot service error: ${response.status}`);
      }

      const result = await response.json();
      return {
        content: this._extractContent(result),
        raw: result,
        model: "external",
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      console.error("[AI] Chatbot unavailable:", err.message);
      return {
        error: "AI_CHATBOT_UNAVAILABLE",
        content: null,
        raw: null,
        model: "external",
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  _extractContent(result) {
    // If the python backend returns a stringified JSON
    if (typeof result === "string") {
      try {
        const parsed = JSON.parse(result);
        if (typeof parsed?.reply === "string") return parsed.reply;
        if (typeof parsed?.content === "string") return parsed.content;
      } catch (e) {
        // ignore and just return the string
      }
      return result;
    }
    
    // If it's a standard JS object
    if (typeof result?.reply === "string") return result.reply;
    if (typeof result?.content === "string") return result.content;
    if (typeof result?.message === "string") return result.message;
    if (result?.data !== undefined) {
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    }
    return JSON.stringify(result);
  }
}

const aiChatService = new AiChatService();
module.exports = { aiChatService };
