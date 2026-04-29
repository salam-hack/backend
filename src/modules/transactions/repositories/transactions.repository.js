'use strict';
const { Prisma } = require('@prisma/client');
const { prisma } = require('../../../prisma/client');

class TransactionsRepository {
  create(data) {
    return prisma.transaction.create({
      data: {
        ...data,
        amount: new Prisma.Decimal(data.amount),
        quantity: data.quantity != null ? new Prisma.Decimal(data.quantity) : null,
      },
    });
  }

  findOwned(id, userId) {
    return prisma.transaction.findFirst({ where: { id, userId } });
  }

  listByUser(userId, filters = {}) {
    const where = { userId };
    if (filters.type) where.type = filters.type;
    if (filters.category) where.category = { contains: filters.category, mode: 'insensitive' };
    if (filters.from) where.transactionDate = { ...where.transactionDate, gte: new Date(filters.from) };
    if (filters.to) where.transactionDate = { ...where.transactionDate, lte: new Date(filters.to) };

    return prisma.transaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      take: 100,
    });
  }

  listAll(filters = {}) {
    const where = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.type) where.type = filters.type;
    if (filters.category) where.category = { contains: filters.category, mode: 'insensitive' };
    if (filters.from) where.transactionDate = { ...where.transactionDate, gte: new Date(filters.from) };
    if (filters.to) where.transactionDate = { ...where.transactionDate, lte: new Date(filters.to) };

    return prisma.transaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
  }

  update(id, data) {
    return prisma.transaction.update({ where: { id }, data });
  }

  delete(id) {
    return prisma.transaction.delete({ where: { id } });
  }

  summary(userId) {
    return prisma.transaction.groupBy({
      by: ['type', 'category'],
      where: { userId },
      _sum: { amount: true },
      _count: true,
    });
  }
}

const transactionsRepository = new TransactionsRepository();
module.exports = { transactionsRepository };
