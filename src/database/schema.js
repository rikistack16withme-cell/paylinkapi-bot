/**
 * Database Schemas & Initial Structures
 */
const initialSchema = {
  users: {},
  orders: {},
  apiKeys: {},
  sessions: {},
  meta: {
    version: '1.0.0',
    phase: 1,
    createdAt: new Date().toISOString()
  }
};

module.exports = {
  initialSchema
};
