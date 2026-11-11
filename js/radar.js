/* Three.js 3D scene. All trajectories/angles are ARTISTIC, not real orbital data. */
window.SpaceRadar3D = (() => {
  "use strict";

  const canvas = document.getElementById("scene");
  const tip = document.getElementById("tooltip");
  const fallback = document.getElementById("fallback");
  const TAU = Math.PI * 2;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const T = window.THREE;

  let renderer, scene, camera, earth, clouds, galaxy, sweep, sweepBeam;
  let selectedRing, selectedLine, selectedLinePositions;
  let raycaster, globeTexture;
  let requestAnimationId = 0;
  let onSelect = () => {};
  let objects = [], hitTargets = [], selectedId = null;
  let sweepEnabled = true, galaxyEnabled = true, autoRotate = !reduceMotion;
  let speed = reduceMotion ? 0 : 1;
  let angle = .54, elevation = .34;
  let cameraDistance = window.innerWidth <= 700 ? 63 : 48;
  let targetDistance = cameraDistance;
  let lastFrameTime = 0, sweepTime = 0, galaxyRotation = .12;
  let clockStarted = false;
  const activePointers = new Map();
  let moved = 0, pinchDistance = null, tipObject = null;
  let diffuseRock, riskyRock, rockGeometry, hitGeometry, glowTexture;

  const clamp = (x, lower, upper) => Math.max(lower, Math.min(upper, x));

  function hash(s) {
    let value = 2166136261;
    for (let i = 0; i < String(s).length; i++) {
      value ^= String(s).charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function randomGenerator(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function lunarRadius(lunar) {
    return 5.5 + 15 * Math.log1p(clamp(Number(lunar) || 0, 0, 70)) / Math.log1p(70);
  }

  function circleGeometry(radius, segments = 180) {
    const points = [];
    for (let i = 0; i < segments; i++) {
      const a = i / segments * TAU;
      points.push(new T.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return new T.BufferGeometry().setFromPoints(points);
  }

  function glowMap() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(.2, "rgba(255,255,255,.65)");
    gradient.addColorStop(.55, "rgba(255,255,255,.13)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }

  function earthMap() {
    // Self-contained stylized fallback, so the globe remains recognizable offline.
    const w = 1024, h = 512;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const ocean = ctx.createLinearGradient(0, 0, w, h);
    ocean.addColorStop(0, "#07305a");
    ocean.addColorStop(.5, "#17668c");
    ocean.addColorStop(1, "#062b58");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, w, h);

    // Rough equirectangular continent outlines. Artistic texture, not a map.
    const continents = [
      [[-168,72],[-136,69],[-125,58],[-112,52],[-126,43],[-123,32],[-113,28],[-108,20],[-97,17],[-89,21],[-81,25],[-82,30],[-95,34],[-97,48],[-82,52],[-81,62],[-106,72],[-145,73]],
      [[-82,12],[-71,12],[-60,8],[-52,3],[-47,-5],[-37,-13],[-40,-22],[-49,-28],[-52,-42],[-68,-56],[-77,-38],[-81,-14]],
      [[-13,37],[-6,45],[5,52],[17,54],[27,60],[42,56],[38,48],[26,42],[16,40],[10,35],[-2,36]],
      [[-17,37],[5,37],[26,32],[34,12],[41,0],[33,-13],[24,-27],[18,-35],[10,-34],[-4,-15],[-16,5]],
      [[28,59],[41,72],[81,76],[111,71],[141,57],[161,60],[174,50],[151,39],[128,43],[115,32],[124,21],[108,6],[95,13],[81,7],[67,22],[51,26],[45,36],[34,43],[23,49]],
      [[112,-11],[131,-13],[148,-21],[152,-30],[140,-39],[114,-34]],
      [[-52,84],[-39,78],[-41,61],[-55,60],[-62,72]]
    ];
    const coordinate = ([lon, lat]) => [(lon + 180) / 360 * w, (90 - lat) / 180 * h];
    for (const polygon of continents) {
      ctx.beginPath();
      polygon.forEach((point, i) => {
        const [x, y] = coordinate(point);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = "#41785d";
      ctx.fill();
      ctx.strokeStyle = "rgba(186,219,175,.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Ice caps and terrain with subtle noise.
    const rng = randomGenerator(71);
    for (let i = 0; i < 4300; i++) {
      ctx.fillStyle = i % 3 === 0 ? "rgba(236,221,163,.05)" : "rgba(165,226,232,.03)";
      const x = rng() * w, y = rng() * h;
      ctx.fillRect(x, y, 1 + rng() * 5, .6 + rng() * 3);
    }
    ctx.fillStyle = "rgba(232,246,255,.84)";
    ctx.fillRect(0, 0, w, 26);
    ctx.fillStyle = "rgba(232,246,255,.77)";
    ctx.fillRect(0, h - 37, w, 37);
    const texture = new T.CanvasTexture(c);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function cloudMap() {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const ctx = c.getContext("2d");
    const rand = randomGenerator(1728);
    for (let i = 0; i < 650; i++) {
      const x = rand() * c.width, y = rand() * c.height;
      const width = 10 + rand() * 78;
      const height = 2 + rand() * 11;
      ctx.fillStyle = "rgba(241,248,255," + (0.02 + rand() * .12) + ")";
      ctx.beginPath();
      ctx.ellipse(x, y, width, height, -0.2 + rand() * .4, 0, TAU);
      ctx.fill();
    }
    return new T.CanvasTexture(c);
  }

  function addEarth() {
    earth = new T.Mesh(
      new T.SphereGeometry(2.65, 64, 48),
      new T.MeshPhongMaterial({
        map: earthMap(), color: 0xffffff, shininess: 10,
        specular: new T.Color("#28567d")
      })
    );
    earth.rotation.y = 2.35;
    scene.add(earth);

    clouds = new T.Mesh(
      new T.SphereGeometry(2.698, 64, 48),
      new T.MeshPhongMaterial({
        map: cloudMap(), transparent: true, opacity: .62,
        depthWrite: false, shininess: 0
      })
    );
    clouds.rotation.y = 2.15;
    scene.add(clouds);

    const aura = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture, color: 0x2b8fe0, transparent: true,
      opacity: .3, blending: T.AdditiveBlending, depthWrite: false
    }));
    aura.scale.set(11.2, 11.2, 1);
    aura.position.z = -.7;
    scene.add(aura);
    // Use a high-resolution public Three.js example texture when available.
    // Procedural map above remains the fallback when the request fails.
    new T.TextureLoader().load(
      "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
      texture => {
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        earth.material.map.dispose();
        earth.material.map = texture;
        earth.material.needsUpdate = true;
      },
      undefined,
      () => {}
    );
  }

  function makeGalaxy() {
    galaxy = new T.Group();
    const count = window.innerWidth < 750 ? 3600 : 7600;
    const points = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new T.Color();
    const rnd = randomGenerator(9878);
    for (let i = 0; i < count; i++) {
      const u = rnd() * TAU;
      const distToCore = Math.atan2(Math.sin(u), Math.cos(u));
      const bright = Math.exp(-distToCore * distToCore * 1.6);
      const lat = (rnd() + rnd() + rnd() - 1.5) * (.08 + .17 * bright);
      const r = 240 + rnd() * 140;
      points.set([r * Math.cos(lat) * Math.cos(u),
        r * Math.sin(lat), r * Math.cos(lat) * Math.sin(u)], i * 3);
      color.set("#809fd9").lerp(new T.Color("#fff0d0"), bright * .9)
        .multiplyScalar(.43 + rnd() * .55);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(points, 3));
    geo.setAttribute("color", new T.BufferAttribute(colors, 3));
    galaxy.add(new T.Points(geo, new T.PointsMaterial({
      size: 1.3, sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: .82, depthWrite: false
    })));
    galaxy.rotation.set(.5, .2, .85);
    scene.add(galaxy);

    const stars = new Float32Array(1900 * 3);
    for (let i = 0; i < stars.length; i += 3) {
      const a = rnd() * TAU, z = rnd() * 2 - 1;
      const k = Math.sqrt(1 - z * z), r = 260 + rnd() * 130;
      stars.set([r * k * Math.cos(a), r * z, r * k * Math.sin(a)], i);
    }
    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute("position", new T.BufferAttribute(stars, 3));
    const starfield = new T.Points(starGeo, new T.PointsMaterial({
      size: 1.1, sizeAttenuation: false, color: 0xa2b4eb,
      transparent: true, opacity: .6, depthWrite: false
    }));
    galaxy.add(starfield);
  }

  function addRangeGrid() {
    const ringMaterial = new T.LineBasicMaterial({
      color: 0x62c8f6, transparent: true, opacity: .26
    });
    [1, 5, 10, 25, 50].forEach(lunar => {
      const ring = new T.LineLoop(circleGeometry(lunarRadius(lunar)), ringMaterial);
      ring.userData.lunarDistance = lunar;
      scene.add(ring);
    });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      const outer = lunarRadius(70);
      const radial = new T.BufferGeometry().setFromPoints([
        new T.Vector3(Math.cos(a) * 3.5, 0, Math.sin(a) * 3.5),
        new T.Vector3(Math.cos(a) * outer, 0, Math.sin(a) * outer)
      ]);
      scene.add(new T.Line(radial, new T.LineBasicMaterial({
        color: 0x65bce4, transparent: true, opacity: .09
      })));
    }
    sweep = new T.Group();
    const radius = lunarRadius(70);
    const wedge = new T.Mesh(
      new T.CircleGeometry(radius, 54, -.69, .69),
      new T.MeshBasicMaterial({
        color: 0x51baff, transparent: true, opacity: .08,
        depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending
      })
    );
    wedge.rotation.x = -Math.PI / 2;
    const beam = new T.Line(
      new T.BufferGeometry().setFromPoints([
        new T.Vector3(0, 0, 0),
        new T.Vector3(radius, 0, 0)
      ]),
      new T.LineBasicMaterial({ color: 0x79ddff, transparent: true, opacity: .57 })
    );
    sweep.add(wedge, beam);
    scene.add(sweep);
    sweepBeam = beam;

    selectedRing = new T.Mesh(
      new T.RingGeometry(.83, .95, 48),
      new T.MeshBasicMaterial({
        color: 0xffffff, transparent: true,
        opacity: .92, side: T.DoubleSide, depthWrite: false
      })
    );
    selectedRing.visible = false;
    scene.add(selectedRing);

    selectedLinePositions = new Float32Array(6);
    const lineGeometry = new T.BufferGeometry();
    lineGeometry.setAttribute("position", new T.BufferAttribute(
      selectedLinePositions, 3
    ));
    selectedLine = new T.Line(lineGeometry, new T.LineBasicMaterial({
      color: 0xeaf6ff, transparent: true, opacity: .28
    }));
    selectedLine.visible = false;
    scene.add(selectedLine);
  }

  function makeObject(item) {
    const risky = item.hazardous;
    const diameter = Number(item.maxDiameterM) || 50;
    const scale = .2 + Math.sqrt(Math.min(diameter, 1000)) * .009;
    const body = new T.Mesh(rockGeometry, risky ? riskyRock : diffuseRock);
    body.scale.setScalar(scale);
    // Stable, artificial positions: NOT real coordinates.
    const h = hash(item.id);
    const phase = (h % 10000) / 10000 * TAU;
    const lateral = (hash("tilt-" + item.id) % 1000) / 1000 - .5;
    const radius = lunarRadius(item.lunarDistance);
    const sprite = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture,
      color: risky ? 0xff607d : 0x7bdfff,
      transparent: true, opacity: .7, blending: T.AdditiveBlending,
      depthWrite: false
    }));
    sprite.scale.set(1.4 + scale * 3, 1.4 + scale * 3, 1);
    body.add(sprite);
    const hit = new T.Mesh(hitGeometry, new T.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false
    }));
    hit.scale.setScalar(Math.max(1.35, scale * 3.4));
    hit.userData.id = item.id;
    body.add(hit);
    scene.add(body);
    return {
      item, body, sprite, hit, phase, radius,
      height: lateral * radius * .22,
      angularVelocity: .09 / Math.sqrt(radius),
      scale
    };
  }

  function setObjects(items) {
    objects.forEach(o => {
      scene.remove(o.body);
      o.hit.material.dispose();
      o.sprite.material.dispose();
    });
    objects = (items || []).slice(0, 100).map(makeObject);
    hitTargets = objects.map(o => o.hit);
    if (!objects.some(o => o.item.id === selectedId)) selectedId = null;
    for (const obj of objects) locate(obj);
    updateSelection();
  }

  function locate(obj) {
    obj.body.position.set(
      obj.radius * Math.cos(obj.phase),
      obj.height,
      obj.radius * Math.sin(obj.phase)
    );
  }

  function updateSelection() {
    const selected = objects.find(o => o.item.id === selectedId);
    selectedRing.visible = !!selected;
    selectedLine.visible = !!selected;
    if (selected) {
      selectedRing.material.color.set(selected.item.hazardous ? 0xff8091 : 0xffffff);
      selectedRing.position.copy(selected.body.position);
    }
  }

  function select(id) {
    selectedId = id;
    updateSelection();
  }

  function eventPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    };
  }

  function hitObject(event) {
    raycaster.setFromCamera(eventPoint(event), camera);
    const hit = raycaster.intersectObjects(
      hitTargets.filter(mesh => mesh.parent && mesh.parent.visible), false
    )[0];
    return hit ? objects.find(obj => obj.item.id === hit.object.userData.id) : null;
  }

  function tooltip(event, object) {
    if (!object) { tip.hidden = true; tipObject = null; return; }
    tipObject = object;
    tip.textContent = object.item.name + " · " +
      object.item.lunarDistance.toFixed(1) + " DL";
    tip.style.left = Math.min(window.innerWidth - 195, event.clientX + 14) + "px";
    tip.style.top = Math.max(12, event.clientY - 26) + "px";
    tip.hidden = false;
  }

  function resize() {
    if (!renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setInteraction() {
    canvas.addEventListener("pointerdown", event => {
      canvas.setPointerCapture(event.pointerId);
      activePointers.set(event.pointerId, [event.clientX, event.clientY]);
      moved = 0;
      tooltip(event, null);
    });
    canvas.addEventListener("pointermove", event => {
      if (!activePointers.has(event.pointerId)) {
        if (event.pointerType === "mouse") {
          const obj = hitObject(event);
          canvas.style.cursor = obj ? "pointer" : "grab";
          tooltip(event, obj);
        }
        return;
      }
      const old = activePointers.get(event.pointerId);
      if (activePointers.size >= 2) {
        const another = [...activePointers.entries()].find(([id]) => id !== event.pointerId);
        if (another) {
          const dx = event.clientX - another[1][0];
          const dy = event.clientY - another[1][1];
          const next = Math.hypot(dx, dy);
          if (pinchDistance) {
            targetDistance = clamp(targetDistance * pinchDistance / Math.max(next, 1), 13, 100);
          }
          pinchDistance = next;
          moved = 100;
        }
      } else {
        const dx = event.clientX - old[0];
        const dy = event.clientY - old[1];
        moved += Math.abs(dx) + Math.abs(dy);
        angle -= dx * .005;
        elevation = clamp(elevation + dy * .004, -1.25, 1.25);
      }
      activePointers.set(event.pointerId, [event.clientX, event.clientY]);
    });
    function finish(event, wasCanceled) {
      if (activePointers.has(event.pointerId) &&
          !wasCanceled && activePointers.size === 1 && moved < 6) {
        const hit = hitObject(event);
        if (hit) onSelect(hit.item.id);
        else onSelect(null);
      }
      activePointers.delete(event.pointerId);
      if (!activePointers.size) pinchDistance = null;
    }
    canvas.addEventListener("pointerup", event => finish(event, false));
    canvas.addEventListener("pointercancel", event => finish(event, true));
    canvas.addEventListener("wheel", event => {
      event.preventDefault();
      targetDistance = clamp(targetDistance * (1 + event.deltaY * .0011), 13, 100);
    }, { passive: false });
    canvas.addEventListener("pointerleave", event => tooltip(event, null));
    addEventListener("resize", resize);
  }

  function frame(now) {
    requestAnimationId = requestAnimationFrame(frame);
    if (!clockStarted) { lastFrameTime = now; clockStarted = true; }
    const dt = Math.min(.04, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    if (!reduceMotion) {
      earth.rotation.y += dt * .045;
      clouds.rotation.y += dt * .052;
      galaxy.rotation.y += dt * .0014;
      if (autoRotate && activePointers.size === 0 && selectedId == null) {
        angle += dt * .018;
      }
      sweepTime += dt * .48;
    }

    sweep.visible = sweepEnabled;
    sweep.rotation.y = sweepTime;

    for (const o of objects) {
      if (!reduceMotion && speed > 0) {
        o.phase += dt * speed * o.angularVelocity;
        locate(o);
      }
      const highlight = o.item.id === selectedId;
      const wave = Math.sin(now * .0012 + (hash(o.item.id) % 100) / 20);
      o.sprite.material.opacity = highlight ? .95 : .4 + .13 * wave;
      const scale = (1.4 + o.scale * 3) * (highlight ? 1.6 : 1);
      o.sprite.scale.set(scale, scale, 1);
    }

    const current = objects.find(o => o.item.id === selectedId);
    if (current) {
      selectedRing.position.copy(current.body.position);
      selectedRing.lookAt(camera.position);
      const positions = selectedLine.geometry.attributes.position;
      positions.setXYZ(0, 0, 0, 0);
      positions.setXYZ(1,
        current.body.position.x, current.body.position.y, current.body.position.z);
      positions.needsUpdate = true;
      selectedLine.geometry.computeBoundingSphere();
    }

    cameraDistance += (targetDistance - cameraDistance) * .09;
    camera.position.set(
      cameraDistance * Math.cos(elevation) * Math.sin(angle),
      cameraDistance * Math.sin(elevation),
      cameraDistance * Math.cos(elevation) * Math.cos(angle)
    );
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  function init(callback) {
    onSelect = typeof callback === "function" ? callback : () => {};
    if (!T || !canvas) {
      fallback.hidden = false;
      document.getElementById("fallbackText").textContent =
        "O motor 3D não carregou. Confira a conexão e utilize a lista de objetos.";
      return false;
    }
    try {
      renderer = new T.WebGLRenderer({
        canvas, alpha: true, antialias: true, powerPreference: "high-performance"
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
      renderer.outputEncoding = T.sRGBEncoding;
      scene = new T.Scene();
      camera = new T.PerspectiveCamera(53, 1, .1, 1000);
      raycaster = new T.Raycaster();
      glowTexture = glowMap();
      diffuseRock = new T.MeshStandardMaterial({
        color: 0x8dc7e9, emissive: 0x3a8bb1, emissiveIntensity: .42,
        flatShading: true, roughness: .88
      });
      riskyRock = new T.MeshStandardMaterial({
        color: 0xff8396, emissive: 0xc34865, emissiveIntensity: .5,
        flatShading: true, roughness: .85
      });
      rockGeometry = new T.IcosahedronGeometry(1, 1);
      hitGeometry = new T.SphereGeometry(1, 8, 6);
      scene.add(new T.AmbientLight(0x91b4ff, .7));
      const sun = new T.DirectionalLight(0xffffff, 1.8);
      sun.position.set(6, 3, 8);
      scene.add(sun);
      addEarth();
      makeGalaxy();
      addRangeGrid();
      setInteraction();
      resize();
      requestAnimationId = requestAnimationFrame(frame);
      return true;
    } catch (error) {
      fallback.hidden = false;
      document.getElementById("fallbackText").textContent =
        "Não foi possível iniciar o WebGL. A lista de eventos continua disponível.";
      return false;
    }
  }

  function setSpeed(next) {
    speed = reduceMotion ? 0 : clamp(Number(next) || 0, 0, 3);
  }
  function setGalaxy(next) {
    galaxyEnabled = Boolean(next);
    if (galaxy) galaxy.visible = galaxyEnabled;
  }
  function setSweep(next) { sweepEnabled = Boolean(next); }
  function setAutoRotate(next) { autoRotate = !reduceMotion && Boolean(next); }
  function isReady() { return !!renderer; }

  return Object.freeze({
    init, setObjects, select, setSpeed,
    setGalaxy, setSweep, setAutoRotate, isReady
  });
})();
