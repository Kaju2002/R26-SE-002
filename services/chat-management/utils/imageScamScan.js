import Message from "../model/messageModel.js";
import { emitMessageUpdated } from "../config/socket.js";
import { analyzeImageForScam } from "./scamDetectionClient.js";

// Higher = more serious. "error" outranks "safe": an unchecked image is not proof of safety.
const STATUS_RANK = {
  not_checked: 0,
  pending: 0,
  safe: 1,
  error: 2,
  suspicious: 3,
  flagged: 4,
};

const rank = (analysis) => STATUS_RANK[analysis?.status] ?? 0;

/**
 * Merge the caption (text) result with the image (OCR) result.
 * The more serious status wins; tactics from both are kept.
 */
export const combineScamAnalyses = (textAnalysis, imageAnalysis) => {
  const text = textAnalysis || { status: "not_checked" };
  const image = imageAnalysis || { status: "not_checked" };

  if (text.status === "not_checked") return image;
  if (image.status === "not_checked") return text;

  const worse = rank(image) > rank(text) ? image : text;
  const tactics = [
    ...new Set([...(text.tactics || []), ...(image.tactics || [])]),
  ];

  return {
    status: worse.status,
    isScam: Boolean(text.isScam || image.isScam),
    score: worse.score ?? null,
    tactics,
    analyzedAt: image.analyzedAt || text.analyzedAt || new Date(),
  };
};

/**
 * OCR + classify a recruiter's image after the message was already delivered,
 * then save the merged result on the message and push it to open chats.
 * Runs in-process; a restart before it finishes leaves the message "pending".
 */
export const scanImageAttachmentInBackground = async ({
  messageId,
  conversationId,
  conversation,
  file,
  textAnalysis,
  formatMessage,
}) => {
  try {
    const imageAnalysis = await analyzeImageForScam(file?.buffer, {
      mimeType: file?.mimetype,
      fileName: file?.originalname,
    });
    const scamAnalysis = combineScamAnalyses(textAnalysis, imageAnalysis);

    const updated = await Message.findOneAndUpdate(
      { _id: messageId, deletedForEveryone: { $ne: true } },
      { $set: { scamAnalysis } },
      { new: true }
    );
    if (!updated) return null;

    emitMessageUpdated(conversationId, formatMessage(updated), conversation);
    return updated;
  } catch (error) {
    console.error("Background image scam scan failed:", error.message);
    return null;
  }
};
