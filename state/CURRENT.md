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
- A mentett új profil SDK-betöltése ellenőrzött; a beszélgetés frissített globális utasításai és skillútvonalai már a vaultra mutatnak. Ez nem igazolja önmagában a teljes interaktív runtime vagy reload-túlélés minden viselkedését.
- TUI-shortcutok, valódi completion-triggerelt agent-ébresztés, reload-túlélés, valódi gyermekmodell-hívás és más operációs rendszeren végzett futás nincs ebben a migrációban ellenőrizve.

## Aktuális munka – helyi videógeneráló platform

- A felhasználó kérésére folytatjuk a mentés újratervezését/ellenőrzését, a lemez/EFI/zsugoríthatóság felmérését és a pontos videós verziólánc kialakítását. A telepítés/lemezmódosítás későbbi, külön jóváhagyásos kapu.
- Az első korlátozott, csak olvasó Windows-leltár sikeres: klasszikus disk/partíció/drive-mapping, kapacitás, kizárólag felső szintű mappametadata és a részleges backup összefoglalói. Ez a leltár nem járt rekurzív teljes profilbejárással vagy másolással. Eszköz: `scripts/storage-inventory.ps1`; gépi bizonyíték csak `.local/video-platform/inventory-01/` alatt.
- A korábbi backupból nincs lezárt source-results összesítő; az első profilforrás logja és a kifejezett leállítási állapot maradt meg. Nem következik ebből a későbbre sorolt, profilon kívüli gyökérprojektek mentése. A felmért szabad hely lehetővé tette a később elkészült külön rendszerképet a részleges másolat törlése nélkül; teljes helyreállíthatóság ettől még nincs igazolva.
- A natív GPT-leltár, firmware bootlista és WinRE-információ sikeresen mentve; a rendszer/helyreállítási partíciók azonosítva. A csak `shrink querymax` lekérdezés 90 másodperces időkorlátba futott, nincs megbízható zsugoríthatósági eredmény. Nem történt resize/formázás/bootkonfiguráció-változtatás. A saját lekérdezéshez tartozó konkrét folyamatok utóellenőrzése nem talált megmaradt folyamatot. A lekérdezést nem indítjuk újra vakon; következő ellenőrzés célzottan vagy később a Windows lemezkezelőjében.
- A hivatalos AMD/PyTorch/Ubuntu/ComfyUI-források, a commitra kötött requirements, a wheelindexek és a három modellfájl kiadói LFS-metadata ellenőrizve. A konkrét Linux cp312 torch/vision wheel-URL HEAD 200-t ad; a súlyokhoz revízió/méret/kiadói SHA256 megvan. Nincs ISO, teljes wheelcsomag vagy modell letöltve/telepítve, és nincs GPU-mérés.
- Megtisztított közös verziójelölt: `knowledge/video-platform/README.hu.md` és `candidate.json`: Ubuntu Desktop 24.04.5.1, ISO-manifest szerint HWE 7.0.0-31/Python 3.12; AMD 10.1-es család, dokumentált torch 2.13/vision 0.28, rögzített ComfyUI-commit, natív Wan2.2 5B. A 2.13-as induló páros elkerüli az AMD jelenlegi 2.14-es példájának vision-alpha csomagját; ez nem mért előny. Driver-artifact/aláírás, tényleges runtime/device-extra és teljes tranzitív verzió/hash-zár még nyitott, ezért ez nem végleges, tesztelt runtime-lock.
- Natív Windows AMD-út is dokumentált, nem állítjuk Linux kizárólagosságát. A konkrét OS/driver megfelelőség és a működő videóstack külön bizonyítandó; most nincs új Windows-telepítés vagy platformváltás a háttérben.
- Fájlmásolat, tömörített archívum, natív VSS-rendszerkép és offline teljes SSD-image összevetve. A rendelkezésre álló hely és a Windows/boot/programok megőrzése miatt első rendszer-visszaállítási jelölt a natív image, a régi részleges másolat megtartásával. A gépi döntési jelentés privát: `.local/video-platform/ASSESSMENT.hu.md`.
- A legfeljebb 32 MiB / 100 fájlos HDD I/O-pilot sikeres: ténylegesen 50 nem érzékeny fájl, másolat és ZIP hash-visszaolvasása egyezett. Nem hideg-lemez-, image-, ACL/ADS-, alkalmazáskonzisztencia- vagy bare-metal restore-teszt; nincs egészlemezes időextrapoláció. A VSS-lekérdezésben a megjelenő writerek Stable / No error állapotúak, ami csak előfeltétel, nem backupigazolás. A pilot öt célzott guard/unit tesztje és a PowerShell/Python szintaktikai ellenőrzések is sikeresek.
- **A jóváhagyott EFI + Windows + Recovery VSS-rendszerkép elkészült:** kb. 101 perc, natív exit 0, mindhárom kötet success, stderr üres. A natív katalógus a verziót és a kötet/file/system-state/BMR recovery-lehetőségeket látja; három önálló, parent nélküli VHDX létrejött. Ez nem teljes restore-próba. A korábbi elutasított előnézet után csak a felhasználó kifejezett „folytasd” jóváhagyásával indult az éles futás.
- **Readonly mintavisszaállítás sikeres:** a mentett OS-image külön, csak olvasható, betűjel nélküli virtuális kötetként lett csatolva. Négy kijelölt fájl tényleges kinyerése (összesen 104 804 bájt) és a korábbi SHA256-referenciákkal összevetése 4/4 egyezést adott; az image utána leválasztva. Nem teljes image-hash, valamennyi fontos adat ellenőrzése, alkalmazásindítás vagy bare-metal restore. A tényleges naplók/kinyert privát minták csak a gépi `.local/` könyvtárban maradnak.
- A friss source/target és kapacitásvizsgálat, a backup/VM/WSL-ütközési kapu és a korábbi image-ek ellenőrzése sikeres. Csak az új image-mappa hozzáférésvédelme lett megerősítve; a korábbi másolatok és a teljes drive jogosultságai nem változtak. A konkrét hozzáférési/titkosítási és VM-részletek a privát gépi jelentésben maradnak.
- A befejezett futásnak natív naplója, percenkénti térfigyelése, ritkított engine-status naplója, átmeneti alvásgátlása és automatikus stop-kapui voltak (helyminimum, időkeret, tartós elakadás, saját cancel-marker). A négy stabil forrás hash-referenciájával a tényleges image-ből kinyert minták egyeztek. A gépi futásazonosító és stop-út csak `.local/machine-state.json` alatt van. A recovery-út tényleges ellenőrzése a futás után külön szükséges. Ismeretlen új adatforrás, felhőhidratálás, elakadás vagy lényegesen nagyobb méret esetén megállás és újratervezés.

## Korábbi állapot és biztonsági korlátok

- Helyi AMD-alapú videógeneráló platform: dokumentációs terv létezik; Linux/ROCm/PyTorch/ComfyUI telepítés és helyi GPU-benchmark még nincs. Ubuntu LTS az első, kisebb integrációs kockázatú jelölt; Omarchy vállalható alternatíva, teljesítményelőny nincs kimérve. A pontos verziólánc újraellenőrzendő, a korábbi dokumentációs jelöltek nem lockfile-ok.
- A korábbi túl széles élő fájlmásolat továbbra is **leállított, részleges és nem ellenőrzött**; a későbbi külön natív rendszerkép nem teszi utólag teljessé. Forrás és régi másolat megőrizve; a gépi részletek csak helyben maradnak.
- Partíció/EFI-leltár elkészült, a zsugoríthatóság nyitott. Külső recovery-boot és teljes restore nem igazolt; a mintafájlteszt önmagában nem oldja fel a particionálási kaput. Nincs külön jóváhagyás nélküli particionálás, pendrive-törlés vagy biztonsági gyengítés.

## Következő folytatási pont

1. A rendszerkép natív eredménye, katalógusa és négy readonly kinyert mintája ellenőrizve; az image leválasztva. Nincs futó saját backup és nincs szükség új teljes másolásra. Teljes fájlszintű/bare-metal restore ettől még nem igazolt.
2. Következő kapu: külső Windows recovery-indítómédia azonosítása, külön írási/törlési jóváhagyás, boot és backup-felismerés vizsgálata. Az egyetlen igazolt recovery-médiát nem írjuk felül Linux-telepítővel biztosított alternatíva nélkül. A recovery-média nem teljes Windows-újratelepítő csomag, a rendszerkép külön HDD-n marad.
3. Zsugoríthatóság továbbra is nyitott (timeout), pontos driver/runtime/tranzitív zár és Linux/GPU-próba is hátravan. Nincs automatikus particionálás, USB-törlés, biztonsági gyengítés vagy telepítés. A gépi folytatási részletek a privát jelentésben vannak; Lens és további Pi-funkciók most nem a feladat részei.

Gépspecifikus folytatási térkép, ha ezen a PC-n létezik: `.local/machine-state.json`. Ezt nem kell és nem szabad a nyilvános Gitbe tenni; másik gépre a pathokat nem feltételezhetjük.

A tényleges Git-állapotot a `npm run status` mutatja. Nem működik automatikus szemantikus frissítés kikapcsolt asszisztens mellett.
