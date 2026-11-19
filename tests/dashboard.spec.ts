import { expect, test } from "@playwright/test";

test("inspects a chart, switches maps and investigates a live incident", async ({
  page,
}, info) => {
  const start = new Date("2026-01-12T09:00:00Z");
  await page.clock.setFixedTime(start);
  await page.goto("./");
  await page.getByRole("button", { name: /Infrastructure health/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText(/weight .* pts/).first()).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  const slider = page.getByRole("slider", {
    name: "Inspect Enterprise health trend",
  });
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("1");
  const chart = page.getByRole("region", {
    name: "Enterprise health trend",
    exact: true,
  });
  await chart.getByRole("button", { name: "Expand chart" }).click();
  await expect(
    chart.getByRole("button", { name: "Reduce chart" }),
  ).toHaveAttribute("aria-expanded", "true");
  await chart.getByRole("button", { name: "Reduce chart" }).click();
  await page.getByRole("button", { name: "Dependencies" }).click();
  await expect(page.getByText("Depends on", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Geographic" }).click();
  await page.clock.setFixedTime(new Date(start.getTime() + 27 * 60000));
  const incident = page.locator(".queue button").first();
  await expect(incident).toContainText("critical");
  await page.screenshot({
    path: info.outputPath("command-center-critical.png"),
  });
  await incident.click();
  await expect(
    drawer.getByText(/Queue saturation delaying requests/).first(),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Acknowledge alert" }).click();
  await expect(
    drawer.getByRole("button", { name: "Acknowledged" }),
  ).toBeDisabled();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(incident).toContainText("Acknowledged");
});
