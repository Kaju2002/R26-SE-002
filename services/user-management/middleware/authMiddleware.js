import jwt from "jsonwebtoken";

// ============ AUTH MIDDLEWARE ============
export const authMiddleware = (req, res, next) => {
  try {
    // 1. Get token from headers
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please login.",
      });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "greatStack");

    // 3. Attach userId to request
    req.userId = decoded.userId;
    req.email = decoded.email;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
};
