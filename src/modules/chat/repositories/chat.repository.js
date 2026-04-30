'use strict';
const { prisma } = require("../../../prisma/client");

class ChatRepository {
  /**
   * Find a single conversation that belongs to the given user.
   */
  findConversation(id, userId) {
    return prisma.conversation.findFirst({
      where: { id, userId, status: "active" },
    });
  }

  /**
   * Get all active conversations for a user.
   */
  getUserConversations(userId) {
    return prisma.conversation.findMany({
      where: { userId, status: "active" },
      select: {
        id: true,
        title: true,
        summary: true,
        createdAt: true,
        lastMessageAt: true
      },
      orderBy: { updatedAt: "desc" }
    });
  }

  /**
   * Create a new conversation for a user.
   */
  createConversation(userId, title = "New Chat") {
    return prisma.conversation.create({
      data: { userId, title },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });
  }

  /**
   * Stamp lastMessageAt to now.
   */
  touchConversation(id) {
    return prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });
  }

  /**
   * Persist a single message.
   */
  createMessage(data) {
    return prisma.message.create({
      data: {
        conversationId: data.conversationId,
        userId: data.userId,
        role: data.role,
        content: data.content,
        status: data.status || 'completed',
        metadata: data.metadata || null
      },
      select: {
        id: true,
        conversationId: true,
        userId: true,
        role: true,
        content: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update a message's status and/or content.
   */
  updateMessage(id, data) {
    return prisma.message.update({
      where: { id },
      data,
      select: {
        id: true,
        conversationId: true,
        userId: true,
        role: true,
        content: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Fetch the most recent N messages of a conversation (for AI context window).
   */
  async getRecentMessages(conversationId, limit = 20) {
    const rows = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        role: true,
        content: true,
        status: true,
      },
    });
    return rows.reverse();
  }
}

const chatRepository = new ChatRepository();
module.exports = { chatRepository };
