export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
    </span>
  );
}
export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <span className="text-headline">Stanford OYO</span>
    </div>
  );
}
