import jwt from "jsonwebtoken";

const JWT_SECRET = () => process.env.JWT_SECRET || "greatStack";

/**
 * Protect chat routes with the same JWT issued by user-management.
 * Attaches: req.userId, req.email, req.accountType
 */
export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please login.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please login.",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET());

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    req.userId = String(decoded.userId);
    req.email = decoded.email ?? null;
    req.accountType = decoded.accountType || "jobseeker";

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

export const requireSuperAdmin = (req, res, next) => {
  if (req.accountType !== "superadmin") {
    return res.status(403).json({
      success: false,
      message: "Super admin access required",
    });
  }
  next();
};
