import { requestMeta } from './meta-api';

export class InstagramContainerError extends Error {
  constructor(message: string, readonly pending: boolean) { super(message); }
}

// Bounded wait for a server action. Never hold a database transaction while polling.
export async function waitForInstagramContainer(root: string, token: string, containerId: string, preparationDeadline = Infinity) {
  const deadline = Math.min(Date.now() + 20_000, preparationDeadline);
  while (Date.now() < deadline) {
    let data: { status_code?: string; status?: string };
    try {
      data = await requestMeta('consultar procesamiento del contenedor de Instagram', `${root}/${containerId}?fields=status_code,status`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        signal: AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - Date.now()))),
      });
    } catch (error) {
      throw new InstagramContainerError(`No se pudo confirmar el procesamiento del contenedor. Se conserva para revisión. ${error instanceof Error ? error.message : ''}`, true);
    }
    if (data?.status_code === 'FINISHED') return;
    if (data?.status_code === 'ERROR' || data?.status_code === 'EXPIRED') {
      throw new InstagramContainerError(`Instagram informó ${data.status_code} para el contenedor. No se solicitó publicar.`, false);
    }
    if (data?.status_code !== 'IN_PROGRESS') {
      throw new InstagramContainerError('Estado del contenedor inesperado o ya publicado. Se requiere conciliación; no se volverá a publicar automáticamente.', true);
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(2000, remaining)));
  }
  throw new InstagramContainerError('Instagram sigue procesando el contenedor. Se agotó la espera; se conserva el mismo intento para revisión, sin crear otro ni publicar automáticamente.', true);
}
