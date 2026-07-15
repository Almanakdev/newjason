import * as THREE from 'three';
import { el, button, clearChildren } from '../utils/dom';
import { createCharacter, type CharacterRig } from '../player/CharacterFactory';
import { CharacterAnimator } from '../player/PlayerAnimator';
import { CUSTOMIZATION_CATEGORIES, randomAppearance } from '../player/PlayerCustomization';
import { createToonMaterial } from '../shaders/toon';
import type { Appearance } from '../types';

export interface CustomizationResult {
  name: string;
  appearance: Appearance;
}

/**
 * Full-screen character customization with a live rotating 3D preview.
 * Used at the start of a new journey and again from the tailor's shop.
 */
export class CustomizationUI {
  show(
    root: HTMLElement,
    initialName: string,
    initialAppearance: Appearance,
    confirmLabel = 'Begin the Journey'
  ): Promise<CustomizationResult | null> {
    return new Promise((resolve) => {
      const appearance: Appearance = { ...initialAppearance };
      const screen = el('div', 'kp-custom-screen');

      /* ---------- 3D preview ---------- */
      const previewBox = el('div', 'kp-custom-preview');
      const canvas = el('canvas') as HTMLCanvasElement;
      previewBox.appendChild(canvas);
      screen.appendChild(previewBox);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#cfe8f0');
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
      camera.position.set(0, 1.15, 3.3);
      camera.lookAt(0, 0.85, 0);
      scene.add(new THREE.HemisphereLight('#dff0f7', '#9aa584', 1.0));
      const sun = new THREE.DirectionalLight('#fff2d9', 1.6);
      sun.position.set(2, 4, 3);
      scene.add(sun);
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.05, 0.24, 24),
        createToonMaterial('#b98e60')
      );
      pedestal.position.y = -0.12;
      scene.add(pedestal);

      let rig: CharacterRig | null = null;
      let animator: CharacterAnimator | null = null;
      let spinYaw = 0.4;
      const rebuild = () => {
        if (rig) scene.remove(rig.root);
        rig = createCharacter(appearance, { outline: true });
        animator = new CharacterAnimator(rig);
        scene.add(rig.root);
      };
      rebuild();

      let dragging = false;
      let lastX = 0;
      previewBox.addEventListener('pointerdown', (e) => {
        dragging = true;
        lastX = e.clientX;
      });
      window.addEventListener('pointermove', (e) => {
        if (dragging) {
          spinYaw += (e.clientX - lastX) * 0.01;
          lastX = e.clientX;
        }
      });
      window.addEventListener('pointerup', () => (dragging = false));

      let raf = 0;
      let elapsed = 0;
      let last = performance.now();
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        elapsed += dt;
        const w = previewBox.clientWidth || 300;
        const h = previewBox.clientHeight || 300;
        if (canvas.width !== w || canvas.height !== h) {
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
        if (rig && animator) {
          if (!dragging) spinYaw += dt * 0.35;
          rig.root.rotation.y = spinYaw;
          animator.update(dt, elapsed);
        }
        renderer.render(scene, camera);
      };
      loop();

      /* ---------- controls panel ---------- */
      const panel = el('div', 'kp-custom-panel');
      panel.appendChild(el('h2', undefined, '🧵 Your Founder'));
      const nameInput = el('input', 'kp-name-input') as HTMLInputElement;
      nameInput.placeholder = 'Founder name…';
      nameInput.maxLength = 16;
      nameInput.value = initialName;
      panel.appendChild(nameInput);

      const rows = el('div', 'kp-custom-rows');
      panel.appendChild(rows);

      const renderRows = () => {
        clearChildren(rows);
        let lastGroup = '';
        for (const cat of CUSTOMIZATION_CATEGORIES) {
          if (cat.group !== lastGroup) {
            lastGroup = cat.group;
            const header = el('div', undefined, lastGroup.toUpperCase());
            header.style.cssText = 'font-size:11px;font-weight:900;color:var(--kp-ink-soft);margin:10px 0 2px;letter-spacing:1px;';
            rows.appendChild(header);
          }
          const row = el('div', 'kp-custom-row');
          row.appendChild(el('span', 'label', cat.label));
          if (cat.colors) {
            const swatches = el('div', 'kp-swatch-row');
            cat.colors.forEach((color, i) => {
              const sw = el('button', `kp-swatch${appearance[cat.key] === i ? ' selected' : ''}`);
              sw.style.background = color;
              sw.addEventListener('click', () => {
                appearance[cat.key] = i;
                rebuild();
                renderRows();
              });
              swatches.appendChild(sw);
            });
            row.appendChild(swatches);
          } else {
            const arrows = el('div', 'kp-arrows');
            const valueLabel = el('span', 'kp-value', cat.names?.[appearance[cat.key]] ?? String(appearance[cat.key] + 1));
            const shift = (dir: number) => {
              appearance[cat.key] = (appearance[cat.key] + dir + cat.count) % cat.count;
              valueLabel.textContent = cat.names?.[appearance[cat.key]] ?? String(appearance[cat.key] + 1);
              rebuild();
            };
            arrows.append(
              button('kp-arrow-btn', '◀', () => shift(-1)),
              valueLabel,
              button('kp-arrow-btn', '▶', () => shift(1))
            );
            row.appendChild(arrows);
          }
          rows.appendChild(row);
        }
      };
      renderRows();

      const actions = el('div', 'kp-custom-actions');
      const cleanup = (result: CustomizationResult | null) => {
        cancelAnimationFrame(raf);
        renderer.dispose();
        screen.remove();
        resolve(result);
      };
      actions.append(
        button('kp-btn', '🎲 Randomize', () => {
          Object.assign(appearance, randomAppearance());
          rebuild();
          renderRows();
        }),
        button('kp-btn kp-btn--primary', `✔ ${confirmLabel}`, () => {
          cleanup({ name: nameInput.value.trim() || 'Founder', appearance: { ...appearance } });
        })
      );
      panel.appendChild(actions);
      screen.appendChild(panel);
      root.appendChild(screen);
    });
  }
}
