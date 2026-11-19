import { expect, test } from "@playwright/test";

test("inspects shared security records, preserves paused reading and follows the bounded live stream", async ({
  page,
}, info) => {
  const start = new Date("2026-01-12T09:00:00Z");
  await page.clock.setFixedTime(start);
  await page.goto("./#/security");
  await page.clock.setFixedTime(new Date(+start + 27 * 60000 + 10000));
  await expect(page.getByText("Attention", { exact: true })).toBeVisible();
  const message =
    "Service sign-in timed out while the application queue was delayed.";
  await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath("security-activity.png") });
  await page.getByRole("link", { name: "Event Console", exact: true }).click();
  const records = page.getByRole("region", { name: "Log records" });
  await page.getByLabel("Search logs").fill("sign-in");
  await page.getByLabel("Severity", { exact: true }).selectOption("critical");
  await page
    .getByLabel("Resource", { exact: true })
    .selectOption("res-nyc-desk");
  await page.getByLabel("Location", { exact: true }).selectOption("new-york");
  const target = records.getByRole("button").filter({ hasText: message });
  await expect(target).toHaveCount(1);
  await target.click();
  await expect(
    page.getByRole("region", { name: "Event details" }),
  ).toContainText("backup-window-queue-2");
  await page.screenshot({
    path: info.outputPath("event-console-filtered.png"),
  });
  await page.clock.setFixedTime(new Date(+start + 150 * 60000));
  await expect(
    page.getByText("This event has expired from the session journal."),
  ).toBeVisible();
  await expect(page.getByText(/paused records have expired/)).toBeVisible();
  await page.getByRole("button", { name: "Jump to live" }).click();
  await page.getByLabel("Search logs").fill("");
  for (const label of ["Location", "Severity", "Resource"])
    await page.getByLabel(label, { exact: true }).selectOption("");
  await expect(records.getByRole("button")).toHaveCount(500);
  await expect(page.getByText("Following live", { exact: true })).toBeVisible();
  const bottom = () =>
    records.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
  await expect.poll(bottom).toBeLessThan(3);
  await page.screenshot({ path: info.outputPath("event-console-live.png") });
  await records.evaluate((el) => {
    el.scrollTop = el.scrollHeight / 2;
  });
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
  const anchor = () =>
    records.evaluate((el) => {
      const row = Array.from(
        el.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => b.offsetTop + b.offsetHeight > el.scrollTop);
      return [
        row?.dataset.sequence,
        row && Math.round(row.offsetTop - el.scrollTop),
      ];
    });
  const reading = await anchor();
  await page.clock.setFixedTime(new Date(+start + 151 * 60000));
  await expect(page.getByText("02:31:00")).toBeVisible();
  await expect.poll(anchor).toEqual(reading);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(bottom).toBeLessThan(3);
});
