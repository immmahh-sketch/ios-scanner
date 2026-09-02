import { Skia, TileMode, FilterMode, MipmapMode, ImageFormat } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { Orientation, ScanMode } from '../types';
import { uid } from './ids';

// Longest edge we keep. VisionKit hands back ~3000-4000px images; 2600 keeps
// text crisp while keeping PDFs a sane size.
const MAX_EDGE = 2600;

const MODE_VALUE: Record<ScanMode, number> = {
  bw: 0,
  'color-doc': 1,
  'color-photo': 2,
};

// Single-pass colour grade. Tunable entirely from JS, so the "look" of each
// mode can be changed with an OTA update — no rebuild.
const SKSL = `
uniform shader image;
uniform float mode;

half3 sat(half3 rgb, half amount) {
  half l = dot(rgb, half3(0.2126, 0.7152, 0.0722));
  return clamp(mix(half3(l), rgb, amount), 0.0, 1.0);
}

half4 main(float2 xy) {
  half4 c = image.eval(xy);
  half3 rgb = c.rgb;

  if (mode < 0.5) {
    // Black & white document: greyscale + levels + mild gamma.
    half l = dot(rgb, half3(0.2126, 0.7152, 0.0722));
    half black = 0.26;
    half white = 0.74;
    half v = clamp((l - black) / (white - black), 0.0, 1.0);
    v = pow(v, 0.85);
    return half4(v, v, v, 1.0);
  } else if (mode < 1.5) {
    // Colour document: lift black point, add contrast + saturation.
    rgb = clamp((rgb - 0.05) / 0.92, 0.0, 1.0);
    rgb = clamp((rgb - 0.5) * 1.18 + 0.5, 0.0, 1.0);
    rgb = sat(rgb, 1.22);
    return half4(rgb, 1.0);
  } else {
    // Colour photo: gentle, natural enhance only.
    rgb = clamp((rgb - 0.5) * 1.05 + 0.5, 0.0, 1.0);
    rgb = sat(rgb, 1.06);
    return half4(rgb, 1.0);
  }
}
`;

let cachedEffect: ReturnType<typeof Skia.RuntimeEffect.Make> | null = null;
function getEffect() {
  if (!cachedEffect) {
    cachedEffect = Skia.RuntimeEffect.Make(SKSL);
    if (!cachedEffect) throw new Error('Failed to compile image filter.');
  }
  return cachedEffect;
}

export interface ProcessedImage {
  uri: string;
  width: number;
  height: number;
  orientation: Orientation;
}

function orientationOf(width: number, height: number): Orientation {
  return width > height ? 'landscape' : 'portrait';
}

async function decodeToSkiaImage(uri: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64));
  if (!image) throw new Error('Could not decode the scanned image.');
  return image;
}

/**
 * Applies the selected colour mode to a raw scanned page and writes a new JPEG
 * to the cache directory. Returns the processed file plus its dimensions and
 * detected orientation.
 */
export async function processScan(rawUri: string, mode: ScanMode): Promise<ProcessedImage> {
  let image = await decodeToSkiaImage(rawUri);

  // VisionKit pages can be ~3000-4000px on the long edge. Cap them so PDFs stay
  // a sane size, re-decoding the downscaled JPEG.
  const longest = Math.max(image.width(), image.height());
  if (longest > MAX_EDGE) {
    const scale = MAX_EDGE / longest;
    const resized = await manipulateAsync(
      rawUri,
      [{ resize: { width: Math.round(image.width() * scale) } }],
      { compress: 0.95, format: SaveFormat.JPEG },
    );
    image = await decodeToSkiaImage(resized.uri);
  }

  const w = image.width();
  const h = image.height();

  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('Could not allocate an image surface.');

  const imageShader = image.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Linear,
    MipmapMode.None,
  );
  const shader = getEffect()!.makeShaderWithChildren([MODE_VALUE[mode]], [imageShader]);

  const paint = Skia.Paint();
  paint.setShader(shader);

  const canvas = surface.getCanvas();
  canvas.drawPaint(paint);
  surface.flush();

  const snapshot = surface.makeImageSnapshot();
  const outBase64 = snapshot.encodeToBase64(ImageFormat.JPEG, 92);

  const outUri = `${FileSystem.cacheDirectory}proc-${uid()}.jpg`;
  await FileSystem.writeAsStringAsync(outUri, outBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { uri: outUri, width: w, height: h, orientation: orientationOf(w, h) };
}

/** Rotates an already-processed page by a clockwise multiple of 90 degrees. */
export async function rotateImage(uri: string, degrees: number): Promise<ProcessedImage> {
  const result = await manipulateAsync(uri, [{ rotate: degrees }], {
    compress: 0.92,
    format: SaveFormat.JPEG,
  });
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    orientation: orientationOf(result.width, result.height),
  };
}
