
self.onmessage = e => {
    const {
        gridSize, k, zMin, dz, zoom, escapeR,
        maxIter, fractalType, dx = 0, dy = 0,
        juliaMode, juliaRe = 0.75, juliaIm = 0,
        epsilon: epsIn = 1e-6, scaleMode = 1, convergenceTest,
        escapeMode = 'converge'
    } = e.data;

    const N = gridSize * gridSize;
    const pos = new Float32Array(N * 3);
    const rat = new Float32Array(N);
    const gamma = zMin + k * dz;
    const epsilon = epsIn * zoom;
    const invGrid = 1 / (gridSize - 1);
    const escapeR2 = escapeR * escapeR;

    const isNewton =
        fractalType === 26 || // Nova
        fractalType === 40 || // Tri-Nova
        fractalType === 41 || // Nova-Mandelbrot
        fractalType === 42 || // Nova-2
        fractalType === 43 || // Nova-2 (alt)
        fractalType === 44 || // Quartic-Nova
        fractalType === 45 || // Flower-Nova
        fractalType === 46;    // Scatter-Nova

    let idx = 0;
    for (let i = 0; i < gridSize; i++) {
        const x0 = juliaMode
            ? juliaRe
            : ((i * invGrid - 0.5) * zoom + dx);

        for (let j = 0; j < gridSize; j++) {
            const y0 = juliaMode
                ? juliaIm
                : ((j * invGrid - 0.5) * zoom + dy);

            let [qx, qy, px, py] = getInitialZ(fractalType, x0, y0);
            let iter = 0;

            outer:
            while (qx * qx + qy * qy <= escapeR2 && iter < maxIter) {
                const { nx, ny, npx, npy } =
                    computeFractal(fractalType, qx, qy, px, py, x0, y0, gamma, iter, scaleMode);

                // convergence test
                if ((isNewton || convergenceTest)) {
                    if (escapeMode === 'diverge') {
                        // bail as soon as we overflow the escape radius
                        if (nx * nx + ny * ny > escapeR2) {
                            iter++;
                            break outer;
                        }
                    } else {
                        // convergence-mode: only stop when the iterate actually settles
                        const dx_ = nx - qx, dy_ = ny - qy;
                        if (dx_ * dx_ + dy_ * dy_ < epsilon) {
                            iter++;
                            break outer;
                        }
                    }
                }
                qx = nx; qy = ny;
                px = npx; py = npy;
                iter++;
            }

            const b = 3 * idx++;
            pos[b] = x0;
            pos[b + 1] = y0;
            pos[b + 2] = gamma;
            rat[idx - 1] = iter / maxIter;
        }
    }

    self.postMessage({ k, pos: pos.buffer, rat: rat.buffer },
        [pos.buffer, rat.buffer]);
};


/* ---------- Burning-Ship Multibrot helpers ---------- */
function shipPower(ax, ay, p) {           // |z|^p in polar coords
    // r = sqrt(ax²+ay²)  ;  θ = atan2(ay, ax)
    const r2 = ax * ax + ay * ay;
    const r = Math.pow(r2, 0.5 * p);      // r^p
    const th = Math.atan2(ay, ax) * p;     // pθ
    return [r * Math.cos(th),               // Re part
    r * Math.sin(th)];             // Im part
}

/* ---------- generic inverse-power helper ---------- */
function invPower(qx, qy, p) {
    /* 1 / (qx + i qy)^p  via polar form */
    const r2 = qx * qx + qy * qy + 1e-9;        // avoid /0
    const rp = Math.pow(r2, p * 0.5);       // r^p
    const th = Math.atan2(qy, qx) * p;      // p·θ
    const rpInv = 1.0 / rp;                 // 1 / r^p
    return [rpInv * Math.cos(th),          // Re
    -rpInv * Math.sin(th)];       // Im  (negated ⇒ 1/z^p)
}

function getInitialZ(type, x0, y0) {
    if (
        type === 26 || // Nova
        type === 40 || // Tri-Nova
        type === 41 || // Nova-Mandelbrot
        type === 42 || // Nova-2
        type === 43 || // Nova-2 (alt)
        type === 44 || // Quartic-Nova
        type === 45 || // Flower-Nova
        type === 46    // Scatter-Nova
    ) {
        return [1, 0, 0, 0];
    }
    if (type >= 30 && type <= 39) return [x0, y0, 0, 0]; // inverse families at c
    return [0, 0, 0, 0];                            // all others at 0
}

function computeFractal(fractalType, qx, qy, px, py, cx, cy, gamma, iter, scaleMode = 1) {
    const s = 1 + iter * (gamma - 1);
    let ccx = cx, ccy = cy;
    if (scaleMode === 1) {
        ccx *= s; ccy *= s;
    } else if (scaleMode === 2) {
        ccx /= s; ccy /= s;
    }
    const a = Math.abs(qx), b = Math.abs(qy);
    let nx, ny, npx = px, npy = py;


    switch (fractalType) {
        case 1:  // Tricorn
            nx = qx * qx - qy * qy + ccx;
            ny = -2 * qx * qy + ccy;
            break;

        case 2:  // Burning Ship
            nx = a * a - b * b + ccx;
            ny = 2 * a * b + ccy;
            break;

        case 3:  // Perpendicular Mandelbrot
            nx = qx * qx - qy * qy + ccx;
            ny = -2 * a * qy + ccy;
            break;

        case 4:  // Celtic
            nx = Math.abs(qx * qx - qy * qy) + ccx;
            ny = 2 * qx * qy + ccy;
            break;

        case 5:  // Buffalo
            nx = Math.abs(qx * qx - qy * qy) + ccx;
            ny = -2 * qx * qy + ccy;
            break;

        case 6:  // Phoenix (λ = –0.5)
            nx = qx * qx - qy * qy + ccx - 0.5 * px;
            ny = 2 * qx * qy + ccy - 0.5 * py;
            npx = qx;      // ← store *this* iteration's z for the next round
            npy = qy;
            break;

        case 7: { // Cubic Multibrot (z³ + c)
            const r2 = qx * qx + qy * qy;
            const theta = Math.atan2(qy, qx);
            const r3 = Math.pow(r2, 1.5);        // r³
            nx = r3 * Math.cos(3 * theta) + ccx;
            ny = r3 * Math.sin(3 * theta) + ccy;
            break;
        }

        case 8: { // Quartic Multibrot (z⁴ + c)
            const r2 = qx * qx + qy * qy;
            const theta = Math.atan2(qy, qx);
            const r4 = r2 * r2;                  // r⁴
            nx = r4 * Math.cos(4 * theta) + ccx;
            ny = r4 * Math.sin(4 * theta) + ccy;
            break;
        }

        case 9:  // Cosine
            nx = Math.cos(qx) * Math.cosh(qy) + ccx;
            ny = -Math.sin(qx) * Math.sinh(qy) + ccy;
            break;

        case 10: // Sine
            nx = Math.sin(qx) * Math.cosh(qy) + ccx;
            ny = Math.cos(qx) * Math.sinh(qy) + ccy;
            break;

        case 11: {         // Heart
            // z_{n+1} = (|Re(z_n)| + i·Im(z_n))^2 + c
            const rx = Math.abs(qx);          // ⎯ only real part
            nx = rx * rx - qy * qy + ccx;
            ny = 2 * rx * qy + ccy;
            break;
        }

        case 12: // Perpendicular Buffalo
            nx = Math.abs(qx * qx - qy * qy) + ccx;
            ny = -2 * a * qy + ccy;
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

            nx = tx + ccx;
            ny = ty + ccy;
            break;
        }

        case 14: {                        // Quintic Multibrot  (z^5 + c)
            const r2 = qx * qx + qy * qy;
            const theta = Math.atan2(qy, qx);
            const r5 = Math.pow(r2, 2.5);           // r^(5/2)
            nx = r5 * Math.cos(5 * theta) + ccx;
            ny = r5 * Math.sin(5 * theta) + ccy;
            break;
        }

        case 15: {                        // Sextic Multibrot   (z^6 + c)
            const r2 = qx * qx + qy * qy;
            const theta = Math.atan2(qy, qx);
            const r6 = r2 * r2 * r2;                   // r^3, then squared → r^6
            nx = r6 * Math.cos(6 * theta) + ccx;
            ny = r6 * Math.sin(6 * theta) + ccy;
            break;
        }

        case 16: {                        // Tangent fractal    (tan z + c)
            // tan(x+iy) = (sin2x + i sinh2y) / (cos2x + cosh2y)
            const sin2x = Math.sin(2 * qx);
            const sinh2y = Math.sinh(2 * qy);
            const denom = Math.cos(2 * qx) + Math.cosh(2 * qy) + 1e-9; // avoid /0
            nx = sin2x / denom + ccx;
            ny = sinh2y / denom + ccy;
            break;
        }

        case 17: {                        // Exponential fractal (exp z + c)
            const ex = Math.exp(qx);
            nx = ex * Math.cos(qy) + ccx;
            ny = ex * Math.sin(qy) + ccy;
            break;
        }

        case 18: {                      // Septic Multibrot (z^7 + c)
            const r2 = qx * qx + qy * qy;
            const theta = Math.atan2(qy, qx);
            const r7 = Math.pow(r2, 3.5);          // r^(7/2)
            nx = r7 * Math.cos(7 * theta) + ccx;
            ny = r7 * Math.sin(7 * theta) + ccy;
            break;
        }

        case 19: {                      // Octic Multibrot (z^8 + c)
            const r2 = qx * qx + qy * qy;
            const theta = Math.atan2(qy, qx);
            const r8 = r2 * r2 * r2 * r2;                  // r^8
            nx = r8 * Math.cos(8 * theta) + ccx;
            ny = r8 * Math.sin(8 * theta) + ccy;
            break;
        }

        case 20: {                      // Inverse Mandelbrot (1/z^2 + c)
            const r2 = qx * qx + qy * qy + 1e-9;   // avoid /0
            const inv = 1.0 / (r2 * r2);          // 1 / |z|⁴

            // real part is unchanged
            nx = (qx * qx - qy * qy) * inv + ccx;

            // *** sign is now POSITIVE ***
            ny = (2 * qx * qy) * inv + ccy;
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
            const dx = ccx * sub + cx;
            const dy = ccy * sub + cy;

            nx = a * a - b * b + dx * s;               // same Burning-Ship update
            ny = 2.0 * a * b + dy * s;
            break;
        }

        case 22: {  // Cubic Burning Ship  |z|³ + c
            const [rx, ry] = shipPower(a, b, 3.0);
            nx = rx + ccx;
            ny = ry + ccy;
            break;
        }

        case 23: {  // Quartic Burning Ship |z|⁴ + c
            const [rx, ry] = shipPower(a, b, 4.0);
            nx = rx + ccx;
            ny = ry + ccy;
            break;
        }

        case 24: {  // Quintic Burning Ship |z|⁵ + c
            const [rx, ry] = shipPower(a, b, 5.0);
            nx = rx + ccx;
            ny = ry + ccy;
            break;
        }

        case 25: {  // Hexic Burning Ship  |z|⁶ + c
            const [rx, ry] = shipPower(a, b, 6.0);
            nx = rx + ccx;
            ny = ry + ccy;
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

            nx = qx - qxDiv + ccx;
            ny = qy - qyDiv + ccy;
            break;
        }

        /* -------- Man-o-War (needs previous-z, reuse Phoenix vars) ------------------ */
        case 27: { // z² + c + z_{n-1}
            nx = qx * qx - qy * qy + ccx + px;
            ny = 2.0 * qx * qy + ccy + py;
            npx = qx;            // ← store current z for the next iteration
            npy = qy;
            break;
        }
        /*   30 – inv cubic   | 31 – inv quartic | … | 35 – inv octic   */
        case 30:
        case 31:
        case 32:
        case 33:
        case 34:
        case 35: {
            const p = invPowerP;                        // 3 … 8
            const r2 = qx * qx + qy * qy + 1e-12;            // tiny ε avoids /0
            const rp = Math.pow(r2, -p * 0.5);           // 1 / r^p
            const ang = -p * Math.atan2(qy, qx);          // −p·θ   (minus sign = reciprocal)
            const rx = rp * Math.cos(ang);
            const ry = rp * Math.sin(ang);
            nx = rx + ccx;
            ny = ry + ccy;
            break;
        }
        /* ---------- 36 : Inverse Burning-Ship (reciprocal variant) -------- */
        case 36: {              //  1 / (|z|²)      + c
            const a = Math.abs(qx), b = Math.abs(qy);
            const r2 = qx * qx + qy * qy + 1e-9;          // avoid /0
            const inv = 1.0 / (r2 * r2);                // 1 / |z|⁴
            nx = (a * a - b * b) * inv + ccx;
            ny = (2 * a * b) * inv + ccy;
            break;
        }

        /* ---------- 37 : Inverse Tricorn ---------------------------------- */
        case 37: {              //  1 / (conj(z)²)  + c
            const r2 = qx * qx + qy * qy + 1e-9;
            const inv = 1.0 / (r2 * r2);
            nx = (qx * qx - qy * qy) * inv + ccx;
            ny = (-2 * qx * qy) * inv + ccy;      // note minus => conjugate
            break;
        }

        /* ---------- 38 : Inverse Celtic (uses abs on real part) ------------ */
        case 38: {
            const r2 = qx * qx + qy * qy + 1e-9;
            const inv = 1.0 / (r2 * r2);
            const rx = Math.abs(qx * qx - qy * qy);
            nx = rx * inv + ccx;
            ny = (2 * qx * qy) * inv + ccy;
            break;
        }

        /* ---------- 39 : Inverse Phoenix (1/z² – 0.5·prev + c) ------------ */
        case 39: {
            const r2 = qx * qx + qy * qy + 1e-9;      // avoid /0
            const inv = 1.0 / (r2 * r2);           // 1 / |z|⁴

            /* true 1 / z²   (Im part is POSITIVE) */
            const zx2 = (qx * qx - qy * qy) * inv;    // Re
            const zy2 = (2.0 * qx * qy) * inv;    // Im  ← fixed sign

            nx = zx2 + ccx - 0.5 * px;              // Phoenix blend  λ = –0.5
            ny = zy2 + ccy - 0.5 * py;

            npx = qx;                             // save previous-z
            npy = qy;
            break;
        }
        case 40: { //Tri-Nova
            /* z² */
            const zx2 = qx * qx - qy * qy,
                zy2 = 2.0 * qx * qy;

            /* z⁴ = (z²)² */
            const zx4 = zx2 * zx2 - zy2 * zy2,
                zy4 = 2.0 * zx2 * zy2;

            /*  (4/3)·z  −  (1/3)·z⁴  + c  */
            nx = (1.3333333333333333 * qx) - (0.3333333333333333 * zx4) + ccx;
            ny = (1.3333333333333333 * qy) - (0.3333333333333333 * zy4) + ccy;
            break;
        }
        case 41: {
            // Nova‐Mandelbrot: zₙ₊₁ = zₙ − (zₙ³ − 1)/(3 zₙ²) + c

            // z²
            const zx2 = qx * qx - qy * qy,
                zy2 = 2.0 * qx * qy;
            // z³
            const zx3 = zx2 * qx - zy2 * qy,
                zy3 = zx2 * qy + zy2 * qx;
            // denominator = 3·z²
            const denx = 3.0 * zx2,
                deny = 3.0 * zy2;
            const den2 = denx * denx + deny * deny + 1e-9;  // avoid /0

            // numerator = z³ − 1
            const numx = zx3 - 1.0,
                numy = zy3;

            // division (z³−1)/(3 z²)
            const divx = (numx * denx + numy * deny) / den2;
            const divy = (numy * denx - numx * deny) / den2;

            // candidate for next z
            const nx0 = qx - divx + ccx,
                ny0 = qy - divy + ccy;

            // otherwise accept the step
            nx = nx0;
            ny = ny0;
            break;
        }
        case 42: {  // Nova 2
            // 1) compute 1/z
            const r2_inv = 1.0 / (qx * qx + qy * qy + 1e-9);
            const izRe = qx * r2_inv;
            const izIm = -qy * r2_inv;

            // 2) build (1/z)^2 and (1/z)^4
            const zx2 = izRe * izRe - izIm * izIm;
            const zy2 = 2.0 * izRe * izIm;
            const zx4 = zx2 * zx2 - zy2 * zy2;
            const zy4 = 2.0 * zx2 * zy2;

            // 3) apply forward Quad-Nova step on 1/z:
            //    f = (4/3)*(1/z) - (1/3)*(1/z)^4 + c*s
            const fRe = 1.3333333333333333 * izRe
                - 0.3333333333333333 * zx4
                + ccx;
            const fIm = 1.3333333333333333 * izIm
                - 0.3333333333333333 * zy4
                + ccy;

            // 4) invert back: z_{n+1} = 1 / f
            const den = 1.0 / (fRe * fRe + fIm * fIm + 1e-9);
            nx = fRe * den;
            ny = -fIm * den;
            break;
        }

        case 43: {  // Nova  2
            // 1) build z² and z⁴ just like case 40
            const zx2 = qx * qx - qy * qy;
            const zy2 = 2.0 * qx * qy;
            const zx4 = zx2 * zx2 - zy2 * zy2;
            const zy4 = 2.0 * zx2 * zy2;

            // 2) do the forward Quad-Nova step f(z) = (4/3)z – (1/3)z⁴ + c·s
            const fRe = 1.3333333333333333 * qx
                - 0.3333333333333333 * zx4
                + ccx;
            const fIm = 1.3333333333333333 * qy
                - 0.3333333333333333 * zy4
                + ccy;

            // 3) invert that result: z_{n+1} = 1 / f
            const invR2 = 1.0 / (fRe * fRe + fIm * fIm + 1e-9);
            nx = fRe * invR2;
            ny = -fIm * invR2;
            break;
        }

        case 44: { // Quartic-Nova: Newton iteration for z⁴ – 1 (plus c)
            // First build z² and z³
            const zx2 = qx * qx - qy * qy;
            const zy2 = 2 * qx * qy;
            const zx3 = zx2 * qx - zy2 * qy;
            const zy3 = zx2 * qy + zy2 * qx;

            // Now z⁴ = z³ * z
            const zx4 = zx3 * qx - zy3 * qy;
            const zy4 = zx3 * qy + zy3 * qx;

            // Newton step: (z⁴ – 1) / (4 z³)
            const numx = zx4 - 1.0, numy = zy4;
            const denx = 4.0 * (zx2 * qx - zy2 * qy);
            const deny = 4.0 * (zx2 * qy + zy2 * qx);
            const den2 = denx * denx + deny * deny + 1e-9; // avoid /0

            const divx = (numx * denx + numy * deny) / den2;
            const divy = (numy * denx - numx * deny) / den2;

            // new z = z – (z⁴–1)/(4 z³) + c
            nx = qx - divx + ccx;
            ny = qy - divy + ccy;
            break;
        }
        case 45: { // Flower Nova
            // seed z₀ = c
            if (iter === 0) {
                qx = cx;
                qy = cy;
            }

            // 1) build z²
            const zx2 = qx * qx - qy * qy;
            const zy2 = 2.0 * qx * qy;

            // 2) build z³ & z⁴
            const zx3 = zx2 * qx - zy2 * qy;
            const zy3 = zx2 * qy + zy2 * qx;
            const zx4 = zx3 * qx - zy3 * qy;
            const zy4 = zx3 * qy + zy3 * qx;

            // 3) Newton-style divisor = 4 z³
            const denx = 4.0 * zx3, deny = 4.0 * zy3;
            const den2 = denx * denx + deny * deny + 1e-9;

            // 4) numerator = z⁴ – 1
            const numx = zx4 - 1.0, numy = zy4;

            // 5) (z⁴–1)/(4z³)
            const divx = (numx * denx + numy * deny) / den2;
            const divy = (numy * denx - numx * deny) / den2;

            // 6) forward candidate: zₙ – (z⁴–1)/(4z³) + c·s
            const fx = qx - divx + ccx;
            const fy = qy - divy + ccy;

            // 7) NEGATE the result
            nx = -fx;
            ny = -fy;
            break;
        }
        case 46: {  // Scatter-Nova 
            // seed z₀ = c exactly once
            if (iter === 0) {
                qx = cx;
                qy = cy;
            }

            // build z²
            const zx2 = qx * qx - qy * qy;
            const zy2 = 2.0 * qx * qy;

            // build z³ and z⁴
            const zx3 = zx2 * qx - zy2 * qy;
            const zy3 = zx2 * qy + zy2 * qx;
            const zx4 = zx3 * qx - zy3 * qy;
            const zy4 = zx3 * qy + zy3 * qx;

            // denominator = 4·z³
            const denx = 4.0 * zx3, deny = 4.0 * zy3;
            const den2 = denx * denx + deny * deny + 1e-9; // avoid /0

            // numerator = z⁴ – 1
            const numx = zx4 - 1.0, numy = zy4;

            // (z⁴–1)/(4 z³)
            const divx = (numx * denx + numy * deny) / den2;
            const divy = (numy * denx - numx * deny) / den2;

            // forward Newton candidate: z – (z⁴–1)/(4 z³) + c·s
            const fx = qx - divx + ccx;
            const fy = qy - divy + ccy;

            // **invert** it: zₙ₊₁ = 1 / f
            const invR2 = 1.0 / (fx * fx + fy * fy + 1e-9);
            nx = fx * invR2;
            ny = -fy * invR2;
            break;
        }
        case 47: {
            // the “needle” centre in the c-plane:
            const tipRe = -1.8043359375;
            const tipIm = -0.017451171875;
            // how deep (fraction of current zoom window) you want to go:
            const sub = 0.04;
  
            // 'cx' and 'cy' here are your usual sample-point
            // (i.e. ((i*invGrid - .5)*zoom + dx), etc.)
            // we now pull them fractionally toward the tip
            const zoomedRe = tipRe + (ccx - tipRe) * sub;
            const zoomedIm = tipIm + (ccy - tipIm) * sub;
  
            // burn-ship uses absolute values of the *previous* z:
            nx = a * a - b * b + zoomedRe;
            ny = 2 * a * b + zoomedIm;
            break;
          }
        default: // Mandelbrot
            nx = qx * qx - qy * qy + ccx;
            ny = 2 * qx * qy + ccy;
    }

    return { nx, ny, npx, npy };
}