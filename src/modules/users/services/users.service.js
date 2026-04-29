'use strict';
const { NotFoundError } = require('../../../common/errors/http-error');
const { usersRepository } = require('../repositories/users.repository');

/** Strip sensitive fields from user record */
function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

class UsersService {
  async getMe(userId) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return safeUser(user);
  }

  async updateMe(userId, data) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    const updated = await usersRepository.update(userId, data);
    return safeUser(updated);
  }
}

const usersService = new UsersService();
module.exports = { usersService };
