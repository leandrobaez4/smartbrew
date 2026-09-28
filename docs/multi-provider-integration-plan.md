# Plan de integracion de catalogos multi-proveedor

## Objetivo

Construir una arquitectura extensible para integrar Elit y futuros proveedores sin agregar logica condicional por proveedor en los servicios de negocio.

La solucion debe:

- usar un contrato comun basado en Adapter y una Factory para resolver la implementacion correcta;
- identificar de forma inequivoca el proveedor y el registro original de cada producto;
- normalizar catalogos, precios, monedas, IVA, stock, imagenes y atributos sin perder la respuesta original;
- permitir importaciones puntuales y sincronizaciones incrementales de los productos publicados, manuales y programadas;
- soportar capacidades diferentes por proveedor, por ejemplo catalogo sin creacion automatica de ordenes;
- mantener separada y operativa la integracion directa con Mercado Libre usada por el catalogo de afiliados;
- exponer configuracion, estado, errores y acciones de sincronizacion desde el dashboard `/admin`.

## Alcance y decisiones principales

### Dos flujos de producto que no se deben mezclar

SmartBrew tiene dos casos de uso distintos:

1. **Afiliados de Mercado Libre**: `Product` representa un producto descubierto o importado directamente desde Mercado Libre. La compra ocurre fuera de SmartBrew mediante `affiliateUrl`.
2. **Dropshipping de proveedores**: `SupplierProduct` representa una oferta de un proveedor, con costo, stock, precio calculado y una eventual `MarketplaceListing` en Mercado Libre.

No se unificaran estas tablas. Tienen identidades, costos, estados y ciclos de vida diferentes. Cuando el dashboard necesite mostrar ambos catalogos juntos se construira un modelo de lectura discriminado, no una tabla de dominio comun.

```text
Mercado Libre API ──> Product ──> Catalogo de afiliados ──> Enlace externo

Proveedor API ──> Adapter ──> SupplierProduct ──> Oportunidad
                                              └─> MarketplaceListing ──> Mercado Libre
```

### Identidad y procedencia

- En dropshipping, la identidad canonica continuara siendo `(supplierId, externalId)`.
- `SupplierProduct.supplierId` identifica al proveedor propietario de la oferta.
- `Supplier.slug` sera un identificador humano; la seleccion tecnica se hara con un `connectorKey` explicito.
- `rawData` conservara la respuesta original para auditoria y re-procesamiento.
- En afiliados, la identidad continuara siendo `(marketplace, externalId)` en `Product`.
- Una coincidencia de EAN o SKU entre proveedores representa ofertas relacionadas, no el mismo registro.

## Estado actual

La base necesaria ya existe:

- `SupplierConnector` define operaciones de catalogo, precio, stock y ordenes.
- `SupplierConnectorFactory` registra builders y envuelve los conectores con logs.
- `SupplierProduct` ya tiene relacion con `Supplier`, identidad compuesta y `rawData`.
- `importSupplierProducts` normaliza upserts y registra cambios de costo o stock.
- BullMQ ya ejecuta trabajos de catalogo, stock, precio, fees, ordenes y publicaciones.
- Las credenciales de proveedores se guardan cifradas.
- `IntegrationLog` y `JobExecution` ya aportan observabilidad basica.

Brechas detectadas:

- la Factory de produccion registra solamente el conector `mock`;
- `Supplier.type` se usa parcialmente como clave tecnica y no expresa un contrato claro;
- el contrato obliga a todos los adapters a implementar todas las operaciones, aunque el proveedor no las soporte;
- los jobs de catalogo, stock y precio terminan ejecutando actualmente la misma sincronizacion completa;
- la importacion de Elit desde la extension guarda directamente en Prisma y evita el Adapter, la Factory y el pipeline comun;
- no existe todavia un adapter real de Elit ni validacion versionada de su respuesta;
- no hay cursor, checksum, baja por ausencia ni estado detallado por corrida de catalogo;
- no existe una vista administrativa unificada que muestre claramente el origen y la salud de cada oferta.

## Arquitectura objetivo

### 1. Contrato canonico

Crear contratos de entrada independientes de Prisma en `src/lib/suppliers/contracts.ts`:

```ts
type SupplierCapability =
  | 'catalog'
  | 'product'
  | 'price'
  | 'stock'
  | 'create-order'
  | 'order-status';

type NormalizedSupplierProduct = {
  externalId: string;
  sku: string | null;
  ean: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  sourceUrl: string | null;
  price: {
    baseAmount: number | null;
    currency: string | null;
    exchangeRateArsPerUsd: number | null;
    vatPercentage: number | null;
    vatAmount: number | null;
    includesVat: boolean | null;
    internalTaxAmount: number | null;
    internalTaxPercentage: number | null;
    pvpArs: number | null;
    pvpUsd: number | null;
    supplierMarkupPercentage: number | null;
  };
  stock: number | null;
  images: string[];
  attributes: Record<string, unknown>;
  sourceUpdatedAt: Date | null;
  rawData: unknown;
};
```

Cada adapter valida primero la respuesta externa con Zod y despues la transforma a este DTO. Los servicios de importacion no conoceran nombres de campos de Elit ni de ningun proveedor concreto.

### 2. Adapter por proveedor

Separar el contrato por capacidades para que una integracion parcial sea valida:

- `CatalogAdapter`: consultar un producto puntual y las actualizaciones de un conjunto monitoreado.
- `InventoryAdapter`: consultar precio y stock.
- `OrderAdapter`: crear orden y consultar su estado.

Un adapter puede implementar una o varias capacidades. La Factory debe rechazar una operacion no soportada antes de realizar una llamada externa y devolver un error tipado `CAPABILITY_NOT_SUPPORTED`.

Estructura propuesta:

```text
src/lib/suppliers/
├── contracts.ts
├── factory.ts
├── registry.ts
├── ingestion.ts
├── adapters/
│   ├── mock.ts
│   ├── manual.ts
│   └── elit/
│       ├── client.ts
│       ├── schemas.ts
│       ├── mapper.ts
│       ├── adapter.ts
│       └── adapter.test.ts
└── repositories/
    └── supplier-product-repository.ts
```

### 3. Factory y registro

La Factory seguira siendo el unico punto para construir adapters. Un registro central asociara una clave estable con un builder:

```ts
export const supplierAdapterFactory = new SupplierAdapterFactory()
  .register('mock-v1', createMockAdapter)
  .register('manual-v1', createManualAdapter)
  .register('elit-v1', createElitAdapter);
```

Reglas:

- no seleccionar adapters por `slug`, porque un proveedor puede cambiar de version o mecanismo;
- persistir `connectorKey`, por ejemplo `elit-v1`, en `Supplier`;
- validar al crear o editar un proveedor que la clave exista y que sus credenciales requeridas esten configuradas;
- no permitir registros duplicados en el registry;
- inyectar cliente HTTP, reloj y logger para facilitar pruebas deterministas;
- mantener timeouts, reintentos, redaccion de secretos y logs en wrappers compartidos.

### 4. Pipeline de ingestion y monitoreo dirigido

No se descargara el catalogo completo del proveedor. Un producto entra a SmartBrew solamente cuando se importa de manera explicita desde la extension o el dashboard:

```text
Importacion manual/extension
  -> SupplierImportService
  -> SupplierAdapterFactory.make(supplier)
  -> adapter.getProduct(externalId)
  -> validacion externa
  -> normalizacion
  -> upsert por (supplierId, externalId)
  -> configuracion y posterior publicacion
```

Una vez que el producto tiene una `MarketplaceListing`, pasa a formar parte del conjunto monitoreado. El job programado consulta exclusivamente productos con `marketplaceItemId` y estado `ACTIVE` o `PAUSED`. Los pausados deben seguir monitoreados para detectar una reposicion y permitir su reactivacion.

```text
Polling cada 10-15 minutos
  -> cargar IDs externos con publicaciones ACTIVE o PAUSED
  -> SupplierAdapterFactory.make(supplier)
  -> consultar cambios desde el ultimo checkpoint exitoso
  -> conservar solamente cambios de los IDs monitoreados
  -> actualizar precio/stock
  -> guardar historial si hubo diferencias
  -> recalcular precio final, margen y ROI
  -> sincronizar Mercado Libre segun reglas de seguridad
```

El adapter debe preferir, en este orden:

1. endpoint batch filtrado por IDs externos;
2. endpoint de detalle por producto, con concurrencia limitada;
3. endpoint incremental por `actualizacion=AAAA-MM-DD HH:MM`, filtrando localmente la respuesta contra los IDs monitoreados.

La tercera opcion puede recibir cambios de productos que SmartBrew no tiene publicados, pero esos registros se descartan y nunca se incorporan al catalogo local. En ningun caso se ejecuta una descarga inicial completa.

Reglas de consistencia:

- guardar un checkpoint por proveedor y tipo de operacion;
- avanzar el checkpoint solamente cuando toda la consulta termine correctamente;
- consultar con un pequeno solapamiento temporal para no perder cambios en el limite;
- hacer upsert idempotente para que ese solapamiento no duplique historial;
- no interpretar la ausencia de un producto en la respuesta incremental como stock cero;
- pausar solamente cuando el proveedor informe explicitamente stock cero o discontinuado;
- limitar concurrencia por proveedor;
- respetar rate limits y `Retry-After`;
- diferenciar error transitorio de dato invalido;
- continuar con otros proveedores cuando uno falla.

### 5. Modelo de datos propuesto

Aplicar cambios aditivos y migraciones progresivas:

#### `Supplier`

- `connectorKey String?`: adapter y version seleccionados.
- `connectorConfig Json?`: configuracion no secreta y especifica del adapter.
- `capabilities String[]`: snapshot informativo de capacidades habilitadas.
- `lastSuccessfulSyncAt DateTime?`.
- `lastSyncStatus` y `lastSyncError` para diagnostico rapido.

`type` se mantiene durante la transicion y luego se depreca cuando todos los registros tengan `connectorKey`.

#### `SupplierProduct`

- `sourceUrl String?`.
- `sourceUpdatedAt DateTime?`.
- `sourceHash String?` para evitar escrituras sin cambios.
- `availabilityStatus` para distinguir disponible, sin stock, discontinuado y desconocido.
- mantener `rawData` y la clave unica `(supplierId, externalId)`.

#### `SupplierProductPricing`

Reutilizar y evolucionar la configuracion de costo y precio de publicacion existente; no crear una segunda calculadora para Elit. El modelo debe distinguir:

- `supplierBasePrice`: costo real antes de impuestos.
- `supplierCurrency`: moneda del costo informado.
- `exchangeRateArsPerUsd`: cotizacion usada por el proveedor.
- `vatPercentage` y montos de IVA en moneda de origen y ARS.
- `internalTaxAmount` y, si la fuente lo informa, `internalTaxPercentage`.
- `supplierPvpArs` y `supplierPvpUsd`: PVP sugeridos por el proveedor.
- `supplierMarkupPercentage`: markup configurado en la cuenta del proveedor.
- `supplierPricingUpdatedAt`: fecha de la informacion comercial recibida.

Los campos PVP y markup son referencias comparativas. No forman parte del calculo del precio de SmartBrew. Durante la migracion se conservaran los campos actuales para mantener compatibilidad y se hara backfill cuando la equivalencia sea segura.

#### Corridas de sincronizacion

Agregar `SupplierSyncRun` con proveedor, tipo de sync, checkpoint inicial/final, cantidades monitoreadas/consultadas/actualizadas/invalidas, estado, timestamps y error resumido. `IntegrationLog` seguira guardando el detalle tecnico de llamadas.

El historial actual de costo/stock debe ampliarse con snapshots de costo base, moneda, cotizacion, IVA, impuesto interno y costo total del proveedor. Asi se puede distinguir si un aumento se produjo por precio, cambio de moneda o impuestos.

No agregar `supplierId` a `Product`: los productos de afiliados provienen de un marketplace y no son ofertas de un proveedor de dropshipping.

### 6. Calculo de precio y rentabilidad

La calculadora existente en `src/lib/supplier-product-pricing.ts` sera la base comun para todos los proveedores. Debe dejar de asumir que todo costo llega en USD y debe incorporar el impuesto interno.

```text
costo base ARS
  = convertir(precio, moneda, cotizacion)

costo proveedor ARS
  = costo base ARS
  + IVA ARS
  + impuesto interno ARS

costo total ARS
  = costo proveedor ARS
  + busqueda/gestion
  + envio
  + cargo fijo de marketplace
  + comision porcentual de marketplace
  + otros costos configurados
```

SmartBrew calculara su precio desde el costo total y su politica de rentabilidad. `pvp_ars`, `pvp_usd` y `supplierMarkupPercentage` nunca reemplazan este calculo.

Antes de automatizar se debe unificar la semantica de porcentajes:

- `supplierMarkupPercentage`: referencia de Elit, ganancia aplicada por Elit sobre su costo.
- `targetMarginPercentage`: margen neto objetivo de SmartBrew sobre el precio de venta.
- `minimumMargin`: margen neto minimo permitido sobre el precio de venta.
- `ROI`: ganancia neta dividida por costo total; es informativo y no sustituye al margen.

La implementacion actual por producto calcula la ganancia como porcentaje del costo aunque el campo se llama margen, mientras `ProfitabilityService` calcula margen sobre la venta. Esta diferencia debe corregirse para que dashboard, alertas y automatizaciones produzcan la misma decision.

### 7. Reglas operativas de precio

Para cada producto publicado se evaluara:

```text
ganancia neta = precio ML - costo total
margen neto   = ganancia neta / precio ML
ROI           = ganancia neta / costo total
```

Estados recomendados:

- **Saludable:** alcanza el margen objetivo y la ganancia minima.
- **Reprecio sugerido:** esta por debajo del objetivo, pero todavia supera el margen y la ganancia minimos.
- **No rentable:** esta por debajo de `minimumMargin` o `minimumProfit`.

Cuando cambia costo, cotizacion, IVA o impuesto interno, el sistema debe recalcular primero un precio capaz de recuperar el margen objetivo. El orden automatico sera:

1. calcular el precio recomendado con todos los costos;
2. comparar la variacion contra el precio publicado;
3. si `autoUpdatePrices` esta habilitado y la variacion no supera `priceChangeLimit`, actualizar Mercado Libre;
4. si supera el limite, no cambiar el precio y crear una alerta `PRICE_ANOMALY`;
5. si no existe un precio seguro/rentable, bloquear una nueva publicacion o pausar una existente segun la configuracion.

El impuesto interno no elimina matematicamente el margen si el precio puede subir sin limite; aumenta el precio necesario para recuperarlo. Para bloquear una publicacion se necesita una restriccion explicita, por ejemplo precio maximo, variacion maxima o separacion maxima respecto del PVP de referencia. La regla sera:

```text
si precio necesario para alcanzar el minimo > precio maximo aceptable
entonces no publicar y alertar
```

El precio maximo aceptable y el uso del PVP como limite comercial deben ser configurables; el PVP no debe transformarse implicitamente en un bloqueo.

## Adapter inicial: Elit

La pagina `https://www.elit.com.ar/mi-cuenta/integracion-api` requiere una sesion autenticada. Por lo tanto, antes de programar el cliente hay que capturar y versionar el contrato real provisto a la cuenta, sin inferir endpoints desde el sitio publico.

### Descubrimiento obligatorio

Documentar en `docs/providers/elit-api.md`:

- URL base y ambientes disponibles;
- mecanismo de autenticacion y expiracion de credenciales;
- endpoints de detalle, consulta batch, actualizaciones, precio, stock y ordenes;
- formato de `actualizacion`, filtros por IDs, paginacion y zona horaria;
- limites de frecuencia y politica de reintentos;
- moneda, precision, formato del tipo de cambio e inclusion de IVA;
- semantica de stock, reservas y productos discontinuados;
- imagenes, categorias, EAN, SKU y variantes;
- ejemplos anonimizados de respuesta y errores;
- disponibilidad de webhooks o archivos alternativos.

### Mapeo esperado

El adapter `elit-v1` sera responsable de:

- validar cada respuesta con schemas Zod;
- mapear ID de Elit a `externalId`;
- preservar SKU y EAN sin usarlos como identidad primaria;
- normalizar `precio`, `moneda`, `cotizacion`, IVA e impuesto interno como componentes separados;
- guardar `pvp_ars`, `pvp_usd` y `markup` como referencias comerciales de Elit;
- no sumar IVA dos veces cuando el precio ya lo incluya;
- confirmar en el contrato si `impuesto_interno` es monto o porcentaje y en que moneda se expresa antes de calcularlo;
- normalizar stock desconocido como `null`, no como cero;
- rechazar de forma aislada un producto invalido sin detener el monitoreo de los demas;
- conservar la respuesta original en `rawData` sin credenciales ni datos sensibles.

La extension de Chrome dejara de persistir una forma especial de Elit. Enviara un comando de importacion con `supplierSlug`, `externalId` y, durante la transicion, un snapshot firmado. SmartBrew resolvera `elit-v1` mediante la Factory y ejecutara el mismo pipeline que una sincronizacion API.

## Convivencia con Mercado Libre

### Afiliados

El flujo existente se conserva:

- `MercadoLibreClient` importa productos directos a `Product`;
- `affiliateUrl` sigue siendo manual o provisto por el flujo de afiliados;
- las paginas publicas continuan consumiendo solamente productos `ACTIVE` con URL permitida;
- ningun sync de proveedores puede modificar, pausar o eliminar `Product`.

### Marketplace de dropshipping

Mercado Libre actua como canal de venta para `SupplierProduct` a traves de `MarketplaceListing`. Sus clientes de publicacion, fees, precio, stock, ordenes y webhooks deben permanecer separados de los adapters de proveedor.

La lectura de datos locales permite calcular y simular sin credenciales de Mercado Libre. Para consultar publicaciones remotas, obtener comisiones o ejecutar publicaciones, cambios de precio, stock, pausas y reactivaciones se requiere una aplicacion de Mercado Libre con OAuth.

Configuracion prevista:

- account ID de Mercado Libre;
- client ID y client secret;
- access token de corta duracion;
- refresh token cifrado y renovacion automatica;
- webhook validado para ordenes y cambios soportados por Mercado Libre.

Los tokens no deben compartirse por chat ni guardarse en el repositorio. Un access token expuesto debe revocarse y regenerarse.

A futuro puede crearse una `MarketplaceAdapterFactory`, pero no es requisito para integrar el segundo proveedor. Primero se estabilizara la frontera actual y se evitara una abstraccion prematura.

### Vista combinada

Si se necesita buscar todos los catalogos desde una pantalla, usar un DTO de lectura:

```ts
type CatalogItem =
  | { sourceKind: 'AFFILIATE_MARKETPLACE'; marketplace: 'MERCADO_LIBRE'; productId: string }
  | { sourceKind: 'SUPPLIER'; supplierId: string; supplierSlug: string; supplierProductId: string };
```

Cada fila debe mostrar un badge de origen y navegar a su pantalla especifica. No se habilitaran acciones de publicacion dropshipping sobre una fila de afiliados.

## Dashboard administrativo

### Proveedores

Extender `/admin/suppliers` y `/admin/suppliers/[id]` para mostrar:

- adapter/version seleccionados y capacidades;
- credenciales configuradas sin revelar valores;
- ultima sincronizacion exitosa y ultimo error;
- cantidad de productos activos, sin stock, invalidos y discontinuados;
- botones para probar conexion y actualizar precio/stock de los productos publicados;
- historial de corridas y acceso filtrado a logs;
- configuracion de frecuencia, timeout y comportamiento de bajas.

### Catalogo y oportunidades

- mostrar siempre proveedor, SKU externo y fecha de ultima actualizacion;
- permitir filtrar por origen, proveedor, estado de sync y disponibilidad;
- advertir cuando precio, stock o tipo de cambio esten vencidos;
- reutilizar la pantalla existente de configuracion de costo y precio de publicacion;
- mostrar costo base, moneda, cotizacion, IVA, impuesto interno, costo total, comision, margen y ROI;
- comparar `supplierPvpArs` contra el precio de nuestra `MarketplaceListing` para el mismo producto, con diferencia absoluta y porcentual;
- dejar claro que esa comparacion usa nuestra publicacion, no todos los vendedores del marketplace;
- mostrar por separado markup de Elit, margen objetivo de SmartBrew, margen real y ROI;
- bloquear publicacion si faltan datos obligatorios o la informacion esta vencida;
- bloquear o pedir revision si el impuesto interno lleva el precio rentable por encima del maximo aceptable;
- mantener un enlace al producto original del proveedor cuando exista.

### Operacion segura

Las acciones manuales deben encolar jobs, no ejecutar consultas masivas dentro de una Server Action. La UI mostrara el `JobExecution` asociado y actualizara el estado de forma consultable.

## Seguridad y observabilidad

- mantener credenciales cifradas y fuera de `connectorConfig`, `rawData` y logs;
- redactar headers `Authorization`, cookies, tokens y passwords antes de persistir trazas;
- usar allowlist de hosts por adapter para prevenir SSRF mediante `apiUrl` configurable;
- aplicar timeout con `AbortSignal` a todas las llamadas;
- incluir `supplierId`, `connectorKey`, operacion, duracion, intento y correlation ID en logs;
- alertar por credenciales invalidas, tres fallos consecutivos y variaciones anormales de precio o stock;
- generar alertas de aumento comparando el costo total anterior y nuevo, incluyendo cotizacion, IVA e impuesto interno;
- no reintentar automaticamente `createOrder` sin idempotency key confirmada por el proveedor;
- guardar payloads de clientes u ordenes solo cuando sean necesarios y con minimizacion de datos.

## Plan de implementacion

### Fase 0 — Contrato de Elit y decisiones

- [ ] Obtener acceso autenticado a la documentacion de integracion de Elit.
- [ ] Crear `docs/providers/elit-api.md` con contrato y ejemplos anonimizados.
- [ ] Confirmar capacidades reales: detalle por ID, consulta batch, actualizaciones, stock, precio, ordenes y estados.
- [ ] Confirmar semantica y moneda de precio, IVA, impuesto interno, cotizacion, PVP y markup.
- [ ] Definir reglas de monedas, variantes, stock y discontinuados.
- [ ] Aprobar la separacion `Product`/`SupplierProduct` y el DTO de vista combinada.
- [ ] Aprobar margen real sobre venta como definicion unica de `targetMarginPercentage` y `minimumMargin`.

**Criterio de salida:** no quedan endpoints, autenticacion ni reglas monetarias asumidas.

### Fase 1 — Contratos y Factory v2

- [ ] Extraer DTOs y capacidades desde `connectors.ts` a `contracts.ts`.
- [ ] Dividir el adapter monolitico en interfaces por capacidad.
- [ ] Agregar errores tipados y validacion de capacidades.
- [ ] Crear registro central y migrar `mock` sin cambiar su comportamiento.
- [ ] Agregar `manual-v1` para imports administrados sin API.
- [ ] Cubrir Factory, wrappers, capacidades y redaccion con unit tests.

**Criterio de salida:** un adapter parcial puede importar y monitorear productos sin implementar ordenes y no hay seleccion por condicionales de proveedor.

### Fase 2 — Persistencia y procedencia

- [ ] Agregar campos aditivos a `Supplier` y `SupplierProduct`.
- [ ] Crear `SupplierSyncRun` e indices necesarios.
- [ ] Backfill de `connectorKey` para proveedores existentes.
- [ ] Actualizar formularios, validaciones y respuestas API sin exponer secretos.
- [ ] Implementar repositorio de upsert idempotente y hash de cambios.
- [ ] Definir el conjunto monitoreado a partir de publicaciones `ACTIVE` y `PAUSED`.
- [ ] Extender `SupplierProductPricing` e historial con impuesto interno, PVP, markup y componentes de cotizacion.
- [ ] Migrar la calculadora existente sin crear un flujo de precio paralelo.

**Criterio de salida:** cada oferta muestra proveedor, adapter, ID externo y estado de sincronizacion; repetir una corrida no duplica informacion.

### Fase 3 — Adapter `elit-v1`

- [ ] Implementar cliente HTTP con autenticacion, timeout, rate limit y consultas dirigidas.
- [ ] Crear schemas Zod usando muestras reales.
- [ ] Implementar mapper al DTO canonico.
- [ ] Registrar `elit-v1` en la Factory.
- [ ] Agregar contract tests con fixtures anonimizados.
- [ ] Probar producto individual y actualizaciones de una lista controlada de publicaciones.
- [ ] Verificar con muestras reales que costo base, IVA, impuesto interno, PVP y markup conservan moneda y precision.

**Criterio de salida:** Elit se sincroniza exclusivamente mediante Factory y precio/stock coinciden con la fuente para una muestra de productos publicados.

### Fase 4 — Orquestacion y extension

- [ ] Separar el job de importacion puntual de los jobs de monitoreo de precio y stock.
- [ ] Consultar solamente IDs con publicaciones `ACTIVE` o `PAUSED`, con checkpoint y resumen por corrida.
- [ ] Filtrar localmente por esos IDs si Elit solo ofrece el parametro global `actualizacion`.
- [ ] Aplicar locks por proveedor y tipo de operacion.
- [ ] Generar alertas cuando aumente el costo total o una publicacion deje de superar los minimos configurados.
- [ ] Recalcular precio, margen y ROI despues de cada cambio comercial.
- [ ] Intentar un reprecio seguro antes de pausar por baja rentabilidad.
- [ ] Migrar la importacion de la extension al endpoint comun de ingestion.
- [ ] Mantener temporalmente compatibilidad con snapshots firmados actuales.
- [ ] Retirar el upsert especifico de Elit cuando la transicion este verificada.

**Criterio de salida:** importacion manual y extension comparten el servicio de ingreso; el sync programado solo monitorea productos publicados y nunca descarga el catalogo completo.

### Fase 5 — Dashboard `/admin`

- [ ] Agregar selector de adapter y configuracion por capacidades.
- [ ] Implementar prueba de conexion sin guardar secretos en logs.
- [ ] Mostrar salud, metricas, errores e historial de corridas.
- [ ] Agregar filtros y badges de origen al catalogo y oportunidades.
- [ ] Mostrar frescura de precio/stock y bloquear acciones inseguras.
- [ ] Mostrar PVP Elit versus nuestra publicacion ML y separar markup, margen y ROI.
- [ ] Incorporar impuesto interno y precio maximo aceptable a la configuracion de publicacion.
- [ ] Exponer OAuth y estado de conexion de Mercado Libre sin revelar tokens.
- [ ] Incorporar vista combinada de afiliados y proveedores solo como read model.

**Criterio de salida:** la integracion puede configurarse, ejecutarse y diagnosticarse sin terminal ni acceso directo a la base.

### Fase 6 — Endurecimiento y segundo proveedor

- [ ] Ejecutar pruebas de volumen, paginacion, timeouts y respuestas parciales.
- [ ] Verificar alertas, reintentos y recuperacion despues de fallos.
- [ ] Documentar el procedimiento para crear un nuevo adapter.
- [ ] Integrar un segundo proveedor usando solamente contrato, adapter y registro.
- [ ] Confirmar que no fue necesario modificar ingestion, oportunidades ni ordenes.

**Criterio de salida:** el segundo proveedor demuestra que la arquitectura es extensible y no una implementacion especial para Elit.

## Backlog sugerido

| Orden | Tarea | Dependencia | Resultado |
|---:|---|---|---|
| 1 | Relevar y documentar API autenticada de Elit | Acceso Elit | Contrato verificable |
| 2 | Introducir capacidades y DTO canonico | 1 | Frontera estable |
| 3 | Evolucionar Factory y registry | 2 | Resolucion sin condicionales |
| 4 | Agregar procedencia, pricing ampliado y `SupplierSyncRun` | 2 | Auditoria e idempotencia |
| 5 | Implementar `elit-v1` | 1, 3 | Primer adapter real |
| 6 | Implementar monitoreo incremental dirigido | 4, 5 | Sync solo de publicaciones |
| 7 | Unificar margen, rentabilidad y reprecio seguro | 4, 6 | Decisiones consistentes |
| 8 | Migrar extension de Chrome | 5, 6 | Un unico flujo de importacion |
| 9 | Configurar OAuth de Mercado Libre | Acceso ML | Automatizaciones renovables |
| 10 | Mejorar dashboard de proveedores | 4, 6, 7 | Configuracion y operacion visibles |
| 11 | Catalogo combinado como read model | 10 | Origen visible sin mezclar dominios |
| 12 | Integrar segundo proveedor | 3, 6 | Validacion de extensibilidad |

## Estrategia de pruebas

- **Unitarias:** schemas, mappers, capacidades, Factory, redaccion, monedas, IVA, impuesto interno, margen, ROI y reglas de baja.
- **Contract tests:** fixtures reales anonimizados por version de adapter.
- **Integracion:** filtrado por publicaciones, checkpoints, solapamiento, upsert, historial y fallos parciales con PostgreSQL.
- **Jobs:** locks, reintentos, idempotencia y resumen de `SupplierSyncRun`.
- **End-to-end:** alta de proveedor, prueba de conexion, sync manual, aparicion en oportunidades y publicacion controlada.
- **Regresion:** calculadora existente, imports de afiliados ML, URLs publicas, extension actual durante la transicion, publicaciones, fees, stock y ordenes.
- **Carga:** conjunto representativo de publicaciones consultado con memoria acotada y limites de concurrencia.

En cada fase ejecutar Prisma validate/generate, migraciones sobre una base de prueba, TypeScript, ESLint, Vitest y build de produccion.

## Despliegue y rollback

1. Desplegar primero los campos aditivos y el codigo compatible con registros viejos.
2. Hacer backfill de `connectorKey` sin eliminar `type`.
3. Activar `elit-v1` con feature flag para un proveedor y sync manual.
4. Comparar conteos, muestras de precio/stock, IVA y errores con Elit.
5. Habilitar sync programado y luego migrar la extension.
6. Mantener el flujo anterior disponible durante una ventana de observacion.
7. Retirar compatibilidad y campos obsoletos en una migracion posterior independiente.

El rollback debe desactivar el adapter o el scheduler sin borrar `SupplierProduct`, historial ni configuracion de afiliados. Las migraciones destructivas quedan fuera de las primeras fases.

## Definicion de terminado

La iniciativa se considera terminada cuando:

- Elit y al menos otro proveedor funcionan mediante adapters registrados;
- no hay ramas `if supplier === ...` fuera de los adapters o su registro;
- toda oferta de dropshipping tiene procedencia visible y auditable;
- extension e importacion manual comparten el pipeline de ingreso, mientras el sync programado monitorea solamente publicaciones;
- ninguna tarea automatica descarga o persiste el catalogo completo de un proveedor;
- precio, moneda, tipo de cambio e IVA se normalizan sin ambiguedad;
- impuesto interno, PVP y markup se almacenan sin usarlos como sustituto del costo o margen de SmartBrew;
- calculadora, alertas y jobs usan la misma definicion de margen neto;
- el reprecio respeta `autoUpdatePrices`, `priceChangeLimit` y el precio maximo aceptable;
- las acciones remotas de Mercado Libre usan OAuth renovable y secretos cifrados;
- capacidades no soportadas se bloquean de forma explicita;
- el dashboard permite configurar y diagnosticar integraciones;
- los productos de afiliados de Mercado Libre siguen funcionando sin migracion de datos ni cambios de comportamiento;
- las pruebas de regresion, seguridad, idempotencia y volumen estan aprobadas.
