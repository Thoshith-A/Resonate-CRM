"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

import type { RevealState } from "../intro/contract";

const CORE_HEIGHT = 2.3;

type RingSpec = {
  radius: number;
  tube: number;
  tilt: [number, number, number];
};

const RINGS: readonly RingSpec[] = [
  { radius: 1.24, tube: 0.02, tilt: [0.45, 0, 0.2] },
  { radius: 1.48, tube: 0.016, tilt: [1.85, 0.4, 0] },
  { radius: 1.72, tube: 0.012, tilt: [0.9, -0.6, 1.1] },
];

const RING_VERTEX_HEAD = /* glsl */ `
#include <common>
varying vec2 vSgRingPos;
`;

const RING_VERTEX_BODY = /* glsl */ `
#include <begin_vertex>
vSgRingPos = position.xy;
`;

const RING_FRAGMENT_HEAD = /* glsl */ `
#include <common>
uniform float uProgress;
varying vec2 vSgRingPos;
`;

/**
 * Arc reveal: the torus' main angle lives in its local XY plane, so any
 * fragment beyond uProgress * 2pi is discarded. At uProgress = 1 the
 * normalized angle is always below 2pi — nothing is ever discarded.
 */
const RING_FRAGMENT_BODY = /* glsl */ `
#include <clipping_planes_fragment>
float sgAngle = atan(vSgRingPos.y, vSgRingPos.x);
if (sgAngle < 0.0) sgAngle += 6.2831853;
if (sgAngle > uProgress * 6.2831853) discard;
`;

export function ResonanceCore({ reveal }: { reveal?: RevealState }) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const ringCRef = useRef<THREE.Mesh>(null);

  // Ring materials are built imperatively so the intro can patch an
  // arc-reveal uniform in via onBeforeCompile; without `reveal` the
  // materials are exactly the historical ones (no patch, no uniform).
  const revealed = Boolean(reveal);
  const { ringMaterials, ringUniforms } = useMemo(() => {
    const uniformList = RINGS.map(() => ({ value: 1 }));
    const materialList = RINGS.map((_, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: "#d6cdc0",
        metalness: 1,
        roughness: 0.24,
        envMapIntensity: 1.3,
      });
      if (revealed) {
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uProgress = uniformList[index];
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", RING_VERTEX_HEAD)
            .replace("#include <begin_vertex>", RING_VERTEX_BODY);
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", RING_FRAGMENT_HEAD)
            .replace("#include <clipping_planes_fragment>", RING_FRAGMENT_BODY);
        };
      }
      return material;
    });
    return { ringMaterials: materialList, ringUniforms: uniformList };
  }, [revealed]);

  useEffect(() => {
    return () => {
      for (const material of ringMaterials) {
        material.dispose();
      }
    };
  }, [ringMaterials]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const group = groupRef.current;
    if (group) {
      group.position.y = CORE_HEIGHT + Math.sin(t * 0.5) * 0.06;
      group.rotation.y = t * 0.04;
      if (reveal) {
        const scale = reveal.coreScale.value;
        group.scale.setScalar(scale);
        group.visible = scale > 0.001;
      }
    }
    if (reveal) {
      for (let i = 0; i < ringUniforms.length; i += 1) {
        ringUniforms[i].value = reveal.ringProgress[i].value;
      }
    }
    const core = coreRef.current;
    if (core) {
      core.rotation.y = t * 0.18;
      core.rotation.x = t * 0.11;
    }
    const ringA = ringARef.current;
    if (ringA) {
      ringA.rotation.x = t * 0.21;
      ringA.rotation.z = t * 0.13;
    }
    const ringB = ringBRef.current;
    if (ringB) {
      ringB.rotation.y = -t * 0.17;
      ringB.rotation.x = t * 0.09;
    }
    const ringC = ringCRef.current;
    if (ringC) {
      ringC.rotation.z = t * 0.08;
      ringC.rotation.y = t * 0.14;
    }
  });

  const ringRefs = [ringARef, ringBRef, ringCRef] as const;

  return (
    <group ref={groupRef} position={[0, CORE_HEIGHT, 0]}>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.32, 1]} />
        <meshStandardMaterial
          color="#0d0805"
          emissive="#e09a52"
          emissiveIntensity={4}
          roughness={0.3}
          metalness={0}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.88, 48, 48]} />
        <MeshTransmissionMaterial
          samples={6}
          resolution={384}
          transmission={1}
          thickness={0.65}
          roughness={0.18}
          ior={1.45}
          chromaticAberration={0.04}
          anisotropicBlur={0.35}
          clearcoat={1}
          attenuationDistance={2.5}
          attenuationColor="#f3e3cf"
        />
      </mesh>

      {RINGS.map((ring, index) => (
        <group key={ring.radius} rotation={ring.tilt}>
          <mesh ref={ringRefs[index]} material={ringMaterials[index]}>
            <torusGeometry args={[ring.radius, ring.tube, 16, 96]} />
          </mesh>
        </group>
      ))}

      <pointLight color="#e09a52" intensity={25} distance={10} decay={2} />
    </group>
  );
}
