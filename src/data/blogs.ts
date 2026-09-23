import articleHtml from './tavlada-hamle-secme-rehberi.html?raw'

export interface BlogArticle {
  slug: string
  title: string
  metaDesc: string
  excerpt: string
  bodyHtml: string
}

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: 'tavlada-hamle-secme-rehberi',
    title: 'Tavlada Hamle Seçme Rehberi: Kapı, Kırma ve Kaçış',
    metaDesc:
      'Tavlada hangi taşı oynayacağınıza karar veremiyor musunuz? Kapı almak, rakip taşı kırmak ve gerideki taşları çıkarmak için pratik hamle rehberi.',
    excerpt:
      'Birden fazla yasal hamle arasından seçim yaparken kapı alma, rakip taşı kırma ve gerideki taşları çıkarma fırsatlarını nasıl tartacağınızı öğrenin.',
    bodyHtml: articleHtml,
  },
]

export function findBlogArticle(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((article) => article.slug === slug)
}
