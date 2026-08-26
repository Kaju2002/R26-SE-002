const DEFAULT_BASE_URL = "http://127.0.0.1:8001";
const PREDICT_TIMEOUT_MS = 90000;

const getBaseUrl = () =>
  process.env.EMPLOYER_VERIFICATION_BASE_URL?.trim().replace(/\/$/, "") ||
  DEFAULT_BASE_URL;

/**
 * Call employer-verification POST /predict.
 * Never throws — returns { ok: false } on outage so hybrid flow can queue for admin.
 */
export const predictEmployer = async ({
  companyName,
  websiteUrl,
  email,
} = {}) => {
  const name = String(companyName || "").trim();
  if (name.length < 2) {
    return {
      ok: false,
      error: "Company name required for verification check",
      data: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREDICT_TIMEOUT_MS);

  try {
    const response = await fetch(`${getBaseUrl()}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        company_name: name,
        website_url: String(websiteUrl || "").trim() || undefined,
        email: String(email || "").trim() || undefined,
      }),
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Employer verification returned ${response.status}`,
        data: null,
      };
    }

    return { ok: true, error: null, data };
  } catch (error) {
    const detail =
      error?.name === "AbortError"
        ? "timed out"
        : error?.message || "unavailable";
    return {
      ok: false,
      error: `Employer verification ${detail}`,
      data: null,
    };
  } finally {
    clearTimeout(timer);
  }
};
