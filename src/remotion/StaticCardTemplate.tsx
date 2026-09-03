import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, useCurrentFrame } from 'remotion';

export interface StaticCardTemplateProps {
  hook: string;
  productTitle: string;
  benefits: string[];
  cta: string;
  disclaimer: string;
  imageUrl?: string;
  price?: string;
}

export const StaticCardTemplate: React.FC<StaticCardTemplateProps> = ({
  hook,
  productTitle,
  benefits,
  cta,
  disclaimer,
  imageUrl,
  price
}) => {
  const frame = useCurrentFrame();

  const hookOpacity = interpolate(frame, [0, 15, 45, 60], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const productOpacity = interpolate(frame, [60, 75, 165, 180], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const benefitsOpacity = interpolate(frame, [180, 195, 225, 240], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [240, 255, 285, 300], [0, 1, 1, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#111827', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* 0-2s: Hook */}
      <Sequence from={0} durationInFrames={60}>
        <AbsoluteFill style={{ opacity: hookOpacity, justifyContent: 'center', alignItems: 'center', padding: '10%' }}>
          <h1 style={{ fontSize: '80px', textAlign: 'center', fontWeight: 'bold' }}>{hook}</h1>
        </AbsoluteFill>
      </Sequence>

      {/* 2-6s: Product & Image */}
      <Sequence from={60} durationInFrames={120}>
        <AbsoluteFill style={{ opacity: productOpacity, justifyContent: 'center', alignItems: 'center', padding: '10%' }}>
          {imageUrl && <Img src={imageUrl} style={{ width: '600px', height: '600px', objectFit: 'contain', marginBottom: '40px', borderRadius: '40px', backgroundColor: 'white' }} />}
          <h2 style={{ fontSize: '60px', textAlign: 'center', fontWeight: 'bold' }}>{productTitle}</h2>
          {price && <p style={{ fontSize: '40px', color: '#10B981', marginTop: '20px' }}>{price}</p>}
        </AbsoluteFill>
      </Sequence>

      {/* 6-8s: Benefits */}
      <Sequence from={180} durationInFrames={60}>
        <AbsoluteFill style={{ opacity: benefitsOpacity, justifyContent: 'center', alignItems: 'center', padding: '10%' }}>
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {benefits.map((benefit, i) => (
              <li key={i} style={{ fontSize: '50px', marginBottom: '40px', textAlign: 'center', backgroundColor: '#374151', padding: '30px', borderRadius: '20px' }}>
                ✨ {benefit}
              </li>
            ))}
          </ul>
        </AbsoluteFill>
      </Sequence>

      {/* 8-10s: CTA & Disclaimer */}
      <Sequence from={240} durationInFrames={60}>
        <AbsoluteFill style={{ opacity: ctaOpacity, justifyContent: 'center', alignItems: 'center', padding: '10%' }}>
          <h1 style={{ fontSize: '70px', fontWeight: 'bold', color: '#3B82F6', textAlign: 'center', marginBottom: '60px' }}>{cta}</h1>
          <p style={{ fontSize: '30px', color: '#9CA3AF', textAlign: 'center' }}>{disclaimer}</p>
        </AbsoluteFill>
      </Sequence>
      
    </AbsoluteFill>
  );
};
