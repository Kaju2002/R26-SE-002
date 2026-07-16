import PushToken from "../model/pushTokenModel.js";

export const registerPushToken = async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const platform = String(req.body?.platform || "unknown").trim().toLowerCase();
    const deviceName = String(req.body?.deviceName || "").trim();

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "token is required",
      });
    }

    if (
      !token.startsWith("ExponentPushToken[") &&
      !token.startsWith("ExpoPushToken[")
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Expo push token",
      });
    }

    const safePlatform = ["ios", "android", "web", "unknown"].includes(platform)
      ? platform
      : "unknown";

    const device = await PushToken.findOneAndUpdate(
      { token },
      {
        $set: {
          userId: String(req.userId),
          token,
          platform: safePlatform,
          deviceName,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Push token registered",
      device: {
        id: String(device._id),
        platform: device.platform,
        updatedAt: device.updatedAt,
      },
    });
  } catch (error) {
    console.error("Register push token error:", error);
    return res.status(500).json({
      success: false,
      message: "Error registering push token",
      error: error.message,
    });
  }
};

export const unregisterPushToken = async (req, res) => {
  try {
    const token = String(req.body?.token || req.query?.token || "").trim();

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "token is required",
      });
    }

    await PushToken.deleteOne({
      userId: String(req.userId),
      token,
    });

    return res.status(200).json({
      success: true,
      message: "Push token removed",
    });
  } catch (error) {
    console.error("Unregister push token error:", error);
    return res.status(500).json({
      success: false,
      message: "Error removing push token",
      error: error.message,
    });
  }
};
