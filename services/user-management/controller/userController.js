import User from "../model/userModel.js";
import jwt from "jsonwebtoken";
import transporter from "../config/nodemailer.js";
import { EMAIL_VERIFY_TEMPLATE } from "../config/emailTemplate.js";

const OTP_VALIDITY_MS = 24 * 60 * 60 * 1000;

const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;

const buildVerificationHtml = (email, otp) =>
  EMAIL_VERIFY_TEMPLATE.replace("{{email}}", email).replace("{{otp}}", otp);

const sendVerificationEmail = async (email, otp) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
    to: email,
    subject: "Verify your FraudAware account",
    html: buildVerificationHtml(email, otp),
  });
};

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
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "greatStack",
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    // ==== RESPONSE ====
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
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
      },
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

// ============ LOGOUT ============
export const logout = async (req, res) => {
  try {
    const userId = req.userId; // Set by auth middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // ==== UPDATE LAST ACTIVITY ====
    // Update lastLoginAt to track last user activity
    const user = await User.findByIdAndUpdate(
      userId,
      { lastLoginAt: new Date() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ==== RESPONSE ====
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
