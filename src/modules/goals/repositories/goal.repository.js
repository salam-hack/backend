'use strict';
const { prisma } = require("../../../prisma/client");

class GoalRepository {
  /**
   * Find all goals for a user.
   */
  findAllByUserId(userId) {
    return prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Find a single goal by ID and user ID.
   */
  findById(id, userId) {
    return prisma.goal.findFirst({
      where: { id, userId }
    });
  }

  /**
   * Create a new goal.
   */
  create(data) {
    return prisma.goal.create({
      data: {
        userId: data.userId,
        title: data.title,
        description: data.description,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount || 0,
        status: data.status || 'active',
        userExpectedDate: data.userExpectedDate ? new Date(data.userExpectedDate) : null,
      }
    });
  }

  /**
   * Update a goal.
   */
  update(id, data) {
    return prisma.goal.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount,
        status: data.status,
        userExpectedDate: data.userExpectedDate ? new Date(data.userExpectedDate) : undefined,
        systemCalculatedDate: data.systemCalculatedDate ? new Date(data.systemCalculatedDate) : undefined,
      }
    });
  }

  /**
   * Delete a goal.
   */
  delete(id) {
    return prisma.goal.delete({
      where: { id }
    });
  }
}

const goalRepository = new GoalRepository();
module.exports = { goalRepository };
