# Tabliczka mnożenia

Aplikacja do nauki tabliczki mnożenia dla dziecka. Jeden ekran, w pełni statyczna —
bez backendu, bez logowania, dane w przeglądarce.

## Jak to działa

Jedno działanie naraz, bez zegara i bez presji. Wynik zatwierdza się sam, bez Entera —
gdy wpisana liczba jest już jednoznaczna. „Nie wiem" pokazuje wynik do przepisania.
Sesja ma 20 pytań i kończy się podsumowaniem.

### Trudność

Dziewięć progów: **1–20, 1–30, … 1–100**. Próg to zakres **wyniku** działania — przy
1–20 pojawiają się tylko działania o wyniku najwyżej 20, czyli 25 z 55 działań całej
tabliczki. Kolejne progi tylko dokładają, nigdy nie zabierają. Wybrany próg zostaje
zapamiętany; jego zmiana zaczyna sesję od nowa.

### Dobór pytań

Silnik powtórek to Leitner z pudełkami `[natychmiast, 10 min, 1 dzień, 3 dni, 7 dni]`.
Wybór działania to 70% z zaległych i 30% z już płynnych, żeby sesja nie była samą porażką.

Na to nałożone są dwie rzeczy, bez których sesja nie działałaby dobrze:

**Zestaw roboczy** ośmiu działań, krążący niezależnie od kolejki powtórek. Bez niego
poprawna odpowiedź wysyłałaby działanie do pudełka 2, czyli o dziesięć minut, a sesja
trwa kilka minut — działanie nigdy nie wróciłoby w tej samej sesji, więc nigdy nie
zrobiłoby serii dwóch trafień z rzędu i nigdy nie awansowało.

**Karencja** czterech pytań: działanie nie może wrócić, dopóki nie przejdą cztery inne.
Sam zakaz powtórki „dwa razy pod rząd" za mało rozrzucał pytania i sesja robiła się nużąca.

### Poziomy opanowania

`0` nieznany · `1` poznany · `2` znany · `3` płynny · `4` zautomatyzowany

Poziom liczy się z **mediany** ostatnich pięciu czasów odpowiedzi, nie ze średniej —
jeden przypadkowy zawis nie przekreśla serii. Poziom 3 wymaga mediany poniżej 3 s,
poziom 4 poniżej 2 s. Poziom rusza się o co najwyżej jeden stopień na odpowiedź,
w obie strony: spowolnienie zbija go także przy poprawnych odpowiedziach. Degradacja
nigdy nie schodzi do zera — raz poznanego działania nie odpoznajemy.

Licznik „umiesz X/Y" pokazuje, ile działań w wybranym progu jest już na poziomie 2 lub wyżej.

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
progi trudności, pełna sesja, rozrzut pytań, zapis do IndexedDB, zmiana progu,
przeładowanie, „Nie wiem" i zła odpowiedź. Zrzuty ekranu lądują
w `tools/browser-check/shots/`. Sterownik gada z przeglądarką po CDP i nie ma żadnych
zależności — Node 24 ma wbudowany WebSocket. Ścieżkę do przeglądarki można wskazać
zmienną `CHROME_PATH`.

## Architektura

```
src/app/
  domain/   czysty TypeScript — model, mastery, scheduler, trudność, sesja
  data/     serializacja, IndexedDB, preferencje
  state/    FactStore — jedyne źródło prawdy o postępach
  game/     ekran ćwiczenia i numpad
```

`domain/` nie importuje niczego z `@angular/*`, nie dotyka DOM i nie zna zegara —
czas i losowość wpływają argumentami. Dlatego cały silnik powtórek da się przetestować
bez uruchamiania Angulara i bez udawania zegara.

Postęp trafia do IndexedDB, wybrany próg do `localStorage`. Gdy przeglądarka nie daje
zapisu (tryb prywatny), aplikacja działa dalej i mówi o tym wprost.

Klucz działania jest znormalizowany, więc `7×8` i `8×7` to jeden fakt i jeden wpis
w bazie. Deserializacja jest defensywna: rekord spoza dopuszczalnych zakresów jest
odrzucany i zastępowany świeżym.

## Stack

Angular 22 standalone i zoneless, TypeScript 6, Vitest. Bez routera — jeden ekran.
Zero zewnętrznych bibliotek runtime.

## Uwaga o npm

Globalny npm 10.7.0 nie potrafi rozwiązać drzewa zależności Vitest 4
(`Cannot read properties of null (reading 'edgesOut')` w arborist). Instaluj przez
`npx npm@11 install` albo zaktualizuj globalny npm.
