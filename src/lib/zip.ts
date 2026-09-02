import { zipSync, type Zippable } from 'fflate';
import { decode as b64ToBytes, encode as bytesToB64 } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

export interface ZipEntry {
  /** File name inside the archive. */
  name: string;
  /** Source file uri to read (base64). */
  uri?: string;
  /** Or inline text content. */
  text?: string;
}

/** Builds a .zip in the cache directory from the given entries and returns its uri. */
export async function buildZip(outName: string, entries: ZipEntry[]): Promise<string> {
  const files: Zippable = {};
  for (const entry of entries) {
    if (entry.text != null) {
      files[entry.name] = new TextEncoder().encode(entry.text);
    } else if (entry.uri) {
      const b64 = await FileSystem.readAsStringAsync(entry.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      files[entry.name] = new Uint8Array(b64ToBytes(b64));
    }
  }

  const zipped = zipSync(files, { level: 6 });
  const buffer = zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength,
  ) as ArrayBuffer;

  const uri = `${FileSystem.cacheDirectory}${outName}`;
  await FileSystem.writeAsStringAsync(uri, bytesToB64(buffer), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}
