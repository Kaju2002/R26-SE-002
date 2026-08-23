import EmployerWorkspace from "../model/employerWorkspaceModel.js";

export class WorkspaceAccessError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = "WorkspaceAccessError";
    this.status = status;
  }
}

export const normalizeWorkspaceName = (name) =>
  String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");

export const formatWorkspace = (workspace) => ({
  id: String(workspace._id),
  ownerId: workspace.ownerId,
  name: workspace.name,
  normalizedName: workspace.normalizedName,
  logo: workspace.logo || null,
  status: workspace.status,
  members: (workspace.members || []).map((member) => ({
    userId: member.userId,
    role: member.role,
    status: member.status,
  })),
});

/**
 * Keep workspace branding in sync with company profile logo (and name when provided).
 * Profile uploads update user.company.logo; older workspaces often still have logo=null.
 */
export const syncWorkspaceBrandingFromUser = async (workspace, user) => {
  if (!workspace) return workspace;

  const logo = user?.company?.logo || null;
  const profileName = String(user?.company?.name || "")
    .trim()
    .replace(/\s+/g, " ");

  let dirty = false;

  if (logo && workspace.logo !== logo) {
    workspace.logo = logo;
    dirty = true;
  }

  if (profileName) {
    const normalizedName = normalizeWorkspaceName(profileName);
    if (
      workspace.normalizedName === normalizedName &&
      workspace.name !== profileName
    ) {
      workspace.name = profileName;
      dirty = true;
    }
  }

  if (dirty) await workspace.save();
  return workspace;
};

export const loadWorkspace = async (workspaceId) => {
  const id = String(workspaceId || "").trim();
  if (!id) {
    throw new WorkspaceAccessError("Workspace id is required", 400);
  }

  const workspace = await EmployerWorkspace.findById(id);
  if (!workspace) {
    throw new WorkspaceAccessError("Workspace not found", 404);
  }

  return workspace;
};

export const validateActiveWorkspaceMembership = async (
  workspaceId,
  userId
) => {
  const workspace = await loadWorkspace(workspaceId);
  const activeMember = workspace.members?.some(
    (member) =>
      member.userId === String(userId) && member.status === "active"
  );

  if (workspace.status !== "active" || !activeMember) {
    throw new WorkspaceAccessError(
      "You are not an active member of this workspace",
      403
    );
  }

  return workspace;
};

const listActiveMemberships = async (userId) =>
  EmployerWorkspace.find({
    status: "active",
    members: {
      $elemMatch: {
        userId: String(userId),
        status: "active",
      },
    },
  }).sort({ createdAt: 1 });

/**
 * One login = one company workspace.
 * Company/agency profile name wins; otherwise the oldest membership is used.
 * Never creates extra workspaces from free-typed job company names.
 */
export const getOrCreateHomeWorkspace = async (user) => {
  const userId = String(user?.id || user?._id || "").trim();
  if (!userId) {
    throw new WorkspaceAccessError("Authenticated user id is required", 400);
  }

  const profileName = String(user?.company?.name || "")
    .trim()
    .replace(/\s+/g, " ");
  const logo = user?.company?.logo || null;
  const memberships = await listActiveMemberships(userId);

  if (profileName) {
    const normalizedName = normalizeWorkspaceName(profileName);
    const named = memberships.find(
      (workspace) => workspace.normalizedName === normalizedName
    );
    if (named) {
      return syncWorkspaceBrandingFromUser(named, user);
    }

    return resolveOrCreateEmployerWorkspace({
      userId,
      companyName: profileName,
      logo,
    });
  }

  let home = null;
  if (memberships.length === 1) home = memberships[0];
  else {
    const owned = memberships.filter(
      (workspace) => String(workspace.ownerId) === userId
    );
    if (owned.length) home = owned[0];
    else if (memberships.length) home = memberships[0];
  }

  if (home) {
    return syncWorkspaceBrandingFromUser(home, user);
  }

  throw new WorkspaceAccessError(
    "Set a company or agency name on this account before using the employer dashboard",
    400
  );
};

export const assertHomeWorkspaceAccess = async (workspaceId, user) => {
  const home = await getOrCreateHomeWorkspace(user);
  if (String(home._id) !== String(workspaceId || "").trim()) {
    throw new WorkspaceAccessError(
      "This workspace does not belong to this login",
      403
    );
  }
  return home;
};

export const resolveOrCreateEmployerWorkspace = async ({
  userId,
  companyName,
  logo = null,
}) => {
  const ownerId = String(userId || "").trim();
  const name = String(companyName || "").trim().replace(/\s+/g, " ");
  const normalizedName = normalizeWorkspaceName(name);

  if (!ownerId) {
    throw new WorkspaceAccessError("Authenticated user id is required", 400);
  }
  if (!normalizedName) {
    throw new WorkspaceAccessError("Company name is required", 400);
  }

  const existing = await EmployerWorkspace.findOne({
    ownerId,
    normalizedName,
  });
  if (existing) {
    const ownerMember = existing.members?.find(
      (member) => member.userId === ownerId
    );
    if (
      existing.status !== "active" ||
      !ownerMember ||
      ownerMember.status !== "active"
    ) {
      throw new WorkspaceAccessError(
        "The matching workspace is not active for this user",
        403
      );
    }
    if (logo && existing.logo !== logo) {
      existing.logo = logo;
      await existing.save();
    }
    return existing;
  }

  try {
    return await EmployerWorkspace.create({
      ownerId,
      name,
      normalizedName,
      logo: logo || null,
      members: [{ userId: ownerId, role: "owner", status: "active" }],
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const workspace = await EmployerWorkspace.findOne({
      ownerId,
      normalizedName,
    });
    if (!workspace) throw error;
    return validateActiveWorkspaceMembership(workspace._id, ownerId);
  }
};
