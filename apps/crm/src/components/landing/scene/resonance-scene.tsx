"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import { AudienceField } from "./audience-field";
import { ResonanceCore } from "./resonance-core";
import { StudioEnvironment } from "./studio-environment";
import { CameraRig } from "./camera-rig";
import { Effects, type EffectsFx } from "./effects";
import { createIntroRefs, scalar, type IntroRefs } from "../intro/contract";
import { IntroExperience, type IntroBridge } from "../intro/IntroExperience";

type ResonanceSceneProps =
  | { mode?: "standard"; onReady: () => void; bridge?: never; tier?: never }
  | {
      mode: "cinematic";
      onReady: () => void;
      bridge: IntroBridge;
      tier: "high" | "med";
    };

/** Shared mutable state for the cinematic intro — created exactly once. */
type CinematicState = { refs: IntroRefs; fx: EffectsFx };

/** Glossy near-black studio floor beneath the audience plane. */
function StudioFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
      <planeGeometry args={[110, 90]} />
      <MeshReflectorMaterial
        blur={[360, 100]}
        resolution={768}
        mixBlur={1}
        mixStrength={6}
        depthScale={1.2}
        minDepthThreshold={0.5}
        maxDepthThreshold={1.6}
        roughness={0.85}
        metalness={0.6}
        mirror={0.4}
        color="#0b0b0d"
      />
    </mesh>
  );
}

export default function ResonanceScene(props: ResonanceSceneProps) {
  const { onReady } = props;
  const [cinematic] = useState<CinematicState | null>(() =>
    props.mode === "cinematic"
      ? { refs: createIntroRefs(), fx: { bloom: scalar(1.2), aberration: scalar(0) } }
      : null
  );

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 35, near: 0.5, far: 90, position: [-4.2, 6.2, 14.5] }}
      onCreated={() => onReady()}
    >
      {props.mode === "cinematic" && cinematic ? (
        <>
          <StudioEnvironment
            manageAtmosphere={false}
            lights={cinematic.refs.reveal.lights}
          />
          <AudienceField reveal={cinematic.refs.reveal.audienceReveal} />
          <ResonanceCore reveal={cinematic.refs.reveal} />
          <StudioFloor />
          <Effects fx={cinematic.fx} />
          <IntroExperience
            bridge={props.bridge}
            tier={props.tier}
            refs={cinematic.refs}
            fx={cinematic.fx}
          />
        </>
      ) : (
        <>
          <StudioEnvironment />
          <AudienceField />
          <ResonanceCore />
          <StudioFloor />
          <CameraRig />
          <Effects />
        </>
      )}
    </Canvas>
  );
}
