export function privateUrls(id: string): [string, string][] {
  const file = `dive/${id}.json`;
  return [
    ['GET', `/_private/${file}`],
    ['GET', `/%5Fprivate/${file}`],
    ['GET', `/_PrIvAtE/${file}`],
    ['GET', `//_private/${file}`],
    ['GET', `/./_private/${file}`],
    ['GET', `/%2e/_private/${file}`],
    ['GET', `/_private%2F${file}`],
    ['GET', `/_private/dive%2F${id}.json`],
    ['GET', `/_private/${file}/`],
    ['GET', `/_private/dive/${id}.JSON`],
    ['GET', `/_private/${file}?download=1`],
    ['HEAD', `/_private/${file}`],
    ['GET', `/%255Fprivate/${file}`],
  ];
}
