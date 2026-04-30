'use strict';

const CATEGORY_ID_MAP = {
  Food: 'EXP_FOOD',
  'Food & Drinks': 'EXP_FOOD',
  Transport: 'EXP_TRANSPORT',
  Transportation: 'EXP_TRANSPORT',
  Bills: 'EXP_BILLS',
  'Bills & Subscriptions': 'EXP_BILLS',
  Shopping: 'EXP_SHOPPING',
  Entertainment: 'EXP_ENTERTAINMENT',
  Health: 'EXP_HEALTH',
  Healthcare: 'EXP_HEALTH',
  Education: 'EXP_EDUCATION',
  Gifts: 'EXP_GIFTS',
  'Gifts & Donations': 'EXP_GIFTS',
  Other: 'EXP_OTHER',
  Salary: 'INC_SALARY',
  Freelance: 'INC_FREELANCE',
  Investments: 'INC_INVESTMENTS',
  Income: 'INC_OTHER',
  'Other Income': 'INC_OTHER',
  Electronics: 'GOAL_ELECTRONICS',
  Travel: 'GOAL_TRAVEL',
  Car: 'GOAL_CAR',
  Home: 'GOAL_HOME',
  Personal: 'GOAL_PERSONAL',
};

const ID_TO_CATEGORY_MAP = {
  EXP_FOOD: 'Food',
  EXP_TRANSPORT: 'Transport',
  EXP_BILLS: 'Bills',
  EXP_SHOPPING: 'Shopping',
  EXP_ENTERTAINMENT: 'Entertainment',
  EXP_HEALTH: 'Health',
  EXP_EDUCATION: 'Education',
  EXP_GIFTS: 'Gifts',
  EXP_OTHER: 'Other',
  INC_SALARY: 'Salary',
  INC_FREELANCE: 'Freelance',
  INC_INVESTMENTS: 'Investments',
  INC_GIFTS: 'Gifts',
  INC_OTHER: 'Income',
  GOAL_ELECTRONICS: 'Electronics',
  GOAL_TRAVEL: 'Travel',
  GOAL_CAR: 'Car',
  GOAL_HOME: 'Home',
  GOAL_PERSONAL: 'Personal',
};

const CATEGORY_ALIASES = {
  food: 'EXP_FOOD',
  foods: 'EXP_FOOD',
  'food drinks': 'EXP_FOOD',
  'food and drinks': 'EXP_FOOD',
  groceries: 'EXP_FOOD',
  restaurant: 'EXP_FOOD',
  coffee: 'EXP_FOOD',
  transport: 'EXP_TRANSPORT',
  transportation: 'EXP_TRANSPORT',
  uber: 'EXP_TRANSPORT',
  taxi: 'EXP_TRANSPORT',
  bills: 'EXP_BILLS',
  subscriptions: 'EXP_BILLS',
  shopping: 'EXP_SHOPPING',
  entertainment: 'EXP_ENTERTAINMENT',
  health: 'EXP_HEALTH',
  healthcare: 'EXP_HEALTH',
  education: 'EXP_EDUCATION',
  gifts: 'EXP_GIFTS',
  salary: 'INC_SALARY',
  freelance: 'INC_FREELANCE',
  investments: 'INC_INVESTMENTS',
  income: 'INC_OTHER',
  electronics: 'GOAL_ELECTRONICS',
  travel: 'GOAL_TRAVEL',
  car: 'GOAL_CAR',
  home: 'GOAL_HOME',
  personal: 'GOAL_PERSONAL',
};

function normalizeCategory(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getCategoryId(category) {
  if (!category) return null;
  if (ID_TO_CATEGORY_MAP[category]) return category;
  if (CATEGORY_ID_MAP[category]) return CATEGORY_ID_MAP[category];
  return CATEGORY_ALIASES[normalizeCategory(category)] || null;
}

function getCategoryName(categoryId) {
  return ID_TO_CATEGORY_MAP[categoryId] || null;
}

function inferGoalCategoryId(goal) {
  const text = `${goal.title || ''} ${goal.description || ''}`.toLowerCase();
  if (/laptop|iphone|macbook|phone|computer|electronics|آيفون|لابتوب|حاسوب/.test(text)) {
    return 'GOAL_ELECTRONICS';
  }
  if (/travel|trip|vacation|turkey|europe|عطلة|رحلة|سفر|تركيا/.test(text)) {
    return 'GOAL_TRAVEL';
  }
  if (/car|toyota|سيارة|تويوتا/.test(text)) {
    return 'GOAL_CAR';
  }
  if (/home|house|منزل|بيت/.test(text)) {
    return 'GOAL_HOME';
  }
  return 'GOAL_PERSONAL';
}

function getCategories() {
  return {
    expense: [
      { id: 'EXP_FOOD', name: 'Food & Drinks' },
      { id: 'EXP_TRANSPORT', name: 'Transportation' },
      { id: 'EXP_BILLS', name: 'Bills & Subscriptions' },
      { id: 'EXP_SHOPPING', name: 'Shopping' },
      { id: 'EXP_ENTERTAINMENT', name: 'Entertainment' },
      { id: 'EXP_HEALTH', name: 'Healthcare' },
      { id: 'EXP_EDUCATION', name: 'Education' },
      { id: 'EXP_GIFTS', name: 'Gifts & Donations' },
      { id: 'EXP_OTHER', name: 'Other' },
    ],
    income: [
      { id: 'INC_SALARY', name: 'Salary' },
      { id: 'INC_FREELANCE', name: 'Freelance' },
      { id: 'INC_INVESTMENTS', name: 'Investments' },
      { id: 'INC_GIFTS', name: 'Gifts' },
      { id: 'INC_OTHER', name: 'Other Income' },
    ],
    goals: [
      { id: 'GOAL_ELECTRONICS', name: 'Electronics' },
      { id: 'GOAL_TRAVEL', name: 'Travel' },
      { id: 'GOAL_CAR', name: 'Car' },
      { id: 'GOAL_HOME', name: 'Home' },
      { id: 'GOAL_PERSONAL', name: 'Personal' },
    ],
  };
}

module.exports = {
  CATEGORY_ID_MAP,
  ID_TO_CATEGORY_MAP,
  getCategoryId,
  getCategoryName,
  inferGoalCategoryId,
  getCategories,
};
