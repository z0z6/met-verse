document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "met_verse_vr_config";

  const defaultConfig = {
    bgColor: "#050508",
    vrColor: "#00ffcc",
    gridColor: "#1a2636",
    zoom: 1.0,
    speed: 0.010,
    tilt: 15
  };

  // Wczytywanie z localStorage
  function loadConfig() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...defaultConfig };
    try {
      return { ...defaultConfig, ...JSON.parse(saved) };
    } catch (e) {
      return { ...defaultConfig };
    }
  }

  const config = loadConfig();

  function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    const status = document.getElementById("save-status");
    if (status) {
      status.innerText = "Zapisano pomyślnie!";
      setTimeout(() => { status.innerText = ""; }, 2000);
    }
  }

  // Detekcja urządzeń mobilnych
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Inicjalizacja Three.js
  const container = document.getElementById("webgl-container");
  if (!container) return;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(config.bgColor);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 7);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2.0));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // Obiekt Gogli VR i Siatki
  const vrGroup = new THREE.Group();
  scene.add(vrGroup);

  const vrMaterial = new THREE.MeshBasicMaterial({
    color: config.vrColor,
    wireframe: true
  });

  function createVRGoggles() {
    const goggles = new THREE.Group();

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.0, 10, 6, 6), vrMaterial);
    goggles.add(bodyMesh);

    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 0.2, 8, 4, 2), vrMaterial);
    visorMesh.position.z = 0.52;
    goggles.add(visorMesh);

    const noseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8), vrMaterial);
    noseMesh.rotation.x = Math.PI / 2;
    noseMesh.position.set(0, -0.45, 0.3);
    goggles.add(noseMesh);

    const sideStrapMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.2, 16, 1, true, 0, Math.PI), vrMaterial);
    sideStrapMesh.rotation.x = Math.PI / 2;
    sideStrapMesh.position.set(0, 0, -0.5);
    goggles.add(sideStrapMesh);

    const topStrapMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 16, 1, true, Math.PI / 2, Math.PI), vrMaterial);
    topStrapMesh.rotation.z = Math.PI / 2;
    topStrapMesh.position.set(0, 0.2, -0.5);
    goggles.add(topStrapMesh);

    return goggles;
  }

  vrGroup.add(createVRGoggles());

  const gridHelper = new THREE.GridHelper(30, 30, new THREE.Color(config.gridColor), new THREE.Color(config.gridColor));
  gridHelper.position.y = -2.5;
  scene.add(gridHelper);

  // Loop animacji
  function animate() {
    requestAnimationFrame(animate);
    vrGroup.rotation.y += parseFloat(config.speed);
    vrGroup.rotation.x = THREE.MathUtils.degToRad(parseFloat(config.tilt));
    const scale = parseFloat(config.zoom);
    vrGroup.scale.set(scale, scale, scale);
    renderer.render(scene, camera);
  }
  animate();

  // Wypełnienie GUI wartosciami z configu
  function syncInputs() {
    document.getElementById("bgColor").value = config.bgColor;
    document.getElementById("vrColor").value = config.vrColor;
    document.getElementById("gridColor").value = config.gridColor;

    document.getElementById("zoom").value = config.zoom;
    document.getElementById("val-zoom").innerText = parseFloat(config.zoom).toFixed(2);

    document.getElementById("speed").value = config.speed;
    document.getElementById("val-speed").innerText = parseFloat(config.speed).toFixed(3);

    document.getElementById("tilt").value = config.tilt;
    document.getElementById("val-tilt").innerText = `${config.tilt}°`;
  }

  // Obsługa zdarzeń GUI
  document.getElementById("bgColor").addEventListener("input", (e) => {
    config.bgColor = e.target.value;
    scene.background.set(config.bgColor);
  });

  document.getElementById("vrColor").addEventListener("input", (e) => {
    config.vrColor = e.target.value;
    vrMaterial.color.set(config.vrColor);
  });

  document.getElementById("gridColor").addEventListener("input", (e) => {
    config.gridColor = e.target.value;
    gridHelper.material.color.set(config.gridColor);
  });

  document.getElementById("zoom").addEventListener("input", (e) => {
    config.zoom = e.target.value;
    document.getElementById("val-zoom").innerText = parseFloat(config.zoom).toFixed(2);
  });

  document.getElementById("speed").addEventListener("input", (e) => {
    config.speed = e.target.value;
    document.getElementById("val-speed").innerText = parseFloat(config.speed).toFixed(3);
  });

  document.getElementById("tilt").addEventListener("input", (e) => {
    config.tilt = e.target.value;
    document.getElementById("val-tilt").innerText = `${config.tilt}°`;
  });

  document.getElementById("save-btn").addEventListener("click", () => {
    saveConfig();
  });

  // Zwijanie panelu
  const panel = document.getElementById("admin-panel");
  const toggleBtn = document.getElementById("panel-toggle");
  const toggleIcon = document.getElementById("toggle-icon");

  toggleBtn.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    toggleIcon.innerText = panel.classList.contains("collapsed") ? "▲" : "▼";
  });

  syncInputs();

  // Resize handler
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
});
