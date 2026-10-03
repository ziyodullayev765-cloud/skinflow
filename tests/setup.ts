import "@testing-library/jest-dom/vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:5432/skinflow_test";
process.env.DATABASE_SSL = "false";
process.env.SESSION_SECRET = "test-session-secret-0123456789-abcdefghijklmnop";
process.env.TELEGRAM_BOT_TOKEN = "123456:TEST-PLAYER-BOT-TOKEN";
process.env.ADMIN_TELEGRAM_BOT_TOKEN = "654321:TEST-ADMIN-BOT-TOKEN";
process.env.ADMIN_TELEGRAM_IDS = "777000111";
process.env.ADMIN_USERNAME = "owner";
process.env.ADMIN_PASSWORD = "owner-password-123";
process.env.ALLOW_GUEST_LOGIN = "true";
process.env.RATE_LIMITS_ENABLED = "false";
process.env.UPLOAD_DIR = "/tmp/skinflow-test-uploads";

if (typeof window !== "undefined") {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList);
}
