import { test, expect } from '@playwright/test'

test.describe('Public status page', () => {
  test('shows overall status banner', async ({ page }) => {
    await page.goto('/status')
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible()
  })
})

test.describe('Admin incidents page', () => {
  test('renders incidents list layout', async ({ page }) => {
    await page.goto('/admin/incidents')
    await expect(page.getByRole('heading', { name: /Incidents/i })).toBeVisible()
  })
})
