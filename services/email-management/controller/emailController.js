import jwt from "jsonwebtoken";
import { getApplicationForSender } from "../config/jobManagementClient.js";
import {
  buildOAuthUrl,
  exchangeCodeForToken,
  getMessage as fetchNylasMessage,
  getNylasConfig,
  listFolders as fetchNylasFolders,
  listMessages as fetchNylasMessages,
  revokeGrant,
  sendMessage,
} from "../config/nylas.js";
import {
  clearNylasGrant,
  getNylasGrant,
  saveNylasGrant,
} from "../config/userManagementClient.js";

const STATE_SECRET = () =>
  process.env.NYLAS_STATE_SECRET ||
  process.env.JWT_SECRET ||
  process.env.NYLAS_API_KEY ||
  "fraudaware-nylas-state";

const EMPLOYER_TYPES = new Set(["recruiter", "company"]);

const FOLDER_KEYS = ["inbox", "sent", "drafts", "spam", "trash"];

const normalizeFolderKey = (folder) => {
  const name = String(folder?.name || folder?.display_name || "")
    .trim()
    .toLowerCase();
  const attributes = [
    ...(Array.isArray(folder?.attributes) ? folder.attributes : []),
    ...(Array.isArray(folder?.system_folder) ? [folder.system_folder] : []),
  ]
    .map((value) => String(value).toLowerCase())
    .join(" ");

  const haystack = `${name} ${attributes}`;
  if (/\binbox\b/.test(haystack)) return "inbox";
  if (/\bsent\b/.test(haystack) || haystack.includes("sent mail")) return "sent";
  if (/\bdraft/.test(haystack)) return "drafts";
  if (/\bspam\b|\bjunk\b/.test(haystack)) return "spam";
  if (/\btrash\b|\bbin\b|\bdeleted\b/.test(haystack)) return "trash";
  return null;
};

const formatParticipant = (participant) => {
  if (!participant) return null;
  if (typeof participant === "string") {
    return { email: participant, name: null };
  }
  return {
    email: participant.email || null,
    name: participant.name || null,
  };
};

const formatParticipants = (list) =>
  (Array.isArray(list) ? list : []).map(formatParticipant).filter(Boolean);

const formatAttachment = (attachment) => ({
  id: attachment.id || attachment.attachment_id || null,
  filename: attachment.filename || attachment.name || "attachment",
  contentType: attachment.content_type || attachment.contentType || null,
  size: attachment.size ?? null,
});

const formatMessageSummary = (message) => {
  const from = formatParticipants(message.from);
  return {
    id: message.id,
    subject: message.subject || "(No subject)",
    snippet: message.snippet || "",
    from,
    to: formatParticipants(message.to),
    date: message.date ?? null,
    unread: Boolean(message.unread),
    starred: Boolean(message.starred),
    hasAttachments: Boolean(
      message.attachments?.length || message.has_attachments
    ),
  };
};

const formatMessageDetail = (message) => ({
  ...formatMessageSummary(message),
  body: message.body || message.snippet || "",
  cc: formatParticipants(message.cc),
  bcc: formatParticipants(message.bcc),
  folders: Array.isArray(message.folders) ? message.folders : [],
  attachments: (Array.isArray(message.attachments) ? message.attachments : []).map(
    formatAttachment
  ),
});

const requireConnectedGrant = async (authorizationHeader) => {
  const grant = await getNylasGrant(authorizationHeader);
  if (!grant.ok) {
    return { ok: false, status: grant.status, message: grant.message };
  }
  if (!grant.connected || !grant.grantId) {
    return {
      ok: false,
      status: 400,
      message: "Mailbox not connected. Connect Gmail or Outlook first.",
    };
  }
  return { ok: true, grant };
};

const signState = ({ userId, returnTo, provider }) =>
  jwt.sign(
    {
      userId: String(userId),
      returnTo: returnTo || null,
      provider: provider || "google",
    },
    STATE_SECRET(),
    { expiresIn: "15m" }
  );

const verifyState = (state) => {
  try {
    return { ok: true, payload: jwt.verify(state, STATE_SECRET()) };
  } catch {
    return { ok: false, message: "Invalid or expired OAuth state" };
  }
};

export const getStatus = async (req, res) => {
  try {
    const grant = await getNylasGrant(req.authorizationHeader);
    if (!grant.ok) {
      return res.status(grant.status).json({
        success: false,
        message: grant.message,
      });
    }

    return res.status(200).json({
      success: true,
      connected: grant.connected,
      email: grant.email,
      connectedAt: grant.connectedAt,
    });
  } catch (error) {
    console.error("Email status error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching email status",
      error: error.message,
    });
  }
};

export const connect = async (req, res) => {
  try {
    if (!EMPLOYER_TYPES.has(req.user.accountType)) {
      return res.status(403).json({
        success: false,
        message: "Only recruiters and companies can connect a mailbox",
      });
    }

    const provider =
      String(req.query.provider || "google").toLowerCase() === "microsoft"
        ? "microsoft"
        : "google";
    const returnTo = String(req.query.returnTo || "").trim() || null;
    const {
      clientId,
      redirectUri: defaultRedirectUri,
      apiUri,
    } = getNylasConfig();
    const redirectUri = returnTo || defaultRedirectUri;

    const state = signState({
      userId: req.userId,
      returnTo: redirectUri,
      provider,
    });

    const authUrl = buildOAuthUrl({
      clientId,
      redirectUri,
      provider,
      loginHint: req.userEmail,
      state,
      apiUri,
    });

    return res.status(200).json({
      success: true,
      authUrl,
      provider,
      redirectUri,
    });
  } catch (error) {
    console.error("Email connect error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not start Nylas OAuth",
    });
  }
};

export const callback = async (req, res) => {
  try {
    const code = String(req.query.code || "").trim();
    const state = String(req.query.state || "").trim();

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required",
      });
    }

    const config = getNylasConfig();
    let redirectUri = config.redirectUri;
    if (state) {
      const verified = verifyState(state);
      if (!verified.ok) {
        return res.status(400).json({
          success: false,
          message: verified.message,
        });
      }
      if (String(verified.payload.userId) !== String(req.userId)) {
        return res.status(403).json({
          success: false,
          message: "OAuth state does not match the signed-in user",
        });
      }
      if (verified.payload.returnTo) {
        redirectUri = verified.payload.returnTo;
      }
    }

    const tokenResponse = await exchangeCodeForToken({
      clientId: config.clientId,
      apiKey: config.apiKey,
      redirectUri,
      code,
      apiUri: config.apiUri,
    });

    const grantId = tokenResponse.grant_id || tokenResponse.grantId;
    const email =
      tokenResponse.email ||
      tokenResponse.grant_info?.email ||
      tokenResponse.grantInfo?.email ||
      req.userEmail;

    if (!grantId) {
      return res.status(502).json({
        success: false,
        message: "Nylas did not return a grant id",
      });
    }

    const saved = await saveNylasGrant(req.authorizationHeader, {
      grantId,
      email,
    });

    if (!saved.ok) {
      return res.status(saved.status).json({
        success: false,
        message: saved.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mailbox connected",
      email,
      connected: true,
    });
  } catch (error) {
    console.error("Email callback error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not complete Nylas OAuth",
    });
  }
};

export const sendEmail = async (req, res) => {
  try {
    const { to, subject, body, applicationId } = req.body ?? {};

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: "to, subject, and body are required",
      });
    }

    if (applicationId) {
      const ownership = await getApplicationForSender(
        req.authorizationHeader,
        applicationId
      );
      if (!ownership.ok) {
        return res.status(ownership.status).json({
          success: false,
          message: ownership.message,
        });
      }

      if (String(ownership.application?.recruiterId) !== String(req.userId)) {
        return res.status(403).json({
          success: false,
          message: "Only the job owner can email this applicant",
        });
      }

      const applicantEmail = ownership.application?.applicantEmail;
      if (
        applicantEmail &&
        String(applicantEmail).toLowerCase() !== String(to).toLowerCase()
      ) {
        return res.status(400).json({
          success: false,
          message: "Recipient email does not match the application",
        });
      }
    }

    const grant = await getNylasGrant(req.authorizationHeader);
    if (!grant.ok) {
      return res.status(grant.status).json({
        success: false,
        message: grant.message,
      });
    }

    if (!grant.connected || !grant.grantId) {
      return res.status(400).json({
        success: false,
        message: "Mailbox not connected. Connect Gmail or Outlook first.",
      });
    }

    const config = getNylasConfig();
    await sendMessage({
      apiKey: config.apiKey,
      apiUri: config.apiUri,
      grantId: grant.grantId,
      to: String(to).trim(),
      subject: String(subject).trim(),
      body: String(body).replace(/\n/g, "<br/>"),
    });

    return res.status(200).json({
      success: true,
      message: "Email sent",
    });
  } catch (error) {
    console.error("Send email error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not send email",
    });
  }
};

export const listFolders = async (req, res) => {
  try {
    const connected = await requireConnectedGrant(req.authorizationHeader);
    if (!connected.ok) {
      return res.status(connected.status).json({
        success: false,
        message: connected.message,
      });
    }

    const config = getNylasConfig();
    const folders = await fetchNylasFolders({
      apiKey: config.apiKey,
      apiUri: config.apiUri,
      grantId: connected.grant.grantId,
    });

    const byKey = new Map();
    for (const folder of folders) {
      const key = normalizeFolderKey(folder);
      if (!key || byKey.has(key)) continue;
      byKey.set(key, {
        key,
        id: folder.id,
        name: folder.name || folder.display_name || key,
        totalCount: folder.total_count ?? folder.totalCount ?? null,
        unreadCount: folder.unread_count ?? folder.unreadCount ?? null,
      });
    }

    const mapped = FOLDER_KEYS.map((key) => {
      const found = byKey.get(key);
      if (found) return found;
      return {
        key,
        id: null,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        totalCount: null,
        unreadCount: null,
      };
    });

    return res.status(200).json({
      success: true,
      folders: mapped,
    });
  } catch (error) {
    console.error("List folders error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not list folders",
    });
  }
};

export const listMessages = async (req, res) => {
  try {
    const connected = await requireConnectedGrant(req.authorizationHeader);
    if (!connected.ok) {
      return res.status(connected.status).json({
        success: false,
        message: connected.message,
      });
    }

    const config = getNylasConfig();
    let folderId = String(req.query.folder || "").trim() || null;
    const folderKey = String(req.query.folderKey || "inbox")
      .trim()
      .toLowerCase();
    const q = String(req.query.q || "").trim();
    const limit = Number(req.query.limit) || 50;
    const pageToken = String(req.query.pageToken || "").trim() || null;

    if (!folderId) {
      const folders = await fetchNylasFolders({
        apiKey: config.apiKey,
        apiUri: config.apiUri,
        grantId: connected.grant.grantId,
      });
      const match = folders.find(
        (folder) => normalizeFolderKey(folder) === folderKey
      );
      folderId = match?.id || null;
    }

    const result = await fetchNylasMessages({
      apiKey: config.apiKey,
      apiUri: config.apiUri,
      grantId: connected.grant.grantId,
      in: folderId || undefined,
      limit,
      searchQueryNative: q || undefined,
      pageToken,
    });

    return res.status(200).json({
      success: true,
      messages: result.messages.map(formatMessageSummary),
      nextCursor: result.nextCursor,
      folderId,
      folderKey,
    });
  } catch (error) {
    console.error("List messages error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not list messages",
    });
  }
};

export const getMessage = async (req, res) => {
  try {
    const connected = await requireConnectedGrant(req.authorizationHeader);
    if (!connected.ok) {
      return res.status(connected.status).json({
        success: false,
        message: connected.message,
      });
    }

    const messageId = String(req.params.messageId || "").trim();
    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "messageId is required",
      });
    }

    const config = getNylasConfig();
    const message = await fetchNylasMessage({
      apiKey: config.apiKey,
      apiUri: config.apiUri,
      grantId: connected.grant.grantId,
      messageId,
    });

    return res.status(200).json({
      success: true,
      message: formatMessageDetail(message),
    });
  } catch (error) {
    console.error("Get message error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not fetch message",
    });
  }
};

export const disconnect = async (req, res) => {
  try {
    const grant = await getNylasGrant(req.authorizationHeader);
    if (grant.ok && grant.grantId) {
      try {
        const config = getNylasConfig();
        await revokeGrant({
          apiKey: config.apiKey,
          apiUri: config.apiUri,
          grantId: grant.grantId,
        });
      } catch (error) {
        console.warn("Nylas grant revoke warning:", error.message);
      }
    }

    const cleared = await clearNylasGrant(req.authorizationHeader);
    if (!cleared.ok) {
      return res.status(cleared.status).json({
        success: false,
        message: cleared.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Mailbox disconnected",
    });
  } catch (error) {
    console.error("Disconnect email error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not disconnect mailbox",
    });
  }
};
