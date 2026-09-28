# Agregar un proveedor a SmartBrew

Los proveedores de dropshipping se integran mediante un adapter registrado en
`SupplierConnectorFactory`. El dominio no debe agregar condiciones por nombre o
slug de proveedor.

## Contrato mínimo

1. Normalizar cada respuesta a `SupplierProduct`.
2. Declarar únicamente las capacidades reales del proveedor.
3. Registrar una clave versionada, por ejemplo `proveedor-v1`, y opcionalmente
   un alias compatible.
4. Configurar esa clave en `Supplier.type`.
5. Usar `importSupplierProducts` para persistir. No escribir directamente en
   `SupplierProduct` desde el adapter.

Una integración puntual puede implementar solamente `product`. El wrapper de la
Factory rechaza `catalog`, `stock`, `price` u órdenes antes de invocar al adapter
si esas capacidades no fueron declaradas.

## Adapter de referencia `manual-v1`

`src/lib/suppliers/manual.ts` es el segundo adapter de referencia. Recibe un
snapshot JSON administrado, valida identidad, costo, moneda, stock e imágenes, y
lo transforma al contrato común. Está registrado junto con `elit-snapshot-v1`
sin modificar la ingesta, oportunidades, pricing, órdenes ni el catálogo
combinado.

El adapter manual tiene solamente la capacidad `product`; por eso el scheduler
lo omite de forma segura y nunca intenta descargar un catálogo completo. Para
soportar una API real se agrega otro adapter con `catalog`, `price` o `stock`
según corresponda, sin ampliar capacidades artificialmente.

## Verificación requerida

- Fixture anonimizado y schema estricto para la versión de la API.
- Unit tests del mapper y de datos monetarios inválidos.
- Contract test de capacidades en la Factory.
- Prueba de que el resultado pasa por `supplierProductData` o
  `importSupplierProducts` sin cambios específicos del proveedor.
- Pruebas de timeout, respuesta parcial, secretos redactados e idempotencia antes
  de habilitar sincronización programada.

Nunca guardar tokens o contraseñas en fixtures, `rawData`, configuración del
connector ni logs. Las credenciales se cifran mediante el almacenamiento de
proveedores existente.
