# SmartBrew: extractor de productos de Elit

La extensión extrae desde la pestaña activa los datos del producto y abre una pantalla de revisión en SmartBrew. Sólo guarda después de la confirmación del administrador y nunca realiza pedidos.

## Instalación y prueba manual

1. Abrí `chrome://extensions` y activá **Modo de desarrollador**.
2. Elegí **Cargar descomprimida** y seleccioná `extensions/elit-product`.
3. Abrí un producto en `https://www.elit.com.ar/producto/...`.
4. Si tu cuenta de Elit permite ver precio y stock, iniciá sesión antes de extraer.
5. Abrí la extensión y presioná **Extraer este producto**.
6. Revisá el JSON y elegí **Configurar en SmartBrew**.
7. En el dashboard completá o corregí precio, cambio, costos, comisión y margen. La base sólo cambia al confirmar el formulario.

El botón **Configurar en SmartBrew** se habilita después de cualquier extracción válida. Si Elit no expone el precio o el tipo de cambio, esos campos se abren en cero para completarlos manualmente en SmartBrew.

El traspaso abre SmartBrew con el producto codificado en la URL. No incluye cookies ni credenciales, pero los datos del producto y su costo pueden quedar visibles en el historial del navegador y en registros de navegación.

## Cálculo en SmartBrew

- Conserva el precio base y el IVA aplicado en USD y ARS.
- Permite configurar costo de búsqueda/gestión, envío, porcentaje y cargo fijo de Mercado Libre.
- Ofrece márgenes de 10%, 15%, 20%, 25%, 30% y 40% mediante radio buttons.
- Muestra comisión estimada, costo total, ganancia y precio final antes de guardar.
- Si se configura una categoría `MLA`, el worker consulta periódicamente el porcentaje vigente en el recurso oficial de costos de Mercado Libre.
- El cargo fijo queda editable: Mercado Libre requiere logística y peso facturable para confirmarlo con precisión.

## Datos y permisos

- Extrae código de Elit, SKU, EAN, título, descripción, marca, categoría, precio USD, tipo de cambio, IVA, equivalentes ARS, stock, galería y atributos técnicos. Si el precio no aparece en los datos internos, también lee el bloque visual que separa los enteros y centavos del precio en USD.
- Cuando Elit no expone precio o stock para la sesión actual, devuelve esos campos como `null` y lo informa explícitamente.
- `activeTab` concede acceso temporal sólo después del clic del usuario.
- `scripting` ejecuta el extractor empaquetado en contexto aislado.
- No solicita cookies, historial, almacenamiento, acceso permanente a sitios ni scripts remotos.

## Verificación

```bash
node --test extensions/elit-product/*.test.mjs
```
