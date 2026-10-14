import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeImageForScam,
  analyzeMessageForScam,
  toScamAnalysis,
} from "../../utils/scamDetectionClient.js";

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe("toScamAnalysis", () => {
  it("maps SCAM DETECTED to flagged", () => {
    const result = toScamAnalysis({
      is_scam: true,
      confidence: 92,
      label: "SCAM DETECTED",
      tactics: [{ key: "payment_request", name: "Payment Request" }],
    });
    expect(result.status).toBe("flagged");
    expect(result.isScam).toBe(true);
    expect(result.score).toBeCloseTo(0.92);
    expect(result.tactics).toEqual(["payment_request"]);
  });

  it("maps SUSPICIOUS to suspicious", () => {
    const result = toScamAnalysis({
      is_scam: false,
      inconclusive: true,
      confidence: 61,
      label: "SUSPICIOUS",
      tactics: [],
    });
    expect(result.status).toBe("suspicious");
    expect(result.isScam).toBe(false);
  });

  it("maps LEGITIMATE to safe", () => {
    const result = toScamAnalysis({
      is_scam: false,
      inconclusive: false,
      confidence: 95,
      label: "LEGITIMATE",
      tactics: [],
    });
    expect(result.status).toBe("safe");
  });
});

describe("scam-detection HTTP calls", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.SCAM_DETECTION_BASE_URL = "http://scam.test";
    process.env.INTERNAL_SERVICE_KEY = "test-internal-key";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.SCAM_DETECTION_BASE_URL;
    delete process.env.INTERNAL_SERVICE_KEY;
  });

  it("sends the internal key and no user id to /classify", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { is_scam: false, label: "SUSPICIOUS", inconclusive: true, confidence: 55, tactics: [] })
    );

    const result = await analyzeMessageForScam("Send your bank details today");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://scam.test/classify");
    expect(init.headers["x-internal-service-key"]).toBe("test-internal-key");
    expect(JSON.parse(init.body)).toEqual({ text: "Send your bank details today" });
    expect(result.status).toBe("suspicious");
  });

  it("returns error when the service rejects the call", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "Invalid internal service key." }));
    const result = await analyzeMessageForScam("Hello");
    expect(result.status).toBe("error");
  });

  it("returns error without calling the service when the key is missing", async () => {
    delete process.env.INTERNAL_SERVICE_KEY;
    const result = await analyzeMessageForScam("Hello");
    expect(result.status).toBe("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads image bytes to /classify-image", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { is_scam: true, label: "SCAM DETECTED", confidence: 90, tactics: [{ key: "urgency" }] })
    );

    const result = await analyzeImageForScam(Buffer.from([0xff, 0xd8, 0xff]), {
      mimeType: "image/jpeg",
      fileName: "offer.jpg",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://scam.test/classify-image");
    expect(init.headers["x-internal-service-key"]).toBe("test-internal-key");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get("file")).toBeTruthy();
    expect(result.status).toBe("flagged");
    expect(result.tactics).toEqual(["urgency"]);
  });

  it("treats images without readable text as not_checked", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { detail: "No text found in the image." }));
    const result = await analyzeImageForScam(Buffer.from([1, 2, 3]), { mimeType: "image/png" });
    expect(result.status).toBe("not_checked");
  });

  it("returns error when image analysis fails on the server", async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { detail: "Model not loaded" }));
    const result = await analyzeImageForScam(Buffer.from([1, 2, 3]), { mimeType: "image/png" });
    expect(result.status).toBe("error");
  });
});
