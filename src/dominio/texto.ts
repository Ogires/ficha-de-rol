export const recortar = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : s);
