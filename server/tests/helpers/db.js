require("./env");
const mongoose = require("mongoose");

/**
 * Test database lifecycle. Uses a real Mongo (the docker-compose one) against
 * a dedicated `pocketninja_test` database rather than an in-memory server —
 * no 100MB binary download, and it exercises the real indexes, which is where
 * the Budget uniqueness constraint actually lives.
 */

const connect = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
  // Indexes are what enforce Budget uniqueness; without this the constraint
  // tests would pass vacuously on a fresh database.
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.createIndexes()),
  );
};

const clear = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
};

const disconnect = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

module.exports = { connect, clear, disconnect, mongoose };
