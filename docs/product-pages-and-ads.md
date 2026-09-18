# Fichas públicas y anuncios pausados

## Ficha de producto

- URL estable: https://www.smartbrew.tech/productos/ID. Cambiar el título no rompe anuncios existentes.
- Listado /productos enlaza a cada ficha. Solo se muestran productos ACTIVE con URL HTTPS válida de Mercado Libre o meli.la; los demás responden 404.
- Galería deduplicada, sin precio y con aviso de afiliado. No se inventan especificaciones ni descuentos.
- Previa y Editar incluyen URL pública, copiar y abrir. No hay migración de base de datos.
- El dominio canónico de los enlaces es www.smartbrew.tech.

## Automatizador (primera versión)

Desde Previa/Editar, «Crear anuncio de Instagram (pausado)».
Requiere presupuesto total, moneda ARS o USD, duración 1–30 días y confirmación.
El público inicial, informado en pantalla, es Argentina / mayores de 18 años / feed de Instagram.
Usa la portada, no el carrusel ni un post orgánico existente.
La creación se programa por QStash, no bloquea el navegador.

Configurar solo en servidor:

- META_ADS_ENABLED=true (omitir o false para deshabilitar nuevas operaciones).
- META_ADS_ACCESS_TOKEN: token de Facebook Marketing API con ads_management y acceso a los activos; no es el token de Instagram Login.
- META_ADS_ACCOUNT_ID: número de cuenta publicitaria sin act_.
- META_ADS_PAGE_ID: ID de la página de Facebook.
- META_ADS_INSTAGRAM_ID: ID de la cuenta profesional asociada y autorizada para anuncios.
- META_ADS_API_VERSION: versión compatible, predeterminada v26.0.
- QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, APP_URL: configuración existente.
- VERCEL_AUTOMATION_BYPASS_SECRET solo si la protección de despliegues lo requiere.

El consumidor /api/queue/meta-ads exige firma. Se valida la moneda y estado de la cuenta antes de crear entidades.
Se crean campaña, conjunto, creativo y anuncio. Las tres entidades con entrega llevan PAUSED fijo; no existe endpoint de activación en esta implementación.
El presupuesto se convierte a unidades menores de ARS/USD; Meta valida sus mínimos. La fecha inicial es una hora después de la creación y la final, N días después. Revisar fechas, presupuesto, facturación, identidad y vista previa en Ads Manager antes de activarlo manualmente.

JobExecution conserva input e IDs parciales, sin tokens. Bloqueo por producto al encolar y por trabajo al reclamar.
Solo se permite un intento por producto en esta versión, incluso si falla: evita duplicados cuando Meta pudo aceptar una solicitud que terminó en timeout.
Si se interrumpe un worker, el estado muestra revisión después de tres minutos; no se recupera automáticamente ni borra registros.
Revisar IDs en Meta y QStash antes de cualquier recuperación administrativa. No hay botón de reintento ni edición de campañas todavía.
Delivered significa trabajo recibido; no garantiza anuncio creado ni aprobado. SUCCEEDED significa creación PAUSED confirmada, no anuncio activo/aprobado.

## Acceso de Meta y validación pendiente

Para la cuenta propia, Meta documenta Standard Access; para administrar cuentas ajenas, Advanced Access de ads_management/ads_read según las operaciones.
Ver https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi
La revisión previa de permisos Instagram no concede automáticamente permisos publicitarios. Confirmar Marketing API, acceso a cuenta/página/Instagram, facturación y revisión del anuncio en Meta.

No se crearon anuncios reales, no se consultó saldo ni se activó gasto durante la implementación. Las pruebas son locales con mocks.
Tras desplegar y configurar acceso, hacer una prueba autorizada de creación PAUSED. Cambios de versión/cuenta pueden requerir ajustar parámetros conforme a la respuesta de Meta. No asumir que saldo disponible equivale a aprobación.
