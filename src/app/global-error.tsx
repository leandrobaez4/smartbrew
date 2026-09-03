'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Algo salió mal!</h2>
        <button onClick={() => reset()}>Intentar de nuevo</button>
      </body>
    </html>
  );
}
