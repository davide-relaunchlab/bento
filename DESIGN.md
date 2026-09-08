---
name: bento/office dashboard
description: Sistema visivo della dashboard personale e condivisa, estratto dal codice.
colors:
  home-bg: "#f7f8fc"
  home-surface: "#fff"
  home-ink: "#202c45"
  home-muted: "#65718a"
  home-line: "#e3e8f1"
  home-blue: "#305bd1"
  home-blue-bg: "#edf2ff"
  home-green: "#167354"
  home-green-bg: "#eaf7f0"
  home-orange: "#b6501f"
  home-orange-bg: "#fff2e9"
  home-focus: "#335bd6"
typography:
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(26px, 2.5vw, 36px)"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-.035em"
  title:
    fontSize: "17px"
    fontWeight: 750
    letterSpacing: "-.025em"
  body:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    lineHeight: 1.7
  label:
    fontSize: "11px"
    fontWeight: 600
rounded:
  action: "8px"
  field: "7px"
  surface: "12px"
  creation: "14px"
  dialog: "16px"
spacing:
  compact: "6px"
  inline: "12px"
  group: "16px"
  mobile-edge: "18px"
components:
  button-primary:
    backgroundColor: "{colors.home-blue}"
    textColor: "{colors.home-surface}"
    rounded: "{rounded.action}"
    padding: "11px 18px"
  text-action:
    textColor: "{colors.home-muted}"
    padding: "8px 6px"
  icon-action:
    textColor: "{colors.home-muted}"
    width: "32px"
    height: "32px"
    rounded: "{rounded.field}"
  input:
    backgroundColor: "{colors.home-surface}"
    textColor: "{colors.home-ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  navigation-active:
    backgroundColor: "{colors.home-blue-bg}"
    textColor: "{colors.home-blue}"
    padding: "12px"
  filter:
    textColor: "{colors.home-muted}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
  folder:
    backgroundColor: "{colors.home-surface}"
    textColor: "{colors.home-ink}"
    rounded: "{rounded.surface}"
    padding: "17px 16px"
  create-spreadsheet:
    backgroundColor: "{colors.home-green-bg}"
    textColor: "{colors.home-green}"
    rounded: "{rounded.creation}"
    padding: "25px 22px"
---

# Design System: bento/office dashboard

## Overview

**Creative North Star: "Il tavolo di lavoro personale"**

Il tavolo di lavoro personale, come definito dal contratto della dashboard: contenuto centrale, comandi leggibili e archivio compatto. La superficie implementata è chiara e fredda, con inchiostro blu notte e Manrope; il contratto della dashboard è allineato a questo fondo freddo.

Questo documento descrive soltanto la dashboard bento/office, inclusi i suoi moduli e dialoghi. Non prescrive il sistema degli editor dash, type o slides e non introduce un nuovo marchio definitivo.

**Key Characteristics:**
- Tre accenti semantici distinguono i formati dei file.
- Superfici prevalentemente piatte, delimitate da tono e bordi sottili.
- Titoli compatti e metadati subordinati, con navigazione adattata alla larghezza.

Fonti: `office/client/dashboard.css`, `office/client/dashboard.ts`, `docs/design/dashboard.md` e i vincoli di marchio di `PRODUCT.md`. Estrazione da sorgente dell’8 settembre 2026: nessun controllo del rendering o degli stili calcolati in browser in questo passaggio; il Mac era bloccato. I token descrivono le dichiarazioni locali, non garantiscono l’assenza di interferenze dal CSS globale.

## Colors

La palette affianca neutrali freddi a tre coppie inchiostro/fondo pastello; i valori normativi sono nel frontmatter. Le rampe OKLCH del sidecar sono sintetizzate per le anteprime del pannello, non sono token implementati né palette approvate per nuove superfici.

### Primary

`home-blue` identifica documenti, azioni primarie e navigazione selezionata; `home-blue-bg` ne è la superficie tenue. `home-focus` mantiene il contorno di focus distinto dal riempimento del controllo.

### Secondary

`home-green` e `home-green-bg` identificano i fogli di calcolo.

### Tertiary

`home-orange` e `home-orange-bg` identificano le presentazioni. Il colore non sostituisce mai etichetta e disegno del formato.

### Neutral

`home-bg` è lo sfondo generale; `home-surface` sostiene rail, campi e cartelle. `home-ink` è il testo principale, `home-muted` accompagna metadati e controlli secondari, `home-line` separa superfici e righe.

**The File Identity Rule.** Il colore di formato resta coerente tra creazione, icona del file e punto del filtro.

## Typography

Manrope è caricato da un font locale variabile (pesi 200–800), con `font-display: swap`. La famiglia della dashboard comprende fallback di sistema; titoli principali e dialoghi dichiarano Manrope con fallback sans-serif.

La gerarchia headline identifica il titolo della pagina; title descrive le intestazioni di sezione; body descrive la prosa introduttiva; label descrive filtri e azioni testuali. Non esiste un unico stile body applicato a tutto: nomi dei file sono 12px/700, titoli di creazione 15px/750, metadati tipicamente 10px, dialoghi 19px. I paragrafi introduttivi hanno misura massima 60ch. Date e contatore usano cifre tabulari. I titoli possono andare a capo, le etichette delle cartelle usano ellissi.

I valori più piccoli sono registrati come densità attuale, non come obiettivo universale di leggibilità; non sono stati verificati visivamente. Non esiste una scala tipografica matematica dichiarata.

## Layout

La shell desktop usa una rail di 232px e una colonna `minmax(0,1fr)`. La rail è sticky, alta 100dvh; il contenuto principale ha larghezza massima 1392px e padding `52px clamp(24px,4vw,64px) 64px`. Il titolo e la ricerca precedono creazione, cartelle e archivio: è la composizione specifica della dashboard, non una regola per ogni pagina futura.

Creazione e cartelle occupano tre colonne con gap rispettivamente 16px e 12px; la separazione delle sezioni è di 38px. La ricerca misura 240px su desktop. Le righe file separano nome, posizione, data, ruolo e azioni; le azioni restano in una colonna di 68px.

A larghezze ≤1180px la rail scende a 200px, titolo e ricerca si impilano, le cartelle passano a due colonne; posizione e ruolo dei file vengono nascosti. I comandi di creazione mantengono tre colonne ma dispongono verticalmente icona e testo.

A larghezze ≤700px la rail diventa una testata con navigazione orizzontale; scheda spazio, cartelle laterali e profilo vengono nascosti. Il corpo usa padding `27px 18px 40px`; la creazione passa a una colonna e le cartelle restano su due. Date e intestazioni delle righe scompaiono: restano collegamento al file e azioni. Titolo pagina 27px; dialoghi con padding 22px. A larghezze ≥1500px le schede di creazione aumentano l’altezza minima a 152px e i titoli a 17px.

## Elevation & Depth

Le superfici ordinarie sono piatte, separate da colore e bordo sottile. L’hover delle cartelle cambia bordo e fondo; le righe file diventano bianche. Il dialogo usa l’unica ombra strutturale (`0 22px 90px #16213940`) e un backdrop (`#18233f66`). Non vengono impiegati gradienti o blur in questo stylesheet.

**The Dialog Depth Rule.** Il dialogo introduce profondità per separare un’azione contestuale dall’archivio sottostante.

Solo con `prefers-reduced-motion: no-preference`, le schede di creazione abilitate si sollevano di 3px in hover e i dialoghi entrano con traslazione di 8px e clip-path. Durata 180ms, curva di trasformazione `cubic-bezier(.16,1,.3,1)`; colore e bordo delle schede usano `ease`. Non estendere il movimento ai controlli disabilitati.

## Shapes

Angoli morbidi e contenuti: campi, filtri e pulsanti icona condividono il raggio field; pulsanti primari e righe file il raggio action; cartelle e form inline il raggio surface. La creazione usa il raggio creation e il dialogo il raggio dialog. Navigazione e ricerca usano rispettivamente 9px e 10px. Avatar, punti di formato e piccolo segno più hanno forma circolare.

Le icone sono SVG geometrici inline a tratto arrotondato, non glifi di font. Le icone file condividono foglio con angolo ripiegato, disegno interno specifico e due dimensioni: 31×37px nella lista e 51×60px nella creazione desktop (37×44px su mobile).

## Components

### Buttons

Il primario blu conferma creazione, spostamento e accesso; hover più scuro (`#244bad`). Le azioni testuali sono trasparenti e attenuate, con fondo e testo blu in hover. I pulsanti icona hanno area 32×32px, SVG 17px e hover tenue. Tutti i controlli disabilitati hanno opacità .5 e cursore non consentito. Pulsanti, link, input e select ricevono un outline di focus di 3px, offset 3px.

### Creation cards

Tre ampi pulsanti, uno per formato, con icona foglio, titolo, breve descrizione e segno più. Altezza minima desktop 132px; su mobile 90px. Hover con bordo del colore di formato; il movimento è subordinato alla preferenza utente. I controlli possono essere disabilitati secondo spazio e permessi: la palette non implica disponibilità.

### Inputs / Fields

La ricerca è un contenitore bianco bordato con icona 18px e campo interno trasparente. I campi dei moduli usano bordo neutro e raggio field. Il form di denominazione appare inline; selezione della destinazione e concessione accessi vivono in dialoghi. I campi mantengono contorno di focus; errori sono regioni `role="alert"` con fondo rosato e testo rosso scuro.

### Navigation

Voci compatte con icona, testo allineato a sinistra e stato attivo blu tenue. Le voci di spazio espongono `aria-current`; la rail elenca anche cartelle personali. Il cambio di spazio o cartella azzera la ricerca. Su mobile la navigazione resta esplicita nella testata.

### Filters

Pulsanti compatti con stato `aria-pressed`, testo e punto colorato per formato; selezionato con fondo `#e7edf9` e testo `#2b4a8d`. Il selettore di ordinamento affianca i filtri su desktop e scende sotto su mobile.

### Folders and file rows

Le cartelle sono pulsanti bianchi bordati con icona calda, nome e conteggio. I file sono righe con collegamento nativo, icona semantica, tipo e metadati progressivamente ridotti ai breakpoint. Le azioni di spostamento e condivisione hanno nome accessibile; la disponibilità dipende dal ruolo. Il contatore riflette l’elenco filtrato.

### Dialogs and feedback

Dialoghi nativi con larghezza `min(500px,calc(100vw - 32px))`, altezza massima 85dvh, scrolling interno, titolo e chiusura. Elenchi di accesso separano nome, ruolo e provenienza del permesso. Loading, errore con riprova e archivio vuoto sono stati espliciti; l’elenco file usa `aria-live="polite"`. Il sidecar illustra gli stili, non implementa questi flussi.

## Do's and Don'ts

### Do:
- Do mantenere la corrispondenza documento/blu, foglio/verde, presentazione/arancio insieme a icona e testo.
- Do mantenere focus visibile e stati disabled dei controlli.
- Do adattare la densità con i breakpoint esistenti e conservare titolo e azioni dei file su mobile.
- Do usare nomenclatura bento/ in minuscolo e cataloghi di traduzione per la UI.

### Don't:
- Don’t trasferire automaticamente questi token agli editor.
- Don’t aggiungere ombre alle superfici ordinarie della dashboard: il rilievo strutturale appartiene ai dialoghi.
- Don’t trasformare gli esempi statici del sidecar in prova di comportamento o verifica visiva.
