import {
  assertHomeWorkspaceAccess,
  formatWorkspace,
  getOrCreateHomeWorkspace,
  WorkspaceAccessError,
} from "../service/employerWorkspaceService.js";

export const listMyWorkspaces = async (req, res) => {
  try {
    const home = await getOrCreateHomeWorkspace(req.user);

    return res.status(200).json({
      success: true,
      message: "Workspaces fetched successfully",
      workspaces: [formatWorkspace(home)],
    });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("List workspaces error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching workspaces",
      error: error.message,
    });
  }
};

export const getMyWorkspace = async (req, res) => {
  try {
    const workspace = await assertHomeWorkspaceAccess(
      req.params.workspaceId,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Workspace fetched successfully",
      workspace: formatWorkspace(workspace),
    });
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Get workspace error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching workspace",
      error: error.message,
    });
  }
};
