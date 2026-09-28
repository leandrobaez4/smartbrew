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
etiqueta `smartbrew-dropshipping-sync`. QStash llama al endpoint cada minuto y
SmartBrew sólo despacha la cadena cuando se cumple el intervalo configurado en
el dashboard.

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
