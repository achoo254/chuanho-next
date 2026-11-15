/**
 * Keeps Babylon off its CDN. The page's content policy only trusts its own origin, and the game should work without a
 * third party anyway, so every helper Babylon would fetch at run time is served from `public/decoders/babylon/`
 * (copied there from the matching Babylon release, see the README):
 *
 * - `meshopt_decoder.js` for meshopt-compressed models (EXT_meshopt_compression),
 * - `babylon.ktx2Decoder.js`, `ktx2Transcoders/1/*` and `zstddec.wasm` for KTX2 / Basis textures.
 *
 * `Tools.ScriptBaseUrl` rewrites every remaining CDN address (Draco, glslang, the inspector) to the same folder, so a
 * helper that is not hosted fails with a 404 on this origin instead of quietly loading from the CDN.
 *
 * Both decoders compile WebAssembly and the KTX2 one runs in a blob: worker, so the content policy needs
 * `'wasm-unsafe-eval'` and `worker-src 'self' blob:` once compressed models ship (see docs/deployment-guide.md).
 */
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2';
import { Tools } from '@babylonjs/core/Misc/tools';

const DECODER_BASE = '/decoders/babylon';
const KTX2 = `${DECODER_BASE}/ktx2Transcoders/1`;

let configured = false;

export function configureSelfHostedDecoders(): void {
  if (configured) return;
  configured = true;
  Tools.ScriptBaseUrl = DECODER_BASE;
  MeshoptCompression.Configuration = { decoder: { url: `${DECODER_BASE}/meshopt_decoder.js` } };
  KhronosTextureContainer2.URLConfig = {
    jsDecoderModule: `${DECODER_BASE}/babylon.ktx2Decoder.js`,
    wasmUASTCToASTC: `${KTX2}/uastc_astc.wasm`,
    wasmUASTCToBC7: `${KTX2}/uastc_bc7.wasm`,
    wasmUASTCToRGBA_UNORM: `${KTX2}/uastc_rgba8_unorm_v2.wasm`,
    wasmUASTCToRGBA_SRGB: `${KTX2}/uastc_rgba8_srgb_v2.wasm`,
    wasmUASTCToR8_UNORM: `${KTX2}/uastc_r8_unorm.wasm`,
    wasmUASTCToRG8_UNORM: `${KTX2}/uastc_rg8_unorm.wasm`,
    jsMSCTranscoder: `${KTX2}/msc_basis_transcoder.js`,
    wasmMSCTranscoder: `${KTX2}/msc_basis_transcoder.wasm`,
    wasmZSTDDecoder: `${DECODER_BASE}/zstddec.wasm`,
  };
}
