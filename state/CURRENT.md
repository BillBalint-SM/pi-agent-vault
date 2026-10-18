# Aktuális érdemi állapot

## Irány és tartós döntések

- Ez a repó a Pi-asszisztens hordozható munkakörnyezetének és válogatott, aktuális működési állapotának központi forrása. Nem pusztán dokumentációkereső, nem modellsúly-mentés, és nem a teljes beszélgetéstörténet.
- Magyar, tömör, döntésképes kommunikáció. Gyors, pontos, önálló haladás; a legkisebb teljes megoldás, YAGNI/SOLID arányosan; L0–L3 munkamélység. A részletes szerződés: `working-policy.md`.
- A repó nyilvános. Csak megtisztított közös szabályok, konfigurációforrások, eszközkód és folytatási kontextus kerülhet bele. Kulcsok, cookie-k, sessionök, privát projektek/briefek, személyes naplók és pontos gépi mentési adatok nem.
- A korábbi dokumentációs tár forrása az eredeti Git-előzményben marad: `de64d2a5a5a204bcfe374dc140a1dadcd25efaaf`. Nem aktív integráció. Pi-kérdésnél először az adott telepített verzió hivatalos dokumentációját kell olvasni.

## Munkakörnyezet

- Referencia: Pi **1.3.0**, Node **26.x**. A hordozható telepítő más Pi-verziót nem fogad el próba nélkül.
- Hat rögzített csomag: web-access 0.42.0; background-tasks 2.6.10; rpiv-todo 2.13.9; simplify 0.2.3; lens 4.4.3; subagents 0.79.1. Zod 4.6.7 explicit runtime peer.
- Öt aktív extension: web, process-only háttérmunka, L2/L3 todo, simplify, korlátozott subagent. Két allowlistelt skill: browser-control, evidence-led-design. Nincs automatikusan átvett csomag-skill/prompt/theme.
- Web: Exa → DuckDuckGo; közvetlen HTTP; nincs browser cookie, rejtett összegző modell, hosted fetch, automatikus klónozás vagy kép/videó/YouTube útvonal. A keresők megkapják a lekérdezést.
- Background: process-only; Windows cmd, Linux/macOS bash kiválasztás. Delegate/fusion/attested nincs. A bővítmény peer-deklarációja nem fedi a referencia Pi-verziót; korábbi szűk Windows-pilot átment, teljes kompatibilitás nincs igazolva.
- Subagent: csak pi-reviewer; read/grep/find/ls; friss kontextus, saját globális/projektutasítások, örökölt modell; extra extension és további delegálás nélkül. Konkurencia 1; max. 2 indítás/futásfa, 8/szülősession, mélység 1. Ez nem OS-sandbox és nem emberi szakértői validálás.
- Lens telepítve, globálisan inaktív. Projektkijelölés, eszköz- és módosítási szabályok felmérése nélkül nem aktiválható.
- Az evidence-led-design keretrendszer, forrásregiszter és review-validator a repóban van. A validator struktúrát ellenőriz, nem vizuális minőséget. A projekt saját DESIGN.md-je marad a márka tekintélye.
- A korábbi képes/videós API-adapter újrahasználható kódja `tools/content-generator/` alatt megmarad. Alapértelmezett offline dry-run; élő, fizetős integráció és generált vizuális minőség nincs igazolva. Projektbrand, privát brief és eredmény nincs átadva.

## Ellenőrzött és még nyitott

- A korábbi abszolút útvonalas profilon külön/együtt végzett SDK-pilotok: regisztráció, webkeresés/HTTP, tiltott provider, háttérfolyamat siker/hiba/leállítás, todo és tiltott agent ellenőrzése sikeres. Ez nem bizonyítja a mostani hordozható profilt.
- **A hordozható forrás elkészült; az első Windows-pilot sikeres.** 25 teszt átment: profilgenerálás, másik home és szóköz/Unicode path, idegen utasítás védelme, beállításmegőrzés, idempotencia, byte-pontos rollback, újabb kézi változás védelme, design-validator és offline API-guardok. A célzott public-source path/titok-/lock-ellenőrzés is sikeres; ez nem teljes biztonsági audit.
- Elkülönített Pi 1.3.0 SDK-session: pontosan öt extension és két skill, tiltott többletfunkciók hiánya, simplify regisztráció, read-only subagent ceiling, todo create/list/clear, tiltott agent/provider, valódi echo háttérfolyamat és kimenete, valamint IANA közvetlen HTTP-extraction sikeres. Modellhívás: 0. Részletes első pilotnapló helyben: `.local/migration/isolated-install-pilot.log`; a legutóbbi SDK-jelentés: `.local/verification/latest.json`.
- Az eltérő, szóközös gyökérbe másolt forrás valódi betöltése és tool-próbája is sikeres; az ismételt setup 0 változást eredményezett. A próba ugyanazon a Windows-gépen és hoston, közös dependency-junctionnel történt, nem másik fizikai PC-n vagy operációs rendszeren.
- A hordozható runtime függőségeinek npm-auditja 0 ismert sérülékenységet jelzett. Ez nem teljes forrásaudit vagy biztonsági garancia. A részletes audit gépi példánya helyben: `.local/dependency-audit.json`.
- **Az élő konfiguráció átállítva és külön SDK-sessionben ellenőrizve.** Öt kezelt profilfájl változott, a korábbi modell/provider/UI-preferenciák megmaradtak. Az ismételt setup 0 változást adott. Privát snapshot, pontos rollback-út és jelentések: `.local/migration/`. Auth/session tartalom nem lett exportálva.
- A korábbi külön policyfájl helyi kompatibilitási belépési pontként az itteni szerződésre mutat; eredetije privát snapshotban megmaradt. A régi abszolút útvonalas wrapper-/skillmásolatok nem az új profil forrásai, nem lettek törölve.
- A mentett új profil betöltése ellenőrzött; **ennek a már futó beszélgetésnek a teljes reloadja nincs igazolva**. Újraindítás vagy `/reload` után az új központi forrásokat kell használnia.
- TUI-shortcutok, valódi completion-triggerelt agent-ébresztés, reload-túlélés, valódi gyermekmodell-hívás és más operációs rendszeren végzett futás nincs ebben a migrációban ellenőrizve.

## Egyéb nyitott munkák – nem végrehajtási engedélyek

- Helyi AMD-alapú videógeneráló platform: dokumentációs terv létezik; Linux/ROCm/PyTorch/ComfyUI telepítés és helyi GPU-benchmark még nincs. Ubuntu LTS az első, kisebb integrációs kockázatú jelölt; Omarchy vállalható alternatíva, teljesítményelőny nincs kimérve. A pontos verziólánc újraellenőrzendő, a korábbi dokumentációs jelöltek nem lockfile-ok.
- Linux dual-boot előtt a korábbi túl széles élő fájlmásolás **leállítva, részleges és nem ellenőrzött**. Nem rendszerkép. Forrás és részleges másolat megőrizve. Mentéshatókör újratervezése és reprezentatív pilot szükséges; a gépi részletek csak helyben maradnak.
- Partíció/EFI/zsugoríthatósági leltár nem teljes. Ellenőrzött fontosadat-mentés és külön jóváhagyás nélkül nincs particionálás, pendrive-törlés vagy biztonsági gyengítés.

## Következő folytatási pont

1. Következő Pi-betöltéskor/reload után ebből a repóból olvasni a szabályokat és az aktuális állapotot; a lokális hitelesítést külön megtartani.
2. A hordozható migráció elkészült; további munka a felhasználó aktuális célja szerint. Korábbi nyitott szálak: Lens projektkijelölés, illetve a helyi videóplatform mentési/verziózár-előfeltételei. Ezek egyike sem automatikus telepítési vagy lemezműveleti engedély.
3. Következő érdemi változáskor az érintett központi forrást és ezt az állapotot együtt frissíteni, arányos ellenőrzéssel. A tényleges helyi checkpoint/távoli szinkron helyzetét a Gitből ellenőrizni, nem ebből a statikus szövegből feltételezni.

Gépspecifikus folytatási térkép, ha ezen a PC-n létezik: `.local/machine-state.json`. Ezt nem kell és nem szabad a nyilvános Gitbe tenni; másik gépre a pathokat nem feltételezhetjük.

A tényleges Git-állapotot a `npm run status` mutatja. Nem működik automatikus szemantikus frissítés kikapcsolt asszisztens mellett.
