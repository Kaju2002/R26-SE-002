import MessageTemplate, {
  TEMPLATE_CATEGORIES,
} from "../model/messageTemplateModel.js";
import {
  getOrCreateHomeWorkspace,
  WorkspaceAccessError,
} from "../service/employerWorkspaceService.js";

const isValidObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id));

const formatTemplate = (doc) => ({
  id: String(doc._id),
  workspaceId: doc.workspaceId ? String(doc.workspaceId) : null,
  ownerId: doc.ownerId,
  name: doc.name,
  category: doc.category,
  subject: doc.subject || "",
  body: doc.body || "",
  createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
});

const DEFAULT_TEMPLATES = [
  {
    name: "Application received",
    category: "screening",
    subject: "We received your application for {{jobTitle}}",
    body: `Hi {{name}},

Thank you for applying to {{jobTitle}} at {{company}}. We've received your application and our team will review it shortly.

Best regards,
{{company}} Hiring Team`,
  },
  {
    name: "Interview invitation",
    category: "interview_invite",
    subject: "Interview invitation — {{jobTitle}} at {{company}}",
    body: `Hi {{name}},

We'd like to invite you to interview for {{jobTitle}} at {{company}}.

Please reply with your availability, or we will send a calendar invite shortly.

Best regards,
{{company}} Hiring Team`,
  },
  {
    name: "Application update — not moving forward",
    category: "reject",
    subject: "Update on your application for {{jobTitle}}",
    body: `Hi {{name}},

Thank you for your interest in {{jobTitle}} at {{company}} and for the time you invested in the process.

After careful review, we won't be moving forward with your application at this time. We encourage you to apply for future roles that match your experience.

We wish you the best in your search.

Best regards,
{{company}} Hiring Team`,
  },
  {
    name: "Offer — congratulations",
    category: "offer",
    subject: "Offer for {{jobTitle}} at {{company}}",
    body: `Hi {{name}},

Congratulations! We are pleased to offer you the {{jobTitle}} role at {{company}}.

We'll follow up with offer details and next steps shortly. Please reply if you have any questions.

Welcome aboard!

Best regards,
{{company}} Hiring Team`,
  },
];

const ensureDefaults = async (ownerId, workspaceId) => {
  const count = await MessageTemplate.countDocuments({ ownerId });
  if (count > 0) return;

  await MessageTemplate.insertMany(
    DEFAULT_TEMPLATES.map((template) => ({
      ...template,
      ownerId,
      workspaceId,
    }))
  );
};

/** GET /api/jobs/templates */
export const listTemplates = async (req, res) => {
  try {
    const home = await getOrCreateHomeWorkspace(req.user);
    await ensureDefaults(req.userId, String(home._id));

    const filter = { ownerId: req.userId };
    const category = String(req.query.category || "").trim();
    if (category && TEMPLATE_CATEGORIES.includes(category)) {
      filter.category = category;
    }

    const templates = await MessageTemplate.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      templates: templates.map(formatTemplate),
    });
  } catch (error) {
    console.error("List templates error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not list templates",
    });
  }
};

/** GET /api/jobs/templates/:templateId */
export const getTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    if (!isValidObjectId(templateId)) {
      return res.status(400).json({ success: false, message: "Invalid template id" });
    }

    const template = await MessageTemplate.findById(templateId);
    if (!template || template.ownerId !== req.userId) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }

    return res.status(200).json({
      success: true,
      template: formatTemplate(template),
    });
  } catch (error) {
    console.error("Get template error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not get template",
    });
  }
};

/** POST /api/jobs/templates */
export const createTemplate = async (req, res) => {
  try {
    const home = await getOrCreateHomeWorkspace(req.user);
    const name = String(req.body?.name || "").trim();
    const body = String(req.body?.body || "").trim();
    const subject = String(req.body?.subject || "").trim();
    let category = String(req.body?.category || "custom").trim();

    if (!name || !body) {
      return res.status(400).json({
        success: false,
        message: "name and body are required",
      });
    }
    if (!TEMPLATE_CATEGORIES.includes(category)) {
      category = "custom";
    }

    const template = await MessageTemplate.create({
      workspaceId: String(home._id),
      ownerId: req.userId,
      name,
      category,
      subject,
      body,
    });

    return res.status(201).json({
      success: true,
      template: formatTemplate(template),
    });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("Create template error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not create template",
    });
  }
};

/** PATCH /api/jobs/templates/:templateId */
export const updateTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    if (!isValidObjectId(templateId)) {
      return res.status(400).json({ success: false, message: "Invalid template id" });
    }

    const template = await MessageTemplate.findById(templateId);
    if (!template || template.ownerId !== req.userId) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: "name cannot be empty" });
      }
      template.name = name;
    }
    if (req.body?.body !== undefined) {
      const body = String(req.body.body).trim();
      if (!body) {
        return res.status(400).json({ success: false, message: "body cannot be empty" });
      }
      template.body = body;
    }
    if (req.body?.subject !== undefined) {
      template.subject = String(req.body.subject).trim();
    }
    if (req.body?.category !== undefined) {
      const category = String(req.body.category).trim();
      if (TEMPLATE_CATEGORIES.includes(category)) {
        template.category = category;
      }
    }

    await template.save();

    return res.status(200).json({
      success: true,
      template: formatTemplate(template),
    });
  } catch (error) {
    console.error("Update template error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not update template",
    });
  }
};

/** DELETE /api/jobs/templates/:templateId */
export const deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    if (!isValidObjectId(templateId)) {
      return res.status(400).json({ success: false, message: "Invalid template id" });
    }

    const template = await MessageTemplate.findOneAndDelete({
      _id: templateId,
      ownerId: req.userId,
    });

    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }

    return res.status(200).json({ success: true, message: "Template deleted" });
  } catch (error) {
    console.error("Delete template error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Could not delete template",
    });
  }
};
