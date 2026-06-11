"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { ScalarRef } from "../intro/contract";

const COUNT = 7200;
const COLS = 120;
const ROWS = 60;
const FIELD_WIDTH = 64;
const FIELD_Z_NEAR = 6;
const FIELD_Z_FAR = -46;

/** Deterministic PRNG so the field layout is stable across mounts. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VERTEX_HEAD = /* glsl */ `
#include <common>
uniform float uTime;
uniform float uReveal;
attribute float aSeed;
varying float vGlow;
`;

/**
 * All motion lives here: a slow ambient swell plus a periodic train of
 * concentric ring-pulses expanding from the origin (one crest every 4s,
 * travelling at 5.5 u/s). Instances lift and pass an HDR glow factor to
 * the fragment stage as a ring crosses them, then settle back.
 *
 * The intro's reveal rides on uReveal: instances start shrunken below the
 * floor and rise/grow in a near-to-far wave. The 2.1 multiplier guarantees
 * uReveal = 1 clamps to 1 for every instance (max penalty ~1.03), so lift
 * is exactly 0 and the math is byte-for-byte today's.
 */
const VERTEX_BODY = /* glsl */ `
#include <begin_vertex>
vec2 iXZ = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
float dist = length(iXZ);
float swell = sin(iXZ.x * 0.30 + uTime * 0.34 + aSeed * 2.4)
            * cos(iXZ.y * 0.26 - uTime * 0.21);
float phase = fract((dist / 5.5 - uTime) / 4.0);
float crestDist = min(phase, 1.0 - phase) * 22.0;
float ring = exp(-crestDist * crestDist * 0.55);
float falloff = 1.0 / (1.0 + dist * 0.14);
float pulse = ring * falloff;
vGlow = pulse * (0.65 + 0.7 * aSeed) * 3.0;
transformed.y += swell * 0.16 + pulse * 0.85;
float lift = 1.0 - clamp(uReveal * 2.1 - aSeed * 0.35 - dist * 0.012, 0.0, 1.0);
transformed.xyz *= 1.0 - lift;
transformed.y -= lift * 2.2;
vGlow *= 1.0 - lift;
`;

const FRAGMENT_HEAD = /* glsl */ `
#include <common>
uniform vec3 uCopper;
varying float vGlow;
`;

const FRAGMENT_BODY = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += uCopper * vGlow;
`;

export function AudienceField({ reveal }: { reveal?: ScalarRef }) {
  const { mesh, geometry, material, uniforms } = useMemo(() => {
    const fieldUniforms = {
      uTime: { value: 0 },
      uReveal: { value: 1 },
      uCopper: { value: new THREE.Color("#e09a52") },
    };

    const fieldGeometry = new THREE.IcosahedronGeometry(0.052, 0);
    const fieldMaterial = new THREE.MeshStandardMaterial({
      color: "#26262a",
      metalness: 0.5,
      roughness: 0.38,
    });
    fieldMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = fieldUniforms.uTime;
      shader.uniforms.uReveal = fieldUniforms.uReveal;
      shader.uniforms.uCopper = fieldUniforms.uCopper;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", VERTEX_HEAD)
        .replace("#include <begin_vertex>", VERTEX_BODY);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", FRAGMENT_HEAD)
        .replace("#include <emissivemap_fragment>", FRAGMENT_BODY);
    };

    const instanced = new THREE.InstancedMesh(fieldGeometry, fieldMaterial, COUNT);
    instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    instanced.frustumCulled = false;

    const rand = mulberry32(0x5e50_a7e);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const seeds = new Float32Array(COUNT);
    const spacingX = FIELD_WIDTH / (COLS - 1);
    const spacingZ = (FIELD_Z_FAR - FIELD_Z_NEAR) / (ROWS - 1);

    for (let i = 0; i < COUNT; i += 1) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      position.set(
        (col / (COLS - 1) - 0.5) * FIELD_WIDTH + (rand() - 0.5) * spacingX * 0.85,
        0,
        FIELD_Z_NEAR + row * spacingZ + (rand() - 0.5) * Math.abs(spacingZ) * 0.85
      );
      scale.setScalar(0.7 + rand() * 0.7);
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(i, matrix);
      seeds[i] = rand();
    }

    const seedAttribute = new THREE.InstancedBufferAttribute(seeds, 1);
    seedAttribute.setUsage(THREE.StaticDrawUsage);
    fieldGeometry.setAttribute("aSeed", seedAttribute);

    return {
      mesh: instanced,
      geometry: fieldGeometry,
      material: fieldMaterial,
      uniforms: fieldUniforms,
    };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    if (reveal) {
      uniforms.uReveal.value = reveal.value;
    }
  });

  return <primitive object={mesh} position={[0, -0.1, 0]} />;
}
