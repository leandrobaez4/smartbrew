import OpenAI from 'openai';
import { CopyGenerator, CopyGenerationInput, GeneratedCopy } from './types';

export class OpenAICopyGenerator implements CopyGenerator {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generate(input: CopyGenerationInput): Promise<GeneratedCopy> {
    const prompt = `
      Actúa como un creador de contenido viral en Instagram y TikTok experto en curaduría de productos de Mercado Libre (tecnología, hogar, gadgets, café).
      Tu trabajo es escribir el guion y el texto descriptivo (caption) para un Reel promocionando el siguiente producto.

      INFORMACIÓN DEL PRODUCTO:
      - Título Original: ${input.productTitle}
      - Precio: ${input.productPrice}
      - Atributos: ${JSON.stringify(input.productAttributes)}
      
      Necesito que me devuelvas UNICAMENTE un JSON con la siguiente estructura exacta (sin formato Markdown adicional):
      {
        "hook": "Una oración súper ganchera y corta para el texto en pantalla (máximo 8 palabras).",
        "benefits": ["Beneficio 1", "Beneficio 2", "Beneficio 3"],
        "caption": "Texto descriptivo para la publicación de Instagram, persuasivo, con emojis.",
        "cta": "Llamado a la acción corto para el video.",
        "hashtags": ["#Tag1", "#Tag2", "#Tag3"],
        "disclaimer": "Podemos recibir una comisión..."
      }
      
      Reglas:
      - Los beneficios deben ser oraciones cortas (máximo 8 palabras cada uno) porque van a aparecer en el video.
      - El tono debe ser entusiasta, moderno y directo. No uses lenguaje corporativo.
    `;

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    return JSON.parse(content) as GeneratedCopy;
  }
}
