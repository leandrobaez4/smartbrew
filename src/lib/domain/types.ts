import { z } from "zod";

export interface MarketplaceProduct {
  externalId: string;
  title: string;
  categoryId: string | null;
  price: number | null;
  currencyId: string | null;
  originalPermalink: string;
  primaryImageUrl: string | null;
  attributesJson: Record<string, any> | null;
  sellerId: string | null;
  sellerReputation: string | null;
  isAvailable: boolean;
  hasFastShipping?: boolean;
  salesCount?: number;
}

export interface SearchProductsInput {
  query?: string;
  categoryId?: string;
  limit?: number;
}

export interface MarketplaceClient {
  searchProducts(input: SearchProductsInput): Promise<MarketplaceProduct[]>;
  getProduct(externalId: string): Promise<MarketplaceProduct>;
}

export const GeneratedCopySchema = z.object({
  hook: z.string().min(10).max(90),
  benefits: z.array(z.string().min(5).max(90)).length(3),
  caption: z.string().min(40).max(1200),
  cta: z.string().min(5).max(100),
  hashtags: z.array(z.string().regex(/^#[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]+$/)).min(3).max(10),
  disclaimer: z.string().min(10).max(240)
});

export type GeneratedCopy = z.infer<typeof GeneratedCopySchema>;

export interface CopyGenerationInput {
  productTitle: string;
  productPrice: number | null;
  productCurrency: string | null;
  productAttributes: Record<string, any> | null;
}

export interface CopyGenerator {
  generate(input: CopyGenerationInput): Promise<GeneratedCopy>;
}

export interface PutFileInput {
  key: string;
  localPath: string;
  mimeType: string;
}

export interface MediaStorage {
  putPublicFile(input: PutFileInput): Promise<{ publicUrl: string }>;
  deleteFile(key: string): Promise<void>;
}

export interface PublishReelInput {
  videoUrl: string;
  caption: string;
}

export interface PublishResult {
  externalContainerId: string;
}

export interface PublishingStatus {
  status: 'IN_PROGRESS' | 'FINISHED' | 'ERROR';
  externalMediaId?: string;
  externalPermalink?: string;
  errorMessage?: string;
}

export interface SocialPublisher {
  publishReel(input: PublishReelInput): Promise<PublishResult>;
  getPublishingStatus(externalContainerId: string): Promise<PublishingStatus>;
}
