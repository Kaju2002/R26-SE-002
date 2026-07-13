import User from "../model/userModel.js";
import jwt from "jsonwebtoken";
import transporter from "../config/nodemailer.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";
import {
  EMAIL_VERIFY_TEMPLATE,
  PASSWORD_RESET_TEMPLATE,
} from "../config/emailTemplate.js";
import { publishEvent } from "../utils/publishEvent.js";

const OTP_VALIDITY_MS = 24 * 60 * 60 * 1000;
const RESET_OTP_VALIDITY_MS = 15 * 60 * 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account with this email exists, a password reset code has been sent.";

const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;

const normalizeEmail = (email) => email.toLowerCase().trim();

const normalizeOtp = (otp) => String(otp).trim();

const isValidEmail = (email) => EMAIL_REGEX.test(email);

const isValidOtp = (otp) => /^\d{6}$/.test(otp);

const buildVerificationHtml = (email, otp) =>
  EMAIL_VERIFY_TEMPLATE.replace("{{email}}", email).replace("{{otp}}", otp);

const buildPasswordResetHtml = (email, otp) =>
  PASSWORD_RESET_TEMPLATE.replace("{{email}}", email).replace("{{otp}}", otp);

const sendVerificationEmail = async (email, otp) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    to: email,
    subject: "Verify your FraudAware account",
    html: buildVerificationHtml(email, otp),
  });
};

const sendPasswordResetEmail = async (email, otp) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    to: email,
    subject: "Reset your FraudAware password",
    html: buildPasswordResetHtml(email, otp),
  });
};

const canRequestPasswordReset = (user) =>
  user &&
  user.emailVerified === true &&
  user.accountStatus === "active";

const validatePasswordResetOtp = (user, normalizedOtp) => {
  if (
    !user.passwordResetToken ||
    !user.passwordResetExpires ||
    user.passwordResetExpires.getTime() < Date.now()
  ) {
    return {
      ok: false,
      status: 400,
      message: "Reset code is expired. Please request a new code.",
    };
  }

  if (user.passwordResetToken !== normalizedOtp) {
    return {
      ok: false,
      status: 400,
      message: "Invalid reset code",
    };
  }

  return { ok: true };
};

const issuePasswordResetOtp = async (user) => {
  const resetOtp = generateOtp();
  user.passwordResetToken = resetOtp;
  user.passwordResetExpires = new Date(Date.now() + RESET_OTP_VALIDITY_MS);
  await user.save();
  await sendPasswordResetEmail(user.email, resetOtp);
};

const JWT_SECRET = () => process.env.JWT_SECRET || "greatStack";
const JWT_EXPIRE = () => process.env.JWT_EXPIRE || "7d";

const formatAuthUser = (user) => ({
  id: user._id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  fullName: `${user.firstName} ${user.lastName}`,
  avatar: user.avatar,
  headline: user.headline,
  role: user.role,
  location: user.location,
  accountStatus: user.accountStatus,
  emailVerified: user.emailVerified,
  isPremium: user.isPremium,
  lastLoginAt: user.lastLoginAt,
});

const signAuthToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0,
    },
    JWT_SECRET(),
    { expiresIn: JWT_EXPIRE() }
  );

// ============ REGISTER ============
export const register = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    // ==== VALIDATION ====
    // 1. Check all required fields
    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, password, and confirm password are required",
      });
    }

    // 2. Validate fullName length
    const nameTrimed = fullName.trim();
    if (nameTrimed.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Full name must be at least 2 characters",
      });
    }

    // Check if fullName has at least first and last name
    const nameParts = nameTrimed.split(" ");
    if (nameParts.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please enter full name (first and last name)",
      });
    }

    // 3. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // 4. Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // 5. Validate confirmPassword matches password
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // ==== CHECK IF USER EXISTS ====
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    // ==== PARSE FULL NAME INTO FIRST AND LAST NAME ====
    const nameParts2 = nameTrimed.split(" ");
    const firstName = nameParts2[0];
    const lastName = nameParts2.slice(1).join(" ");

    const verificationOtp = generateOtp();
    const verificationExpiry = new Date(Date.now() + OTP_VALIDITY_MS);

    // ==== CREATE NEW USER ====
    const newUser = await User.create({
      email: email.toLowerCase().trim(),
      password, // Will be hashed by pre-save hook
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      accountStatus: "active",
      emailVerified: false,
      emailVerificationToken: verificationOtp,
      emailVerificationExpires: verificationExpiry,
    });

    await sendVerificationEmail(newUser.email, verificationOtp);

    // ==== RESPONSE ====
    res.status(201).json({
      success: true,
      message: "User registered successfully. Verification OTP sent to email.",
      requiresEmailVerification: true,
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        fullName: `${newUser.firstName} ${newUser.lastName}`,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error during registration",
      error: error.message,
    });
  }
};

// ============ LOGIN ============
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ==== VALIDATION ====
    // 1. Check required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // ==== FIND USER BY EMAIL ====
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    // 3. Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 4. Check if account is active
    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.accountStatus}`,
      });
    }

    // 5. Block login until email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
        requiresEmailVerification: true,
      });
    }

    // ==== COMPARE PASSWORD ====
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // ==== UPDATE LAST LOGIN ====
    user.lastLoginAt = new Date();
    await user.save();

    // ==== GENERATE JWT TOKEN ====
    const token = signAuthToken(user);

    // ==== RESPONSE ====
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: formatAuthUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Error during login",
      error: error.message,
    });
  }
};

// ============ VERIFY EMAIL OTP ============
export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOtp = otp.trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be a 6-digit code",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+emailVerificationToken +emailVerificationExpires"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: "Email already verified",
      });
    }

    if (
      !user.emailVerificationToken ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires.getTime() < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: "OTP is expired. Please request a new OTP.",
      });
    }

    if (user.emailVerificationToken !== normalizedOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    await publishEvent(EVENT_TYPES.AUTH_ACCOUNT_CREATED, {
      userId: String(user._id),
      email: user.email,
    });

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify email OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error while verifying email OTP",
      error: error.message,
    });
  }
};

// ============ RESEND VERIFICATION OTP ============
export const resendVerificationOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+emailVerificationToken +emailVerificationExpires"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    const verificationOtp = generateOtp();
    user.emailVerificationToken = verificationOtp;
    user.emailVerificationExpires = new Date(Date.now() + OTP_VALIDITY_MS);
    await user.save();

    await sendVerificationEmail(user.email, verificationOtp);

    res.status(200).json({
      success: true,
      message: "Verification OTP sent successfully",
    });
  } catch (error) {
    console.error("Resend verification OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error while resending verification OTP",
      error: error.message,
    });
  }
};

// ============ FORGOT PASSWORD ============
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+passwordResetToken +passwordResetExpires"
    );

    if (canRequestPasswordReset(user)) {
      await issuePasswordResetOtp(user);
    }

    res.status(200).json({
      success: true,
      message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Error while sending password reset code",
      error: error.message,
    });
  }
};

// ============ VERIFY RESET OTP ============
export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and reset code are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedOtp = normalizeOtp(otp);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (!isValidOtp(normalizedOtp)) {
      return res.status(400).json({
        success: false,
        message: "Reset code must be a 6-digit code",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+passwordResetToken +passwordResetExpires"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before resetting your password",
      });
    }

    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.accountStatus}`,
      });
    }

    const otpCheck = validatePasswordResetOtp(user, normalizedOtp);
    if (!otpCheck.ok) {
      return res.status(otpCheck.status).json({
        success: false,
        message: otpCheck.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Reset code verified successfully",
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error while verifying reset code",
      error: error.message,
    });
  }
};

// ============ RESET PASSWORD ============
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !otp || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, reset code, password, and confirm password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedOtp = normalizeOtp(otp);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (!isValidOtp(normalizedOtp)) {
      return res.status(400).json({
        success: false,
        message: "Reset code must be a 6-digit code",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password +passwordResetToken +passwordResetExpires"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before resetting your password",
      });
    }

    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.accountStatus}`,
      });
    }

    const otpCheck = validatePasswordResetOtp(user, normalizedOtp);
    if (!otpCheck.ok) {
      return res.status(otpCheck.status).json({
        success: false,
        message: otpCheck.message,
      });
    }

    const isSamePassword = await user.comparePassword(password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password",
      });
    }

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    await publishEvent(EVENT_TYPES.AUTH_PASSWORD_UPDATED, {
      userId: String(user._id),
      email: user.email,
    });

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error while resetting password",
      error: error.message,
    });
  }
};

// ============ RESEND RESET OTP ============
export const resendResetOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+passwordResetToken +passwordResetExpires"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before resetting your password",
      });
    }

    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.accountStatus}`,
      });
    }

    await issuePasswordResetOtp(user);

    res.status(200).json({
      success: true,
      message: "Password reset code sent successfully",
    });
  } catch (error) {
    console.error("Resend reset OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error while resending reset code",
      error: error.message,
    });
  }
};

// ============ GET CURRENT USER (SESSION VALIDATION) ============
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.accountStatus}`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Session is valid",
      user: formatAuthUser(user),
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Error validating session",
      error: error.message,
    });
  }
};

// ============ LOGOUT ============
export const logout = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { tokenVersion: 1 },
        lastLoginAt: new Date(),
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Logout successful",
      note: "Token has been invalidated. Please delete it from your client.",
      lastActivityAt: user.lastLoginAt,
    });
  } catch (error) {
    console.error("Logout error:", error);

    res.status(500).json({
      success: false,
      message: "Error during logout",
      error: error.message,
    });
  }
};
