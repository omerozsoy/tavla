import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const fail = (message) => {
  console.error(`SEO audit failed: ${message}`)
  process.exitCode = 1
}

const index = read('index.html')
const robots = read('public/robots.txt')
const rootSitemap = read('public/sitemap.xml')
const backendSitemap = read('backend/public/sitemap.xml')

if (/<meta\s+name=["']keywords["']/i.test(index)) {
  fail('index.html still contains obsolete meta keywords')
}

const canonical = index.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1]
if (canonical !== 'https://www.tavlatv.com/') {
  fail(`homepage canonical is ${canonical ?? 'missing'}`)
}

const description = index.match(/<meta\s+name=["']description["'][\s\S]*?content=["']([^"']+)["']/i)?.[1]
if (!description || description.length < 70 || description.length > 170) {
  fail(`homepage description length is ${description?.length ?? 0}; expected 70–170 characters`)
}

const sitemapUrl = robots.match(/^Sitemap:\s*(\S+)\s*$/im)?.[1]
if (sitemapUrl !== 'https://www.tavlatv.com/sitemap.xml') {
  fail(`robots.txt sitemap is ${sitemapUrl ?? 'missing'}`)
}

function sitemapLocs(xml, label) {
  if (!xml.includes('<urlset') || !xml.includes('</urlset>')) {
    fail(`${label} is not a complete urlset`)
  }
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1])
  if (locs.length === 0) fail(`${label} contains no URLs`)
  if (new Set(locs).size !== locs.length) fail(`${label} contains duplicate URLs`)
  for (const loc of locs) {
    if (!/^https:\/\/www\.tavlatv\.com\/[A-Za-z0-9/_-]*$/.test(loc)) {
      fail(`${label} contains an invalid URL: ${loc}`)
    }
  }
  return locs
}

const rootLocs = sitemapLocs(rootSitemap, 'public/sitemap.xml')
const backendLocs = sitemapLocs(backendSitemap, 'backend/public/sitemap.xml')
if (rootLocs.join('\n') !== backendLocs.join('\n')) {
  fail('root and backend sitemaps are out of sync')
}

if (process.exitCode) process.exit()
console.log(`SEO audit passed: ${rootLocs.length} sitemap URLs, canonical and metadata checks OK.`)
