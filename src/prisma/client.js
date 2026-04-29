'use strict';
const { PrismaClient } = require('@prisma/client');
const { env } = require('../config/env');

const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = { prisma };
