import { test, expect } from "@playwright/test";
import en from "../src/i18n/locales/en/translation.json" with { type: "json" };
import de from "../src/i18n/locales/de/translation.json" with { type: "json" };

const cases = [
  {
    name: "ydotool recovery guidance in English",
    language: "en",
    payload: { error_type: "ydotool_non_ascii" },
    description: en.errors.ydotoolNonAscii,
  },
  {
    name: "ydotool recovery guidance in German",
    language: "de",
    payload: { error_type: "ydotool_non_ascii" },
    description: de.errors.ydotoolNonAscii,
  },
  {
    name: "generic paste failure",
    language: "en",
    payload: { error_type: "other" },
    description: en.errors.pasteFailed,
  },
  {
    name: "legacy paste failure without a payload",
    language: "en",
    payload: null,
    description: en.errors.pasteFailed,
  },
];

for (const { name, language, payload, description } of cases) {
  test(name, async ({ page }) => {
    await page.route("http://localhost:1420/", async (route) => {
      const response = await route.fetch();
      const html = await response.text();
      await route.fulfill({
        response,
        body: html.replace(
          '<script type="module" src="/src/main.tsx"></script>',
          `<script type="module">
            import { mockIPC } from "/node_modules/@tauri-apps/api/mocks.js";
            window.__TAURI_OS_PLUGIN_INTERNALS__ = { platform: "linux", os_type: "linux" };
            mockIPC((cmd) => cmd === "get_app_settings"
              ? { app_language: ${JSON.stringify(language)}, onboarding_completed: false }
              : [], { shouldMockEvents: true });
            await import("/src/main.tsx");
          </script>`,
        ),
      });
    });
    await page.goto("/");
    await expect(page.locator("#root")).not.toBeEmpty();
    await page.evaluate(async (error) => {
      const modulePath = "/node_modules/@tauri-apps/api/event.js";
      const { emit } = await import(modulePath);
      await emit("paste-error", error);
    }, payload);
    await expect(page.getByText(description, { exact: true })).toBeVisible();
  });
}
