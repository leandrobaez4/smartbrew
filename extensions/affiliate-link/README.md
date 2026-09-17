# Prueba local: enlace afiliado

El endpoint de generación es el indicado por el usuario, no una API pública verificada. Puede exigir protecciones adicionales (CSRF), cambiar o rechazar la llamada. No se intenta evadir controles ni reintentar errores.

## Instalación y prueba manual

1. En Chrome, abrí `chrome://extensions` y activá **Modo de desarrollador**.
2. Elegí **Cargar descomprimida** y seleccioná esta carpeta `extensions/affiliate-link` (no la raíz del repositorio).
3. Abrí un producto en `https://www.mercadolibre.com.ar` con tu sesión de Afiliados iniciada.
4. Abrí la extensión desde el icono de extensiones de Chrome.
5. Presioná **Generar para este producto** y mantené el panel abierto hasta recibir respuesta.
6. Copiá el enlace visible, o informá únicamente el mensaje de error. No compartas cookies, tokens ni respuestas privadas.

La etiqueta fija de esta prueba es `leandrobaez1983`. La URL se obtiene de la pestaña actual. Generar un enlace puede agregar el producto a «Mis recomendaciones» de Mercado Libre. No se publica en redes ni se compra nada.

## Permisos y límites

- `activeTab`: acceso temporal a la pestaña donde abrís la extensión; el código solo funciona en el dominio exacto permitido.
- `scripting`: ejecuta el código empaquetado en contexto aislado, sin acceder a variables privadas de la página.
- Sin permisos `cookies`, almacenamiento, historial, acceso permanente a dominios ni scripts remotos.
- El navegador adjunta la sesión a la solicitud del mismo origen; la extensión no extrae ni guarda cookies. No envía datos a Vercel.
- Si responde 401/403, no se considera una prueba exitosa. No hay bypass de CSRF ni CAPTCHA.
- No hay reintentos automáticos. Una respuesta perdida puede haber generado el enlace; revisar antes de repetir.
- Esta prueba reconoce únicamente un enlace HTTPS `meli.la` inequívoco en la respuesta JSON. Otros formatos necesitan inspección posterior sin secretos.

La instalación y la prueba real deben completarse manualmente; los tests con respuestas simuladas no confirman compatibilidad con Mercado Libre.

## Enviar a SmartBrew (versión 0.2)

Después de generar el enlace, «Enviar a SmartBrew» abre `https://www.smartbrew.tech/admin/products/affiliate` con URL, título, imagen y enlace en los parámetros de navegación (visibles en historial y potencialmente logs). No envía cookies ni credenciales. Si falta el título, no habilita el botón. La pantalla requiere sesión de administrador y una confirmación explícita antes de escribir.

- Existente: actualiza solo el enlace; exige confirmar si se reemplaza otro y comprueba cambios concurrentes.
- Nuevo: persiste un JobExecution, publica su ID en QStash y el consumidor crea un CANDIDATE con los datos de la página y el enlace. No consulta precio/stock ni publica en Instagram.
- La identidad se toma del path MLA de la URL, como en la importación previa; un catálogo y una publicación de vendedor pueden tener IDs diferentes, no se fusionan por título.
- Entregas repetidas: bloqueo transaccional del trabajo, clave única marketplace/externalId y guardado atómico. Dos trabajos con distintos enlaces no se sobrescriben silenciosamente.
- Consultar el estado actualizando la pantalla de confirmación. STARTED indica pendiente; un error de envío a QStash no se muestra como éxito. Puede confirmarse nuevamente para reenviar de forma idempotente. No hay reenvío automático de trabajos que no hayan alcanzado QStash.
- Conflicto en consumidor: marca FAILED y conserva el enlace existente; no reintenta indefinidamente un conflicto que requiere decisión humana.

Servidor: configurar `APP_URL=https://www.smartbrew.tech`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` y `QSTASH_NEXT_SIGNING_KEY`. Opcional: `VERCEL_AUTOMATION_BYPASS_SECRET` para protección de despliegues. Endpoint: `/api/queue/affiliate-import`, firma obligatoria incluso si faltan claves (falla cerrado). No requiere migración: usa Product y JobExecution existentes.

Desplegar SmartBrew y recargar la extensión en `chrome://extensions` antes de la prueba integrada. Si hay login intermedio, volver a enviar desde la extensión. El botón en el listado de productos queda fuera de esta etapa: el envío comienza desde Mercado Libre.

Pruebas: `node --test extensions/affiliate-link/request.test.mjs`.
