import { meshopt } from '@gltf-transform/functions';
import validator from 'gltf-validator';
import { MeshoptEncoder } from 'meshoptimizer';
import { createIO } from './glb.ts';

/** The Khronos glTF validator's errors for one file. It cannot decode meshopt, so it reads the staging file. */
export async function validate(bytes: Uint8Array): Promise<string[]> {
  const report = await validator.validateBytes(bytes, {
    externalResourceFunction: () => Promise.reject(new Error('models carry no external files')),
  });
  return report.issues.messages
    .filter((m) => m.severity === 0)
    .map((m) => `${m.code} ${m.message}${m.pointer ? ` at ${m.pointer}` : ''}`);
}

/** Validates a staging .glb from Blender and returns it meshopt-compressed (EXT_meshopt_compression). */
export async function pack(bytes: Uint8Array): Promise<Uint8Array> {
  const errors = await validate(bytes);
  if (errors.length > 0) throw new Error(`the glTF validator found errors: ${errors.join('; ')}`);
  const io = await createIO();
  const document = await io.readBinary(bytes);
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  return io.writeBinary(document);
}
