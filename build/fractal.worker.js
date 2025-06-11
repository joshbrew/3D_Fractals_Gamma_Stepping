/* ---------- Burning-Ship Multibrot helpers ---------- */
function shipPower(ax, ay, p) {           // |z|^p in polar coords
    // r = sqrt(ax²+ay²)  ;  θ = atan2(ay, ax)
    const r2 = ax * ax + ay * ay;
    const r = Math.pow(r2, 0.5 * p);      // r^p
    const th = Math.atan2(ay, ax) * p;     // pθ
    return [r * Math.cos(th),               // Re part
    r * Math.sin(th)];             // Im part
}

const SQRT2_INV = 1 / Math.sqrt(2);
const ROT45X = 0.7071067811865476;   //  cos 45°
const ROT45Y = -0.7071067811865476;   // -sin 45°

self.onmessage = e => {
    const { gridSize, k, zMin, dz, zoom, escapeR, maxIter, fractalType, dx = 0, dy = 0 } = e.data;
    const N = gridSize * gridSize;
    const pos = new Float32Array(N * 3);
    const rat = new Float32Array(N);
    const gamma = zMin + k * dz;

    let idx = 0;


    for (let i = 0; i < gridSize; i++) {
        const x0 = (i / (gridSize - 1) - 0.5) * zoom + dx;
        for (let j = 0; j < gridSize; j++) {
            const y0 = (j / (gridSize - 1) - 0.5) * zoom + dy;

            /* z, previous-z (for Phoenix) */
            let qx = 0, qy = 0, px = 0, py = 0;
            let iter = 0;

            while (qx * qx + qy * qy <= escapeR * escapeR && iter < maxIter) {
                const s = 1 + iter * (gamma - 1);      // slice scaling
                const a = Math.abs(qx);
                const b = Math.abs(qy);

                let nx, ny;

                switch (fractalType) {
                    case 1:  // Tricorn
                        nx = qx * qx - qy * qy + x0 * s;
                        ny = -2 * qx * qy + y0 * s;
                        break;

                    case 2:  // Burning Ship
                        nx = a * a - b * b + x0 * s;
                        ny = 2 * a * b + y0 * s;
                        break;

                    case 3:  // Perpendicular Mandelbrot
                        nx = qx * qx - qy * qy + x0 * s;
                        ny = -2 * a * qy + y0 * s;
                        break;

                    case 4:  // Celtic
                        nx = Math.abs(qx * qx - qy * qy) + x0 * s;
                        ny = 2 * qx * qy + y0 * s;
                        break;

                    case 5:  // Buffalo
                        nx = Math.abs(qx * qx - qy * qy) + x0 * s;
                        ny = -2 * qx * qy + y0 * s;
                        break;

                    case 6:  // Phoenix (λ = –0.5)
                        nx = qx * qx - qy * qy + x0 * s - 0.5 * px;
                        ny = 2 * qx * qy + y0 * s - 0.5 * py;
                        px = qx; py = qy;
                        break;

                    case 7: { // Cubic Multibrot (z³ + c)
                        const r2 = qx * qx + qy * qy;
                        const theta = Math.atan2(qy, qx);
                        const r3 = Math.pow(r2, 1.5);        // r³
                        nx = r3 * Math.cos(3 * theta) + x0 * s;
                        ny = r3 * Math.sin(3 * theta) + y0 * s;
                        break;
                    }

                    case 8: { // Quartic Multibrot (z⁴ + c)
                        const r2 = qx * qx + qy * qy;
                        const theta = Math.atan2(qy, qx);
                        const r4 = r2 * r2;                  // r⁴
                        nx = r4 * Math.cos(4 * theta) + x0 * s;
                        ny = r4 * Math.sin(4 * theta) + y0 * s;
                        break;
                    }

                    case 9:  // Cosine
                        nx = Math.cos(qx) * Math.cosh(qy) + x0 * s;
                        ny = -Math.sin(qx) * Math.sinh(qy) + y0 * s;
                        break;

                    case 10: // Sine
                        nx = Math.sin(qx) * Math.cosh(qy) + x0 * s;
                        ny = Math.cos(qx) * Math.sinh(qy) + y0 * s;
                        break;

                    case 11: {         // Heart
                        // z_{n+1} = (|Re(z_n)| + i·Im(z_n))^2 + c
                        const rx = Math.abs(qx);          // ⎯ only real part
                        nx = rx * rx - qy * qy + x0 * s;
                        ny = 2 * rx * qy + y0 * s;
                        break;
                    }

                    case 12: // Perpendicular Buffalo
                        nx = Math.abs(qx * qx - qy * qy) + x0 * s;
                        ny = -2 * a * qy + y0 * s;
                        break;

                    /* -------- Spiral Mandelbrot (simple quadratic with a twist) ----------------- */
                    case 13: {
                        const THETA = 0.35 + 2 * gamma;            // per-layer twist
                        const wRe = Math.cos(THETA);
                        const wIm = Math.sin(THETA);

                        /* z²  (= qx²-qy²  +  i·2qxqy) */
                        const zx2 = qx * qx - qy * qy;
                        const zy2 = 2.0 * qx * qy;

                        /* w·z²  (complex multiply) */
                        const tx = wRe * zx2 - wIm * zy2;
                        const ty = wRe * zy2 + wIm * zx2;

                        nx = tx + x0 * s;
                        ny = ty + y0 * s;
                        break;
                    }

                    case 14: {                        // Quintic Multibrot  (z^5 + c)
                        const r2 = qx * qx + qy * qy;
                        const theta = Math.atan2(qy, qx);
                        const r5 = Math.pow(r2, 2.5);           // r^(5/2)
                        nx = r5 * Math.cos(5 * theta) + x0 * s;
                        ny = r5 * Math.sin(5 * theta) + y0 * s;
                        break;
                    }

                    case 15: {                        // Sextic Multibrot   (z^6 + c)
                        const r2 = qx * qx + qy * qy;
                        const theta = Math.atan2(qy, qx);
                        const r6 = r2 * r2 * r2;                   // r^3, then squared → r^6
                        nx = r6 * Math.cos(6 * theta) + x0 * s;
                        ny = r6 * Math.sin(6 * theta) + y0 * s;
                        break;
                    }

                    case 16: {                        // Tangent fractal    (tan z + c)
                        // tan(x+iy) = (sin2x + i sinh2y) / (cos2x + cosh2y)
                        const sin2x = Math.sin(2 * qx);
                        const sinh2y = Math.sinh(2 * qy);
                        const denom = Math.cos(2 * qx) + Math.cosh(2 * qy) + 1e-9; // avoid /0
                        nx = sin2x / denom + x0 * s;
                        ny = sinh2y / denom + y0 * s;
                        break;
                    }

                    case 17: {                        // Exponential fractal (exp z + c)
                        const ex = Math.exp(qx);
                        nx = ex * Math.cos(qy) + x0 * s;
                        ny = ex * Math.sin(qy) + y0 * s;
                        break;
                    }

                    case 18: {                      // Septic Multibrot (z^7 + c)
                        const r2 = qx * qx + qy * qy;
                        const theta = Math.atan2(qy, qx);
                        const r7 = Math.pow(r2, 3.5);          // r^(7/2)
                        nx = r7 * Math.cos(7 * theta) + x0 * s;
                        ny = r7 * Math.sin(7 * theta) + y0 * s;
                        break;
                    }

                    case 19: {                      // Octic Multibrot (z^8 + c)
                        const r2 = qx * qx + qy * qy;
                        const theta = Math.atan2(qy, qx);
                        const r8 = r2 * r2 * r2 * r2;                  // r^8
                        nx = r8 * Math.cos(8 * theta) + x0 * s;
                        ny = r8 * Math.sin(8 * theta) + y0 * s;
                        break;
                    }

                    case 20: {                      // Inverse Mandelbrot (1/z^2 + c)
                        const r2 = qx * qx + qy * qy + 1e-9;            // avoid /0
                        const denom = r2 * r2;                        // (|z|²)² = |z|⁴
                        nx = (qx * qx - qy * qy) / denom + x0 * s;
                        ny = (-2 * qx * qy) / denom + y0 * s;
                        break;
                    }

                    case 21: {   // Burning Ship  – deep zoom on the forward tip
                        /*  centre of the tiny replica (credit: Hofstadter needles list)
                            approximately  (–1.7443359375 , –0.017451171875)           */
                        const cx = -1.7443359375;
                        const cy = -0.017451171875;

                        /* extra magnification: shrink the grid  to ~3 % of normal  */
                        const sub = 0.04;                      // ← tweak to zoom further

                        /* translate AND shrink the c-plane sample */
                        const dx = x0 * sub + cx;
                        const dy = y0 * sub + cy;

                        nx = a * a - b * b + dx * s;               // same Burning-Ship update
                        ny = 2.0 * a * b + dy * s;
                        break;
                    }

                    case 22: {  // Cubic Burning Ship  |z|³ + c
                        const [rx, ry] = shipPower(a, b, 3.0);
                        nx = rx + x0 * s;
                        ny = ry + y0 * s;
                        break;
                    }

                    case 23: {  // Quartic Burning Ship |z|⁴ + c
                        const [rx, ry] = shipPower(a, b, 4.0);
                        nx = rx + x0 * s;
                        ny = ry + y0 * s;
                        break;
                    }

                    case 24: {  // Quintic Burning Ship |z|⁵ + c
                        const [rx, ry] = shipPower(a, b, 5.0);
                        nx = rx + x0 * s;
                        ny = ry + y0 * s;
                        break;
                    }

                    case 25: {  // Hexic Burning Ship  |z|⁶ + c
                        const [rx, ry] = shipPower(a, b, 6.0);
                        nx = rx + x0 * s;
                        ny = ry + y0 * s;
                        break;
                    }

                    /* -------- Nova fractal (Newton method blend) -------------------------------- */
                    case 26: {                                // z − (z³ − 1)/(3 z²) + c
                        /* z² */
                        const zx2 = qx * qx - qy * qy,
                            zy2 = 2.0 * qx * qy;

                        /* z³ = z²·z */
                        const zx3 = zx2 * qx - zy2 * qy,
                            zy3 = zx2 * qy + zy2 * qx;

                        /* numerator (z³ − 1) */
                        const numx = zx3 - 1.0,
                            numy = zy3;

                        /* denominator 3 z² */
                        const denx = 3.0 * zx2,
                            deny = 3.0 * zy2;
                        const den2 = denx * denx + deny * deny + 1e-9;     // avoid /0

                        /* (z³−1)/(3 z²) */
                        const qxDiv = (numx * denx + numy * deny) / den2;
                        const qyDiv = (numy * denx - numx * deny) / den2;

                        nx = qx - qxDiv + x0 * s;
                        ny = qy - qyDiv + y0 * s;
                        break;
                    }

                    /* -------- Man-o-War (needs previous-z, reuse Phoenix vars) ------------------ */
                    case 27: {                                // z² + c + z_{n-1}
                        nx = qx * qx - qy * qy + x0 * s + px;
                        ny = 2.0 * qx * qy + y0 * s + py;
                        px = qx; py = qy;                       // store prev-z
                        break;
                    }

                    default: // Mandelbrot
                        nx = qx * qx - qy * qy + x0 * s;
                        ny = 2 * qx * qy + y0 * s;
                }

                qx = nx; qy = ny;
                iter++;
            }

            const base = 3 * idx;
            pos[base] = x0;
            pos[base + 1] = y0;
            pos[base + 2] = gamma;
            rat[idx] = iter / maxIter;
            idx++;
        }
    }

    self.postMessage({ k, pos: pos.buffer, rat: rat.buffer },
        [pos.buffer, rat.buffer]);
};

export default self;