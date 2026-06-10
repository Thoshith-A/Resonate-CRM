"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Fully programmatic studio lighting — no HDRI downloads. Lightformer
 * panels are baked once into a small PMREM environment: a warm overhead
 * softbox, two cool rim strips and a low front fill, plus a dim spotlight
 * for the centerpiece's contact glow.
 */
export function StudioEnvironment() {
  return (
    <>
      <color attach="background" args={["#070708"]} />
      <fog attach="fog" args={["#070708", 16, 52]} />
      <ambientLight intensity={0.08} />
      <spotLight
        position={[5, 11, 5]}
        angle={0.3}
        penumbra={1}
        decay={2}
        intensity={300}
        color="#ffdcb0"
      />
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={5}
          color="#fff1de"
          scale={[10, 5, 1]}
          position={[0, 8, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={2.6}
          color="#cdd9e6"
          scale={[1.6, 10, 1]}
          position={[-9, 3, -4]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#c9d6e4"
          scale={[1.6, 10, 1]}
          position={[9, 3, -4]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.7}
          color="#e6d6c3"
          scale={[14, 2, 1]}
          position={[0, 0.5, 8]}
          target={[0, 2, 0]}
        />
      </Environment>
    </>
  );
}
