# Facebook: comentario Info → Messenger

Implementación independiente de Instagram. Solo comentarios nuevos cuyo texto,
tras trim y conversión a minúsculas, sea exactamente `info`. No responde a
“quiero”, “precio”, “más info”, comentarios propios, ediciones ni reacciones.
No envía respuesta pública ni procesa mensajes entrantes de Messenger.

## Configuración Production en Vercel

- `FACEBOOK_COMMENTS_ENABLED=true` (apagado por defecto).
- `FACEBOOK_PAGE_ID`: ID de la página confirmado por Graph API, no asumir que
  coincide con el ID del perfil público ni con el ID de Instagram.
- `FACEBOOK_PAGE_ACCESS_TOKEN`: token de ESA página con permisos de Messenger.
- `FACEBOOK_APP_SECRET`: secreto de la app que firma los eventos de Facebook.
- `FACEBOOK_WEBHOOK_VERIFY_TOKEN`: valor aleatorio elegido para el handshake.
- `FACEBOOK_GRAPH_API_VERSION=v26.0` (verificar compatibilidad de la app).
- `FACEBOOK_POST_PRODUCT_MAP`: JSON explícito como
  `{"PAGE_ID_POST_ID":"cmud7gwru0000jv04q4wnuo8t"}`. Reemplazar la clave por
  el `post_id` numérico real (`123_456`); el ejemplo con letras NO es válido.
- Reutiliza `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`,
  `QSTASH_NEXT_SIGNING_KEY`, `APP_URL=https://www.smartbrew.tech` y el bypass
  opcional de Vercel. Volver a desplegar después de cambiar variables.

Esta primera versión configura asociaciones en el servidor, no agrega un editor
de asociaciones en el admin. No se configuraron credenciales ni datos de producción.

## Meta y prueba real pendiente

1. Habilitar Messenger para la app y autorizar la página. Verificar
   `pages_messaging`, `pages_manage_metadata` y los permisos de lectura de
   comentarios (`pages_read_engagement` / `pages_read_user_content` según el
   acceso requerido). Para personas sin rol, verificar el acceso avanzado
   correspondiente. No hace falta moderar ni responder públicamente comentarios.
2. Configurar objeto Page y callback
   `https://www.smartbrew.tech/api/webhooks/facebook`, con el verify token
   configurado. Suscribir la app a `feed` para la página, no solo al campo en
   el panel. No modificar la suscripción existente de Instagram.
3. Con el mapa vacío, hacer un NUEVO comentario Info. El log de Vercel
   `[Facebook] unmapped_post` mostrará solo el ID numérico de la publicación.
   Confirmar que corresponde al anuncio/producto antes de agregarlo al mapa.
4. Guardar el mapa y redeploy. Hacer OTRO comentario Info, verificar QStash,
   `JobExecution` (`jobName=facebook_info_reply`) y la bandeja/solicitudes de
   Messenger del comentarista. No se reprocesan comentarios viejos automáticamente.
5. El envío usa `POST /PAGE_ID/messages`, recipient.comment_id y message.text.
   Se exige `message_id` como confirmación de Meta. Falta verificar esta llamada
   con token real y permisos de la app; la documentación web de Private Replies
   no fue accesible durante la implementación. No considerar habilitado ni
   aprobado hasta completar la prueba real. Respetar la ventana y elegibilidad
   de Private Replies que Meta aplique al comentario.

## Seguridad y operación

Se valida HMAC SHA256 del cuerpo con el App Secret antes de procesar y firma
QStash en el worker. Una página permitida, mapa explícito y producto ACTIVE con
enlace seguro; nunca se envía catálogo genérico ni se adivina un producto.
Job ID determinista por página/comentario, claim transaccional con bloqueo de
fila. Duplicados y carreras no repiten el envío. Un error previo de encolado
permite reentrega del mismo trabajo aún sin claim.

Un timeout o caída tras claim deja `CLAIMED` o `REVIEW_REQUIRED`: requiere
comprobar Messenger antes de una recuperación manual, no se reenvía a ciegas.
Esto prioriza evitar duplicados; no garantiza entrega exactamente una vez.
QStash delivered significa que el worker respondió, NO que Messenger entregó.
Los errores de Meta guardan HTTP/code, nunca tokens ni texto de su respuesta.
No hay cambios de esquema ni modificaciones a la automatización de Instagram.
