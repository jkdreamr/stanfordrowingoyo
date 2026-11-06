export type Row<T> = { [K in keyof T]: T[K] extends boolean ? number : T[K] };
