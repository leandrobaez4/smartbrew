# Revisión de instagram_business_basic — borrador

No enviar todavía: falta configurar Vercel, aplicar las tablas, desplegar y probar
OAuth real. Este guion se basa en los requisitos que muestra el formulario de Meta.

## Descripción para adaptar después de validar

SmartBrew utiliza instagram_business_basic para identificar la cuenta profesional
de Instagram que autoriza la conexión dentro de su portal privado. Tras iniciar
sesión en SmartBrew, la persona selecciona “Conectar Instagram” y autoriza el acceso
en la pantalla oficial de Instagram. SmartBrew consulta y muestra el nombre de
usuario y el identificador de esa cuenta en la página de conexión. Esto permite
confirmar qué cuenta se conectó y volver a consultar su información mediante
“Actualizar perfil”. La persona también puede eliminar la conexión local.

Este permiso es necesario para leer esos datos desde la API de Instagram. El portal
no solicita la contraseña de Instagram ni muestra el token. En esta etapa el flujo
OAuth del portal solicita únicamente instagram_business_basic; no publica contenido
ni automatiza mensajes para las cuentas conectadas mediante este portal.

La automatización existente de SmartBrew para comentarios y respuestas privadas es
una integración separada. No presentar este portal como prueba de esas funciones
ni afirmar que ya existe automatización para múltiples empresas.

## Acceso del revisor

1. Crear un acceso exclusivo desde `/admin/instagram` después del despliegue.
2. Activarlo y comprobar su login. No otorgar acceso al administrador de SmartBrew.
3. Entregar usuario y contraseña de ESE acceso en el campo privado del formulario
   de revisión, no en este archivo ni en el repositorio.
4. Indicar como inicio `https://www.smartbrew.tech/portal/login`.
5. Indicar que el perfil aparece en `https://www.smartbrew.tech/portal/instagram`
   tras autorizar “Conectar Instagram” con la cuenta profesional del revisor.

Nunca entregar credenciales de Instagram. El portal reserva la cuenta del bot
existente; usar una cuenta profesional de prueba distinta para la grabación.
Confirmar antes de enviar que este alcance refleja la solicitud deseada: aprobar
este portal no equivale a aprobar los permisos de comentarios/mensajes del bot.

## Guion de grabación (aproximadamente 2 minutos)

1. Mostrar el portal y explicar: “This is SmartBrew's private Instagram connection
   portal.” Iniciar sesión sin revelar la contraseña.
2. Mostrar el estado sin conexión y pulsar “Conectar Instagram”. Subtítulo:
   “The user connects their Instagram professional account through Instagram.”
3. Mostrar la autorización oficial y el permiso solicitado. Ocultar contraseña,
   códigos de verificación y cualquier secreto. No simular esta pantalla.
4. Regresar al portal; mostrar el nombre de usuario e ID reales. Subtítulo:
   “SmartBrew reads and displays the authorized account's username and user ID
   using instagram_business_basic.”
5. Pulsar “Actualizar perfil” y mostrar el resultado. Subtítulo:
   “Refresh profile retrieves the account information again from Instagram.”
6. Mostrar “Desconectar” y explicar que elimina la conexión guardada en SmartBrew,
   no la autorización en Meta. No hace falta desconectar durante la grabación.

Si la UI sigue en español, agregar estos subtítulos en inglés. Evitar capturar
la URL transitoria del callback, porque contiene el código de autorización.

## Antes de enviar

- Probar todos los pasos con el acceso que recibirá el revisor.
- Revisar privacidad y eliminación de datos para que describan también el portal.
- Completar los requisitos de revocación/eliminación que muestre Meta.
- Grabar el funcionamiento real después del despliegue, sin errores ni secretos.
- No marcar cumplimiento ni enviar la solicitud hasta revisar personalmente los
  términos y la descripción final. La grabación no garantiza la aprobación.
