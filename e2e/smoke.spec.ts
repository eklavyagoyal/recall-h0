import { expect, test } from "@playwright/test";

const DEMO_TLC = process.env.DEMO_TLC ?? "PRD-OUTBREAK-0001";

test("console runs a trace and the inspector shows a plan with Index Scan", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("tlc-input").fill(DEMO_TLC);
  await page.getByTestId("trace-button").click();

  const latency = page.getByTestId("latency-badge");
  await expect(latency).toBeVisible();
  await expect
    .poll(async () => {
      const text = (await latency.textContent()) ?? "";
      const match = text.match(/(\d+(?:\.\d+)?)\s*ms/i);
      return match ? Number(match[1]) : Number.NaN;
    })
    .toBeGreaterThan(0);

  await expect(page.getByTestId("store-count")).toContainText(/\d/);

  await page.getByTestId("inspector-toggle").click();
  const plan = page.getByTestId("explain-plan");
  await expect(plan).toBeVisible();
  await expect(plan).toContainText(/Index Scan|Index Only Scan/i);
  await expect(plan).toContainText(/Recursive/i);
});
