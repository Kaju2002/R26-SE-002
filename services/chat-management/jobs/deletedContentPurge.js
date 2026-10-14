/**
 * Retention for "Delete for everyone" messages.
 *
 * Deleted content is kept so moderators can review scam reports. After
 * DELETED_MESSAGE_RETENTION_DAYS (default 90) it is wiped, unless the message
 * is part of a chat report's evidence pack.
 */

import Message from "../model/messageModel.js";
import ChatReport from "../model/chatReportModel.js";
import { deleteUploadedAttachment } from "../utils/chatImageUpload.js";

const MS_DAY = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 200;

const getRetentionDays = () => {
  const days = Number(process.env.DELETED_MESSAGE_RETENTION_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 90;
};

const resourceTypeFor = (messageType) =>
  messageType === "audio" ? "video" : messageType === "file" ? "raw" : "image";

export const runDeletedContentPurge = async ({ now = new Date() } = {}) => {
  const cutoff = new Date(now.getTime() - getRetentionDays() * MS_DAY);
  const candidates = await Message.find({
    deletedForEveryone: true,
    deletedAt: { $lte: cutoff },
    contentPurgedAt: null,
    retainedForReport: { $ne: true },
  }).limit(BATCH_SIZE);

  if (!candidates.length) return { checked: 0, purged: 0, keptForReports: 0 };

  const ids = candidates.map((message) => String(message._id));
  const reported = new Set(
    (
      await ChatReport.distinct("evidenceMessages.messageId", {
        "evidenceMessages.messageId": { $in: ids },
      })
    ).map(String)
  );

  const toPurge = candidates.filter((message) => !reported.has(String(message._id)));
  for (const message of toPurge) {
    for (const attachment of message.attachments || []) {
      await deleteUploadedAttachment(
        attachment.publicId,
        resourceTypeFor(message.messageType)
      );
    }
  }

  if (toPurge.length) {
    await Message.updateMany(
      { _id: { $in: toPurge.map((message) => message._id) } },
      {
        $set: {
          body: "",
          attachments: [],
          scamAnalysis: {
            status: "not_checked",
            isScam: false,
            score: null,
            tactics: [],
            analyzedAt: null,
          },
          contentPurgedAt: now,
        },
      }
    );
  }

  // Marked so they are not re-checked on every pass.
  const kept = candidates.filter((message) => reported.has(String(message._id)));
  if (kept.length) {
    await Message.updateMany(
      { _id: { $in: kept.map((message) => message._id) } },
      { $set: { retainedForReport: true } }
    );
  }

  return {
    checked: candidates.length,
    purged: toPurge.length,
    keptForReports: kept.length,
  };
};

let timer = null;

export const startDeletedContentPurge = () => {
  const enabled =
    String(process.env.DELETED_CONTENT_PURGE_ENABLED || "true").toLowerCase() !== "false";
  if (!enabled) {
    console.log("[deleted-content-purge] Disabled");
    return;
  }

  const tick = async () => {
    try {
      const summary = await runDeletedContentPurge();
      if (summary.purged || summary.keptForReports) {
        console.log(
          `[deleted-content-purge] purged=${summary.purged} keptForReports=${summary.keptForReports}`
        );
      }
    } catch (error) {
      console.error("[deleted-content-purge] Pass failed:", error.message);
    }
  };

  setTimeout(() => {
    void tick();
    timer = setInterval(() => void tick(), MS_DAY / 4);
  }, 60_000);

  console.log(
    `[deleted-content-purge] Started (retention ${getRetentionDays()} days, every 6h)`
  );
};

export const stopDeletedContentPurge = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
