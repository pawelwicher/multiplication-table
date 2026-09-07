# Trening matematyczny

Ćwiczenie działań i tabliczki mnożenia. Jedna strona, bez backendu, postęp trzymany
w przeglądarce.

## Co potrafi

- **Zakres liczb** od 1–20 do 1–100 — składniki i wyniki nie wychodzą poza wybrany zakres.
- **Działania do wyboru:** dodawanie, odejmowanie, mnożenie, dzielenie, nawiasy, niewiadoma `x`.
- **Od 2 do 10 składników** w jednym działaniu, np. `5 + 3 − 4 × 3 − 6 ÷ 2`.
- **Tryb tabliczki mnożenia** — wybrane tabliczki, opcjonalnie z dzieleniem.
- **Punkty rosnące z trudnością** działania, licznik poprawnych i błędnych, seria z mnożnikiem.
- **Własna klawiatura numeryczna** — na telefonie nie wyjeżdża klawiatura systemowa.
- **Tryb jasny i ciemny**, układ dopasowany do telefonu i desktopu.

## Uruchomienie

```bash
npx npm@11 install   # globalny npm 10.7 nie radzi sobie z Vitest 4
npm start            # http://localhost:4200
npm run test:run     # testy domeny
npm run build        # build produkcyjny
```

## Układ katalogów

| Katalog          | Odpowiada za                                                      |
| ---------------- | ----------------------------------------------------------------- |
| `src/app/domain` | Czysta logika: wyrażenia, generator działań, punktacja, tabliczka |
| `src/app/state`  | Sygnałowe stores i zapis do `localStorage`                        |
| `src/app/setup`  | Ekran kryteriów                                                   |
| `src/app/game`   | Ekran ćwiczenia i podsumowanie sesji                              |
| `src/app/ui`     | Klawiatura numeryczna                                             |
