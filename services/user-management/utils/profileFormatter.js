const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatMonthYear = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const formatDurationLabel = (startDate, endDate, isCurrent = false) => {
  const start = new Date(startDate);
  const end = isCurrent || !endDate ? new Date() : new Date(endDate);

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months < 1) months = 1;

  const years = Math.floor(months / 12);
  const remMonths = months % 12;

  if (years === 0) return `${remMonths} month${remMonths === 1 ? "" : "s"}`;
  if (remMonths === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${remMonths} month${remMonths === 1 ? "" : "s"}`;
};

export const formatExperienceDuration = (item) => {
  const start = formatMonthYear(item.startDate);
  const end = item.isCurrentlyWorking ? "Present" : formatMonthYear(item.endDate);
  const span = formatDurationLabel(item.startDate, item.endDate, item.isCurrentlyWorking);
  return `${start} - ${end} | ${span}`;
};

export const formatEducationDuration = (item) => {
  const startYear = new Date(item.startDate).getFullYear();
  const endYear = item.endDate ? new Date(item.endDate).getFullYear() : "Present";
  const span = formatDurationLabel(item.startDate, item.endDate, !item.endDate);
  return `${startYear} - ${endYear} | ${span}`;
};

export const formatFileSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} b`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kb`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} mb`;
};

const FALLBACK_PALETTE = [
  { bg: "#FBE0B6", color: "#7A5418" },
  { bg: "#1F2A6E", color: "#FFFFFF" },
  { bg: "#FFE091", color: "#5C3F00" },
  { bg: "#D8E1FF", color: "#202871" },
];

export const buildLogoFallback = (name) => {
  if (!name?.trim()) return undefined;

  const words = name.trim().split(/\s+/).filter(Boolean);
  const text =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];

  return { text, bg: palette.bg, color: palette.color };
};
const mapLogoFields = (logoUrl, name) => ({
  logoUri: logoUrl || undefined,
  fallback: logoUrl ? undefined : buildLogoFallback(name),
});

/**
 * Shape backend user document to match frontend PROFILE + PROFILE_DETAILS.
 */
export const formatProfileResponse = (user) => {
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const shortName = user.firstName || fullName.split(" ")[0] || "";

  return {
    profile: {
      id: user._id.toString(),
      email: user.email,
      fullName,
      shortName,
      role: user.role || "",
      headline: user.headline || "",
      location: user.location || "",
      avatar: user.avatar || "",
      phone: user.phone || "",
      dateOfBirth: user.dateOfBirth || null,
      isVerified: Boolean(user.idVerified || user.emailVerified),
      company: {
        name: user.company?.name || "",
        logo: user.company?.logo || "",
        website: user.company?.website || "",
        isVerified: Boolean(user.company?.isVerified),
        ...mapLogoFields(user.company?.logo, user.company?.name),
      },
      stats: [
        { id: "viewers", label: "profile viewers", value: user.stats?.profileViews ?? 0 },
        { id: "impressions", label: "post impressions", value: user.stats?.postImpressions ?? 0 },
      ],
      isPremium: Boolean(user.isPremium),
      premiumLabel: user.isPremium ? "Premium Member" : "Try Premium for Rs 0",
    },
    details: {
      summary: user.summary || "",
      experiences: (user.workExperience || []).map((item) => ({
        id: item._id.toString(),
        role: item.jobTitle,
        company: item.company,
        duration: formatExperienceDuration(item),
        ...mapLogoFields(item.companyLogo, item.company),
        startDate: item.startDate,
        endDate: item.endDate,
        isCurrentlyWorking: item.isCurrentlyWorking,
        description: item.description || "",
        location: item.location || "",
      })),
      education: (user.education || []).map((item) => ({
        id: item._id.toString(),
        degree: item.degree,
        institution: item.institution,
        fieldOfStudy: item.fieldOfStudy || "",
        duration: formatEducationDuration(item),
        ...mapLogoFields(item.institutionLogo, item.institution),
        startDate: item.startDate,
        endDate: item.endDate,
        description: item.description || "",
      })),
      skills: user.skills || [],
      languages: (user.languages || []).map((item) => ({
        id: item._id.toString(),
        name: item.language,
        proficiency: item.proficiency,
        flagUri: item.flagUrl || undefined,
      })),
      cvFiles: (user.cvFiles || []).map((item) => ({
        id: item._id.toString(),
        name: item.fileName,
        size: formatFileSize(item.fileSize),
        fileUrl: item.fileUrl,
        fileSize: item.fileSize,
        isPrimary: item.isPrimary,
        uploadedAt: item.uploadedAt,
      })),
    },
  };
};
