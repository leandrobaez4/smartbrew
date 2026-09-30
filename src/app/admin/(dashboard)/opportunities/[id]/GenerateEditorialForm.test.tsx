import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import GenerateEditorialForm from './GenerateEditorialForm';

vi.stubGlobal('React', React);

it('renders the AI action with its blocking loading dialog', () => {
  const html = renderToStaticMarkup(<GenerateEditorialForm
    action={() => {}}
    label="Generar con IA desde datos de Unidrop"
    supplierName="Unidrop"
  />);

  expect(html).toContain('Generar con IA desde datos de Unidrop');
  expect(html).toContain('aria-label="Generando contenido con IA"');
  expect(html).toContain('Generando contenido con IA…');
  expect(html).toContain('los datos de Unidrop');
});
