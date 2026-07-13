import mongoose from "mongoose";
import User from "../model/userModel.js";
import { deleteFile, getFileUrl } from "../utils/cloudinaryHelper.js";
import { formatPublicRecruiterProfile } from "../utils/formatPublicRecruiterProfile.js";
import { formatProfileResponse } from "../utils/profileFormatter.js";

const findUserOr404 = async (userId, res) => {
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ success: false, message: "User not found" });
    return null;
  }
  return user;
};

const sendProfile = (res, user, message) => {
  const formatted = formatProfileResponse(user);
  res.status(200).json({
    success: true,
    message,
    ...formatted,
  });
};

const parseBool = (value) => value === true || value === "true";

const replaceUploadedImage = async (currentUrl, req) => {
  const uploadedUrl = getFileUrl(req.file);
  if (!uploadedUrl) return currentUrl;

  if (currentUrl && currentUrl !== uploadedUrl) {
    await deleteFile(currentUrl, "image").catch(() => {});
  }

  return uploadedUrl;
};

const parseFullName = (fullName = "") => {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) {
    return { firstName: trimmed, lastName: trimmed };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

// ============ GET MY PROFILE ============
export const getMyProfile = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    sendProfile(res, user, "Profile fetched successfully");
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message,
    });
  }
};

// ============ GET PUBLIC RECRUITER PROFILE ============
export const getPublicRecruiterProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Recruiter not found",
      });
    }

    const recruiter = formatPublicRecruiterProfile(user, {
      viewerId: req.userId,
    });

    res.status(200).json({
      success: true,
      message: "Recruiter profile fetched successfully",
      recruiter,
    });
  } catch (error) {
    console.error("Get public recruiter profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recruiter profile",
      error: error.message,
    });
  }
};

// ============ UPDATE BASIC PROFILE ============
export const updateBasicProfile = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const {
      firstName,
      lastName,
      fullName,
      phone,
      headline,
      role,
      currentPosition,
      location,
      company,
      dateOfBirth,
      dob,
    } = req.body;

    if (fullName !== undefined) {
      const parsed = parseFullName(fullName);
      user.firstName = parsed.firstName;
      user.lastName = parsed.lastName;
    } else {
      if (firstName !== undefined) user.firstName = firstName.trim();
      if (lastName !== undefined) user.lastName = lastName.trim();
    }

    if (phone !== undefined) user.phone = phone?.trim() || null;
    if (headline !== undefined) user.headline = headline?.trim() || "";

    const nextRole = currentPosition ?? role;
    if (nextRole !== undefined) user.role = nextRole?.trim() || "";

    if (location !== undefined) user.location = location?.trim() || "";

    const nextDob = dob ?? dateOfBirth;
    if (nextDob !== undefined) {
      user.dateOfBirth = nextDob ? new Date(nextDob) : null;
    }

    if (company !== undefined) {
      if (typeof company === "string") {
        user.company = {
          name: company.trim(),
          logo: user.company?.logo ?? null,
          website: user.company?.website ?? null,
          isVerified: user.company?.isVerified ?? false,
        };
      } else {
        user.company = {
          name: company.name?.trim() || user.company?.name || "",
          logo: company.logo ?? user.company?.logo ?? null,
          website: company.website ?? user.company?.website ?? null,
          isVerified: company.isVerified ?? user.company?.isVerified ?? false,
        };
      }
    }

    await user.save();
    sendProfile(res, user, "Basic profile updated successfully");
  } catch (error) {
    console.error("Update basic profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating basic profile",
      error: error.message,
    });
  }
};

// ============ UPDATE SUMMARY ============
export const updateSummary = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const { summary } = req.body;
    if (summary === undefined) {
      return res.status(400).json({
        success: false,
        message: "Summary is required",
      });
    }

    user.summary = summary.trim();
    await user.save();
    sendProfile(res, user, "Summary updated successfully");
  } catch (error) {
    console.error("Update summary error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating summary",
      error: error.message,
    });
  }
};

// ============ UPDATE SKILLS ============
export const updateSkills = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const { skills } = req.body;
    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        message: "Skills must be an array of strings",
      });
    }

    user.skills = skills.map((s) => s.trim()).filter(Boolean);
    await user.save();
    sendProfile(res, user, "Skills updated successfully");
  } catch (error) {
    console.error("Update skills error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating skills",
      error: error.message,
    });
  }
};

// ============ WORK EXPERIENCE ============
export const addWorkExperience = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const {
      jobTitle,
      role,
      company,
      companyLogo,
      startDate,
      endDate,
      isCurrentlyWorking,
      description,
      location,
    } = req.body;

    const title = jobTitle ?? role;
    const currentlyWorking = parseBool(isCurrentlyWorking);
    const uploadedLogo = getFileUrl(req.file);

    if (!title || !company || !startDate) {
      return res.status(400).json({
        success: false,
        message: "role/jobTitle, company, and startDate are required",
      });
    }

    user.workExperience.push({
      jobTitle: title,
      company,
      companyLogo: uploadedLogo || companyLogo || null,
      startDate,
      endDate: currentlyWorking ? null : endDate || null,
      isCurrentlyWorking: currentlyWorking,
      description: description || "",
      location: location || "",
    });

    await user.save();
    sendProfile(res, user, "Work experience added successfully");
  } catch (error) {
    console.error("Add work experience error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding work experience",
      error: error.message,
    });
  }
};

export const updateWorkExperience = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const item = user.workExperience.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Work experience not found" });
    }

    if (req.body.jobTitle !== undefined) item.jobTitle = req.body.jobTitle;
    if (req.body.role !== undefined) item.jobTitle = req.body.role;
    if (req.body.company !== undefined) item.company = req.body.company;
    if (req.body.startDate !== undefined) item.startDate = req.body.startDate;
    if (req.body.endDate !== undefined) item.endDate = req.body.endDate;
    if (req.body.isCurrentlyWorking !== undefined) {
      item.isCurrentlyWorking = parseBool(req.body.isCurrentlyWorking);
    }
    if (req.body.description !== undefined) item.description = req.body.description;
    if (req.body.location !== undefined) item.location = req.body.location;

    if (req.file) {
      item.companyLogo = await replaceUploadedImage(item.companyLogo, req);
    } else if (req.body.companyLogo !== undefined) {
      item.companyLogo = req.body.companyLogo || null;
    }

    if (item.isCurrentlyWorking) {
      item.endDate = null;
    }

    await user.save();
    sendProfile(res, user, "Work experience updated successfully");
  } catch (error) {
    console.error("Update work experience error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating work experience",
      error: error.message,
    });
  }
};

export const deleteWorkExperience = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const item = user.workExperience.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Work experience not found" });
    }

    if (item.companyLogo) {
      await deleteFile(item.companyLogo, "image").catch(() => {});
    }

    item.deleteOne();
    await user.save();
    sendProfile(res, user, "Work experience deleted successfully");
  } catch (error) {
    console.error("Delete work experience error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting work experience",
      error: error.message,
    });
  }
};

// ============ EDUCATION ============
export const addEducation = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const {
      degree,
      institution,
      institutionLogo,
      fieldOfStudy,
      startDate,
      endDate,
      description,
    } = req.body;

    const uploadedLogo = getFileUrl(req.file);

    if (!degree || !institution || !startDate) {
      return res.status(400).json({
        success: false,
        message: "degree, institution, and startDate are required",
      });
    }

    user.education.push({
      degree,
      institution,
      institutionLogo: uploadedLogo || institutionLogo || null,
      fieldOfStudy: fieldOfStudy || "",
      startDate,
      endDate: endDate || null,
      description: description || "",
    });

    await user.save();
    sendProfile(res, user, "Education added successfully");
  } catch (error) {
    console.error("Add education error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding education",
      error: error.message,
    });
  }
};

export const updateEducation = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const item = user.education.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Education not found" });
    }

    if (req.body.degree !== undefined) item.degree = req.body.degree;
    if (req.body.institution !== undefined) item.institution = req.body.institution;
    if (req.body.fieldOfStudy !== undefined) item.fieldOfStudy = req.body.fieldOfStudy;
    if (req.body.startDate !== undefined) item.startDate = req.body.startDate;
    if (req.body.endDate !== undefined) item.endDate = req.body.endDate;
    if (req.body.description !== undefined) item.description = req.body.description;

    if (req.file) {
      item.institutionLogo = await replaceUploadedImage(item.institutionLogo, req);
    } else if (req.body.institutionLogo !== undefined) {
      item.institutionLogo = req.body.institutionLogo || null;
    }

    await user.save();
    sendProfile(res, user, "Education updated successfully");
  } catch (error) {
    console.error("Update education error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating education",
      error: error.message,
    });
  }
};

export const deleteEducation = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const item = user.education.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Education not found" });
    }

    if (item.institutionLogo) {
      await deleteFile(item.institutionLogo, "image").catch(() => {});
    }

    item.deleteOne();
    await user.save();
    sendProfile(res, user, "Education deleted successfully");
  } catch (error) {
    console.error("Delete education error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting education",
      error: error.message,
    });
  }
};

// ============ LANGUAGES ============
export const addLanguage = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const { language, name, proficiency, flagUrl, flagUri } = req.body;
    const languageName = language ?? name;

    if (!languageName || !proficiency) {
      return res.status(400).json({
        success: false,
        message: "name/language and proficiency are required",
      });
    }

    const uploadedFlag = getFileUrl(req.file);

    user.languages.push({
      language: languageName,
      proficiency,
      flagUrl: uploadedFlag || flagUrl || flagUri || null,
    });
    await user.save();
    sendProfile(res, user, "Language added successfully");
  } catch (error) {
    console.error("Add language error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding language",
      error: error.message,
    });
  }
};

export const updateLanguage = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const item = user.languages.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Language not found" });
    }

    if (req.body.language !== undefined) item.language = req.body.language;
    if (req.body.name !== undefined) item.language = req.body.name;
    if (req.body.proficiency !== undefined) item.proficiency = req.body.proficiency;

    if (req.file) {
      item.flagUrl = await replaceUploadedImage(item.flagUrl, req);
    } else if (req.body.flagUrl !== undefined) {
      item.flagUrl = req.body.flagUrl || null;
    } else if (req.body.flagUri !== undefined) {
      item.flagUrl = req.body.flagUri || null;
    }

    await user.save();
    sendProfile(res, user, "Language updated successfully");
  } catch (error) {
    console.error("Update language error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating language",
      error: error.message,
    });
  }
};

export const deleteLanguage = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const item = user.languages.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Language not found" });
    }

    if (item.flagUrl) {
      await deleteFile(item.flagUrl, "image").catch(() => {});
    }

    item.deleteOne();
    await user.save();
    sendProfile(res, user, "Language deleted successfully");
  } catch (error) {
    console.error("Delete language error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting language",
      error: error.message,
    });
  }
};

// ============ COMPANY LOGO UPLOAD ============
export const updateCompanyLogo = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Company logo file is required (field name: logo)",
      });
    }

    const currentLogo = user.company?.logo ?? null;
    const uploadedLogo = await replaceUploadedImage(currentLogo, req);

    user.company = {
      name: user.company?.name || "",
      logo: uploadedLogo,
      website: user.company?.website ?? null,
      isVerified: user.company?.isVerified ?? false,
    };

    await user.save();
    sendProfile(res, user, "Company logo updated successfully");
  } catch (error) {
    console.error("Update company logo error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating company logo",
      error: error.message,
    });
  }
};

// ============ AVATAR UPLOAD ============
export const updateAvatar = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Avatar image file is required (field name: avatar)",
      });
    }

    const newAvatarUrl = getFileUrl(req.file);
    if (user.avatar && user.avatar !== newAvatarUrl) {
      await deleteFile(user.avatar, "image").catch(() => {});
    }

    user.avatar = newAvatarUrl;
    await user.save();
    sendProfile(res, user, "Avatar updated successfully");
  } catch (error) {
    console.error("Update avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating avatar",
      error: error.message,
    });
  }
};

// ============ CV UPLOAD / DELETE ============
export const uploadCv = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CV file is required (field name: cv)",
      });
    }

    const { isPrimary } = req.body;
    const fileUrl = getFileUrl(req.file);

    if (isPrimary === "true" || isPrimary === true) {
      user.cvFiles.forEach((cv) => {
        cv.isPrimary = false;
      });
    }

    user.cvFiles.push({
      fileName: req.file.originalname,
      fileUrl,
      fileSize: req.file.size || 0,
      isPrimary: isPrimary === "true" || isPrimary === true,
    });

    await user.save();
    sendProfile(res, user, "CV uploaded successfully");
  } catch (error) {
    console.error("Upload CV error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading CV",
      error: error.message,
    });
  }
};

export const deleteCv = async (req, res) => {
  try {
    const user = await findUserOr404(req.userId, res);
    if (!user) return;

    const cv = user.cvFiles.id(req.params.cvId);
    if (!cv) {
      return res.status(404).json({ success: false, message: "CV not found" });
    }

    if (cv.fileUrl) {
      await deleteFile(cv.fileUrl, "raw").catch(() => {});
    }

    cv.deleteOne();
    await user.save();
    sendProfile(res, user, "CV deleted successfully");
  } catch (error) {
    console.error("Delete CV error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting CV",
      error: error.message,
    });
  }
};
