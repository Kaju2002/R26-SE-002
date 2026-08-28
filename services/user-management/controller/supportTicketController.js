import SupportTicket, {
  SUPPORT_LINKED_TYPES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from "../model/supportTicketModel.js";
import User from "../model/userModel.js";
import mongoose from "mongoose";
import { publishEvent } from "../utils/publishEvent.js";
import { EVENT_TYPES } from "../constants/eventTypes.js";
import { loadAdminActor } from "../utils/adminActor.js";
import { writeAuditLogForActor } from "../utils/writeAuditLog.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const mapSupportMessage = (message) => {
  const item = message?.toObject ? message.toObject() : message;
  return {
    id: item._id ? String(item._id) : "",
    author: item.author,
    authorName: item.authorName || "",
    body: item.body || "",
    createdAt: toIso(item.createdAt) || new Date().toISOString(),
  };
};

export const mapSupportTicket = (doc) => {
  const item = doc?.toObject ? doc.toObject() : doc;
  return {
    id: String(item._id),
    ticketNumber: item.ticketNumber || "",
    subject: item.subject || "",
    description: item.description || "",
    requesterUserId: item.requesterUserId ? String(item.requesterUserId) : null,
    requesterName: item.requesterName || "",
    requesterEmail: item.requesterEmail || "",
    status: item.status || "open",
    priority: item.priority || "medium",
    assigneeUserId: item.assigneeUserId ? String(item.assigneeUserId) : null,
    assigneeName: item.assigneeName || null,
    assigneeEmail: item.assigneeEmail || null,
    linkedType: item.linkedType || "none",
    linkedId: item.linkedId || null,
    linkedLabel: item.linkedLabel || null,
    internalNote: item.internalNote || null,
    messages: Array.isArray(item.messages)
      ? item.messages.map(mapSupportMessage)
      : [],
    closedAt: toIso(item.closedAt),
    createdAt: toIso(item.createdAt) || new Date().toISOString(),
    updatedAt: toIso(item.updatedAt) || new Date().toISOString(),
  };
};

/** User-facing ticket shape — omits admin-only fields. */
export const mapSupportTicketForUser = (doc) => {
  const item = mapSupportTicket(doc);
  const { internalNote: _internalNote, ...rest } = item;
  return rest;
};

const nextTicketNumber = async () => {
  const [result] = await SupportTicket.aggregate([
    { $match: { ticketNumber: { $regex: /^TKT-\d+$/ } } },
    {
      $project: {
        num: {
          $toInt: {
            $arrayElemAt: [{ $split: ["$ticketNumber", "-"] }, 1],
          },
        },
      },
    },
    { $group: { _id: null, maxNum: { $max: "$num" } } },
  ]);

  const next = (result?.maxNum ?? 0) + 1;
  return `TKT-${String(next).padStart(3, "0")}`;
};

const loadRequester = async (userId) => {
  const user = await User.findById(userId).select(
    "firstName lastName email accountStatus"
  );
  if (!user || user.accountStatus !== "active") return null;

  const name =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.email ||
    "User";

  return {
    userId: user._id,
    name,
    email: user.email || "",
  };
};

const findOwnedTicketOr404 = async (id, userId, res) => {
  if (!isValidObjectId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid ticket id",
    });
    return null;
  }

  const ticket = await SupportTicket.findOne({
    _id: id,
    requesterUserId: userId,
  });

  if (!ticket) {
    res.status(404).json({
      success: false,
      message: "Support ticket not found",
    });
    return null;
  }

  return ticket;
};

const parseLinkedFields = (body) => {
  const linkedType = String(body?.linkedType || "none")
    .trim()
    .toLowerCase();

  if (!SUPPORT_LINKED_TYPES.includes(linkedType)) {
    return {
      error: "linkedType must be user, job, report, or none",
    };
  }

  const linkedId =
    linkedType === "none"
      ? null
      : String(body?.linkedId || "").trim().slice(0, 120) || null;

  const linkedLabel =
    linkedType === "none"
      ? null
      : String(body?.linkedLabel || "").trim().slice(0, 300) || null;

  if (linkedType !== "none" && !linkedId) {
    return { error: "linkedId is required when linkedType is not none" };
  }

  return { linkedType, linkedId, linkedLabel };
};

/**
 * POST /api/support/tickets
 * Body: { subject, description, linkedType?, linkedId?, linkedLabel? }
 */
export const createSupportTicket = async (req, res) => {
  try {
    const requester = await loadRequester(req.userId);
    if (!requester) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const subject = String(req.body?.subject || "").trim();
    const description = String(req.body?.description || "").trim();

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "subject is required",
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "description is required",
      });
    }

    const linked = parseLinkedFields(req.body);
    if (linked.error) {
      return res.status(400).json({
        success: false,
        message: linked.error,
      });
    }

    let ticket = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const ticketNumber = await nextTicketNumber();
      try {
        ticket = await SupportTicket.create({
          ticketNumber,
          subject: subject.slice(0, 200),
          description: description.slice(0, 8000),
          requesterUserId: requester.userId,
          requesterName: requester.name,
          requesterEmail: requester.email,
          status: "open",
          priority: "medium",
          linkedType: linked.linkedType,
          linkedId: linked.linkedId,
          linkedLabel: linked.linkedLabel,
          messages: [
            {
              author: "user",
              authorUserId: requester.userId,
              authorName: requester.name,
              body: description.slice(0, 8000),
            },
          ],
        });
        break;
      } catch (error) {
        if (error?.code === 11000 && attempt < 4) continue;
        throw error;
      }
    }

    if (!ticket) {
      return res.status(500).json({
        success: false,
        message: "Could not create support ticket",
      });
    }

    void publishEvent(EVENT_TYPES.SUPPORT_TICKET_CREATED, {
      ticketId: String(ticket._id),
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      requesterUserId: String(requester.userId),
      requesterName: requester.name,
      requesterEmail: requester.email,
    });

    return res.status(201).json({
      success: true,
      message: "Support ticket created",
      item: mapSupportTicketForUser(ticket),
    });
  } catch (error) {
    console.error("createSupportTicket error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not create support ticket",
      error: error.message,
    });
  }
};

/**
 * GET /api/support/tickets
 * Query: status (open|in_progress|closed), page, limit
 */
export const listMySupportTickets = async (req, res) => {
  try {
    const status = String(req.query.status || "").trim().toLowerCase();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const filter = { requesterUserId: req.userId };
    if (SUPPORT_STATUSES.includes(status)) {
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Support tickets fetched",
      items: items.map(mapSupportTicketForUser),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error("listMySupportTickets error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load support tickets",
      error: error.message,
    });
  }
};

/**
 * GET /api/support/tickets/:id
 */
export const getMySupportTicket = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const ticket = await findOwnedTicketOr404(id, req.userId, res);
    if (!ticket) return;

    return res.status(200).json({
      success: true,
      message: "Support ticket fetched",
      item: mapSupportTicketForUser(ticket),
    });
  } catch (error) {
    console.error("getMySupportTicket error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load support ticket",
      error: error.message,
    });
  }
};

/**
 * POST /api/support/tickets/:id/messages
 * Body: { body: string }
 */
export const addMySupportTicketMessage = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const ticket = await findOwnedTicketOr404(id, req.userId, res);
    if (!ticket) return;

    const body = String(req.body?.body || "").trim();
    if (!body) {
      return res.status(400).json({
        success: false,
        message: "body is required",
      });
    }

    if (ticket.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Ticket is closed. Open a new ticket if you need more help.",
      });
    }

    const requester = await loadRequester(req.userId);
    if (!requester) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    ticket.messages.push({
      author: "user",
      authorUserId: requester.userId,
      authorName: requester.name,
      body: body.slice(0, 8000),
      createdAt: new Date(),
    });

    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Message sent",
      item: mapSupportTicketForUser(ticket),
    });
  } catch (error) {
    console.error("addMySupportTicketMessage error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not send message",
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/support-tickets
 * Query: status (open|in_progress|closed), q, page, limit
 */
export const listSupportTickets = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const filter = {};
    if (SUPPORT_STATUSES.includes(status)) {
      filter.status = status;
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { ticketNumber: regex },
        { subject: regex },
        { description: regex },
        { requesterName: regex },
        { requesterEmail: regex },
        { assigneeName: regex },
        { assigneeEmail: regex },
        { linkedLabel: regex },
        { linkedId: regex },
      ];
    }

    const [items, total, statusCounts] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(filter),
      SupportTicket.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = { total: 0, open: 0, in_progress: 0, closed: 0 };
    for (const row of statusCounts) {
      if (counts[row._id] !== undefined) {
        counts[row._id] = row.count;
      }
    }
    counts.total = counts.open + counts.in_progress + counts.closed;

    return res.status(200).json({
      success: true,
      message: "Support tickets fetched",
      items: items.map(mapSupportTicket),
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error("listSupportTickets error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load support tickets",
      error: error.message,
    });
  }
};

const findTicketOr404 = async (id, res) => {
  if (!isValidObjectId(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid ticket id",
    });
    return null;
  }

  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    res.status(404).json({
      success: false,
      message: "Support ticket not found",
    });
    return null;
  }

  return ticket;
};

/**
 * GET /api/admin/support-tickets/:id
 */
export const getSupportTicket = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const ticket = await findTicketOr404(id, res);
    if (!ticket) return;

    return res.status(200).json({
      success: true,
      message: "Support ticket fetched",
      item: mapSupportTicket(ticket),
    });
  } catch (error) {
    console.error("getSupportTicket error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load support ticket",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/admin/support-tickets/:id
 * Body: { status?, priority?, internalNote? }
 */
export const updateSupportTicket = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const ticket = await findTicketOr404(id, res);
    if (!ticket) return;

    const body = req.body || {};
    const previousStatus = ticket.status;
    let changed = false;

    if (body.status !== undefined) {
      const status = String(body.status).trim().toLowerCase();
      if (!SUPPORT_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "status must be open, in_progress, or closed",
        });
      }
      if (ticket.status !== status) {
        ticket.status = status;
        changed = true;
      }
      if (status === "closed") {
        if (!ticket.closedAt) {
          ticket.closedAt = new Date();
          changed = true;
        }
      } else if (ticket.closedAt) {
        ticket.closedAt = null;
        changed = true;
      }
    }

    if (body.priority !== undefined) {
      const priority = String(body.priority).trim().toLowerCase();
      if (!SUPPORT_PRIORITIES.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "priority must be low, medium, or high",
        });
      }
      if (ticket.priority !== priority) {
        ticket.priority = priority;
        changed = true;
      }
    }

    if (body.internalNote !== undefined) {
      const note =
        body.internalNote === null
          ? null
          : String(body.internalNote).trim().slice(0, 4000) || null;
      if ((ticket.internalNote || null) !== note) {
        ticket.internalNote = note;
        changed = true;
      }
    }

    if (!changed) {
      return res.status(200).json({
        success: true,
        message: "No changes applied",
        item: mapSupportTicket(ticket),
      });
    }

    await ticket.save();

    const actor = await loadAdminActor(req.userId);
    if (actor && body.status !== undefined && previousStatus !== ticket.status) {
      const label = ticket.ticketNumber || String(ticket._id);
      if (ticket.status === "closed") {
        void writeAuditLogForActor(actor, {
          action: "support.ticket.close",
          targetType: "support",
          targetId: String(ticket._id),
          targetLabel: `${label} · ${ticket.subject}`,
          summary: `Closed support ticket ${label}`,
          before: { status: previousStatus },
          after: { status: ticket.status },
        });
      } else if (previousStatus === "closed") {
        void writeAuditLogForActor(actor, {
          action: "support.ticket.reopen",
          targetType: "support",
          targetId: String(ticket._id),
          targetLabel: `${label} · ${ticket.subject}`,
          summary: `Reopened support ticket ${label}`,
          before: { status: previousStatus },
          after: { status: ticket.status },
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Support ticket updated",
      item: mapSupportTicket(ticket),
    });
  } catch (error) {
    console.error("updateSupportTicket error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not update support ticket",
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/support-tickets/:id/assign-me
 */
export const assignSupportTicketToMe = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const ticket = await findTicketOr404(id, res);
    if (!ticket) return;

    const admin = await loadAdminActor(req.userId);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin user not found",
      });
    }

    const previousAssignee = ticket.assigneeName || null;

    ticket.assigneeUserId = admin.userId;
    ticket.assigneeName = admin.name;
    ticket.assigneeEmail = admin.email;

    if (ticket.status === "open") {
      ticket.status = "in_progress";
    }

    if (ticket.status === "closed") {
      ticket.status = "in_progress";
      ticket.closedAt = null;
    }

    await ticket.save();

    const label = ticket.ticketNumber || String(ticket._id);
    void writeAuditLogForActor(admin, {
      action: "support.ticket.assign",
      targetType: "support",
      targetId: String(ticket._id),
      targetLabel: `${label} · ${ticket.subject}`,
      summary: `Assigned support ticket ${label} to ${admin.name}`,
      before: { assigneeName: previousAssignee },
      after: { assigneeName: admin.name },
    });

    return res.status(200).json({
      success: true,
      message: "Ticket assigned to you",
      item: mapSupportTicket(ticket),
    });
  } catch (error) {
    console.error("assignSupportTicketToMe error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not assign support ticket",
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/support-tickets/:id/messages
 * Body: { body: string }
 */
export const addSupportTicketMessage = async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const ticket = await findTicketOr404(id, res);
    if (!ticket) return;

    const body = String(req.body?.body || "").trim();
    if (!body) {
      return res.status(400).json({
        success: false,
        message: "body is required",
      });
    }

    if (ticket.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Ticket is closed. Reopen it before replying.",
      });
    }

    const admin = await loadAdminActor(req.userId);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin user not found",
      });
    }

    ticket.messages.push({
      author: "admin",
      authorUserId: admin.userId,
      authorName: admin.name,
      body: body.slice(0, 8000),
      createdAt: new Date(),
    });

    if (ticket.status === "open") {
      ticket.status = "in_progress";
    }

    if (!ticket.assigneeUserId) {
      ticket.assigneeUserId = admin.userId;
      ticket.assigneeName = admin.name;
      ticket.assigneeEmail = admin.email;
    }

    await ticket.save();

    void publishEvent(EVENT_TYPES.SUPPORT_TICKET_REPLIED, {
      ticketId: String(ticket._id),
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      requesterUserId: ticket.requesterUserId
        ? String(ticket.requesterUserId)
        : null,
      adminName: admin.name,
      replyPreview: body.slice(0, 120),
    });

    const label = ticket.ticketNumber || String(ticket._id);
    void writeAuditLogForActor(admin, {
      action: "support.ticket.reply",
      targetType: "support",
      targetId: String(ticket._id),
      targetLabel: `${label} · ${ticket.subject}`,
      summary: `Replied to support ticket ${label}`,
      before: { status: ticket.status },
      after: { status: ticket.status },
      note: body.slice(0, 200),
    });

    return res.status(200).json({
      success: true,
      message: "Reply sent",
      item: mapSupportTicket(ticket),
    });
  } catch (error) {
    console.error("addSupportTicketMessage error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not send support reply",
      error: error.message,
    });
  }
};
