import { expect, type Locator, type Page, test } from "@playwright/test";

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

async function clickCircuit(page: Page, circuit: Locator) {
  const wire = circuit.locator("path.net-hit");
  await wire.scrollIntoViewIfNeeded();
  // The center of an SVG path's bounding box is not necessarily on its stroke.
  const point = await wire.evaluate((element: SVGPathElement) => {
    const position = element.getPointAtLength(element.getTotalLength() / 4);
    const transform = element.getScreenCTM();
    if (!transform) throw new Error("Circuit has no screen coordinates");
    const screen = position.matrixTransform(transform);
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.click(point.x, point.y);
}

test("tracks circuit failover across Networking, Infrastructure and Command Center", async ({
  page,
}, info) => {
  const start = new Date("2026-01-12T09:00:00Z");
  await page.clock.setFixedTime(start);
  await page.goto("./#/networking");
  const scene = page.locator("svg.net-scene");
  await expect(scene).toHaveAttribute("viewBox", "0 0 900 340");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(scene).not.toHaveAttribute("viewBox", "0 0 900 340");
  const zoomed = await scene.getAttribute("viewBox");
  await page.getByRole("button", { name: "Pan left" }).click();
  await expect(scene).not.toHaveAttribute("viewBox", zoomed ?? "");
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(scene).toHaveAttribute("viewBox", "0 0 900 340");
  await page
    .getByRole("button", { name: "Inspect VECTOR-09", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "VECTOR-09" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.clock.setFixedTime(new Date(+start + 45 * 60000));
  const primary = page.getByRole("button", {
    name: "Inspect link-tpa-fra",
    exact: true,
  });
  const standby = page.getByRole("button", {
    name: "Inspect link-tpa-fra-backup",
    exact: true,
  });
  await expect(standby.locator("title")).toContainText(
    "Degraded · link-tpa-fra-backup",
  );
  await page.screenshot({ path: info.outputPath("network-topology.png") });
  await primary.focus();
  await expect(primary).toBeFocused();
  await primary.press("Enter");
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Offline", { exact: true })).toBeVisible();
  await expect(
    drawer.getByText("link-tpa-fra-backup", { exact: true }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await clickCircuit(page, primary);
  await expect(drawer).toHaveAccessibleName("link-tpa-fra");
  await drawer.getByRole("button", { name: "Close" }).click();
  await clickCircuit(page, standby);
  await expect(drawer).toHaveAccessibleName("link-tpa-fra-backup");
  await expect(drawer.getByText("650.0 Mbps", { exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Geographic", exact: true }).click();
  await page.screenshot({ path: info.outputPath("network-geographic.png") });
  const tampa = page.getByRole("button", {
    name: "Inspect Tampa",
    exact: true,
  });
  await tampa.locator("circle.node-core").click();
  await expect(drawer).toHaveAccessibleName("Tampa");
  await drawer.getByRole("button", { name: "Close" }).click();
  await tampa.press("Space");
  await expect(drawer.getByText(/America\/New_York/)).toBeVisible();
  await expect(
    drawer.getByText(/link-tpa-fra · Degraded · link-tpa-fra-backup/),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  const sidebar = page.getByRole("navigation", { name: "Sidebar" });
  await sidebar.getByRole("link", { name: "Infrastructure" }).click();
  const orders = page.getByRole("button", { name: /PULSE-23/ });
  await expect(orders).toContainText("Degraded");
  await orders.click();
  const transfer =
    "Primary link-tpa-fra offline; traffic transferred to link-tpa-fra-backup.";
  await expect(
    drawer.getByText(`warning · ${transfer}`, { exact: true }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await sidebar.getByRole("link", { name: "Command Center" }).click();
  await standby.press("Enter");
  await expect(drawer.getByText("650.0 Mbps", { exact: true })).toBeVisible();
  await expect(drawer.getByText("350.0 Mbps", { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date(+start + 55 * 60000));
  await expect(drawer.getByText("link-tpa-fra", { exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await sidebar.getByRole("link", { name: "Infrastructure" }).click();
  // The independent queue episode in Frankfurt also clears by minute 60.
  await page.clock.setFixedTime(new Date(+start + 60 * 60000));
  await expect(orders).toContainText("Healthy");
  await orders.click();
  await expect(drawer.getByText("No active alerts.")).toBeVisible();
});
