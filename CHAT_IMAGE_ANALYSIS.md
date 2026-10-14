# Chat photo analysis

Adds optional photos to Harbour assistant using the existing OpenAI Responses API and server-side key. No extra API key, storage binding or database migration is required.

## Behaviour

- Reuses `PhotoSelection` from booking: at most two originals per message, each at most 20 MiB, desktop chooser/drop and mobile album/camera hint, preview/remove and signature checks.
- Chat-specific copy explains processing and retention. Browser-decodable booking formats are re-encoded to JPEG, removing EXIF and freezing animated images. HEIC/HEIF requires browser decoding; unsupported files receive a JPG/PNG conversion message and are retained for replacement.
- Before sending, each image is resized to at most 1600 pixels on its longer edge and compressed to at most 1 MiB. Server checks count, base64, JPEG signature/dimensions and bounded streaming request bytes. Only data URLs are accepted, never arbitrary remote image URLs.
- Images bypass FAQ shortcuts. The same existing per-IP and daily AI allowance apply. Provider output has a validated assessment category. Failure or exhausted quota explicitly says images were not analysed, hides prices and retains selected files for retry.
- Analysis uses visible observations and uncertainty, not a definitive diagnosis or roadworthiness assessment. Image instructions are treated as untrusted data. Urgent, unclear or unrelated assessment categories suppress the price card. A relevant service selects its existing catalogue range; the model never sets currency amounts or severity-based prices. E.g. tyres AUD 80–280 versus brakes AUD 80–650. These are service ranges, not a promise that the pictured repair fits them.
- Bilingual disclaimers appear with the picker and each analysis result. Terms/privacy describes actual processing.
- Account history stores text analysis, assessment status and attachment count, never image data URLs/original files. Existing customer access checks apply. Photos are not automatically copied into a booking; users can attach originals in the booking form. Temporary in-memory thumbnails are bounded to recent messages and disappear on reload/history refresh.

## Implementation

- `lib/chat-images.ts`: normalized payload validation, bounded request reader and disclaimer copy.
- `lib/prepare-chat-images.ts`: browser decoding, resizing and JPEG normalization.
- `app/api/workshop/route.ts`: `chat` with optional `images`; `X-Chat-Images: 1` selects the bounded larger request allowance and rejects non-chat actions. Credentials stay in the Worker.
- `lib/openai-assistant.ts`: existing `gpt-4.1-mini-2025-04-14`, `input_image` content, `detail: high`, `store: false`, 800 output tokens for image calls (450 for text), 25-second timeout. No Files API uploads.
- `components/chat.tsx`: attachment toggle, image-only send, retry preservation, thumbnails and disclaimers.
- Existing booking storage and photo access remain unchanged. Text chats and FAQ keep their existing contract.

## Validation

Run `node scripts/check-chat-images.mjs` for provider-payload/mocked outcome and image boundary checks. Optional local URL adds origin/session/FAQ-fallback/account-history tests; it refuses production targets. Initialize an isolated local D1 via existing migrations, without a real API key, before integration tests. Existing booking photo, community and account checks cover regression boundaries.

Browser checks cover chooser selection, two-image/20 MiB boundaries, preparation/send/removal, failure retention, English/Chinese and 320/390px layouts. Physical phone camera permissions and other browser engines require separate device testing.

## Model lifecycle

Official documentation checked 14 October 2026 confirms image input on the existing model. The deprecation announcement sets 14 January 2027 as its shutdown date and recommends `gpt-6-luna`. Retaining the existing model here avoids an unrelated migration; evaluate its replacement before that date using automotive examples and current account/model availability. Reuse the existing key if permitted; a separate vision API is not inherently needed. Image inputs consume billed tokens.

Sources: https://developers.openai.com/api/docs/guides/images-vision ; https://developers.openai.com/api/docs/models/gpt-4.1-mini ; https://developers.openai.com/api/docs/deprecations
