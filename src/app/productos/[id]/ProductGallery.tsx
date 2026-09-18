'use client';
import { useState } from 'react';

export default function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [selected, setSelected] = useState(0);
  if (!images.length) return <div className="single-image">Imagen no disponible</div>;
  return <section aria-label="Fotos del producto">
    <img className="single-image" src={images[selected] || images[0]} alt={`${title} · foto ${selected + 1}`} />
    <div className="single-thumbnails">
      {images.map((src, index) => <button type="button" key={src} aria-label={`Ver foto ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>
        <img src={src} alt="" loading="lazy" />
      </button>)}
    </div>
  </section>;
}
