# Collection Wizard vs. equine-reproduction.com Semen Calculator

Comparison of input fields and output values between the BreedWise collection wizard
(`src/screens/CollectionWizardScreen.tsx` + `src/screens/collection-wizard/*`) and the
public calculator at https://equine-reproduction.com/semen-calculator.

Generated 2026-04-22.

## Ejaculate Details

| equine-reproduction.com | BreedWise wizard | Notes |
|---|---|---|
| Collection Date | Collection Date | Same |
| Collection Time | — | We only store date |
| Volume | Total Volume (mL) | Same |
| Sperm Concentration (M/mL) | Concentration (M/mL, raw) | Same |
| Sperm Progressive Motility (%) | Progressive Motility (%) | Same |

## Processing / Shipping Parameters

| equine-reproduction.com | BreedWise wizard | Gap |
|---|---|---|
| Targeted Sperm / Dose (**billions**, min >1B) | Target motile sperm / dose (**M**) | Unit scale differs — we use millions, they use billions |
| Total Sperm **vs** Progressive (radio) | Locked to motile (progressive) | No toggle to target total sperm |
| Final Desired Extended Concentration (default **35 M/mL**, rec **25–50**) | Target post-extension concentration (M motile/mL) | Same numeric input does not mean the same thing across both tools |
| Fixed vs Variable final volume (default fixed **57.75 mL**) | — | No "fixed final volume" mode — we only derive dose volume from target motile ÷ target concentration |
| Semen Extender dropdown (Kenney, EZ Mixin CST, Universal Dual Sugar, INRA '96, VMD, BotuSemen family, BotuTurboMax, Other) | Extender autocomplete (INRA 96, Kenney, BotuSemen, BotuSemen Gold, BotuSemen Special, E-Z Mixin, Lactose-Chelate, Milk-Based, Skim Milk Glucose, Other) | Brand list overlaps but ours is missing Universal Dual Sugar, VMD, BotuTurboMax, and the "CST" EZ Mixin variant |
| Antibiotic dropdown (Amikacin, Amikacin/Penicillin, Ticarcillin, Timentin, Gentamicin, Unknown, Other) | — | No antibiotic field |
| Additional Comments | Notes | Same |

## Ownership / Stallion / Recipient

| equine-reproduction.com | BreedWise wizard |
|---|---|
| Farm/Ranch Name, Address, Email/Phone, Owner/Manager | Not in wizard (no app-owner farm profile anywhere) |
| Stallion Name / Breed / Registration # | Comes from the stallion record (wizard launches from `stallionId`); registration # was intentionally dropped from the stallion form per CLAUDE.md |
| Doses per shipment | Per-shipment `doseCount` in `ShippedDoseRowEditor` (plus recipient name/address/carrier/container — richer than the calculator's single numeric field) |

## Derived outputs

The tools produce similarly named outputs, but they do not share the same
concentration semantics.

- BreedWise always treats the dose target and post-extension concentration as
  motile/progressive values.
- The website appears to treat `Final Desired Extended Concentration` as total
  sperm per mL, even when `SpermType=Progressive`.
- Because of that, semen-per-dose can align when the target modes align, but
  dose volume and extender volume diverge unless the website's total-sperm
  concentration is converted into BreedWise's motile concentration.
- Example at 50% motility: `35 M total/mL` on the website corresponds to
  `17.5 M motile/mL` in BreedWise.

BreedWise additionally surfaces `negative-extender` and `target-exceeds-capacity`
warnings inline, and feeds the derived per-dose volumes directly into Step 3 allocation
rows. The calculator website returns a shipment-ready plan in its results panel.

## Gaps worth considering

1. **Collection time** — useful for chain-of-custody / cooling curves; currently not captured.
2. **Total-vs-progressive target toggle** — some vets spec total sperm/dose; we assume motile.
3. **Fixed final volume mode** — common in shipped-cooled protocols (e.g., pad to 57.75 mL straw). Our math has no branch for this; we always produce the minimum dose volume implied by the concentration target.
4. **Default 35 M/mL hint + 25–50 M/mL range guidance** — low-cost UX improvement on the post-extension field.
5. **Antibiotic field** — regulatory/veterinary documentation field; currently unrecorded.
6. **Extender list** — missing several common brands (Universal Dual Sugar, VMD, BotuTurboMax) and the CST variant of EZ Mixin. `'Other'` covers it but we lose autocomplete hits.
7. **Units mismatch** — their "billions/dose" vs our "millions/dose" is a data-entry footgun if a user is copying from a vet form. Consider a unit label tooltip or dual display.

Highest-value/lowest-risk fixes: direct calculator unit tests, clearer motile-vs-total
copy in the UI, and explicit guidance for users copying values from total-sperm-based
calculators.
