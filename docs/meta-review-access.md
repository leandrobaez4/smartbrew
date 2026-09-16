# Acceso temporal para la revisión de Meta

## Despliegue

1. Aplicar `prisma/manual/20260916_meta_review_access.sql` y `prisma/manual/20260916_review_publication.sql` en Neon antes de desplegar (si la primera ya está aplicada, solo falta la segunda). Agregan columnas, índice y tabla de pruebas; no eliminan ni cambian datos existentes. No se ejecutaron automáticamente en producción.
2. Regenerar Prisma Client (`npx prisma generate`) durante el build y desplegar en Vercel.
3. Entrar como administrador a `/admin/instagram`, sección «Acceso exclusivo para revisión de Meta». Confirmar el destino y generar un enlace. Cada generación crea una cuenta aislada nueva; no renueva ni revoca las anteriores.
4. Copiar el enlace completo mostrado una sola vez y compartirlo exclusivamente en las instrucciones privadas de revisión de Meta. No enviarlo a logs, capturas públicas, repositorios o correo de soporte. Si se pierde, revocar ese acceso y generar otro.
5. Probar el enlace en una ventana privada. Pulsar «Entrar al portal de revisión», conectar una cuenta profesional distinta de la cuenta reservada del bot y comprobar el perfil. El hash del fragmento se quita del historial del navegador; para volver a entrar, abrir otra vez el enlace original.
6. Revocar el acceso desde «Todos los accesos» al terminar la revisión. La revocación deshabilita la cuenta, elimina el hash del enlace, las sesiones y la conexión guardada del portal. No revoca por sí misma los permisos de la app dentro de Instagram.

## Alcance y límites

El enlace es una credencial portadora aleatoria de 256 bits, reutilizable por 60 días. La base almacena únicamente SHA-256 del token. Las sesiones del portal duran como máximo 24 horas y nunca superan el vencimiento del acceso. En cada solicitud autenticada se vuelve a comprobar el vencimiento, el hash de revisión y la deshabilitación del miembro. Los accesos de revisión no pueden iniciar sesión por contraseña y no pasan por el flujo de invitación de correo de un solo uso.

«Para Meta» expresa el destino, no una comprobación de identidad: cualquiera con el enlace puede usarlo. No hay roles de administrador, bypass de permisos de Meta, ni acceso a productos, publicaciones, mensajes o eliminaciones de producción. Para accesos de revisión, OAuth solicita `instagram_business_basic` e `instagram_business_content_publish`; las invitaciones normales siguen solicitando solo Basic. Quien ya conectó la cuenta debe volver a autorizarla antes de probar publicación. La eliminación y las verificaciones de Facebook siguen fuera del alcance de este portal.

## Prueba de publicación

El revisor abre su enlace vigente, conecta/reautoriza una cuenta profesional propia y ve «Publicación de prueba para Meta». La pantalla muestra la imagen fija `/logo.jpg` (JPEG 1024 × 1024), el texto fijo y la cuenta de destino. Al marcar la confirmación y pulsar «Publicar foto de prueba en mi Instagram», se publica contenido real en esa cuenta usando exclusivamente su token cifrado del portal. La imagen debe estar disponible públicamente por HTTPS en `INSTAGRAM_PORTAL_ORIGIN`; verificarlo después del despliegue. No se permiten URLs ni cuentas arbitrarias recibidas del cliente.

Una tabla separada, ReviewPublication, conserva un único intento por acceso: PROCESSING, PUBLISHED, FAILED o UNCERTAIN, con IDs del contenedor/media y cuenta. La clave única bloquea doble clic, solicitudes paralelas y reintentos tras timeout. El intento permanece bloqueado aunque se desconecte y reconecte la cuenta. Una prueba fallida requiere revisión del administrador; no hay botón para repetir ni desbloqueo automático. Un nuevo enlace solo debe emitirse tras comprobar el resultado externo cuando haya incertidumbre. No generar otro enlace para reintentar a ciegas.

Se valida el perfil real del token y se bloquean los IDs de producción configurados y el usuario smartbrewmrl. Se espera FINISHED y se vuelve a comprobar sesión y conexión antes de solicitar media_publish. No se mantiene una transacción abierta durante las llamadas de red. Una revocación no puede deshacer una petición externa que ya está en curso. El resultado incierto conserva el bloqueo y el ID publicado si llegó a recibirse. Revocar el portal no elimina la foto remota; el revisor puede retirarla manualmente desde Instagram.

Para verificar el despliegue, usar un acceso de revisión distinto del enlace entregado a Meta, así no se consume su único intento. Confirmar en una cuenta de prueba propia el resultado publicado y conservar el enlace de Meta sin usar para esa prueba.

Una cuenta de revisión tiene una conexión compartida entre sus sesiones. No repartir un mismo enlace a organizaciones diferentes. Los datos de una conexión vencida se conservan hasta desconectar o revocar; el vencimiento bloquea acceso pero no es un proceso automático de borrado.

No se generan tokens de producción, no se envían invitaciones a Meta y no se ejecutan migraciones al implementar este cambio. La creación del enlace se hace después del despliegue desde el administrador autenticado.
