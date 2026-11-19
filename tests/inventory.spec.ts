import { expect, test } from "@playwright/test";

test("tracks a resource across inventory, architecture and command center", async ({
  page,
}, info) => {
  const start = new Date("2026-01-12T09:00:00Z");
  await page.clock.setFixedTime(start);
  await page.goto("./#/infrastructure");
  const find = page.getByRole("searchbox", { name: "Find a resource" });
  await find.fill("pulse-15");
  const row = page.getByRole("button", { name: /PULSE-15/ });
  await expect(row).toContainText("Healthy");
  await row.click();
  const drawer = page.getByRole("dialog", { name: "PULSE-15" });
  await expect(
    drawer.getByRole("region", { name: "Resource CPU history" }),
  ).toBeVisible();
  await expect(
    drawer.getByText("Regional service desk", { exact: true }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await page.clock.setFixedTime(new Date(start.getTime() + 27 * 60000));
  await expect(row).toContainText("Critical");
  await find.fill("");
  await page.screenshot({ path: info.outputPath("inventory.png") });
  await page.getByRole("button", { name: "Architecture", exact: true }).click();
  await page.getByLabel("Focus resource").selectOption("res-nyc-desk");
  const node = page.getByRole("button", { name: "PULSE-15 Critical" });
  await expect(node).toBeVisible();
  await node.click();
  await expect(
    drawer.getByText("Service queue above baseline", { exact: false }),
  ).toBeVisible();
  await expect(drawer.getByText("Critical", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("resource-detail.png") });
  await drawer.getByRole("button", { name: "Close" }).click();
  await page
    .getByRole("navigation", { name: "Sidebar" })
    .getByRole("link", { name: "Command Center" })
    .click();
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  await page.getByLabel("Focus resource").selectOption("res-nyc-desk");
  await expect(node).toBeVisible();
  await node.click();
  await expect(
    drawer.getByText("Service queue above baseline", { exact: false }).first(),
  ).toBeVisible();
});
