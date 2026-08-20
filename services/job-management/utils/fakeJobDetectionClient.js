const DEFAULT_BASE_URL = "http://127.0.0.1:8003";

const getBaseUrl = () =>
  process.env.FAKE_JOB_API_BASE_URL?.trim().replace(/\/$/, "") || DEFAULT_BASE_URL;

const toRiskResult = (partial = {}) => ({
  prediction: String(partial.prediction || "error").toLowerCase(),
  fakeProbability:
    typeof partial.fakeProbability === "number" ? partial.fakeProbability : null,
  legitimateProbability:
    typeof partial.legitimateProbability === "number"
      ? partial.legitimateProbability
      : null,
  confidence: typeof partial.confidence === "number" ? partial.confidence : null,
  message: String(partial.message || "Fake-job check failed."),
  checkedAt: new Date(),
});

/**
 * Classify job-post text via fake-job-detection POST /predict-text.
 * Never throws — on outage returns prediction "error" so the listing is held.
 */
export const classifyJobPostText = async (text) => {
  const truncated = String(text || "").trim();
  if (truncated.length < 15) {
    return toRiskResult({
      prediction: "error",
      message: "Not enough job text to run fake-job detection.",
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${getBaseUrl()}/predict-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: truncated.slice(0, 8000) }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const detail = data.detail || data.message || `HTTP ${response.status}`;
      console.error("Fake-job classify failed:", detail);
      return toRiskResult({
        prediction: "error",
        message: `Fake-job detection unavailable (${detail}). Held for admin review.`,
      });
    }

    return toRiskResult({
      prediction: data.prediction,
      fakeProbability:
        typeof data.fake_probability === "number" ? data.fake_probability : null,
      legitimateProbability:
        typeof data.legitimate_probability === "number"
          ? data.legitimate_probability
          : null,
      confidence: typeof data.confidence === "number" ? data.confidence : null,
      message: data.message,
    });
  } catch (error) {
    console.error("Fake-job client error:", error.message);
    return toRiskResult({
      prediction: "error",
      message: "Fake-job detection could not be reached. Held for admin review.",
    });
  }
};
