// ==========================================
// CONFIG & LOCALSTORAGE MANAGEMENT
// ==========================================
const STORAGE_KEY = "met_verse_vr_config";

// Domyślne wartości parametrów
const defaultConfig = {
  bgColor: "#050508",
  vrColor: "#00ffcc",
  gridColor: "#1a2636",
  zoom: 1.0,
  speed: 0.010,
  tilt: 15
};

// Funkcja do wczytywania konfigu z localStorage
function loadConfig() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { ...defaultConfig };
  try {
    return { ...defaultConfig, ...JSON.parse(saved) };
  } catch (e) {
    console.error("Błąd podczas odczytu localStorage, przywracanie domyślnych:", e);
    return { ...defaultConfig };
  }
}

// Globalny obiekt konfiguracji
const config = loadConfig();

// Funkcja zapisująca konfigurację do localStorage
function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// Detekcja urządzeń mobilnych dla optymalizacji
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// ==========================================
// THREE.JS SCENE SETUP
// ==========================================
const container = document.getElementById("webgl-container");

const scene = new THREE.Scene();
scene.background = new THREE.Color(config.bgColor);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 7);

const renderer = new THREE.WebGLRenderer({
  antialias: !isMobile, // Wyłączamy antialiasing na telefonach dla skoku FPS
  powerPreference: "high-performance"
});

// Optymalizacja lagów na Androidzie: ograniczenie PixelRatio
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2.0));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// ==========================================
// GEOMETRY GENERATION (VR GOGGLES & GRID)
// ==========================================

const vrGroup = new THREE.Group();
scene.add(vrGroup);

// Materiał dla Gogli VR (Wireframe)
const vrMaterial = new THREE.MeshBasicMaterial({
  color: config.vrColor,
  wireframe: true
});

// Tworzenie proceduralnego modelu gogli VR
function createVRGoggles() {
  const goggles = new THREE.Group();

  // 1. Główny korpus przedni
  const bodyGeo = new THREE.BoxGeometry(2.2, 1.1, 1.0, 10, 6, 6);
  const bodyMesh = new THREE.Mesh(bodyGeo, vrMaterial);
  goggles.add(bodyMesh);

  // 2. Przednia szybka / osłona
  const visorGeo = new THREE.BoxGeometry(1.9, 0.8, 0.2, 8, 4, 2);
  const visorMesh = new THREE.Mesh(visorGeo, vrMaterial);
  visorMesh.position.z = 0.52;
  goggles.add(visorMesh);

  // 3. Wcięcie na nos (dół)
  const noseGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8);
  const noseMesh = new THREE.Mesh(noseGeo, vrMaterial);
  noseMesh.rotation.x = Math.PI / 2;
  noseMesh.position.set(0, -0.45, 0.3);
  goggles.add(noseMesh);

  // 4. Boczny pasek mocujący
  const sideStrapGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.2, 16, 1, true, 0, Math.PI);
  const sideStrapMesh = new THREE.Mesh(sideStrapGeo, vrMaterial);
  sideStrapMesh.rotation.x = Math.PI / 2;
  sideStrapMesh.position.set(0, 0, -0.5);
  goggles.add(sideStrapMesh);

  // 5. Górny pasek mocujący
  const topStrapGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.2, 16, 1, true, Math.PI / 2, Math.PI);
  const topStrapMesh = new THREE.Mesh(topStrapGeo, vrMaterial);
  topStrapMesh.rotation.z = Math.PI / 2;
  topStrapMesh.position.set(0, 0.2, -0.5);
  goggles.add(topStrapMesh);

  return goggles;
}

const vrModel = createVRGoggles();
vrGroup.add(vrModel);

// Siatka tła (Grid)
const gridHelper = new THREE.GridHelper(30, 30, new THREE.Color(config.gridColor), new THREE.Color(config.gridColor));
gridHelper.position.y = -2.5;
scene.add(gridHelper);

// ==========================================
// RENDER LOOP
// ==========================================
function animate() {
  requestAnimationFrame(animate);

  // Rotacja i kąt wychylenia
  vrGroup.rotation.y += parseFloat(config.speed);
  vrGroup.rotation.x = THREE.MathUtils.degToRad(parseFloat(config.tilt));
  
  // Skalowanie (Zoom)
  const scale = parseFloat(config.zoom);
  vrGroup.scale.set(scale, scale, scale);

  renderer.render(scene, camera);
}

animate();

// ==========================================
// ADMIN PANEL EVENT HANDLERS & INITIALIZATION
// ==========================================

// Synchronizacja stanu HTML z zapisanym obiektem config
function syncInputsWithConfig() {
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

// Podpięcie listenerów i zapisu do localStorage
document.getElementById("bgColor").addEventListener("input", (e) => {
  config.bgColor = e.target.value;
  scene.background.set(config.bgColor);
  saveConfig();
});

document.getElementById("vrColor").addEventListener("input", (e) => {
  config.vrColor = e.target.value;
  vrMaterial.color.set(config.vrColor);
  saveConfig();
});

document.getElementById("gridColor").addEventListener("input", (e) => {
  config.gridColor = e.target.value;
  gridHelper.material.color.set(config.gridColor);
  saveConfig();
});

document.getElementById("zoom").addEventListener("input", (e) => {
  config.zoom = e.target.value;
  document.getElementById("val-zoom").innerText = parseFloat(config.zoom).toFixed(2);
  saveConfig();
});

document.getElementById("speed").addEventListener("input", (e) => {
  config.speed = e.target.value;
  document.getElementById("val-speed").innerText = parseFloat(config.speed).toFixed(3);
  saveConfig();
});

document.getElementById("tilt").addEventListener("input", (e) => {
  config.tilt = e.target.value;
  document.getElementById("val-tilt").innerText = `${config.tilt}°`;
  saveConfig();
});

// Zwijanie/Rozwijanie Panelu
const panel = document.getElementById("admin-panel");
const toggleBtn = document.getElementById("panel-toggle");
const toggleIcon = document.getElementById("toggle-icon");

toggleBtn.addEventListener("click", () => {
  panel.classList.toggle("collapsed");
  toggleIcon.innerText = panel.classList.contains("collapsed") ? "▲" : "▼";
});

// Wczytaj zapisaną konfigurację do kontrolek w GUI
syncInputsWithConfig();

// ==========================================
// RESPONSYWNOŚĆ (RESIZE)
// ==========================================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
