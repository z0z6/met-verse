# Galeria — Metavers

Wirtualna sala wystawowa w przeglądarce: chodzenie (pierwsza/trzecia osoba) i tryb VR (Cardboard + Android Chrome, WebXR). Zbudowane w Three.js, hostowane statycznie (np. GitHub Pages) — bez żadnego backendu.

## Jak dodać własne prace

1. Wrzuć plik obrazu (jpg/png, najlepiej ≤ 1–2 MB) do folderu `images/`.
2. Dodaj wpis do `artworks.json`:
   ```json
   { "file": "images/moj-obraz.jpg", "title": "Tytuł pracy", "author": "Twoje imię" }
   ```
3. Wypchnij zmiany (`git add`, `git commit`, `git push`) — GitHub Pages przebuduje stronę automatycznie.

Galeria ma **18 gniazd** rozmieszczonych wzdłuż ścian sali. Prace z `artworks.json` wypełniają je po kolei (pierwsza pozycja w pliku = pierwsze gniazdo, itd.). Gniazda bez wpisu pokazują placeholder "wolne miejsce".

Jeśli chcesz więcej niż 18 prac lub inny układ sali, zmień `generateWallSlots()` w `src/room.js`.

## Sterowanie

- **W A S D** / strzałki — ruch
- **Mysz** — rozglądanie się (kliknij ekran, żeby zablokować kursor)
- **SHIFT** — bieg
- Przycisk **"Zmień widok"** w HUD-zie — przełącza pierwszoosobowy / trzecioosobowy w locie

## Tryb VR

Przycisk **VR** (dolny prawy róg, generowany automatycznie przez `VRButton` z Three.js) pojawia się tylko w przeglądarkach ze wsparciem WebXR — na Androidzie to Chrome. Wymaga HTTPS (GitHub Pages ma to domyślnie).

W VR nie ma kontrolera ruchowego (zwykłe gogle Cardboard bez trackingu 6DoF), więc poruszanie się działa przez **teleportację spojrzeniem**: patrz w dół na podłogę przez ~1,5 sekundy, aż pierścień się wypełni — gracz przeniesie się w to miejsce.

### Kalibracja soczewek (no-name Cardboard)
Jeśli obraz w goglach jest rozmyty/źle wyśrodkowany, wygeneruj profil swoich soczewek na stronie Google Cardboard Viewer Profile Generator i zeskanuj wygenerowany QR przy pierwszym uruchomieniu w Chrome.

## Uruchomienie lokalnie

Dowolny lokalny serwer HTTP wystarczy (moduły ES wymagają serwera, nie działają z `file://`):

```bash
npx serve .
# lub
python3 -m http.server 8000
```

## Wdrożenie na GitHub Pages

1. Utwórz repozytorium na GitHub, wrzuć całą zawartość tego folderu.
2. Settings → Pages → Source: `main` branch, folder `/ (root)`.
3. Strona będzie dostępna pod `https://<user>.github.io/<repo>/`.

## Struktura projektu

```
index.html          — punkt wejścia, UI (ekran startowy, HUD)
style.css            — style interfejsu
artworks.json        — lista prac (edytuj, żeby dodać swoje)
images/              — pliki obrazów
src/main.js          — bootstrap sceny, pętla renderowania, tryb VR
src/room.js          — geometria sali, oświetlenie, sloty na obrazy
src/artworks.js       — wczytywanie i rozmieszczanie prac
src/controls.js       — sterowanie, kamera FPP/TPP
```
