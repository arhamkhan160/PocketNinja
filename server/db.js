const mongoose = require("mongoose");

/**
 * Connect to MongoDB Atlas.
 *
 * Mongoose manages an internal connection pool (default 5 sockets).
 * We call this once at startup; if the connection drops Mongoose
 * will automatically attempt to reconnect.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
