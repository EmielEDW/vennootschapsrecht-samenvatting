# Setup — Stripe Payment Link + code-distributie

Eenmalige opzet, ~25 minuten werk. Daarna kun je verkopen mét device-limiet (max 3 apparaten per code).

> **Twee delen:** eerst [Stripe](#stap-1--stripe-account-aanmaken-5-min) (verkoop), daarna [Vercel KV](#bonus--device-limiet-instellen-vercel-kv) (anti-sharing).

## Hoe het werkt (overview)

1. Klant klikt **"Koop €5"** op je site → wordt doorgestuurd naar Stripe Checkout.
2. Klant betaalt (bancontact, kaart, Apple/Google Pay).
3. Stripe stuurt **jou** een mail "Je hebt een betaling ontvangen".
4. Jij stuurt de klant **een unieke code** uit `codes-private.txt` (200 codes klaar in de project-folder, NIET in deze repo).
5. Klant plakt de code op de site → ontgrendelt al het paid content.

> **Pro-tip:** zet een autoresponder op in Stripe (zie stap 2.3) die meteen instructies stuurt zodat de klant weet dat zijn code binnen het uur komt.

## Stap 1 — Stripe account aanmaken (5 min)

1. Ga naar **https://stripe.com/be/** → "Sign up".
2. Vul je gegevens in (email, naam). Voor een Belgische eenmanszaak heb je later je **rijksregisternummer** + **bankrekening (IBAN)** nodig om uitbetalingen te ontvangen, maar je kan eerst in **test-modus** alles uitproberen zonder die data.
3. Verifieer je email.

## Stap 2 — Payment Link maken (5 min)

1. In het Stripe-dashboard, ga naar **Payment Links** (links in de sidebar) → **+ New**.
2. **Product**:
   - Name: `Examen-pack Vennootschapsrecht`
   - Description: `Toegang tot alle flashcards, quiz, cheat-sheet, speedrun en handboek-PDF.`
   - Price: `€5,00` · One-time.
3. **After payment**:
   - Kies **"Show confirmation page"** (niet "redirect" — dat vergt extra setup)
   - **Custom message** (Markdown ondersteund — dit is wat de klant ZIET na betaling):

```
🎉 Bedankt voor je aankoop!

Je krijgt **binnen het uur** je persoonlijke toegangscode op het e-mailadres dat je net hebt gebruikt.

Vragen of haast? Stuur even een berichtje naar:
- 📧 info@emieldewaele.com

Zodra je de code hebt, ga je naar:
👉 https://vennootschapsrecht-samenvatting.vercel.app/examen-pack.html

en klik op "Ik heb een code" om alles te ontgrendelen.
```

4. **Optional fields** → "Customer email" aan zetten (anders heb je geen mailadres om de code naartoe te sturen!).
5. Click **Create link**.
6. Kopieer de URL (ziet eruit als `https://buy.stripe.com/test_xxxxxxxx` of in live-modus `https://buy.stripe.com/xxxxxxxx`).

## Stap 3 — Stripe link invullen in de site

Open een terminal en run (vervang YOUR_LINK_HERE met de URL die je net kopieerde):

```bash
cd "/Users/emiel/Downloads/venb pdf/site"
LSTRIPE='https://buy.stripe.com/YOUR_LINK_HERE'
sed -i '' "s|STRIPE_PAYMENT_LINK_HERE|$LSTRIPE|g" auth.js examen-pack.html
```

(Op Linux: zelfde commando maar zonder de `''` na `-i`.)

Of doe het manueel — zoek `STRIPE_PAYMENT_LINK_HERE` in:
- `auth.js` (1x)
- `examen-pack.html` (2x)

Daarna:

```bash
git add .
git commit -m "Add Stripe payment link"
git push
```

Vercel deployt automatisch.

## Stap 4 — Test in test-modus

1. Open je site en klik op **"Koop het pack"**.
2. Op Stripe Checkout, gebruik testkaart **`4242 4242 4242 4242`**, expiry `12/30`, CVC `123`.
3. Je krijgt de "thank you"-pagina. Check je email — Stripe heeft je een betalingsmelding gestuurd.
4. Stuur jezelf een testcode uit `codes-private.txt`, plak ze op de site → unlock werkt? ✓

## Stap 5 — Activeer live-modus

In Stripe → bovenaan toggle **Test mode → Live mode**. Vul je bedrijfsgegevens in (eenmanszaak = je rijksregisternummer + IBAN). Maak een **nieuwe Payment Link in live mode** (test-links werken niet voor echt geld). Vervang opnieuw `STRIPE_PAYMENT_LINK_HERE` met de live-link.

## Stap 6 — Workflow per verkoop

Telkens je een Stripe-mail krijgt ("You received a payment of €5"):

1. Open `codes-private.txt` (in `/Users/emiel/Downloads/venb pdf/`), neem **de bovenste ongebruikte code**.
2. Stuur een mail naar de klant (Stripe geeft je het mailadres):

```
Hi [naam]!

Bedankt voor je aankoop. Hier is je persoonlijke toegangscode:

>>> XXXX-XXXX <<<

Of klik direct op deze link om automatisch te ontgrendelen:
https://vennootschapsrecht-samenvatting.vercel.app/?code=XXXX-XXXX

Je krijgt onmiddellijk toegang tot:
- Alle 199 flashcards
- Volledige quizbank (50+ vragen)
- Printbare cheat-sheet (A4)
- Last-minute speedrun (30 min)
- Het volledige handboek-PDF

Succes met studeren!

— Emiel
```

3. Streep de code door in `codes-private.txt` (zet er een `# USED [datum] [emailadres]` achter, zo zie je nooit welke al verkocht zijn).

> **Tijd per verkoop:** ~30 seconden. Voor 30 verkopen = 15 minuten totaal werk.

## Sneltoets — magic unlock-links

In plaats van de klant te laten klikken op "Ik heb een code" + plakken, kan je een **directe ontgrendel-link** sturen:

```
https://vennootschapsrecht-samenvatting.vercel.app/?code=XXXX-XXXX
```

Klikt hij erop → auto-unlock + redirect. Geen typfouten meer. Werkt op elke pagina van de site.

## Wat als een code lekt?

Open `site/valid-codes.json`, verwijder de hash van die specifieke code (regel uit de `hashes` array), commit & push. De code werkt niet meer. Mail de eerlijke koper een nieuwe code uit `codes-private.txt`.

Om te weten welke hash bij welke code hoort, run dit vanuit de root van het project:

```bash
python3 -c "
import hashlib
codes = open('codes-private.txt').read().strip().split('\n')
SALT = 'vnr-examen-pack-2026-v1'
target_code = input('Welke code wil je revoken? ').strip().upper()
h = hashlib.sha256((SALT + target_code).encode()).hexdigest()
print(f'Hash: {h}')
print('Zoek in valid-codes.json en verwijder die regel.')
"
```

## Geautomatiseerd? (later)

Als je veel verkopen krijgt en geen tijd meer hebt voor de manuele flow:
- **Zapier** (gratis tier) → Stripe webhook → Gmail draft met code → automatisch.
- **Vercel serverless function** → automatische codelevering.
- **Lemonsqueezy** (5% fee, maar volledig automatisch + EU-BTW geregeld).

Voor je eerste 30-50 verkopen is de manuele flow prima.

## Wat heb je verdiend?

Stripe-fee = **1.5% + €0.25** per transactie (EU-kaarten).
Per €5-verkoop: €5 - €0.075 - €0.25 = **€4.675 netto** per verkoop.

Bij 30 medestudenten = €140 netto. Bij 100 (over meerdere klassen/jaren via mond-tot-mondreclame) = €467 netto.

---

# 🛡️ BONUS — Device-limiet instellen (Vercel KV)

Met deze setup wordt elke code beperkt tot **max 3 apparaten**. Probeert een 4ᵉ apparaat te activeren? "Limit reached" foutmelding. Voorkomt dat een koper z'n code gratis doorgeeft aan z'n hele klas.

**Effort:** ~10 min.
**Kost:** gratis (Vercel KV Hobby tier = 30k commands/dag, ruim voldoende).

## Stap A — Vercel KV store aanmaken

1. Ga naar https://vercel.com → je project `vennootschapsrecht-samenvatting`.
2. Tab **Storage** → **Create Database** → kies **KV (Powered by Upstash)**.
3. Naam: `vnr-pack-kv`. Region: dichtstbij (Frankfurt voor BE).
4. Bevestig. Vercel maakt de database aan **en koppelt automatisch env vars** aan je project.

Je ziet nu deze env vars verschijnen (Settings → Environment Variables):

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`
- `KV_URL`

(Het script gebruikt de eerste twee.)

## Stap B — Eigen secrets toevoegen

Zelfde Settings → Environment Variables → **Add New**. Voeg toe:

| Naam | Waarde | Waarom |
|---|---|---|
| `HMAC_SECRET` | Een random string, bv. `openssl rand -hex 32` of typ 40+ random tekens | Signeert de token na unlock |
| `ADMIN_SECRET` | Een sterk wachtwoord dat alleen jij kent (15+ tekens, kies wat goed onthoudbaar is) | Beschermt `/admin.html` zodat alleen jij codes kan resetten |
| `MAX_DEVICES` | `3` (of `2`, `5`, ...) | Max apparaten per code. Default = 3. |
| `TOKEN_TTL_DAYS` | `365` | Hoelang een token geldig blijft. Default = 365 dagen. |

Genereer een goede HMAC_SECRET via terminal:
```bash
openssl rand -hex 32
# of in Node:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Klik **Save** per env var. Belangrijk: zorg dat alle environments aangevinkt zijn (Production + Preview + Development).

## Stap C — Redeploy

Na het toevoegen van env vars moet je **redeployen**:

- Vercel → Deployments tab → klik op de laatste deploy → **⋯** → **Redeploy**.

Vanaf nu gebruikt `/api/unlock` automatisch de KV-store.

## Stap D — Test de device-limiet

1. Open je site op laptop, plak een testcode → unlock werkt ✓
2. Open op telefoon (of incognito tab), zelfde code → werkt ✓ (2/3)
3. Open op nóg een browser/incognito, zelfde code → werkt ✓ (3/3)
4. Open op een 4ᵉ browser → **"Limit reached"** ✓

## Stap E — Test admin-reset

1. Ga naar `https://jouw-site.vercel.app/admin.html`
2. Vul je `ADMIN_SECRET` in + de code die je net 3× gebruikt hebt.
3. Klik "Reset apparaten". Confirmation verschijnt.
4. Probeer opnieuw te activeren in een 4ᵉ browser → werkt nu wel ✓ (de teller staat terug op 0).

## Hoe gebruik je de admin tool dagelijks?

Wanneer een koper je mailt: *"Ik krijg de limiet-fout, ik wil mijn nieuwe MacBook activeren"*:

1. Open `https://jouw-site.vercel.app/admin.html` (bookmarken!)
2. Vul je ADMIN_SECRET + hun code in
3. Klik reset
4. Mail terug: "Klaar, probeer nu opnieuw."

> ⚠ **Verspreid het admin-secret nergens.** Iemand met je ADMIN_SECRET kan alle codes resetten en effectief gratis pack-toegang regelen.

## Wat als KV niet beschikbaar is?

Het script heeft een **graceful fallback**: als KV niet bereikbaar is of geen env vars gezet zijn, werkt unlock alsnog (zonder device-tracking). Een banner "degraded mode" wordt in de response gemarkeerd maar voor de eindgebruiker is alles normaal. Veiliger dan harde fouten.

## Statistieken bekijken

Vercel → Storage → vnr-pack-kv → tab **Data Browser** kun je live alle KV-keys zien. Zoek op `code:` om te zien welke codes actief zijn en hoeveel devices.

Of via terminal:
```bash
curl -H "Authorization: Bearer $KV_REST_API_TOKEN" \
  "$KV_REST_API_URL/keys/code:*"
```

---

# 📧 BONUS — Automatische email met code (Stripe webhook + Resend)

Nu kun je verkopen mét **volledig automatische codelevering**. Klant betaalt → binnen 30 seconden krijgt hij/zij een mail met een verse code.

**Effort:** ~15 min eenmalig.
**Kost:** gratis (Resend free tier = 100 mails/dag, 3.000/maand).

## Stap A — Resend account aanmaken

1. Ga naar **https://resend.com** → Sign up (free).
2. Verifieer je email.
3. Links → **API Keys** → **+ Create API Key** → naam: `vnr-examen-pack`, full access → Create.
4. Kopieer de key (begint met `re_...`). Je ziet 'm maar één keer!

> Voor productie: optioneel **domain verifiëren** zodat mails komen van bv. `noreply@jouwdomein.be`. Voor nu is `onboarding@resend.dev` prima.

## Stap B — Env vars toevoegen op Vercel

Settings → Environment Variables → Add:

| Naam | Waarde |
|---|---|
| `RESEND_API_KEY` | de `re_...` key uit stap A |
| `FROM_EMAIL` | `Examen-pack <onboarding@resend.dev>` (of jouw eigen domein) |
| `REPLY_TO_EMAIL` | `info@emieldewaele.com` (replies komen daar) |
| `SITE_URL` | `https://vennootschapsrecht-samenvatting.vercel.app` |
| `STRIPE_WEBHOOK_SECRET` | (volgt in stap D) |

## Stap C — Codes seeden in Upstash (1x)

Run dit lokaal vanuit de project-folder:

```bash
cd "/Users/emiel/Downloads/venb pdf"

# Haal de Upstash credentials uit Vercel:
# Vercel → Storage → vnr-pack-kv → tab ".env.local"
# Kopieer KV_REST_API_URL en KV_REST_API_TOKEN
export KV_REST_API_URL='https://...upstash.io'
export KV_REST_API_TOKEN='AY...'

python3 seed-codes.py
```

Output:
```
📋 codes-private.txt: 200 unused, 0 used (skipped)
  · Batch 1: pushed 50 codes (pool size: 50)
  · Batch 2: pushed 50 codes (pool size: 100)
  · Batch 3: pushed 50 codes (pool size: 150)
  · Batch 4: pushed 50 codes (pool size: 200)
✅ Done. Pool 'unused-codes' bevat nu 200 codes.
```

Codes staan nu klaar voor automatische distributie.

## Stap D — Stripe webhook configureren

1. Ga naar **Stripe Dashboard → Developers → Webhooks**.
2. Klik **+ Add endpoint**.
3. **Endpoint URL:** `https://vennootschapsrecht-samenvatting.vercel.app/api/stripe-webhook`
4. **Events to send:** zoek en vink **enkel** aan: `checkout.session.completed`
5. Klik **Add endpoint**.
6. Op de detail-pagina van de webhook: **Reveal** de "Signing secret" (begint met `whsec_...`).
7. Plak deze als `STRIPE_WEBHOOK_SECRET` env var op Vercel (zie stap B).

## Stap E — Redeploy en test

1. Vercel → Deployments → laatste deploy → **⋯** → **Redeploy** (env vars moeten ingeladen worden).
2. Test in Stripe → Developers → Webhooks → klik je endpoint → tab **Send test event** → kies `checkout.session.completed` → **Send test webhook**.
3. Stripe toont response status. **200 OK** = ok.
4. Check Resend → Logs → je ziet de test-mail (gericht aan een dummy adres).

> **Test met echte payment-flow:** je kan in Stripe ook in **Test mode** een echte testpayment doen via test-kaart `4242 4242 4242 4242`. Dan krijg je een echte test-email met een echte code.

## Stap F — Optioneel: verifieer dat alles werkt

**Vercel → Functions tab** toont alle requests naar `/api/stripe-webhook`. Klik op één om de logs te zien. Goede log:

```
✓ Sent code 22D9DXY5 to klant@example.com
```

Slechte logs (en wat ze betekenen):
- `Invalid Stripe signature` → STRIPE_WEBHOOK_SECRET klopt niet
- `RESEND_API_KEY not set` → mist env var
- `Code pool is EMPTY!` → run `seed-codes.py` opnieuw
- `email failed` → check Resend dashboard, code zit terug in pool

## Fallback flow — wat als iets misgaat?

Bij elke fout krijg JIJ (op `REPLY_TO_EMAIL`) een waarschuwingsmail met de customer-info en eventueel de code, zodat je manueel kan helpen. De code wordt teruggeplaatst in de pool zodat 'm niet verloren gaat.

Idempotency check: hetzelfde Stripe-event 2x ontvangen geeft NIET 2 codes. We slaan `processed:{session_id}` op met TTL 90 dagen.

## Hoe weet ik dat alles werkt?

Eerste echte verkoop:
1. Vrienden bv. testen met €5 echte betaling
2. Binnen 30s krijgt hij/zij de mail met code + 1-klik unlock-link
3. Jij krijgt ook een Stripe-notificatie ("€5 received")
4. In Upstash KV browser zie je: 
   - `unused-codes` (LIST): 199 codes nu (1 minder)
   - `sold:CODE` (string): met email + timestamp
   - `processed:cs_xxx` (string): idempotency marker

## Codes bijvullen (later)

Wanneer pool < 20 codes is, regenereer:

```bash
cd "/Users/emiel/Downloads/venb pdf"
python3 -c "
import secrets, hashlib, json
from pathlib import Path

ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
existing = set()
hashes = json.load(open('site/valid-codes.json'))['hashes']
existing_hashes = set(hashes)
SALT = 'vnr-examen-pack-2026-v1'

# Generate 100 fresh codes
new = []
while len(new) < 100:
    c = ''.join(secrets.choice(ALPHABET) for _ in range(8))
    h = hashlib.sha256((SALT + c).encode()).hexdigest()
    if h in existing_hashes: continue
    new.append(c)
    existing_hashes.add(h)

# Append hashes to valid-codes.json
data = json.load(open('site/valid-codes.json'))
data['hashes'].extend(hashlib.sha256((SALT + c).encode()).hexdigest() for c in new)
json.dump(data, open('site/valid-codes.json', 'w'), indent=2)

# Append plaintext to private file
with open('codes-private.txt', 'a') as f:
    f.write('\n# === Batch 2 ===\n')
    for c in new: f.write(c + '\n')

print(f'Generated {len(new)} new codes. Total: {len(data[\"hashes\"])}')
"
# Then push to Upstash
python3 seed-codes.py  # zegt 'pool al groot, toevoegen?' → kies 'a'
git add . && git commit -m "Add 100 more codes" && git push
```
