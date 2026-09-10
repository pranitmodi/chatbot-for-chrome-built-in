const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1280;
const MAX_VIDEO_FRAMES = 8;
const MAX_ATTACHMENTS = 4;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
]);
const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
]);

export { MAX_FILE_BYTES, MAX_ATTACHMENTS, MAX_VIDEO_FRAMES };

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function classifyFile(file) {
  if (IMAGE_TYPES.has(file.type)) return "image";
  if (AUDIO_TYPES.has(file.type)) return "audio";
  if (VIDEO_TYPES.has(file.type)) return "video";

  const name = file.name.toLowerCase();
  if (/\.(png|jpe?g|webp)$/.test(name)) return "image";
  if (/\.(mp3|wav|webm|m4a|ogg|aac|flac)$/.test(name)) return "audio";
  if (/\.(mp4|webm|mov|ogg)$/.test(name)) return "video";
  return null;
}

export function validateFileSize(file) {
  if (file.size > MAX_FILE_BYTES) {
    throw Object.assign(
      new Error(
        `${file.name} is ${formatBytes(file.size)}. Keep attachments under ${formatBytes(MAX_FILE_BYTES)}.`,
      ),
      { name: "FileTooLargeError" },
    );
  }
}

function waitForEvent(target, eventName) {
  return new Promise((resolve, reject) => {
    const onError = () => {
      cleanup();
      reject(new Error(`Media failed to load (${eventName}).`));
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function seekVideo(video, time) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not read a frame from this video."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = time;
  });
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.86) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not process this image."));
    }, type, quality);
  });
}

export async function resizeImageSource(source, maxDim = MAX_IMAGE_DIMENSION) {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvasToBlob(canvas);
}

export async function prepareImageFile(file) {
  validateFileSize(file);
  const blob = await resizeImageSource(file);
  const previewUrl = URL.createObjectURL(blob);
  return {
    id: crypto.randomUUID(),
    kind: "image",
    name: file.name,
    size: blob.size,
    previewUrl,
    modelValue: blob,
    frames: null,
    frameCount: null,
  };
}

export async function prepareAudioFile(file) {
  validateFileSize(file);
  const previewUrl = URL.createObjectURL(file);
  return {
    id: crypto.randomUUID(),
    kind: "audio",
    name: file.name,
    size: file.size,
    previewUrl,
    modelValue: file,
    frames: null,
    frameCount: null,
  };
}

export async function prepareMicrophoneCapture(blob) {
  const type = blob.type || "audio/webm";
  const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  const file = new File([blob], `Microphone recording.${extension}`, { type });
  return prepareAudioFile(file);
}

export async function extractVideoFrames(file, maxFrames = MAX_VIDEO_FRAMES) {
  validateFileSize(file);
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = objectUrl;

  try {
    await waitForEvent(video, "loadedmetadata");
    if (video.readyState < 1) {
      await waitForEvent(video, "loadeddata");
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const count = Math.max(
      1,
      Math.min(maxFrames, duration >= 1 ? Math.min(maxFrames, Math.floor(duration) + 1) : 1),
    );

    const frames = [];
    for (let i = 0; i < count; i += 1) {
      const time =
        count === 1 || duration === 0
          ? 0
          : Math.min(duration * (i / (count - 1)), Math.max(duration - 0.05, 0));
      await seekVideo(video, time);

      const maxDim = MAX_IMAGE_DIMENSION;
      const scale = Math.min(
        1,
        maxDim / Math.max(video.videoWidth || 1, video.videoHeight || 1),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((video.videoWidth || 1) * scale));
      canvas.height = Math.max(1, Math.round((video.videoHeight || 1) * scale));
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(await canvasToBlob(canvas));
    }

    const previewUrl = URL.createObjectURL(frames[0]);
    return {
      id: crypto.randomUUID(),
      kind: "video",
      name: file.name,
      size: file.size,
      previewUrl,
      modelValue: null,
      frames,
      frameCount: frames.length,
    };
  } finally {
    video.src = "";
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareCameraCapture(blob) {
  const resized = await resizeImageSource(blob);
  const previewUrl = URL.createObjectURL(resized);
  return {
    id: crypto.randomUUID(),
    kind: "image",
    name: "Camera capture",
    size: resized.size,
    previewUrl,
    modelValue: resized,
    frames: null,
    frameCount: null,
  };
}

export function revokeAttachment(attachment) {
  if (attachment?.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}

export function revokeAll(attachments) {
  for (const attachment of attachments) {
    revokeAttachment(attachment);
  }
}

export async function prepareFiles(files, capabilities) {
  const prepared = [];
  for (const file of files) {
    const kind = classifyFile(file);
    if (!kind) {
      throw Object.assign(
        new Error(`${file.name} isn't a supported image, audio, or video file.`),
        { name: "UnsupportedFileError" },
      );
    }
    if (kind === "image") {
      if (!capabilities.image) {
        throw Object.assign(
          new Error("Image input isn't available in this Chrome configuration."),
          { name: "NotSupportedError" },
        );
      }
      prepared.push(await prepareImageFile(file));
    } else if (kind === "audio") {
      if (!capabilities.audio) {
        throw Object.assign(
          new Error("Audio analysis isn't available in this Chrome configuration."),
          { name: "NotSupportedError" },
        );
      }
      prepared.push(await prepareAudioFile(file));
    } else if (kind === "video") {
      if (!capabilities.videoFrames) {
        throw Object.assign(
          new Error("Video analysis isn't available because image input isn't supported."),
          { name: "NotSupportedError" },
        );
      }
      prepared.push(await extractVideoFrames(file));
    }
  }
  return prepared;
}

export function attachmentToMediaParts(attachment) {
  if (attachment.kind === "image") {
    return [{ type: "image", value: attachment.modelValue }];
  }
  if (attachment.kind === "audio") {
    return [{ type: "audio", value: attachment.modelValue }];
  }
  if (attachment.kind === "video") {
    return attachment.frames.map((frame) => ({ type: "image", value: frame }));
  }
  return [];
}
