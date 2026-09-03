import {
  CopyGenerationInput,
  CopyGenerator,
  GeneratedCopy,
  MarketplaceClient,
  MarketplaceProduct,
  MediaStorage,
  PublishReelInput,
  PublishResult,
  PublishingStatus,
  PutFileInput,
  SearchProductsInput,
  SocialPublisher
} from "./types";

export class FakeMarketplaceClient implements MarketplaceClient {
  async searchProducts(input: SearchProductsInput): Promise<MarketplaceProduct[]> {
    return [
      {
        externalId: "FAKE12345",
        title: "Cámara De Seguridad Inteligente Wi-fi 1080p Fake",
        categoryId: "MLA123",
        price: 45000,
        currencyId: "ARS",
        originalPermalink: "https://articulo.mercadolibre.com.ar/MLA-FAKE12345-camara",
        primaryImageUrl: "https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg",
        attributesJson: { brand: "FakeBrand", color: "White" },
        sellerId: "987654321",
        sellerReputation: "gold",
        isAvailable: true,
      },
    ];
  }

  async getProduct(externalId: string): Promise<MarketplaceProduct> {
    return {
      externalId,
      title: "Cámara De Seguridad Inteligente Wi-fi 1080p Fake",
      categoryId: "MLA123",
      price: 45000,
      currencyId: "ARS",
      originalPermalink: `https://articulo.mercadolibre.com.ar/MLA-${externalId}-camara`,
      primaryImageUrl: "https://http2.mlstatic.com/D_NQ_NP_12345-MLA_01_2024-O.jpg",
      attributesJson: { brand: "FakeBrand", color: "White" },
      sellerId: "987654321",
      sellerReputation: "gold",
      isAvailable: true,
    };
  }
}

export class FakeCopyGenerator implements CopyGenerator {
  async generate(input: CopyGenerationInput): Promise<GeneratedCopy> {
    return {
      hook: "¿Querés vigilar tu casa desde el celular sin pagar de más?",
      benefits: [
        "Resolución Full HD 1080p con visión nocturna clara",
        "Detección de movimiento con alertas al celular",
        "Se instala en 5 minutos sin cables extra",
      ],
      caption: "Esta cámara inteligente es todo lo que necesitás para estar tranquilo. Conectala al Wi-Fi, bajá la app y listo. Podés ver todo en vivo desde cualquier lado. ¡Aprovechá antes de que suba de precio! Mirá más detalles en el enlace.",
      cta: "Producto en el link de la bio",
      hashtags: ["#HogarInteligente", "#Seguridad", "#Domotica"],
      disclaimer: "Podemos recibir una comisión si comprás a través de nuestro enlace, sin costo adicional para vos.",
    };
  }
}

export class FakeMediaStorage implements MediaStorage {
  async putPublicFile(input: PutFileInput): Promise<{ publicUrl: string }> {
    // In fake mode, we return a mock public URL or local route
    return {
      publicUrl: `http://localhost:3000/media/${input.key}`,
    };
  }

  async deleteFile(key: string): Promise<void> {
    // Fake deletion
  }
}

export class FakeSocialPublisher implements SocialPublisher {
  private inMemoryStatus = new Map<string, PublishingStatus>();

  async publishReel(input: PublishReelInput): Promise<PublishResult> {
    const containerId = `fake_container_${Date.now()}`;
    
    // Simulate async processing
    this.inMemoryStatus.set(containerId, { status: "IN_PROGRESS" });
    
    setTimeout(() => {
      this.inMemoryStatus.set(containerId, {
        status: "FINISHED",
        externalMediaId: `fake_media_${Date.now()}`,
        externalPermalink: `https://instagram.com/p/fake_${Date.now()}`,
      });
    }, 2000); // 2 seconds to process

    return { externalContainerId: containerId };
  }

  async getPublishingStatus(externalContainerId: string): Promise<PublishingStatus> {
    const status = this.inMemoryStatus.get(externalContainerId);
    if (!status) {
      return { status: "ERROR", errorMessage: "Container not found" };
    }
    return status;
  }
}
