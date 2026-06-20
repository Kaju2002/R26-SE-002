import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Work Experience Sub-schema
const workExperienceSchema = new mongoose.Schema({
  jobTitle: {
    type: String,
    required: [true, "Job title is required"],
    trim: true,
  },
  company: {
    type: String,
    required: [true, "Company name is required"],
    trim: true,
  },
  companyLogo: {
    type: String,
    default: null,
  },
  startDate: {
    type: Date,
    required: [true, "Start date is required"],
  },
  endDate: {
    type: Date,
    default: null,
  },
  isCurrentlyWorking: {
    type: Boolean,
    default: false,
  },
  description: {
    type: String,
    trim: true,
  },
  location: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Education Sub-schema
const educationSchema = new mongoose.Schema({
  degree: {
    type: String,
    required: [true, "Degree is required"],
    trim: true,
  },
  institution: {
    type: String,
    required: [true, "Institution name is required"],
    trim: true,
  },
  institutionLogo: {
    type: String,
    default: null,
  },
  fieldOfStudy: {
    type: String,
    trim: true,
  },
  startDate: {
    type: Date,
    required: [true, "Start date is required"],
  },
  endDate: {
    type: Date,
    default: null,
  },
  description: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Languages Sub-schema
const languageSchema = new mongoose.Schema({
  language: {
    type: String,
    required: [true, "Language name is required"],
    trim: true,
  },
  proficiency: {
    type: String,
    enum: ["Native", "Fluent", "Intermediate", "Basic"],
    required: [true, "Proficiency level is required"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// CV Files Sub-schema
const cvFileSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: [true, "File name is required"],
    trim: true,
  },
  fileUrl: {
    type: String,
    required: [true, "File URL is required"],
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  isPrimary: {
    type: Boolean,
    default: false,
  },
});

// Company Sub-schema
const companySchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
  },
  logo: {
    type: String,
    default: null,
  },
  website: {
    type: String,
    default: null,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
});

// Stats Sub-schema
const statsSchema = new mongoose.Schema({
  profileViews: {
    type: Number,
    default: 0,
    min: 0,
  },
  postImpressions: {
    type: Number,
    default: 0,
    min: 0,
  },
  connections: {
    type: Number,
    default: 0,
    min: 0,
  },
  jobsApplied: {
    type: Number,
    default: 0,
    min: 0,
  },
  jobsPosted: {
    type: Number,
    default: 0,
    min: 0,
  },
  endorsements: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { _id: false });

// Privacy Settings Sub-schema
const privacySchema = new mongoose.Schema({
  profileVisibility: {
    type: String,
    enum: ["public", "private", "connections_only"],
    default: "public",
  },
  showEmail: {
    type: Boolean,
    default: false,
  },
  showPhone: {
    type: Boolean,
    default: false,
  },
  allowMessages: {
    type: Boolean,
    default: true,
  },
  allowJobNotifications: {
    type: Boolean,
    default: true,
  },
  allowMarketingEmails: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

// Linked Accounts Sub-schema
const linkedAccountSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ["google", "linkedin", "github"],
    required: [true, "Provider is required"],
  },
  providerId: {
    type: String,
    required: [true, "Provider ID is required"],
  },
  connectedAt: {
    type: Date,
    default: Date.now,
  },
});

// ============ MAIN USER SCHEMA ============
const userSchema = new mongoose.Schema({
  // ==== Authentication ====
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [8, "Password must be at least 8 characters"],
    select: false, // Don't return password by default in queries
  },

  // ==== Basic Information ====
  firstName: {
    type: String,
    required: [true, "First name is required"],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, "Last name is required"],
    trim: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  phone: {
    type: String,
    default: null,
    match: [/^\+?[0-9\s\-()]*$/, "Please enter a valid phone number"],
  },

  // ==== Professional Information ====
  headline: {
    type: String,
    trim: true,
    maxlength: [160, "Headline cannot exceed 160 characters"],
  },
  role: {
    type: String,
    trim: true,
  },
  location: {
    type: String,
    trim: true,
  },
  summary: {
    type: String,
    trim: true,
    maxlength: [2000, "Summary cannot exceed 2000 characters"],
  },
  company: companySchema,

  // ==== Professional Arrays ====
  skills: {
    type: [String],
    default: [],
    validate: {
      validator: function (v) {
        return v.every(skill => skill && skill.trim().length > 0);
      },
      message: "Skills cannot be empty or whitespace",
    },
  },
  workExperience: {
    type: [workExperienceSchema],
    default: [],
  },
  education: {
    type: [educationSchema],
    default: [],
  },
  languages: {
    type: [languageSchema],
    default: [],
  },

  // ==== CV/Resume Files ====
  cvFiles: {
    type: [cvFileSchema],
    default: [],
  },

  // ==== Email Verification ====
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    default: null,
    select: false,
  },
  emailVerificationExpires: {
    type: Date,
    default: null,
    select: false,
  },
  emailVerifiedAt: {
    type: Date,
    default: null,
  },

  // ==== ID Verification ====
  idVerified: {
    type: Boolean,
    default: false,
  },
  idVerificationType: {
    type: String,
    enum: ["passport", "license", "national_id", "driving_license"],
    default: null,
  },
  idVerificationStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  idVerificationNumber: {
    type: String,
    default: null,
    select: false,
  },

  // ==== Account Status ====
  accountStatus: {
    type: String,
    enum: ["active", "inactive", "suspended", "deleted"],
    default: "active",
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },

  // ==== Premium/Subscription ====
  isPremium: {
    type: Boolean,
    default: false,
  },
  premiumType: {
    type: String,
    enum: ["free", "basic", "pro", "enterprise"],
    default: "free",
  },
  premiumStartDate: {
    type: Date,
    default: null,
  },
  premiumEndDate: {
    type: Date,
    default: null,
  },
  premiumStatus: {
    type: String,
    enum: ["active", "expired", "cancelled"],
    default: "active",
  },

  // ==== Profile Statistics ====
  stats: {
    type: statsSchema,
    default: () => ({
      profileViews: 0,
      postImpressions: 0,
      connections: 0,
      jobsApplied: 0,
      jobsPosted: 0,
      endorsements: 0,
    }),
  },

  // ==== Privacy Settings ====
  privacy: {
    type: privacySchema,
    default: () => ({
      profileVisibility: "public",
      showEmail: false,
      showPhone: false,
      allowMessages: true,
      allowJobNotifications: true,
      allowMarketingEmails: false,
    }),
  },

  // ==== Network & Connections ====
  // Note: For production at scale, use separate collections:
  // - Connection { fromUser, toUser, status }
  // - SavedJob { userId, jobId, savedAt }
  // - SavedProfile { userId, profileId, savedAt }
  connections: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },
  savedJobs: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Job",
    default: [],
  },
  savedProfiles: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },

  // ==== Linked Accounts (Social) ====
  linkedAccounts: {
    type: [linkedAccountSchema],
    default: [],
  },

  // ==== Password Reset ====
  passwordResetToken: {
    type: String,
    default: null,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    default: null,
    select: false,
  },

  // ==== Soft Delete ====
  deletedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// ==== INDEXES ====
userSchema.index({ email: 1 });
userSchema.index({ accountStatus: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ "stats.connections": -1 }); // For popular users

// ==== VIRTUAL FIELDS ====
// Auto-generate fullName from firstName and lastName (not stored, computed on read)
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included in JSON/Object output
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

// ==== PRE-SAVE HOOKS ====
// Hash password before saving (only if modified)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ==== VALIDATION ====
// Note: Array element validation (workExperience, education, etc.) should also be validated
// at the service/controller layer because Mongoose doesn't always trigger deep validation
// on partial updates ($push, $set operations). These validators below help on full save(),
// but for robust validation, use service-layer middleware.

// Ensure endDate is after startDate for work experience
userSchema.path("workExperience").validate(function (value) {
  return value.every((exp) => {
    if (exp.endDate && exp.startDate) {
      return exp.endDate >= exp.startDate;
    }
    return true;
  });
}, "End date must be after start date");

// Ensure endDate is after startDate for education
userSchema.path("education").validate(function (value) {
  return value.every((edu) => {
    if (edu.endDate && edu.startDate) {
      return edu.endDate >= edu.startDate;
    }
    return true;
  });
}, "End date must be after start date");

// Ensure unique providers in linkedAccounts (no duplicate social accounts)
userSchema.path("linkedAccounts").validate(function (value) {
  const providers = value.map((acc) => acc.provider);
  return providers.length === new Set(providers).size;
}, "Cannot have duplicate linked accounts for the same provider");

// ==== METHODS ====
// Compare password method (for login)
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get public profile (exclude sensitive data)
userSchema.methods.getPublicProfile = function () {
  const userObject = this.toObject({ virtuals: true });
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.idVerificationNumber;
  delete userObject.__v;
  return userObject;
};

// ==== STATICS ====
// Find user by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Create User Model
const User = mongoose.model("User", userSchema);

export default User;
