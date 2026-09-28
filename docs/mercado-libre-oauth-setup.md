# OAuth renovable de Mercado Libre

## Configuración

Registrar en la aplicación de Mercado Libre la URL exacta:

```text
https://www.smartbrew.tech/api/mercado-libre/oauth/callback
```

Configurar en el servidor:

```ini
MERCADO_LIBRE_CLIENT_ID=
MERCADO_LIBRE_CLIENT_SECRET=
MERCADO_LIBRE_APPLICATION_ID=<mismo App ID>
MERCADO_LIBRE_OAUTH_ORIGIN=https://www.smartbrew.tech
SUPPLIER_CREDENTIALS_ENCRYPTION_KEY=<64 caracteres hexadecimales>
```

`MERCADO_LIBRE_CLIENT_ID` es el App ID usado por OAuth. `MERCADO_LIBRE_APPLICATION_ID` lleva ese mismo valor y permite validar que las notificaciones recibidas pertenezcan a nuestra aplicación.

La clave de cifrado puede generarse una sola vez con `openssl rand -hex 32`. Debe conservarse igual entre despliegues: cambiarla impide descifrar las credenciales ya guardadas. En Vercel, tanto esta clave como `MERCADO_LIBRE_CLIENT_SECRET` deben cargarse como secretos.

Luego ingresar en `/admin/settings/mercado-libre` y elegir **Conectar Mercado Libre**.

## Comportamiento

- El callback valida y consume un `state` de un solo uso con vencimiento de diez minutos.
- Los access y refresh tokens se cifran en reposo.
- SmartBrew renueva el token dentro de los cinco minutos previos a su vencimiento.
- La renovación usa un lock por cuenta y persiste el refresh token de reemplazo antes de liberarlo.
- Si la renovación falla, las operaciones se detienen y el dashboard solicita reconectar la cuenta.
- `MERCADO_LIBRE_ACCESS_TOKEN` se conserva solamente como compatibilidad temporal cuando todavía no existe una conexión OAuth guardada.

Mercado Libre documenta que el refresh token es de un solo uso y que cada renovación devuelve su reemplazo: <https://developers.mercadolibre.com.ar/autenticacion-y-autorizacion>.
