import { validateUserSession } from "../config/userManagementClient.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const result = await validateUserSession(req.headers.authorization);

    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
      });
    }

    const accountType = result.user.accountType;
    if (accountType !== "recruiter" && accountType !== "company") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters and companies can use in-app email",
      });
    }

    req.userId = String(result.user.id);
    req.userEmail = result.user.email;
    req.user = result.user;
    req.authorizationHeader = req.headers.authorization;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};
