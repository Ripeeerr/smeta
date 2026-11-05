import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'
import { resolve } from 'node:path'

const env = { ...loadEnv('test', resolve(import.meta.dirname, '..'), ''), ...process.env }
const database = env.E2E_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith('_e2e')) throw new Error('Укажите отдельную E2E_DATABASE_URL с именем базы, заканчивающимся на _e2e')
const sharedEnv: Record<string, string> = {
  DATABASE_URL: database,
  DJANGO_SECRET_KEY: env.DJANGO_SECRET_KEY || '',
  DJANGO_DEBUG: '1',
  DJANGO_ALLOWED_HOSTS: 'localhost,127.0.0.1',
  CSRF_TRUSTED_ORIGINS: 'http://127.0.0.1:5174',
  DEMO_PASSWORD: env.DEMO_PASSWORD || '',
  DEMO_DIRECTOR_FIRST_NAME: env.DEMO_DIRECTOR_FIRST_NAME || 'Руководитель',
  DEMO_DIRECTOR_LAST_NAME: env.DEMO_DIRECTOR_LAST_NAME || '',
}
process.env.DEMO_PASSWORD = sharedEnv.DEMO_PASSWORD
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'uv run --directory ../backend manage.py migrate --noinput && uv run --directory ../backend manage.py seed_demo && uv run --directory ../backend manage.py runserver 127.0.0.1:8001 --noreload', url: 'http://127.0.0.1:8001/api/health/', env: sharedEnv, reuseExistingServer: false, timeout: 120000 },
    { command: 'bun run dev --port 5174', url: 'http://127.0.0.1:5174', env: { API_PROXY_TARGET: 'http://127.0.0.1:8001' }, reuseExistingServer: false },
  ],
})
