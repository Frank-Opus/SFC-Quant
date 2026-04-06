import { expect, test } from "@playwright/test";

test("overview stays high-signal instead of embedding dedicated workspaces", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const workspaceSurface = page.locator(".workspace-surface");
  await expect(workspaceSurface.getByTestId("thesis-panel")).toHaveCount(0);
  await expect(workspaceSurface.getByTestId("strategy-factory-panel")).toHaveCount(0);
  await expect(workspaceSurface.getByTestId("section-truth-strip")).toHaveCount(0);
});

test("mobile navigation does not rely on horizontal scrolling", async ({ browser }) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobileContext = page.context();

  await page.goto("/", { waitUntil: "networkidle" });

  const navMetrics = await page.evaluate(() => {
    const nav = document.querySelector(".terminal-nav");
    if (!nav) {
      return null;
    }
    return {
      scrollWidth: nav.scrollWidth,
      clientWidth: nav.clientWidth,
    };
  });

  expect(navMetrics).not.toBeNull();
  expect(navMetrics?.scrollWidth).toBe(navMetrics?.clientWidth);

  await mobileContext.close();
});

test("mobile workflow page does not force horizontal page overflow", async ({ browser }) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const mobileContext = page.context();

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "工作流中枢" }).click();
  await expect(page.getByTestId("workflow-studio")).toBeVisible();

  const pageMetrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
  }));

  expect(pageMetrics.bodyScrollWidth).toBeLessThanOrEqual(pageMetrics.bodyClientWidth + 4);
  expect(pageMetrics.docScrollWidth).toBeLessThanOrEqual(pageMetrics.docClientWidth + 4);

  await mobileContext.close();
});
