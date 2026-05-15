# Online zetten — stap voor stap

Je site staat al klaar in [/Users/emiel/Downloads/venb pdf/site](.) als een lokaal git repository. Hieronder twee snelle deploy-paden. Aanbevolen: **optie A (GitHub + Vercel)** — eenmaal opgezet werkt elke `git push` als automatische deploy.

---

## Optie A — GitHub + Vercel (aanbevolen)

### 1. Maak een lege GitHub repo

1. Ga naar **https://github.com/new**
2. Repository name: bv. `vennootschapsrecht-samenvatting`
3. **Public** (anders moet je Vercel apart koppelen aan je account voor private repos).
4. **Niet** "Add README", "Add .gitignore" of een licentie selecteren — die hebben we al lokaal.
5. Klik **Create repository**.

Op de volgende pagina krijg je een URL te zien. Kopieer hem (begint met `https://github.com/<jouw-naam>/...`).

### 2. Push de bestaande commit

Open een terminal en run (vervang de URL met die van jouw repo):

```bash
cd "/Users/emiel/Downloads/venb pdf/site"
git remote add origin https://github.com/<jouw-naam>/vennootschapsrecht-samenvatting.git
git push -u origin main
```

Bij de eerste push vraagt GitHub om in te loggen. Gebruik **Sign in with browser** als dat verschijnt; anders heb je een Personal Access Token nodig (Settings → Developer settings → Personal access tokens).

### 3. Verbind met Vercel

1. Ga naar **https://vercel.com/new**
2. Log in met je GitHub-account.
3. Klik **Import** naast je nieuwe repository.
4. Project-instellingen: niets aanpassen — Vercel detecteert automatisch dat het een statische site is.
5. Klik **Deploy**.

Binnen 30 seconden krijg je een URL als `https://vennootschapsrecht-samenvatting.vercel.app` die je kunt delen.

### 4. (Optioneel) Custom domein

Wil je `samenvatting.jouwdomein.be`? Bij Vercel → Project → Settings → Domains → Add. Volg de DNS-instructies.

---

## Optie B — Direct uploaden naar Netlify Drop

Geen Git nodig. Voor de snelste deploy:

1. Ga naar **https://app.netlify.com/drop**
2. Sleep de **hele inhoud** van `/site` (alle `.html`, `styles.css`, `app.js`) in het dropvenster.
3. Je krijgt direct een URL als `https://eclectic-pasca-12345.netlify.app`.

Nadeel: updates moeten manueel opnieuw geüpload worden.

---

## Updates aanbrengen

Als je later iets aanpast (bv. een typo verbeteren, een hoofdstuk uitbreiden):

```bash
cd "/Users/emiel/Downloads/venb pdf/site"
# edit de .html files of pas de notes/ aan en run python3 ../build.py
git add .
git commit -m "Update: typo fix in BV"
git push
```

Vercel detecteert de push automatisch en deployt de nieuwe versie binnen seconden.

---

## Site lokaal testen vóór push

```bash
cd "/Users/emiel/Downloads/venb pdf/site"
python3 -m http.server 8000
```

Open dan **http://localhost:8000** in je browser.
