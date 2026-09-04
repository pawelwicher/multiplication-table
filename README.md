# Tabliczka mnożenia

Gra do nauki tabliczki mnożenia dla dziecka. W pełni statyczna — bez backendu,
bez logowania, dane w przeglądarce.

## Tryby

**Spokojnie** (`/calm`) — jedno działanie naraz, bez zegara i bez żyć. Tutaj
wchodzi nowy materiał. Sesja ma 20 pytań; „Nie wiem" pokazuje wynik do przepisania.
To jedyny tryb, w którym pomiar czasu jest czysty, więc tylko tu można zdobyć
najwyższy poziom opanowania.

**Arcade** (`/game`) — działania spadają, trzeba odpowiedzieć przed linią.
Wpuszcza wyłącznie działania już znane (poziom ≥ 2): presja czasu buduje płynność,
ale psuje naukę nowego materiału. Na świeżej instalacji tryb jest zamknięty,
dopóki nic nie przejdzie przez tryb spokojny.

**Mapa** (`/map`) — siatka 10×10 z poziomem opanowania każdego działania.

## Uruchomienie

```bash
npx npm@11 install     # patrz „Uwaga o npm" niżej
npm start              # http://localhost:4200
```

## Testy

```bash
npm run test:run       # cały zestaw jednostkowy
npm run test:domain    # sama domena, ~0,7 s
npm run check:browser  # scenariusz end-to-end w prawdziwym Chrome
```

`check:browser` sam podnosi `ng serve`, jeśli nie stoi, i przechodzi całą ścieżkę:
menu → zamknięte arcade → sesja spokojna → zapis do IndexedDB → przeładowanie →
odblokowane arcade → mapa → kasowanie postępu. Zrzuty ekranu lądują
w `tools/browser-check/shots/`. Sterownik gada z przeglądarką po CDP i nie ma
żadnych zależności — Node 24 ma wbudowany WebSocket. Ścieżkę do przeglądarki
można wskazać zmienną `CHROME_PATH`.

## Architektura

```
src/app/
  domain/   czysty TypeScript — model, mastery, scheduler, arcade, calm
  data/     serializacja i IndexedDB
  state/    FactStore — jedyne źródło prawdy o postępach
  game/     pętla gry, kafelki, numpad, HUD, tryb spokojny
  ui/       menu, mapa
```

`domain/` nie importuje niczego z `@angular/*`, nie dotyka DOM i nie zna zegara —
czas i losowość wpływają argumentami. Dlatego cały silnik powtórek da się
przetestować bez uruchamiania Angulara i bez udawania zegara.

### Model

55 unikalnych działań (`a ≤ b`, czynniki 1–10). Klucz jest znormalizowany, więc
`7×8` i `8×7` to jeden fakt i jedna komórka na mapie. Działania z czynnikiem
1, 2, 5 lub 10 są oznaczone jako trywialne — wchodzą do gry, ale nie liczą się
do postępu. Zostaje 21 działań, które naprawdę trzeba zautomatyzować.

### Poziomy opanowania

`0` nieznany · `1` poznany · `2` znany · `3` płynny · `4` zautomatyzowany

Poziom liczy się z **mediany** ostatnich pięciu czasów odpowiedzi, nie ze średniej —
jeden przypadkowy zawis nie przekreśla serii. Poziom 3 wymaga mediany poniżej 3 s,
poziom 4 — poniżej 2 s i **wyłącznie z pomiarów bez drugiego kafelka na ekranie**.
Poziom rusza się o co najwyżej jeden stopień na odpowiedź, w obie strony:
spowolnienie zbija go także przy poprawnych odpowiedziach. Degradacja nigdy
nie schodzi do zera — raz poznanego działania nie odpoznajemy.

### Powtórki

Leitner z pudełkami `[natychmiast, 10 min, 1 dzień, 3 dni, 7 dni]`. Wybór działania
to 70% z zaległych i 30% z już płynnych, żeby sesja nie była samą porażką.

Tryb spokojny prowadzi **osobny zestaw roboczy** pięciu działań, krążący niezależnie
od kolejki powtórek. Bez tego byłby bezużyteczny: poprawna odpowiedź przesuwa
działanie do pudełka 2, czyli o dziesięć minut, a sesja trwa kilka minut — działanie
nigdy nie wróciłoby w tej samej sesji, więc nigdy nie zrobiłoby serii dwóch trafień
z rzędu i nigdy nie awansowało.

### Wydajność pętli gry

Pozycje kafelków to zwykłe obiekty w `Map`, zapisywane prosto do
`element.style.transform` w jednym `requestAnimationFrame`. Szablon w ogóle nie
dotyka `transform` — inaczej odświeżenie widoku cofałoby kafelek. Sygnały trzymają
wyłącznie stan dyskretny: wynik, życia, poziom, seria, bufor wejścia.

## Stack

Angular 22 standalone i zoneless, TypeScript 6, Vitest. Zero zewnętrznych
bibliotek runtime — bez silnika gry, bez UI kitu, bez Dexie.

## Uwaga o npm

Globalny npm 10.7.0 nie potrafi rozwiązać drzewa zależności Vitest 4
(`Cannot read properties of null (reading 'edgesOut')` w arborist). Instaluj przez
`npx npm@11 install` albo zaktualizuj globalny npm.
