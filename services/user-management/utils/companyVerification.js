import User from "../model/userModel.js";
import VerificationRequest from "../model/verificationRequestModel.js";
import { predictEmployer } from "./employerVerificationClient.js";

const readableSource = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "Registry";
  const lower = value.toLowerCase();
  if (lower.includes("cse")) return "CSE";
  if (lower.includes("cbsl")) return "CBSL";
  if (lower.includes("boi")) return "BOI";
  if (lower.includes("eroc") || lower.includes("drc")) return "eROC";
  if (lower.includes("opencorporates")) return "OpenCorporates";
  if (lower.includes("slaasmb")) return "SLAASMB";
  if (lower.includes("known")) return "Official registry";
  return value.replace(/_/g, " ");
};

/**
 * Map ML /predict response into admin queue fields.
 * riskScore is 0–1 where higher = more risky (matches admin UI).
 */
export const mapPredictToVerificationFields = (predict = {}, user) => {
  const evidence = predict.evidence || {};
  const riskLevel = String(predict.risk_level || "").toLowerCase();
  const registrationStatus = String(
    predict.registration_status ||
      evidence.registration_status ||
      "not_found"
  ).toLowerCase();
  const confidence = String(predict.confidence || "").toLowerCase();
  const prediction = String(predict.prediction || "").trim();

  const legitimacy = Number(predict.risk_score);
  let riskScore = 0.5;
  if (Number.isFinite(legitimacy)) {
    riskScore = Math.min(1, Math.max(0, 1 - legitimacy / 100));
  } else if (riskLevel === "low") {
    riskScore = 0.15;
  } else if (riskLevel === "high") {
    riskScore = 0.85;
  } else if (riskLevel === "medium") {
    riskScore = 0.45;
  }

  const signalMap = new Map();
  const pushSignal = (source, found, note) => {
    const label = readableSource(source);
    if (!label) return;
    const prev = signalMap.get(label);
    if (prev && prev.found && !found) return;
    signalMap.set(label, {
      source: label,
      found: Boolean(found),
      note: note ? String(note).slice(0, 240) : null,
    });
  };

  const sources =
    predict.registration_sources || evidence.registration_sources || [];
  for (const source of sources) {
    pushSignal(source, true, predict.registration_summary || null);
  }

  const gov = predict.government_registration_source ||
    evidence.government_registration_source;
  if (gov) pushSignal(gov, registrationStatus === "registered", null);

  const method = predict.registration_method || evidence.registration_method;
  if (method) {
    for (const part of String(method).split("+")) {
      pushSignal(part.trim(), registrationStatus === "registered", null);
    }
  }

  const trace = predict.registration_trace || evidence.registration_trace || [];
  if (Array.isArray(trace)) {
    for (const step of trace) {
      if (!step || typeof step !== "object") continue;
      pushSignal(
        step.source || step.method || "Registry",
        String(step.status || "").toLowerCase().includes("found") ||
          String(step.status || "").toLowerCase() === "matched" ||
          String(step.status || "").toLowerCase() === "ok",
        step.detail || null
      );
    }
  }

  if (signalMap.size === 0) {
    pushSignal(
      "Registry check",
      registrationStatus === "registered",
      predict.registration_summary ||
        evidence.registration_summary ||
        `Status: ${registrationStatus}`
    );
  }

  const summaryParts = [];
  if (predict.recommendation) summaryParts.push(String(predict.recommendation));
  else if (predict.verdict) summaryParts.push(String(predict.verdict));
  if (predict.registration_summary || evidence.registration_summary) {
    summaryParts.push(
      String(predict.registration_summary || evidence.registration_summary)
    );
  }
  if (predict.warning) summaryParts.push(String(predict.warning));
  if (summaryParts.length === 0) {
    summaryParts.push(
      `Automated check: prediction=${prediction || "n/a"}, risk=${riskLevel || "n/a"}, registration=${registrationStatus}.`
    );
  }

  const autoEligible =
    riskLevel === "low" &&
    registrationStatus === "registered" &&
    confidence !== "low" &&
    prediction.toLowerCase() !== "fake" &&
    prediction.toLowerCase() !== "unknown";

  const company = user?.company || {};
  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  return {
    companyName: company.name || "Unknown company",
    registrationNumber: company.registrationNumber || "",
    website: company.website || null,
    industry: company.industry || "",
    address: company.address || "",
    submittedByName: fullName || user?.email || "",
    submittedByEmail: user?.email || "",
    riskScore,
    summary: summaryParts.join(" ").slice(0, 800),
    registrySignals: Array.from(signalMap.values()),
    autoEligible,
    riskLevel,
    registrationStatus,
    confidence,
    prediction,
  };
};

const mapUnavailableFields = (user, errorMessage) => {
  const company = user?.company || {};
  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  return {
    companyName: company.name || "Unknown company",
    registrationNumber: company.registrationNumber || "",
    website: company.website || null,
    industry: company.industry || "",
    address: company.address || "",
    submittedByName: fullName || user?.email || "",
    submittedByEmail: user?.email || "",
    riskScore: 0.55,
    summary: `${errorMessage}. Queued for manual admin review.`,
    registrySignals: [
      {
        source: "Employer verification service",
        found: false,
        note: errorMessage,
      },
    ],
    autoEligible: false,
  };
};

/**
 * Hybrid verification:
 * - Clear legit → auto approve + company.isVerified = true
 * - Otherwise → pending admin queue (isVerified left false unless already true)
 *
 * Returns the upserted VerificationRequest document (lean object).
 */
export const runHybridCompanyVerification = async (userId, options = {}) => {
  const { force = false } = options;
  const user = await User.findById(userId);
  if (!user) return null;

  if (!["company", "recruiter"].includes(user.accountType)) {
    return null;
  }

  const companyName = String(user.company?.name || "").trim();
  if (companyName.length < 2) {
    return null;
  }

  if (user.company?.isVerified && !force) {
    const existingApproved = await VerificationRequest.findOne({
      userId: user._id,
      decision: "approved",
    })
      .sort({ reviewedAt: -1, createdAt: -1 })
      .lean();
    if (existingApproved) return existingApproved;
  }

  // One open pending request at a time — refresh it instead of spamming.
  let request = await VerificationRequest.findOne({
    userId: user._id,
    decision: "pending",
  });

  const predictResult = await predictEmployer({
    companyName,
    websiteUrl: user.company?.website,
    email: user.email,
  });

  const fields = predictResult.ok
    ? mapPredictToVerificationFields(predictResult.data, user)
    : mapUnavailableFields(user, predictResult.error || "Check unavailable");

  const payload = {
    userId: user._id,
    companyName: fields.companyName,
    registrationNumber: fields.registrationNumber,
    website: fields.website,
    industry: fields.industry,
    address: fields.address,
    submittedByName: fields.submittedByName,
    submittedByEmail: fields.submittedByEmail,
    riskScore: fields.riskScore,
    summary: fields.summary,
    registrySignals: fields.registrySignals,
    predictSnapshot: predictResult.ok ? predictResult.data : { error: predictResult.error },
  };

  if (fields.autoEligible) {
    if (!user.company) user.company = { name: companyName };
    user.company.isVerified = true;
    await user.save();

    if (request) {
      Object.assign(request, payload, {
        decision: "approved",
        decisionSource: "auto",
        reviewedAt: new Date(),
        reviewedBy: null,
        rejectionReason: null,
      });
      await request.save();
    } else {
      request = await VerificationRequest.create({
        ...payload,
        decision: "approved",
        decisionSource: "auto",
        reviewedAt: new Date(),
      });
    }
    return request.toObject ? request.toObject() : request;
  }

  // Not auto-eligible — keep / create pending; do not revoke existing verified unless force
  if (force && user.company?.isVerified) {
    user.company.isVerified = false;
    await user.save();
  }

  if (request) {
    Object.assign(request, payload, {
      decision: "pending",
      decisionSource: "admin",
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    });
    await request.save();
  } else {
    request = await VerificationRequest.create({
      ...payload,
      decision: "pending",
      decisionSource: "admin",
    });
  }

  return request.toObject ? request.toObject() : request;
};

/** Fire-and-forget wrapper for register / profile hooks. */
export const scheduleHybridCompanyVerification = (userId, options = {}) => {
  void runHybridCompanyVerification(userId, options).catch((error) => {
    console.error("Hybrid company verification failed:", error?.message || error);
  });
};
