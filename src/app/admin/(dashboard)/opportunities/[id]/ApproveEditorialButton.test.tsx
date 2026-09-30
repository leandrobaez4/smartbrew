import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import ApproveEditorialButton from './ApproveEditorialButton';

vi.stubGlobal('React', React);

it('renders the approval button with its blocking loading dialog', () => {
  const html = renderToStaticMarkup(<form><ApproveEditorialButton /></form>);

  expect(html).toContain('Guardar y aprobar contenido');
  expect(html).toContain('aria-label="Guardando y aprobando contenido"');
  expect(html).toContain('Guardando y aprobando contenido…');
  expect(html).toContain('validando el título, la descripción y los datos editoriales');
});
