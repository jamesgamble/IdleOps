import { expect, test } from "@playwright/test";

test("acknowledges, investigates and restores a simulated circuit through staged maintenance", async ({
  page,
}, info) => {
  const start = new Date("2026-01-12T09:00:00Z");
  const requests: string[] = [];
  page.on("request", (req) => requests.push(req.url()));
  await page.clock.setFixedTime(start);
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Incident queue" }),
  ).toBeVisible();
  await page.clock.setFixedTime(new Date(+start + 45 * 60000));
  await page
    .locator(".queue button")
    .filter({ hasText: "Primary link-tpa-fra offline" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Acknowledge alert" }).click();
  await expect(
    dialog.getByRole("button", { name: "Acknowledged" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Connectivity test" }).click();
  await expect(
    dialog.getByRole("button", { name: "Run maintenance" }),
  ).toBeDisabled();
  await page.clock.setFixedTime(new Date(+start + 45 * 60000 + 15000));
  await expect(dialog.getByRole("status")).toContainText("loss");
  await dialog.getByRole("button", { name: "Run maintenance" }).click();
  await page.clock.setFixedTime(new Date(+start + 45 * 60000 + 20000));
  await expect(dialog.getByRole("status")).toContainText("Draining workload");
  await page.screenshot({ path: info.outputPath("guided-maintenance.png") });
  await page.clock.setFixedTime(new Date(+start + 46 * 60000));
  await expect(
    dialog.getByText("Incident resolved", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.getByText(/^Resolved incidents \(/).click();
  await page
    .getByRole("button", { name: /backup-window-live-circuit/ })
    .click();
  await expect(
    dialog.getByText(/Recovery sequence accelerated/).first(),
  ).toBeVisible();
  expect(
    requests.every((url) => url.startsWith(`${new URL(page.url()).origin}/`)),
  ).toBe(true);
});
