type CloudinaryImageOptions = {
  width?: number;
  height?: number;
  mode?: "fill" | "fit";
  quality?: string;
};

type UploadImageOptions = {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  mimeType?: "image/webp" | "image/jpeg";
};

function isCloudinaryUrl(src: string) {
  return /^https:\/\/res\.cloudinary\.com\//i.test(src);
}

function buildCloudinaryTransformations(options: CloudinaryImageOptions) {
  return [
    "f_auto",
    options.quality ?? "q_auto",
    "dpr_auto",
    options.mode === "fit" ? "c_fit" : "c_fill",
    options.width ? `w_${Math.round(options.width)}` : null,
    options.height ? `h_${Math.round(options.height)}` : null,
  ]
    .filter(Boolean)
    .join(",");
}

export function optimizeImageUrl(src: string | null | undefined, options: CloudinaryImageOptions = {}) {
  const value = String(src ?? "").trim();
  if (!value || !isCloudinaryUrl(value)) return value;

  const marker = "/upload/";
  const markerIndex = value.indexOf(marker);
  if (markerIndex === -1) return value;

  const prefix = value.slice(0, markerIndex + marker.length);
  const suffix = value.slice(markerIndex + marker.length);

  if (/^(?:f_|q_|c_|w_|h_|dpr_)/.test(suffix)) {
    return value;
  }

  const transformations = buildCloudinaryTransformations(options);

  return `${prefix}${transformations}/${suffix}`;
}

type ResponsiveImageOptions = CloudinaryImageOptions & {
  widths: number[];
  sizes: string;
};

export function buildResponsiveImageAttrs(
  src: string | null | undefined,
  options: ResponsiveImageOptions,
) {
  const value = String(src ?? "").trim();
  if (!value) {
    return { src: "", sizes: options.sizes };
  }

  const uniqueWidths = Array.from(
    new Set(options.widths.map((width) => Math.max(1, Math.round(width)))),
  ).sort((left, right) => left - right);

  if (uniqueWidths.length === 0) {
    return {
      src: optimizeImageUrl(value, {
        width: options.width,
        height: options.height,
        mode: options.mode,
        quality: options.quality,
      }),
      sizes: options.sizes,
    };
  }

  const baseWidth = options.width ?? uniqueWidths[uniqueWidths.length - 1]!;
  const baseHeight = options.height;
  const baseOptions: CloudinaryImageOptions = {
    mode: options.mode,
    quality: options.quality,
  };
  const srcSet = isCloudinaryUrl(value)
    ? uniqueWidths
        .map((width) => {
          const scaledHeight =
            baseHeight && baseWidth
              ? Math.max(1, Math.round((baseHeight * width) / baseWidth))
              : undefined;

          return `${optimizeImageUrl(value, {
            ...baseOptions,
            width,
            height: scaledHeight,
          })} ${width}w`;
        })
        .join(", ")
    : undefined;

  return {
    src: optimizeImageUrl(value, {
      ...baseOptions,
      width: uniqueWidths[uniqueWidths.length - 1],
      height:
        baseHeight && baseWidth
          ? Math.max(
              1,
              Math.round((baseHeight * uniqueWidths[uniqueWidths.length - 1]!) / baseWidth),
            )
          : options.height,
    }),
    srcSet,
    sizes: options.sizes,
  };
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not process the selected image."));
    reader.readAsDataURL(blob);
  });
}

function loadFileImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load ${file.name}.`));
    };
    image.src = url;
  });
}

export async function prepareUploadedImage(file: File, options: UploadImageOptions) {
  if (file.type === "image/gif") {
    // Keep GIFs untouched so animated uploads do not lose frames.
    return readBlobAsDataUrl(file);
  }

  const image = await loadFileImage(file);
  const scale = Math.min(1, options.maxWidth / image.width, options.maxHeight / image.height);
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return readBlobAsDataUrl(file);
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, options.mimeType ?? "image/webp", options.quality ?? 0.82);
  });

  if (!blob) {
    return readBlobAsDataUrl(file);
  }

  if (blob.size >= file.size && scale === 1) {
    return readBlobAsDataUrl(file);
  }

  return readBlobAsDataUrl(blob);
}
