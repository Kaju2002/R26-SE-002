import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri) {
    console.error("MONGO_URI (or MONGODB_URI) is not defined in environment variables");
    process.exit(1);
  }

  mongoose.connection.on("connected", () => {
    console.log("Job Management: connected to MongoDB");
  });

  mongoose.connection.on("error", (err) => {
    console.error("Job Management: MongoDB connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("Job Management: MongoDB disconnected");
  });

  try {
    await mongoose.connect(uri);
  } catch (error) {
    console.error("Job Management: failed to connect to MongoDB:", error.message);
    process.exit(1);
  }
};

export default connectDB;
