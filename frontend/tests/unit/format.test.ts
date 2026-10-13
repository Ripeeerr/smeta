import { describe, expect, test } from 'bun:test'
import { initials, localDate, money, statusLabels } from '../../src/lib/format'

describe('форматирование интерфейса', () => {
  test('денежные суммы сохраняют копейки', () => {
    expect(money('96.35')).toContain('96,35')
    expect(money(96000)).not.toContain(',00')
  })
  test('инициалы используют не более двух частей имени', () => {
    expect(initials('  Алексей  Котов Иванович ')).toBe('АК')
    expect(initials('')).toBe('')
  })
  test('локальная дата не зависит от перевода в UTC', () => {
    expect(localDate(new Date(2026, 10, 14, 0, 15))).toBe('2026-11-14')
  })
  test('все этапы имеют понятные подписи', () => {
    expect(Object.keys(statusLabels)).toHaveLength(8)
    expect(statusLabels.ordered).toBe('В пути')
  })
})
