function createMongoRepository(Model) {
  const record = room => ({ _id: room.id, createKey: room.createKey, inviteHash: room.inviteHash,
    memberUserIds: room.members.map(m => m.userId), revision: room.revision, updatedAt: room.updatedAt, document: room });
  const one = async query => (await query.lean())?.document || null;
  return {
    get: id => one(Model.findById(id)),
    byCreateKey: createKey => one(Model.findOne({ createKey })),
    byInviteHash: inviteHash => one(Model.findOne({ inviteHash })),
    async create(room) { await Model.create(record(room)); },
    async compareAndSwap(id, revision, room) {
      const { _id, ...update } = record(room);
      const result = await Model.updateOne({ _id: id, revision }, { $set: update });
      return result.modifiedCount === 1;
    },
    async list(userId) { return (await Model.find({ memberUserIds: userId })
      .select({ 'document.result.events': 0, 'document.result.frames': 0, 'document.result.battlefield': 0 })
      .sort({ updatedAt: -1 }).limit(30).lean()).map(row => row.document); },
  };
}
module.exports = { createMongoRepository };
