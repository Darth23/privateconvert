declare module 'piexifjs' {
  function load(data: string): any;
  function dump(exif: any): string;
  function remove(data: string): string;
  export { load, dump, remove };
}
