"use strict";

const { NotFoundError, ForbiddenError } = require("../../../common/errors/http-error");
const { goalRepository } = require("../repositories/goal.repository");

class GoalService {
  /**
   * Get all goals for a user.
   */
  async getUserGoals(userId) {
    return goalRepository.findAllByUserId(userId);
  }

  /**
   * Get a single goal with ownership check.
   */
  async getGoal(id, userId) {
    const goal = await goalRepository.findById(id, userId);
    if (!goal) throw new NotFoundError("Goal not found");
    return goal;
  }

  /**
   * Create a new goal.
   */
  async createGoal(data) {
    return goalRepository.create(data);
  }

  /**
   * Update a goal with ownership check.
   */
  async updateGoal(id, userId, data) {
    await this.getGoal(id, userId); // Ownership check
    return goalRepository.update(id, data);
  }

  /**
   * Delete a goal with ownership check.
   */
  async deleteGoal(id, userId) {
    await this.getGoal(id, userId); // Ownership check
    return goalRepository.delete(id);
  }
}

const goalService = new GoalService();
module.exports = { goalService };
