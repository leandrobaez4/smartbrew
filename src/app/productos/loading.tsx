export default function ProductosLoading() {
  return <div className="catalog-page">
    <main className="catalog-main catalog-loading" aria-busy="true" aria-label="Cargando productos">
      <div className="catalog-loading-line catalog-loading-kicker" />
      <div className="catalog-loading-line catalog-loading-title" />
      <div className="catalog-loading-line catalog-loading-copy" />
      <div className="catalog-loading-grid">
        {Array.from({ length: 6 }, (_, index) => <div className="catalog-loading-card" key={index} />)}
      </div>
    </main>
  </div>;
}
