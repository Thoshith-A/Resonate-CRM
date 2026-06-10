"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const INTRO_DURATION = 2.6;

/**
 * Cinematic dolly-in on load (easeOutQuart), then a very slow ambient
 * drift plus damped pointer parallax. No orbit controls; all vectors are
 * allocated once and reused every frame.
 */
export function CameraRig() {
  const start = useMemo(() => new THREE.Vector3(-4.2, 6.2, 14.5), []);
  const end = useMemo(() => new THREE.Vector3(-2.4, 2.7, 9), []);
  const target = useMemo(() => new THREE.Vector3(-1.1, 1.6, 0), []);
  const base = useMemo(() => new THREE.Vector3(), []);
  const parallax = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const intro = Math.min(t / INTRO_DURATION, 1);
    const eased = 1 - Math.pow(1 - intro, 4);

    parallax.current.x = THREE.MathUtils.damp(
      parallax.current.x,
      state.pointer.x * 0.5,
      2.2,
      delta
    );
    parallax.current.y = THREE.MathUtils.damp(
      parallax.current.y,
      state.pointer.y * 0.28,
      2.2,
      delta
    );

    base.lerpVectors(start, end, eased);
    state.camera.position.set(
      base.x + Math.sin(t * 0.06) * 0.4 + parallax.current.x,
      base.y + Math.cos(t * 0.045) * 0.2 - parallax.current.y,
      base.z
    );
    state.camera.lookAt(target);
  });

  return null;
}
