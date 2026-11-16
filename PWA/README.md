# Mini-Foglio di Calcolo (PWA)

**🔗 Sito pubblicato: https://<username>.github.io/mini-sheet-pwa/**  ← *da sostituire*

## Avvio in locale
```
python3 -m http.server 8000   # poi apri http://localhost:8000
```
(non da `file://`: il service worker lo richiede)

## Deploy (GitHub Pages)
1. Crea il repo pubblico `mini-sheet-pwa` e fai push su `main` (file nella root).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
3. Attendi la pubblicazione e apri l'URL in una finestra anonima.
Percorsi tutti relativi (`./`), `start_url` e `scope` = `"./"`, SW registrato con `./sw.js`.

## Funzioni implementate
SOMMA, MEDIA, CONTA, CONTA.VALORI, SOMMA.SE, CONTA.SE, MEDIA.SE, MAX, MIN · operatori + - * / · parentesi · `-` unario ·
celle singole e intervalli · errori `#DIV/0!`, `#VALORE!`, `#RIF!`, `#NOME?`, `#CIRC!` (riferimento circolare) ·
separatore argomenti `;` o `,` · salvataggio automatico in localStorage.

## Virtualizzazione
Il DOM contiene solo le celle visibili (+2 di margine, ~500 `div`). Un `div` "layer" con dimensione 9000×2600 px crea le
barre di scorrimento native; a ogni `scroll` (throttled con `requestAnimationFrame`) si ricalcola la finestra visibile e si
ridisegnano le celle con posizione assoluta. Le intestazioni sono sincronizzate via `transform`.

## Dipendenze e ricalcolo
Ogni formula registra i riferimenti (celle singole → mappa inversa; intervalli → rettangoli). Alla modifica di una cella si
invalidano in cache solo i dipendenti transitivi; i valori vengono ricalcolati **lazy** (solo per le celle visibili o richieste).
Cicli rilevati con un insieme di celle "in valutazione".

## Casi di test (motore verificato in Node; il resto va provato nel browser)
| # | Caso | Esito |
|---|------|-------|
| 1 | A1=5, A2=10, A3==SOMMA(A1:A2) | 15 ✅ |
| 2 | B2==A1/B1 con B1=0 | #DIV/0! ✅ |
| 3 | C1==C1; D1↔D2 | #CIRC! ✅ |
| 4 | CONTA.SE(A1:A10;">5") valori misti | corretto ✅ |
| 5 | SOMMA(A1:CV100) su griglia vuota | *vedi nota* |
| 6 | Scorrimento 1→100 e ritorno | da verificare |
| 7 | 100 dipendenti | ~5 ms in Node ✅ (da verificare nel browser) |
| 8–10 | Offline, URL anonimo, nessun 404 | da verificare dopo il deploy |

*Nota caso 5:* se la formula è scritta in una cella **dentro** A1:CV100 (es. E1) è circolare per definizione, come in Excel.
Per ottenere 0 usa un intervallo che non la contiene, es. `=SOMMA(A2:CV100)` in E1.

## Extra / Difficoltà / Riflessioni
*Da compilare da voi* (domande di riflessione della consegna).
