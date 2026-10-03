import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const put = vi.fn();
const get = vi.fn();
vi.mock("@vercel/blob", () => ({ put, get }));

describe("blob storage", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    put.mockReset();
    get.mockReset();
    vi.resetModules();
    process.env.VERCEL = "1";
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    delete process.env.BLOB_ACCESS;
  });
  afterAll(() => {
    process.env = saved;
  });

  it("uploads publicly when the store allows it", async () => {
    put.mockResolvedValue({ url: "https://x.public.blob.vercel-storage.com/skins/a/optimized.webp" });
    const { putObject, blobAccessMode } = await import("../server/lib/storage.js");
    const url = await putObject("skins/a/optimized.webp", Buffer.from("x"), "image/webp");
    expect(url).toMatch(/^https:\/\//);
    expect(put.mock.calls[0][2].access).toBe("public");
    expect(blobAccessMode()).toBe("public");
  });

  it("falls back to private access and a proxied URL for private stores", async () => {
    put.mockRejectedValueOnce(new Error("Vercel Blob: Cannot use public access on a private store")).mockResolvedValue({ url: "https://x.private.blob.vercel-storage.com/skins/b/optimized.webp" });
    const { putObject, blobAccessMode } = await import("../server/lib/storage.js");
    const url = await putObject("skins/b/optimized.webp", Buffer.from("x"), "image/webp");
    expect(url).toBe("/api/media/skins/b/optimized.webp");
    expect(put.mock.calls.map((c) => c[2].access)).toEqual(["public", "private"]);
    expect(blobAccessMode()).toBe("private");
    // Subsequent uploads go straight to private.
    await putObject("skins/b/thumb.webp", Buffer.from("x"), "image/webp");
    expect(put.mock.calls[2][2].access).toBe("private");
  });

  it("does not swallow unrelated storage errors", async () => {
    put.mockRejectedValue(new Error("Vercel Blob: Store suspended"));
    const { putObject } = await import("../server/lib/storage.js");
    await expect(putObject("skins/c/x.webp", Buffer.from("x"), "image/webp")).rejects.toThrow(/suspended/);
  });

  it("recognises BLOB_STORE_ID (OIDC) stores and rejects unsafe keys", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_STORE_ID = "store_abc";
    const { storageDriver, isSafeKey } = await import("../server/lib/storage.js");
    expect(storageDriver()).toBe("blob");
    expect(isSafeKey("skins/a/b.webp")).toBe(true);
    expect(isSafeKey("../etc/passwd")).toBe(false);
    expect(isSafeKey("/abs")).toBe(false);
  });
});
