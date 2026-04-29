'use strict';
const { prisma } = require('../../../prisma/client');

class UsersRepository {
  findById(id) {
    return prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  update(id, data) {
    return prisma.user.update({ where: { id }, data });
  }
}

const usersRepository = new UsersRepository();
module.exports = { usersRepository };
