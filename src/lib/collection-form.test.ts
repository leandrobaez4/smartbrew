import { describe, expect, it } from 'vitest';
import { parseCollectionFormData } from './collection-form';

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values = { slug: 'setup-home-office', title: 'Setup home office', ...overrides };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('parseCollectionFormData', () => {
  it('normalizes optional empty fields and reads publication state', () => {
    const data = form();
    data.set('published', 'on');
    const result = parseCollectionFormData(data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        slug: 'setup-home-office',
        title: 'Setup home office',
        description: null,
        seoTitle: null,
        seoDescription: null,
        image: null,
        published: true,
      });
    }
  });

  it('rejects slugs that are not URL-safe', () => {
    const result = parseCollectionFormData(form({ slug: 'Setup Home Office' }));
    expect(result.success).toBe(false);
  });

  it('enforces SEO field limits', () => {
    const result = parseCollectionFormData(form({ seoTitle: 'x'.repeat(71) }));
    expect(result.success).toBe(false);
  });
});

