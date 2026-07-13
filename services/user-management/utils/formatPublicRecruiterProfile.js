import { buildLogoFallback } from "./profileFormatter.js";

const mapLogoFields = (logoUrl, name) => ({
  logoUri: logoUrl || undefined,
  fallback: logoUrl ? undefined : buildLogoFallback(name),
});

/**
 * Safe public recruiter shape for job seekers viewing a poster's profile.
 * Excludes email, phone, CV, tokens, and other private fields.
 */
export const formatPublicRecruiterProfile = (user, { viewerId } = {}) => {
  const isSelf = viewerId && String(user._id) === String(viewerId);
  const visibility = user.privacy?.profileVisibility ?? "public";
  const isPrivate = visibility === "private" && !isSelf;
  const allowMessages = Boolean(user.privacy?.allowMessages ?? true) && !isPrivate;

  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  const displayName = isPrivate ? "Recruiter" : fullName || "Recruiter";
  const companyName = user.company?.name || "";

  return {
    id: user._id.toString(),
    fullName: displayName,
    headline: isPrivate ? "" : user.headline || user.role || "",
    role: isPrivate ? "" : user.role || "",
    location: isPrivate ? "" : user.location || "",
    avatar: isPrivate ? "" : user.avatar || "",
    initialsFallback: buildLogoFallback(displayName),
    isVerified: Boolean(user.idVerified || user.emailVerified),
    summary: isPrivate ? "" : user.summary || "",
    company: {
      name: companyName,
      logoUri: user.company?.logo || undefined,
      website: isPrivate ? undefined : user.company?.website || undefined,
      isVerified: Boolean(user.company?.isVerified),
      ...mapLogoFields(user.company?.logo, companyName),
    },
    allowMessages,
    isSelf,
    profileVisibility: visibility,
  };
};
