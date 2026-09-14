# Portal de Instagram: primera etapa de Basic

## Alcance

Accesos por invitación creados en `/admin/instagram`; activación y login en
`/portal/login`; autorización y perfil en `/portal/instagram`.
Los emails nuevos llevan a `/portal/activate#token=...`: no se pide correo ni copiar
código, solo una contraseña nueva. El token se identifica por su hash y se valida
en el servidor tanto al abrir como al confirmar. Solo confirmar consume la invitación
de forma atómica mediante el flujo de activación existente. El fragmento evita incluir
el token en logs HTTP; se envía al servidor únicamente en el cuerpo de las acciones.
No activar seguimiento de clics en Resend para estos enlaces sensibles. La página
requiere JavaScript. Los emails anteriores con código siguen funcionando desde
“Aceptar invitación” en el login. Para probar el flujo nuevo hay que reenviar el email.
No hay registro público. Las invitaciones se envían mediante Resend.
El código de activación vence en 7 días y se consume
una sola vez para elegir una contraseña. La sesión dura 24 horas. El login admite
5 intentos por cuenta cada 15 minutos. El administrador puede revocar el acceso.

### Email y listado del administrador

Configurar `RESEND_API_KEY` y `PORTAL_EMAIL_FROM` (por ejemplo,
`SmartBrew <invitaciones@smartbrew.tech>`) en Vercel Production y redeployar.
El dominio del remitente debe estar verificado en Resend mediante sus registros DNS.
Referencia: https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend
No se crean invitaciones si falta esta configuración. Volver a enviar al mismo correo
pendiente genera un código nuevo e invalida el anterior. No reinvita usuarios activos.
Reinvitar un usuario revocado lo deja pendiente de activación con contraseña nueva,
elimina sus sesiones y conexión anteriores y reinicia el límite de intentos, en una
transacción. Debe volver a conectar Instagram. No hay envío masivo ni reintentos automáticos.
Si falla o vence la solicitud a Resend, se conserva la invitación y se ofrece el
código al administrador como alternativa privada. Una respuesta exitosa significa
aceptación por Resend, no entrega en la bandeja: revisar entrega/rebotes en su dashboard.
Probar envío real, spam, activación, reenvío y errores del proveedor antes de darlo
por operativo. No registrar códigos ni cuerpos de email en logs.

`/admin/instagram` muestra correo, username, ID, última actualización y vencimiento
de las conexiones actuales del portal, sin consultar ni mostrar tokens. No es un
historial: desconectar/revocar elimina la conexión. No incluye el bot configurado
por variables de entorno ni verifica revocaciones remotas en tiempo real.

Los invitados NO son filas de User ni usan la cookie del admin. Cada consulta de
perfil usa el miembro de la sesión del servidor, nunca un ID proporcionado por el
navegador. Los tokens se cifran con AES-256-GCM y se vinculan al propietario.
El portal no suscribe webhooks, publica ni envía DMs. No reemplaza las variables
del bot existente. Se rechaza conectar el INSTAGRAM_ACCOUNT_ID reservado del bot.

## Configuración pendiente antes de producción

1. Revisar y aplicar la ampliación aditiva de `prisma/schema.prisma` a la base
   correcta con backup previo. El proyecto usa `prisma db push`: no ejecutar
   reset ni aceptar pérdida de datos. Se agregan PortalMember, PortalSession e
   InstagramConnection; no se modifican tablas existentes.
2. Ejecutar `npx prisma generate` en el build de despliegue.
3. Configurar en Production, sin modificar el token/base/ID del bot:
   - `INSTAGRAM_OAUTH_CLIENT_ID`: ID de la app de Instagram del flujo Instagram Login.
   - `INSTAGRAM_OAUTH_CLIENT_SECRET`: secreto de esa app de Instagram.
   - `INSTAGRAM_PORTAL_ORIGIN=https://www.smartbrew.tech`.
   - `INSTAGRAM_OAUTH_API_VERSION`: versión compatible seleccionada para la app
     (por defecto v21.0, igual que la integración existente; verificar soporte en Meta).
   - `INSTAGRAM_TOKEN_ENCRYPTION_KEY`: 32 bytes aleatorios codificados en 64 caracteres
     hexadecimales. Generar en un gestor de secretos. No pegar en chats ni git.
   - `SESSION_SECRET`: secreto robusto de al menos 32 caracteres para el admin.
4. Registrar EXACTAMENTE en las URLs de redirección OAuth de Instagram Login:
   `https://www.smartbrew.tech/api/instagram/callback`.
   Iniciar sesión en el mismo dominio, no en un alias vercel.app.
5. Desplegar y probar con una cuenta profesional distinta de la cuenta reservada.

## Prueba manual obligatoria (no validada contra Meta todavía)

- Crear invitación desde admin, activar con código y contraseña, cerrar sesión y volver a entrar.
- Código expirado/reutilizado: rechazar. Cuenta revocada: pierde acceso.
- Invitado sin cookie admin: `/admin/products`, `/admin/logs` y acciones de
  invitación deben rechazar acceso; probar también POST directo a las acciones.
- Conectar Instagram: aceptar Basic, regresar y ver username/user_id de la API.
- Rechazar permisos, state inválido/vencido y recargar callback: no guardar conexión.
- Dos miembros no pueden leer/actualizar/desconectar la conexión del otro.
- Actualizar perfil vuelve a consultar Meta. Token vencido pide reconectar.
- Desconectar borra el token local; no revoca permisos en Meta para no afectar el bot.
  El usuario puede retirar la autorización en Apps y sitios web de Instagram.
- Confirmar que un comentario real de SmartBrew sigue enviando el enlace del producto.

## Grabación y revisión

Grabar login del portal, Conectar Instagram, autorización oficial, vuelta al portal
y perfil real consultado. No mostrar contraseñas, códigos de invitación, secretos,
tokens ni el query del callback. Crear credenciales de SmartBrew exclusivas para
el revisor; nunca proporcionar credenciales de Instagram. El formulario de Basic
debe describir esta primera etapa real. Este portal solo solicita Basic, no sirve
por sí solo como demostración de automatizaciones multicuenta ni garantiza aprobación.

## Limitaciones explícitas

No hay recuperación autónoma de contraseña, facturación, renovación automática de
tokens ni automatización multicuenta. El token de larga duración muestra su vencimiento
y el usuario puede reconectar. Antes de ofrecer pilotos públicos: probar aislamiento
contra una base de test, completar pruebas OAuth reales, callbacks de revocación/
eliminación de datos según la configuración de Meta y revisar retención de datos.
