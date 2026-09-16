# Publicaciones: seguridad y despliegue

## Verificación visible mediante Facebook Login

En `/admin/products/[id]`, la sección «Verificación de Instagram mediante Facebook» permite consultar la cuenta (`id,username`) y, seleccionando una publicación activa del producto, su `id,owner`. Usa exclusivamente la configuración `INSTAGRAM_DELETE_FACEBOOK_*` del servidor, no la conexión del portal. Ambas consultas son GET sin caché y con timeout de 10 segundos cada una. La acción exige sesión administrativa, valida los identificadores y busca la publicación dentro del producto antes de consultar Meta.

La interfaz muestra los IDs, usuario, resultado de comparación de propietario y fecha de consulta. Un propietario diferente nunca aparece como verificado. Los errores no confirman eliminación. No se escriben registros ni se cambian estados; tampoco se exponen tokens ni respuestas crudas del proveedor. Esta comprobación puntual no sustituye la verificación que se realiza al eliminar. No requiere nuevas variables ni migraciones. Para la grabación de revisión, usar una publicación activa y mostrar ambos botones y sus resultados; no mostrar credenciales.

## Despliegue y seguridad de publicaciones

Antes de desplegar, aplicar `prisma/manual/20260915_publication_soft_delete.sql` a la base del entorno y regenerar Prisma Client. La migración es aditiva; no elimina registros. No se ejecutó automáticamente en producción.

Cada intento conserva su propia Publication. La reserva UPLOADING se crea en una transacción que bloquea la fila Product con SELECT FOR UPDATE. Todas las publicaciones de todos los borradores del producto se consideran para impedir duplicados entre instancias. La transacción termina antes de llamar a Meta.

Se guarda externalContainerId antes de media_publish. Solo un ID válido de Meta y un guardado exitoso producen éxito en pantalla. Si la respuesta es incierta o falla el guardado tras publicar, PROCESSING bloquea nuevos intentos. No hay vencimiento automático del bloqueo: podría existir un post real. Conciliar con el contenedor, ID remoto y cuenta de Instagram antes de cambiarlo. Un proceso terminado abruptamente también requiere conciliación.

Antes de media_publish se consulta el mismo contenedor hasta obtener status_code FINISHED, con una espera máxima de 20 segundos, pausas de 2 segundos y consultas de hasta 5 segundos (acotadas por el tiempo restante). ERROR o EXPIRED termina el intento como FAILED sin publicar. Si sigue IN_PROGRESS, no se puede consultar su estado o devuelve un estado inesperado, se conserva PROCESSING para revisión. El error 9007/2207027 al publicar también conserva ese bloqueo y el ID del contenedor. No hay reanudación automática ni creación de otro contenedor al agotarse la espera; la conciliación administrativa de la interfaz no libera registros PROCESSING. Este cambio no requiere variables nuevas ni migraciones.

La verificación es de solo lectura: un 400/404, token inválido o falta de permisos no confirma eliminación. Ninguna de estas respuestas borra filas ni relaciones.

La eliminación remota usa DELETE /<IG_MEDIA_ID> con Facebook Login, documentado en https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media y anunciado el 3 de diciembre de 2025 en el changelog. No archiva: elimina el post. La configuración es independiente de publicación y mensajes:

- `INSTAGRAM_DELETE_FACEBOOK_ACCESS_TOKEN`: token de usuario de Facebook obtenido mediante Facebook Login for Business, con `instagram_basic` e `instagram_manage_contents`. No reutilizar el token de Instagram Login ni exponerlo al cliente.
- `INSTAGRAM_DELETE_FACEBOOK_ACCOUNT_ID`: ID de la cuenta profesional de Instagram obtenido por esa integración; no es el ID de la página de Facebook.
- `INSTAGRAM_DELETE_GRAPH_API_VERSION`: por defecto `v26.0`.

Cargar estas variables en Vercel Production y redesplegar. Sin credenciales no hay mutaciones. Esta implementación es para la cuenta administrada por SmartBrew, con configuración manual de servidor: NO agrega onboarding OAuth de Facebook para clientes del portal. La autorización y aprobación de permisos en Meta deben completarse por separado.

Se verifica id y owner antes del DELETE. Bajo el mismo bloqueo Product usado para publicar se persiste DELETE_IN_PROGRESS. El estado permanece PUBLISHED para impedir republicaciones mientras se elimina. Solo `success === true` con `deleted_id` exactamente igual al solicitado permite asignar `deletedAt`. No se borran filas, IDs, relaciones ni se pausa el producto. Si Meta rechaza, queda DELETE_REJECTED; si el resultado es incierto, falla el guardado o el proceso se interrumpe, se bloquean reintentos con DELETE_RECONCILIATION_REQUIRED o DELETE_IN_PROGRESS. Estos casos requieren revisión administrativa, nunca desbloqueo automático por tiempo. En lotes se informa cuántas eliminaciones se confirmaron antes de un error.

No hay conciliación automática de eliminaciones manuales. Un 404 no confirma una eliminación. El historial y la asociación media-producto usados por DM se conservan. No se ejecutaron eliminaciones reales ni se configuraron credenciales de producción durante la implementación.

## Conciliación administrativa

En el detalle del producto, cada publicación activa tiene «Conciliar registro de Instagram». Exige motivo de 10–1000 caracteres, casilla de autorización y confirmación final con el ID del registro. Es una decisión humana explícita, nunca una deducción automática de un error de Meta o una lista vacía.

La acción autenticada bloquea la fila Product y vuelve a comprobar el registro exacto y su pertenencia al producto. No permite conciliar durante QUEUED/UPLOADING/PROCESSING ni DELETE_IN_PROGRESS. En una misma transacción escribe SystemLog con administrador, motivo, IDs, fecha y errores anteriores, y asigna deletedAt con código ADMIN_RETIRED. No modifica el ID remoto, el borrador, las relaciones, el estado original ni el producto. El historial muestra «RETIRADA ADMINISTRATIVAMENTE (sin confirmación de Meta)», distinto de una eliminación remota confirmada. No requiere otra migración aparte del deletedAt ya existente.

No llama a Meta ni publica de nuevo. El administrador debe revisar la cuenta y asumir el riesgo de duplicados antes de retirar el registro. Si ya no quedan otras publicaciones activas o en curso, una nueva publicación manual queda habilitada. Un proceso interrumpido en DELETE_IN_PROGRESS requiere investigación adicional; esta opción no libera ese bloqueo.

Limitación importante: no garantiza exactamente-una-vez frente a fallos externos; prioriza bloquear ante incertidumbre. La conciliación no modifica por sí sola datos de producción hasta que un administrador la confirme desde la interfaz desplegada.

Las pruebas de concurrencia simulan serialización; no sustituyen una prueba con dos conexiones PostgreSQL en un entorno de pruebas. No se probaron publicaciones ni eliminaciones reales durante este cambio.
