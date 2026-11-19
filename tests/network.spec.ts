import { expect, test } from "@playwright/test";

test("shows routed circuit failure and restoration on the operations map", async ({
  page,
}, info) => {
  const start = new Date("2026-01-12T09:00:00Z");
  await page.clock.setFixedTime(start);
  await page.goto("./");
  const route = page
    .locator(".ops-map path title")
    .filter({ hasText: /^link-tpa-fra ·/ });
  await expect(route).toContainText("Healthy · link-tpa-fra");
  await page.clock.setFixedTime(new Date(+start + 45 * 60000));
  await expect(route).toContainText("Degraded · link-tpa-fra-backup");
  await expect(page.locator(".queue")).toContainText("traffic transferred");
  await page.screenshot({ path: info.outputPath("circuit-failover.png") });
  await page.clock.setFixedTime(new Date(+start + 55 * 60000));
  await expect(route).toContainText("Healthy · link-tpa-fra");
  await expect(page.locator(".queue")).not.toContainText("traffic transferred");
});
