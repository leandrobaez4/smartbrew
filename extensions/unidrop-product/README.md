# SmartBrew: extractor de productos de Unidrop

Esta extensión es exclusiva para Unidrop. Lee una ficha autenticada del catálogo, prepara un snapshot por variante/SKU y abre la revisión correspondiente en SmartBrew. No publica en Mercado Libre ni realiza compras.

## Instalación

1. Abrí `chrome://extensions` y activá **Modo desarrollador**.
2. Elegí **Cargar extensión sin empaquetar**.
3. Seleccioná `extensions/unidrop-product`.
4. Iniciá sesión en Unidrop y abrí una URL `/panel/catalogue/{id}`.
5. Presioná **Extraer este producto**.
6. Si existen varias variantes, seleccioná el SKU que querés importar.
7. Presioná **Configurar en SmartBrew** y confirmá la revisión.

## Datos capturados

- ID del producto y SKU de la variante.
- Costo en ARS y precio de referencia con ganancia.
- Stock visible.
- Imágenes, descripción, categoría y atributos.
- Peso y dimensiones del paquete cuando estén disponibles.
- Referencia de envío de Tiendanube, que SmartBrew conserva como referencia pero no aplica a Mercado Libre.
- URL y fecha de captura para controlar la antigüedad del snapshot.

La extensión usa únicamente `activeTab` y `scripting`. No lee cookies ni almacenamiento, no solicita acceso permanente a Unidrop y no incluye credenciales en el payload.

## Verificación

```bash
node --test extensions/unidrop-product/*.test.mjs
```
