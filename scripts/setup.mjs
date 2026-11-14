import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const path = resolve(root, '.env')
if (existsSync(path)) {
  console.log('Файл .env уже существует. Настройки сохранены.')
} else {
  const template = Object.fromEntries(readFileSync(resolve(root, '.env.example'), 'utf8').split('\n').filter(line => line.includes('=')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)] }))
  const password = randomBytes(24).toString('hex')
  const values = {
    POSTGRES_DB: 'smeta',
    POSTGRES_USER: 'smeta',
    POSTGRES_PASSWORD: password,
    DJANGO_SECRET_KEY: randomBytes(48).toString('hex'),
    DJANGO_DEBUG: '1',
    DJANGO_ALLOWED_HOSTS: 'localhost,127.0.0.1,api',
    CSRF_TRUSTED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
    DATABASE_URL: `postgresql://smeta:${password}@localhost:5433/smeta`,
    E2E_DATABASE_URL: `postgresql://smeta:${password}@localhost:5433/smeta_e2e`,
    DEMO_PASSWORD: randomBytes(16).toString('base64url'),
    DEMO_DIRECTOR_FIRST_NAME: template.DEMO_DIRECTOR_FIRST_NAME,
    DEMO_DIRECTOR_LAST_NAME: template.DEMO_DIRECTOR_LAST_NAME,
  }
  writeFileSync(path, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' })
  console.log('Создан .env с отдельными паролями и ключом приложения. Файл исключён из Git.')
}
