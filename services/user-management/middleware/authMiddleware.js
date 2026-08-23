import jwt from "jsonwebtoken";
import User from "../model/userModel.js";

const JWT_SECRET = () => process.env.JWT_SECRET || "greatStack";

// ============ AUTH MIDDLEWARE ============
export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please login.",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET());

    const user = await User.findById(decoded.userId).select(
      "tokenVersion accountStatus email"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Please login again.",
      });
    }

    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.accountStatus}`,
      });
    }

    const tokenVersion = decoded.tokenVersion ?? 0;
    if (tokenVersion !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

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

export const requireSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("accountType");
    if (!user || user.accountType !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Authorization error",
      error: error.message,
    });
  }
};
