GOTOWE PLIKI DO PODMIANY W z0z6/met-verse
============================================

3 pliki, wrzucasz 1:1 do repo (podmieniasz/dodajesz w tych ścieżkach):

  index.html              -> PODMIEŃ istniejący plik w root repo
  js/vr-headset-bg.js     -> DODAJ nowy plik do folderu js/
  models/vr-headset.glb   -> DODAJ nowy plik do nowego folderu models/

Co się zmieniło w index.html względem oryginału:
- import init z './js/particles.js' zamieniony na import init
  z './js/vr-headset-bg.js' (jedna linijka)
- wywołanie init('canvas-container') teraz odpala Twoje gogle VR
  zamiast cząsteczek
- reszta pliku (intro, HUD, przyciski FPP/TPP/VR, main.js) — bez zmian

Twój dotychczasowy js/particles.js, js/config.js, config.json
i admin.html zostają w repo nietknięte — po prostu index.html
już ich nie wywołuje. Jeśli zechcesz kiedyś wrócić do cząsteczek,
wystarczy przywrócić oryginalny import.

JAK WGRAĆ (przez przeglądarkę GitHub)
----------------------------------------
1. Wejdź na https://github.com/z0z6/met-verse
2. Otwórz index.html w repo → ikona ołówka (Edit) → zaznacz całość,
   wklej zawartość załączonego tu index.html → Commit changes
3. "Add file" → "Upload files" → wrzuć models/vr-headset.glb
   i js/vr-headset-bg.js (GitHub sam utworzy folder models/,
   bo js/ już istnieje)
4. Gotowe — GitHub Pages przebuduje stronę automatycznie

JAK WGRAĆ (przez git)
------------------------
    cd met-verse
    cp /ścieżka/do/paczki/index.html .
    mkdir -p models
    cp /ścieżka/do/paczki/models/vr-headset.glb models/
    cp /ścieżka/do/paczki/js/vr-headset-bg.js js/
    git add index.html models/vr-headset.glb js/vr-headset-bg.js
    git commit -m "Swap background to rotating wireframe VR headset"
    git push origin main

WYMAGANY CREDIT (licencja CC-BY-4.0)
---------------------------------------
Model pochodzi ze Sketchfab, wymaga podania autora gdzieś na stronie
(np. w stopce albo w README repo):

"This work is based on 'VR Headset Free Model'
(https://sketchfab.com/3d-models/vr-headset-free-model-51b8dbff65e247979f068914f6197909)
by Vitamin (https://sketchfab.com/btrseller) licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/)"

USTAWIENIA DO ZMIANY
-----------------------
W js/vr-headset-bg.js, na górze pliku:
- LINE_COLOR, LINE_OPACITY  -> wygląd linii
- ROTATE_SPEED              -> szybkość obrotu
- TILT_DEG                  -> kąt przechylenia (domyślnie 45)
