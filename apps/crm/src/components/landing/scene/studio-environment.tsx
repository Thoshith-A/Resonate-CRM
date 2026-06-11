"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

import type { ScalarRef } from "../intro/contract";

const SPOT_INTENSITY = 300;
const AMBIENT_INTENSITY = 0.08;

type StudioEnvironmentProps = {
  /** Multiplies spot + ambient intensity (the intro fades the key in). */
  lights?: ScalarRef;
  /** When false the intro owns scene.background and scene.fog directly. */
  manageAtmosphere?: boolean;
};

/**
 * Fully programmatic studio lighting — no HDRI downloads. Lightformer
 * panels are baked once into a small PMREM environment: a warm overhead
 * softbox, two cool rim strips and a low front fill, plus a dim spotlight
 * for the centerpiece's contact glow.
 */
export function StudioEnvironment({
  lights,
  manageAtmosphere = true,
}: StudioEnvironmentProps) {
  const spotRef = useRef<THREE.SpotLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);

  useFrame(() => {
    if (!lights) {
      return;
    }
    const level = lights.value;
    const spot = spotRef.current;
    if (spot) {
      spot.intensity = SPOT_INTENSITY * level;
    }
    const ambient = ambientRef.current;
    if (ambient) {
      ambient.intensity = AMBIENT_INTENSITY * level;
    }
  });

  return (
    <>
      {manageAtmosphere ? (
        <>
          <color attach="background" args={["#070708"]} />
          <fog attach="fog" args={["#070708", 16, 52]} />
        </>
      ) : null}
      <ambientLight ref={ambientRef} intensity={AMBIENT_INTENSITY} />
      <spotLight
        ref={spotRef}
        position={[5, 11, 5]}
        angle={0.3}
        penumbra={1}
        decay={2}
        intensity={SPOT_INTENSITY}
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
