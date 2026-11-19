import { expect, test } from "@playwright/test";

test("serves six screens from a nested path and keeps one session through navigation", async ({
  page,
  context,
  baseURL,
}, info) => {
  const invalid: string[] = [];
  const assets = new Set<string>();
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url === baseURL || url.startsWith(`${baseURL}assets/`)) {
      assets.add(route.request().resourceType());
      await route.continue();
    } else {
      invalid.push(url);
      await route.abort();
    }
  });
  page.on("response", (response) => {
    if (!response.ok()) invalid.push(`${response.status()} ${response.url()}`);
  });
  page.on("pageerror", (error) => invalid.push(error.message));
  page.on("websocket", (socket) => invalid.push(socket.url()));
  const start = new Date("2026-01-12T09:00:00Z");
  await page.clock.setFixedTime(start);
  await page.goto("./");
  const nav = page.getByRole("navigation", { name: "Sidebar" });
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Command Center",
  );
  await expect(page.getByText("Static preview")).toBeVisible();
  const startedAt = await main.locator("time").getAttribute("datetime");
  expect(startedAt).toBeTruthy();
  await page.clock.setFixedTime(new Date(start.getTime() + 61000));
  await expect(main.getByText("00:01:01")).toBeVisible();
  await page.screenshot({ path: info.outputPath("command-center.png") });

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  const expand = page.getByRole("button", { name: "Expand sidebar" });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  for (const [name, slug] of [
    ["Infrastructure", "infrastructure"],
    ["Networking", "networking"],
    ["Security", "security"],
    ["Event Console", "event-console"],
    ["Settings", "settings"],
    ["Command Center", "command-center"],
  ] as const) {
    const link = nav.getByRole("link", { name, exact: true });
    await link.click();
    await expect(page).toHaveURL(`${baseURL}#/${slug}`);
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(main.locator("time")).toHaveAttribute(
      "datetime",
      startedAt ?? "",
    );
    await expect(main.getByText("00:01:01")).toBeVisible();
    await expect(
      page.getByText("Simulation active", { exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByText("AXIOM INDUSTRIES", { exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByText("IdleOps", { exact: true }).last(),
    ).toBeInViewport();
    await expect(expand).toBeVisible();
    expect(await main.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  }
  await page.getByRole("link", { name: "Open settings" }).click();
  await expect(
    main.getByRole("heading", { name: "Workspace preferences" }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("settings-collapsed.png") });
  await expand.click();
  await page.goBack();
  await expect(
    main.getByRole("heading", { name: "Command Center", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    main.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(`${baseURL}#/settings`);
  await expect(
    main.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(main.locator("time")).not.toHaveAttribute(
    "datetime",
    startedAt ?? "",
  );
  await expect(main.getByText("00:00:00")).toBeVisible();
  expect(assets.has("script") && assets.has("stylesheet")).toBe(true);
  expect(invalid).toEqual([]);
});
