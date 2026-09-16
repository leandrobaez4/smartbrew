# Acceso temporal para la revisión de Meta

## Despliegue

1. Aplicar `prisma/manual/20260916_meta_review_access.sql` en Neon antes de desplegar. Agrega dos columnas y un índice único; no elimina ni cambia datos existentes. No se ejecutó automáticamente en producción.
2. Regenerar Prisma Client (`npx prisma generate`) durante el build y desplegar en Vercel.
3. Entrar como administrador a `/admin/instagram`, sección «Acceso exclusivo para revisión de Meta». Confirmar el destino y generar un enlace. Cada generación crea una cuenta aislada nueva; no renueva ni revoca las anteriores.
4. Copiar el enlace completo mostrado una sola vez y compartirlo exclusivamente en las instrucciones privadas de revisión de Meta. No enviarlo a logs, capturas públicas, repositorios o correo de soporte. Si se pierde, revocar ese acceso y generar otro.
5. Probar el enlace en una ventana privada. Pulsar «Entrar al portal de revisión», conectar una cuenta profesional distinta de la cuenta reservada del bot y comprobar el perfil. El hash del fragmento se quita del historial del navegador; para volver a entrar, abrir otra vez el enlace original.
6. Revocar el acceso desde «Todos los accesos» al terminar la revisión. La revocación deshabilita la cuenta, elimina el hash del enlace, las sesiones y la conexión guardada del portal. No revoca por sí misma los permisos de la app dentro de Instagram.

## Alcance y límites

El enlace es una credencial portadora aleatoria de 256 bits, reutilizable por 60 días. La base almacena únicamente SHA-256 del token. Las sesiones del portal duran como máximo 24 horas y nunca superan el vencimiento del acceso. En cada solicitud autenticada se vuelve a comprobar el vencimiento, el hash de revisión y la deshabilitación del miembro. Los accesos de revisión no pueden iniciar sesión por contraseña y no pasan por el flujo de invitación de correo de un solo uso.

«Para Meta» expresa el destino, no una comprobación de identidad: cualquiera con el enlace puede usarlo. No hay roles de administrador, bypass de permisos de Meta, ni acceso a productos, publicaciones, mensajes o eliminaciones de producción. La conexión usa el OAuth real y solicita únicamente `instagram_business_basic`. La aprobación de otros permisos aún requiere su propio mecanismo de prueba; este enlace no los habilita.

Una cuenta de revisión tiene una conexión compartida entre sus sesiones. No repartir un mismo enlace a organizaciones diferentes. Los datos de una conexión vencida se conservan hasta desconectar o revocar; el vencimiento bloquea acceso pero no es un proceso automático de borrado.

No se generan tokens de producción, no se envían invitaciones a Meta y no se ejecutan migraciones al implementar este cambio. La creación del enlace se hace después del despliegue desde el administrador autenticado.
