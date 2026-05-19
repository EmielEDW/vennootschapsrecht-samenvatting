# Setup — Stripe Payment Link + code-distributie

Eenmalige opzet, ~15 minuten werk. Daarna kun je verkopen.

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
- 📧 emieldewaele@gmail.com

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
