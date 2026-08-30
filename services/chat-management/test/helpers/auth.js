import jwt from "jsonwebtoken";

const TEST_SECRET = "chat-test-secret";

export const signTestToken = ({
  userId,
  email = "user@example.com",
  accountType = "jobseeker",
}) => {
  process.env.JWT_SECRET = TEST_SECRET;
  return jwt.sign({ userId, email, accountType }, TEST_SECRET);
};

export const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
