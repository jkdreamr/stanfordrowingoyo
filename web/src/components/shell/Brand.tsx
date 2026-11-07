export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <img src="/icon.svg" width="40" height="40" alt="" />
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
