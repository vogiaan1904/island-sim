// The Khronos glTF validator ships no types; this covers the one call the pipeline makes.
declare module 'gltf-validator' {
  interface ValidatorMessage {
    code: string;
    message: string;
    /** 0 error, 1 warning, 2 information, 3 hint. */
    severity: number;
    pointer?: string;
  }
  interface ValidatorReport {
    issues: { numErrors: number; messages: ValidatorMessage[] };
  }
  const validator: {
    validateBytes(data: Uint8Array, options?: { externalResourceFunction?: (uri: string) => Promise<Uint8Array> }): Promise<ValidatorReport>;
  };
  export default validator;
}
