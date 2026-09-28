# Contrato API de Elit

Contrato verificado el 28 de septiembre de 2026 contra la documentación
autenticada de la cuenta. Este documento no contiene credenciales ni ejemplos
reales identificables.

## Autenticación y host

- Base URL: `https://clientes.elit.com.ar/v1/api`
- Todos los endpoints requieren `user_id` y `token`.
- Los `POST` reciben ambos valores en el cuerpo JSON.
- Las credenciales se guardan cifradas en SmartBrew: `username` representa
  `user_id` y `apiKey` representa `token`.
- Nunca incluir el token en URLs, logs, fixtures o `rawData`.

## Productos

`POST /productos` devuelve productos, precios, stock, imágenes y atributos.
Admite filtros por `id`, `codigo_alfa`, `codigo_producto`, nombre, marca,
categoría y subcategoría. La paginación usa `limit` (máximo 100) y `offset`.
También acepta `actualizacion=AAAA-MM-DD HH:MM`.

SmartBrew no descarga el catálogo completo. `elit-v1` consulta únicamente por
`id` los productos que SmartBrew ya monitorea y declara capacidades `product`,
`price` y `stock`, pero no `catalog`.

Campos normalizados:

- Identidad: `id`, `codigo_alfa`, `codigo_producto`, `ean`.
- Catálogo: `nombre`, `marca`, `categoria`, `sub_categoria`, imágenes,
  atributos, peso, garantía y enlace de origen.
- Costo: `precio`, `iva`, `impuesto_interno`, `moneda` y `cotizacion`.
- Referencia comercial: `pvp_usd`, `pvp_ars` y `markup`.
- Disponibilidad: `stock_total` y stocks por depósito.
- Auditoría: `creado` y `actualizado` se conservan en `rawData`.

La moneda `1` significa ARS y `2` significa USD. Para costos en USD se exige
una cotización positiva. `SupplierProduct.cost` guarda el costo total normalizado
en ARS: base + IVA + impuesto interno.

## Endpoints de descarga

Existen descargas CSV para Meta, Tienda Nube y formato genérico. No forman parte
del monitoreo incremental de SmartBrew porque implican descargar el catálogo
completo.
