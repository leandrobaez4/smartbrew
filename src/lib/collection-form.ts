import { z } from 'zod';

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).transform((value) => value || null);

export const collectionFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Ingresá un slug.')
    .max(100, 'El slug no puede superar los 100 caracteres.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Usá minúsculas, números y guiones simples.'),
  title: z.string().trim().min(1, 'Ingresá un título.').max(160, 'El título no puede superar los 160 caracteres.'),
  description: optionalText(5000),
  seoTitle: optionalText(70),
  seoDescription: optionalText(180),
  image: optionalText(2000),
  published: z.boolean(),
});

export type CollectionFormInput = z.infer<typeof collectionFormSchema>;

export function parseCollectionFormData(formData: FormData) {
  return collectionFormSchema.safeParse({
    slug: formData.get('slug'),
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    seoTitle: formData.get('seoTitle') ?? '',
    seoDescription: formData.get('seoDescription') ?? '',
    image: formData.get('image') ?? '',
    published: formData.get('published') === 'on',
  });
}

