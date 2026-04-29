"use strict";
const { prisma } = require("../../../prisma/client");

class ChatRepository {
  // ─── Conversations ────────────────────────────────────────────────────────

  /**
   * Create a new conversation for a user.
   * @param {string} userId
   * @param {string} title
   * @returns {Promise<Conversation>}
   */
  createConversation(userId, title) {
    return prisma.conversation.create({
      data: { userId, title },
      select: {
        id: true,
        userId: true,
        title: true,
        status: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * List all active conversations for a user, newest first.
   * Includes message count and last message preview.
   * @param {string} userId
   * @param {{ limit?: number, offset?: number }} opts
   */
  async listConversations(userId, opts = {}) {
    const limit = Math.min(opts.limit ?? 20, 100);
    const offset = opts.offset ?? 0;

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: { userId, status: "active" },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          userId: true,
          title: true,
          status: true,
          lastMessageAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { messages: true },
          },
          // Last message preview via a nested find
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.conversation.count({
        where: { userId, status: "active" },
      }),
    ]);

    // Reshape: pull lastMessage out of the array
    const data = conversations.map(({ messages, _count, ...conv }) => ({
      ...conv,
      messageCount: _count.messages,
      lastMessage: messages[0] ?? null,
    }));

    return { data, total, limit, offset };
  }

  /**
   * Find a single conversation that belongs to the given user.
   * Returns null if not found or not owned by the user.
   * @param {string} id
   * @param {string} userId
   */
  findConversation(id, userId) {
    return prisma.conversation.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        title: true,
        status: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
  }

  /**
   * Update arbitrary fields on a conversation (title, status, …).
   * @param {string} id
   * @param {object} data
   */
  updateConversation(id, data) {
    return prisma.conversation.update({
      where: { id },
      data,
      select: {
        id: true,
        userId: true,
        title: true,
        status: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Stamp lastMessageAt to now so the conversation rises in the feed.
   * @param {string} id
   */
  touchConversation(id) {
    return prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });
  }

  /**
   * Hard-delete a conversation and all its messages (cascade).
   * @param {string} id
   */
  deleteConversation(id) {
    return prisma.conversation.delete({ where: { id } });
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  /**
   * Persist a single message.
   * @param {{ conversationId, userId, role, content, status?, metadata? }} data
   */
  createMessage(data) {
    return prisma.message.create({
      data,
      select: {
        id: true,
        conversationId: true,
        userId: true,
        role: true,
        content: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update a message's status and/or content (e.g. after AI finishes).
   * @param {string} id
   * @param {{ status?, content?, metadata? }} data
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
        metadata: true,
        createdAt: true,
      },
    });
  }

  /**
   * Offset-based paginated message list, oldest-first (chat order).
   *
   * @param {string}  conversationId
   * @param {{ limit?: number, offset?: number }} opts
   * @returns {Promise<{ data: Message[], total: number, limit: number, offset: number }>}
   */
  async listMessages(conversationId, opts = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          conversationId: true,
          userId: true,
          role: true,
          content: true,
          status: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    return { data: messages, total, limit, offset };
  }

  /**
   * Cursor-based message history — load messages *before* a given message id.
   * Used for "load more" / infinite scroll going upward.
   *
   * @param {string}  conversationId
   * @param {{ cursor?: string, limit?: number }} opts
   *   cursor — the id of the oldest message already on the client
   * @returns {Promise<{ data: Message[], hasMore: boolean }>}
   */
  async listMessagesBefore(conversationId, opts = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);

    // If no cursor, return the latest `limit` messages
    const where = { conversationId };
    if (opts.cursor) {
      // Find the createdAt of the cursor message to paginate by time
      const pivot = await prisma.message.findUnique({
        where: { id: opts.cursor },
        select: { createdAt: true },
      });
      if (pivot) {
        where.createdAt = { lt: pivot.createdAt };
      }
    }

    // Fetch one extra to detect hasMore
    const rows = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: {
        id: true,
        conversationId: true,
        userId: true,
        role: true,
        content: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    // Return in ascending (oldest-first) order
    return { data: rows.reverse(), hasMore };
  }

  /**
   * Fetch the most recent N messages of a conversation (for AI context window).
   * @param {string} conversationId
   * @param {number} limit
   */
  async getRecentMessages(conversationId, limit = 20) {
    const rows = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        role: true,
        content: true,
      },
    });
    return rows.reverse(); // oldest first for AI context
  }

  /**
   * Find a single message and verify it belongs to the user.
   * @param {string} id
   * @param {string} userId
   */
  findMessage(id, userId) {
    return prisma.message.findFirst({
      where: { id, userId },
      select: {
        id: true,
        conversationId: true,
        userId: true,
        role: true,
        content: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    });
  }
}

const chatRepository = new ChatRepository();
module.exports = { chatRepository };
