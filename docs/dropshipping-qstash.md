# Dropshipping mediante QStash

Los trabajos de dropshipping que deben funcionar en Vercel se despachan a
`/api/queue/dropshipping`. El endpoint acepta únicamente mensajes firmados por
QStash y mantiene el resultado durable en `JobExecution`.

## Configuración

Se requieren estas variables en el mismo ambiente:

```ini
APP_URL=https://www.smartbrew.tech
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

Guardar `/admin/settings/dropshipping` crea o repara un único schedule con la
etiqueta `smartbrew-dropshipping-sync`. El cron de QStash usa directamente el
intervalo configurado en el dashboard. Los intervalos admitidos comienzan en 15
minutos para que el schedule y su cadena de tres trabajos no agoten por sí solos
el límite diario de QStash Free. La comprobación durable del último despacho se
mantiene como protección adicional ante reentregas. Para el volumen inicial de
SmartBrew, el valor predeterminado es una ejecución diaria.

## Cadena periódica

La cadena usa flow control con paralelismo uno y conserva este orden:

1. `SupplierStockSyncJob`: consulta en el proveedor únicamente los productos
   vinculados a publicaciones activas o pausadas y actualiza costo y stock.
2. `MarketplaceStockSyncJob`: actualiza o pausa el stock en Mercado Libre.
3. `MarketplacePriceSyncJob`: recalcula y actualiza el precio si la opción está
   habilitada y las reglas de rentabilidad y variación lo permiten.

No se descarga el catálogo completo de Elit.

## Publicación

El botón **Publicar en ML** crea un `MarketplacePublishJob` y lo envía a QStash.
La publicación externa no tiene reintentos automáticos para evitar duplicados
si Mercado Libre confirma la creación pero la respuesta se pierde. El resultado
debe revisarse en `JobExecution` y en los registros antes de intentar una
recuperación manual.

`DROPSHIPPING_DRY_RUN=true` continúa teniendo prioridad y evita escrituras
reales en Mercado Libre.
