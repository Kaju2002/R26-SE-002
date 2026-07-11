import { validateUserSession } from "../config/userManagementClient.js";

const attachUserFromAuth = (req, user) => {
  req.userId = String(user.id);
  req.userEmail = user.email;
  req.user = user;
};

export const authMiddleware = async (req, res, next) => {
  try {
    const result = await validateUserSession(req.headers.authorization);

    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
      });
    }

    attachUserFromAuth(req, result.user);
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const result = await validateUserSession(authHeader);
    if (result.ok) {
      attachUserFromAuth(req, result.user);
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next();
  }
};
