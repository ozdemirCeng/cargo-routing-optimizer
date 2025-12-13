declare module '@mapbox/polyline' {
  export type PolylinePoint = [number, number];

  export function encode(points: PolylinePoint[], precision?: number): string;
  export function decode(str: string, precision?: number): PolylinePoint[];

  const polyline: {
    encode: typeof encode;
    decode: typeof decode;
  };

  export default polyline;
}
