# Publicaciones: seguridad y despliegue

Antes de desplegar, aplicar `prisma/manual/20260915_publication_soft_delete.sql` a la base del entorno y regenerar Prisma Client. La migración es aditiva; no elimina registros. No se ejecutó automáticamente en producción.

Cada intento conserva su propia Publication. La reserva UPLOADING se crea en una transacción que bloquea la fila Product con SELECT FOR UPDATE. Todas las publicaciones de todos los borradores del producto se consideran para impedir duplicados entre instancias. La transacción termina antes de llamar a Meta.

Se guarda externalContainerId antes de media_publish. Solo un ID válido de Meta y un guardado exitoso producen éxito en pantalla. Si la respuesta es incierta o falla el guardado tras publicar, PROCESSING bloquea nuevos intentos. No hay vencimiento automático del bloqueo: podría existir un post real. Conciliar con el contenedor, ID remoto y cuenta de Instagram antes de cambiarlo. Un proceso terminado abruptamente también requiere conciliación.

La verificación es de solo lectura: un 400/404, token inválido o falta de permisos no confirma eliminación. Ninguna de estas respuestas borra filas ni relaciones.

La eliminación remota usa DELETE /<IG_MEDIA_ID> con Facebook Login, documentado en https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media y anunciado el 3 de diciembre de 2025 en el changelog. No archiva: elimina el post. La configuración es independiente de publicación y mensajes:

- `INSTAGRAM_DELETE_FACEBOOK_ACCESS_TOKEN`: token de usuario de Facebook obtenido mediante Facebook Login for Business, con `instagram_basic` e `instagram_manage_contents`. No reutilizar el token de Instagram Login ni exponerlo al cliente.
- `INSTAGRAM_DELETE_FACEBOOK_ACCOUNT_ID`: ID de la cuenta profesional de Instagram obtenido por esa integración; no es el ID de la página de Facebook.
- `INSTAGRAM_DELETE_GRAPH_API_VERSION`: por defecto `v26.0`.

Cargar estas variables en Vercel Production y redesplegar. Sin credenciales no hay mutaciones. Esta implementación es para la cuenta administrada por SmartBrew, con configuración manual de servidor: NO agrega onboarding OAuth de Facebook para clientes del portal. La autorización y aprobación de permisos en Meta deben completarse por separado.

Se verifica id y owner antes del DELETE. Bajo el mismo bloqueo Product usado para publicar se persiste DELETE_IN_PROGRESS. El estado permanece PUBLISHED para impedir republicaciones mientras se elimina. Solo `success === true` con `deleted_id` exactamente igual al solicitado permite asignar `deletedAt`. No se borran filas, IDs, relaciones ni se pausa el producto. Si Meta rechaza, queda DELETE_REJECTED; si el resultado es incierto, falla el guardado o el proceso se interrumpe, se bloquean reintentos con DELETE_RECONCILIATION_REQUIRED o DELETE_IN_PROGRESS. Estos casos requieren revisión administrativa, nunca desbloqueo automático por tiempo. En lotes se informa cuántas eliminaciones se confirmaron antes de un error.

No hay conciliación automática de eliminaciones manuales. Un 404 no confirma una eliminación. El historial y la asociación media-producto usados por DM se conservan. No se ejecutaron eliminaciones reales ni se configuraron credenciales de producción durante la implementación.

Limitación importante: esta versión evita falsos éxitos y pérdida de datos; no desbloquea automáticamente la lámpara eliminada manualmente. Resolver esa discrepancia exige confirmar el estado remoto o definir una confirmación administrativa explícita. Tampoco garantiza exactamente-una-vez frente a fallos externos: prioriza bloquear ante incertidumbre.

Las pruebas de concurrencia simulan serialización; no sustituyen una prueba con dos conexiones PostgreSQL en un entorno de pruebas. No se probaron publicaciones ni eliminaciones reales durante este cambio.
