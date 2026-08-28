import User from "../model/userModel.js";

export const loadAdminActor = async (userId) => {
  const user = await User.findById(userId).select(
    "firstName lastName email accountStatus accountType"
  );
  if (!user || user.accountStatus !== "active") return null;

  const name =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.email ||
    "Admin";

  return {
    userId: user._id,
    name,
    email: user.email || "",
    accountType: user.accountType || "",
  };
};
