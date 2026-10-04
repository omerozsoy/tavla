import { expect, it } from 'vitest'
import { safeHref } from './safeHref'

it('allows http(s), mailto, tel and relative links', () => {
  for (const ok of ['https://x.com/a', 'http://x.com', 'mailto:a@b.c', 'tel:+90555', '/turnuva/3', '#top', '?q=1', '//cdn.x/a']) {
    expect(safeHref(ok)).toBe(ok)
  }
})

it('rejects script-capable schemes, including obfuscated ones', () => {
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>', 'vbscript:x']) {
    expect(safeHref(bad)).toBeUndefined()
  }
  expect(safeHref('')).toBeUndefined()
  expect(safeHref(null)).toBeUndefined()
})
