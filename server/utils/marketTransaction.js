class MarketTransactionError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'MarketTransactionError';
    this.status = status;
  }
}

function marketError(status, message) {
  return new MarketTransactionError(status, message);
}

function attachSession(query, session) {
  if (!query || typeof query.session !== 'function') {
    throw new Error('Market transaction query does not support sessions');
  }
  return query.session(session);
}

function modelWithSession(model, session) {
  return {
    find(...args) {
      return attachSession(model.find(...args), session);
    },
  };
}

function runMarketTransaction(User, callback) {
  if (typeof User?.db?.transaction !== 'function') {
    throw new Error('MongoDB transaction support is required for market settlement');
  }
  return User.db.transaction(callback);
}

async function applyCreditDelta(User, userId, delta, session, insufficientMessage) {
  if (delta === 0) return null;
  const filter = { _id: userId };
  if (delta < 0) filter.credits = { $gte: -delta };
  const updated = await User.findOneAndUpdate(
    filter,
    { $inc: { credits: delta } },
    { new: true, session }
  );
  if (!updated) throw marketError(400, insufficientMessage);
  return updated;
}

function parsePositiveQuantity(value, minimum = 1) {
  const quantity = value === undefined || value === null || value === '' ? 1 : Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number.MAX_SAFE_INTEGER) return null;
  return Math.max(minimum, quantity);
}

function sendMarketError(res, error, fallbackMessage) {
  if (error instanceof MarketTransactionError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: fallbackMessage });
}

module.exports = {
  applyCreditDelta,
  attachSession,
  marketError,
  modelWithSession,
  parsePositiveQuantity,
  runMarketTransaction,
  sendMarketError,
};
