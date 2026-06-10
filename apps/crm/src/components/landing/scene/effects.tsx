"use client";

import {
  Bloom,
  EffectComposer,
  Noise,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * The composer disables the renderer's built-in tone mapping, so HDR
 * emissive values (> 1) survive into Bloom; ACES filmic is applied
 * explicitly afterwards, then vignette and a whisper of film grain.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        mipmapBlur
        intensity={0.9}
        luminanceThreshold={1}
        luminanceSmoothing={0.2}
        levels={7}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.18} darkness={0.6} />
      <Noise premultiply opacity={0.035} />
    </EffectComposer>
  );
}
