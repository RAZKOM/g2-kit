/** `updateImageRawData` result strings (SDK `ImageRawDataUpdateResult`). */
export type ImageResult = 'success' | 'imageException' | 'imageSizeInvalid' | 'imageToGray4Failed' | 'sendFailed'

export const IMAGE_RESULT_HINTS: Record<Exclude<ImageResult, 'success'>, string> = {
  imageException: 'the host could not process the image data',
  imageSizeInvalid: 'image dimensions do not match the container or exceed 288×144',
  imageToGray4Failed: 'the host could not convert the image to 4-bit grey (check the encoding)',
  sendFailed: 'the Bluetooth send failed (often transient; retried once)',
}

export interface ImageTarget {
  containerID: number
  containerName: string
}

export class ImageSendError extends Error {
  readonly name = 'ImageSendError'
  constructor(
    readonly code: ImageResult | 'threw' | 'unknown',
    readonly target: ImageTarget,
    readonly cause?: unknown,
  ) {
    const hint = code in IMAGE_RESULT_HINTS ? IMAGE_RESULT_HINTS[code as keyof typeof IMAGE_RESULT_HINTS] : String(cause ?? code)
    super(`updateImageRawData(${target.containerName}#${target.containerID}) failed: ${code} (${hint})`)
  }

  /** Only transient failures are worth retrying; size/format errors repeat. */
  get retryable(): boolean {
    return this.code === 'sendFailed' || this.code === 'threw' || this.code === 'unknown'
  }
}

/** Normalise whatever the host returned (enum string, bool, int code) to an ImageResult. */
export function toImageResult(raw: unknown): ImageResult | 'unknown' {
  if (raw === true) return 'success'
  if (raw === false) return 'sendFailed'
  if (typeof raw === 'number') return (['success', 'imageException', 'imageSizeInvalid', 'sendFailed'] as const)[raw] ?? 'unknown'
  if (typeof raw === 'string') {
    const s = raw.includes('.') ? raw.slice(raw.lastIndexOf('.') + 1) : raw
    if (s === 'success' || s === 'imageException' || s === 'imageSizeInvalid' || s === 'imageToGray4Failed' || s === 'sendFailed') return s
  }
  return 'unknown'
}

export type LayoutRule =
  | 'NO_CONTAINERS'
  | 'TOO_MANY_CONTAINERS'
  | 'TOO_MANY_IMAGES'
  | 'TOO_MANY_OTHERS'
  | 'IMAGE_SIZE'
  | 'CONTAINER_SIZE'
  | 'OUT_OF_BOUNDS'
  | 'DUPLICATE_ID'
  | 'DUPLICATE_NAME'
  | 'INVALID_ID'
  | 'CAPTURE_COUNT'
  | 'Z_ORDER'
  | 'LIST_ITEMS'
  | 'LIST_ITEM_LENGTH'
  | 'TEXT_LENGTH'
  | 'BORDER'
  | 'PADDING'
  | 'TEXT_COLOR'
  | 'MENU_COUNT'
  | 'MENU_ID'
  | 'MENU_NAME'

export interface LayoutIssue {
  rule: LayoutRule
  message: string
  container?: string
}

export class PageLayoutError extends Error {
  readonly name = 'PageLayoutError'
  readonly rule: LayoutRule
  constructor(readonly issues: readonly LayoutIssue[]) {
    super(
      `Invalid page layout:\n${issues.map((i) => `  [${i.rule}]${i.container ? ` ${i.container}:` : ''} ${i.message}`).join('\n')}`,
    )
    this.rule = issues[0].rule
  }
}
