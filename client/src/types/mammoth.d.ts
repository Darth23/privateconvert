declare module 'mammoth' {
  interface ConvertToHtmlResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface Mammoth {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConvertToHtmlResult>;
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<ConvertToHtmlResult>;
  }

  const mammoth: Mammoth;
  export default mammoth;
}
