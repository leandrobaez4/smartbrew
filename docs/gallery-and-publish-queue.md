# Galería e Instagram por QStash

## Despliegue

1. Antes de desplegar, ejecutar en Neon `prisma/manual/20260917_product_gallery.sql`. Es aditivo: conserva la portada y todos los datos existentes. No se ha ejecutado desde el agente.
2. Generar Prisma Client durante el build (el esquema incorpora `Product.imageUrls`).
3. Configurar `APP_URL` con el dominio HTTPS canónico, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` y las credenciales existentes de Instagram. No enviar estos secretos a la extensión.
4. Desplegar y recargar la extensión local en Chrome (versión 0.3.4).
5. Confirmar límites de tiempo del plan: consumidor `maxDuration=120`, entrega QStash `timeout=90s`. El procesamiento de Meta tiene timeouts explícitos de 20 s por petición y espera de contenedor acotada. Los límites de infraestructura siguen existiendo; no se garantiza ausencia de todo timeout.

## Galería

La extensión recoge exclusivamente elementos img.ui-pdp-image.ui-pdp-gallery__figure__image, tanto para la portada como para la galería; no usa og:image ni otras imágenes dentro de contenedores de galería. Selecciona resoluciones de srcset y data-srcset, admite data-zoom y deduplica por identificador de foto cuando está disponible. Máximo 20 fotos por envío y 40 conservadas por producto. No inventa URLs ni carga imágenes que no estén presentes en el DOM. Algunas fotos lazy-loaded podrían necesitar abrir la galería primero. Las imágenes incorrectas guardadas anteriormente no se eliminan automáticamente.

La confirmación y el worker validan dominio HTTPS mlstatic. Las URLs viajan en parámetros de navegación junto con el resto de los datos del producto. Se conserva la portada; reenviar un producto existente agrega fotos sin eliminar la galería anterior. El detalle del admin muestra miniaturas.

Instagram utiliza la portada seguida de la galería, deduplicada por foto. Una imagen mantiene la publicación simple; entre 2 y 10 crean un carrusel. Más de 10 bloquea el intento con un error explícito antes de contactar Meta: no se recorta la selección silenciosamente ni se divide en varios posts. Revisar las imágenes existentes antes de publicar, especialmente las importadas antes del filtro ui-pdp-image.

El worker crea los contenedores hijos en paralelo y espera a todos; solo crea y publica el padre si cada hijo está listo. El caption y el enlace van en el padre y se guarda su ID publicado para mantener la asociación producto/comentarios. La preparación comparte un presupuesto de 60 segundos y la publicación final tiene un timeout de 20 segundos. Un fallo de un hijo no publica un carrusel incompleto. Los resultados inciertos siguen bloqueados para revisión; las publicaciones existentes no se modifican automáticamente.

## Publicación múltiple

El botón del listado usa una acción autenticada de encolado, un JobExecution por producto y un mensaje firmado por trabajo. La pantalla deja de esperar las llamadas a Meta. QStash limita la concurrencia del grupo a 1 mediante [Flow Control](https://upstash.com/docs/qstash/features/flowcontrol).

El worker `/api/queue/product-publish` exige claves y firma válidas. Usa el servicio de publicación con bloqueo del producto y los controles previos de duplicados. Se preservan IDs e historial. El detalle y la vista previa individual también usan la misma acción de encolado del listado, sin esperar a Meta ni informar una publicación confirmada al encolar.

- Producto con trabajo STARTED: no se crea otro trabajo ni se vuelve a enviar a QStash. La respuesta distingue los nuevos encolados de los que ya estaban en cola/procesando. La comprobación se realiza con bloqueo del producto, incluso ante dos clics simultáneos.
- Envío a QStash incierto: se conserva la reserva y se informa el error. No se reenvía desde el botón normal: requiere verificar QStash y recuperar administrativamente el trabajo para no duplicar una entrega que sí pudo haberse aceptado.
- Reentrega de trabajo completado o fallido: no repite la publicación.
- Trabajo reclamado e interrumpido: no lo vuelve a ejecutar ciegamente; se señala revisión después de tres minutos. Verificar logs y estado real antes de conciliar. No hay recuperación automática de efectos externos ambiguos.
- Error confirmado por Meta o resultado incierto: queda registrado en Publication y JobExecution. Un HTTP 200 del consumidor significa trabajo atendido, no publicación exitosa.
- Ver el resultado en la columna Instagram y usar «Actualizar estado de la cola». Los errores completos están en el tooltip y registros del admin.
- No hay un cron ni botón de recuperación para mensajes nunca aceptados por QStash; deben revisarse antes de recuperarlos administrativamente.

Pruebas locales con mocks: `npm test` y `node --test extensions/affiliate-link/request.test.mjs extensions/affiliate-link/gallery.test.mjs`. La prueba de producción y la instalación de extensión requieren intervención del usuario; no se ha publicado nada remotamente desde estas pruebas.
