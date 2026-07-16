import PushToken from "../model/pushTokenModel.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const isExpoPushToken = (token) =>
  typeof token === "string" &&
  (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));

/**
 * Send Expo push notifications to all registered devices for a user.
 * Removes tokens Expo reports as DeviceNotRegistered.
 */
export const sendExpoPushToUser = async (userId, { title, body, data = {} }) => {
  const devices = await PushToken.find({ userId: String(userId) }).lean();
  const tokens = devices
    .map((device) => device.token)
    .filter(isExpoPushToken);

  if (tokens.length === 0) {
    return { sent: 0, skipped: true, reason: "no-tokens" };
  }

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title,
    body,
    data,
    priority: "high",
    channelId: data?.flagged ? "scam-alerts" : "chat-messages",
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Expo push HTTP error:", response.status, payload);
      return { sent: 0, error: true, status: response.status };
    }

    const tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
    const staleTokens = [];

    tickets.forEach((ticket, index) => {
      if (!ticket) return;
      if (ticket.status === "error") {
        console.warn("Expo push ticket error:", ticket.message, ticket.details);
        if (ticket.details?.error === "DeviceNotRegistered") {
          staleTokens.push(tokens[index]);
        }
      }
    });

    if (staleTokens.length > 0) {
      await PushToken.deleteMany({ token: { $in: staleTokens } });
    }

    return {
      sent: tokens.length - staleTokens.length,
      removed: staleTokens.length,
    };
  } catch (error) {
    console.error("Expo push send failed:", error.message);
    return { sent: 0, error: true, message: error.message };
  }
};
