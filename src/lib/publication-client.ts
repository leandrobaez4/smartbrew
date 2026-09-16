// Network/server-action failures must not be rendered as success or leave a spinner stuck.
export async function runPublicationAction<T extends { success: boolean; message?: string }>(action: () => Promise<T>): Promise<T | { success: false; message: string }> {
  try { return await action(); }
  catch { return { success: false, message: 'Se perdió la respuesta del servidor. Verificá el estado antes de reintentar: la operación podría haberse procesado.' }; }
}
