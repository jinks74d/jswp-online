// mammoth ships types for its main entry but not the browser subpath we
// dynamic-import in the source-upload component. Minimal ambient declaration
// for the one call we make.
declare module "mammoth/mammoth.browser" {
  interface ConvertResult {
    value: string;
    messages: unknown[];
  }
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConvertResult>;
  };
  export default mammoth;
}
