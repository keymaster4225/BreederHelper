
# Design System: BreedWise

This document outlines the visual and functional design principles for the "BreedWise" app, aimed at creating a **welcoming, friendly, and approachable** experience for users.

## 1. Visual Personality
- **Warm & Organic:** Avoid harsh lines and pure blacks.
- **Approachable:** Use soft rounded corners and generous whitespace.
- **Professional yet Gentle:** High-quality typography that feels both established (Serif) and modern (Sans-Serif).

---

## 2. Color Palette
A warm, natural palette inspired by the equestrian environment.

| Role | Hex Code | Usage |
| :--- | :--- | :--- |
| **Background** | `#FDFBF7` | Main app background (off-white/cream) |
| **Surface (Card)** | `#F4EFE0` | Background for cards and containers |
| **Primary (Action)** | `#97B498` | Buttons, toggles, active states (Sage Green) |
| **Accent (Warm)** | `#C19A6B` | Secondary highlights, status badges (Tan/Gold) |
| **Text (Primary)** | `#4A3728` | Headers and main body text (Dark Cocoa) |
| **Text (Secondary)** | `#706259` | Subtext and labels (Soft Brown) |

---

## 3. Typography
A combination of a classic Serif for brand/headers and a clean Sans-Serif for utility.

- **Headers (Serif):** *Lora* or *Playfair Display*.
  - Use for: Page titles, Mare names, Section headers.
  - Tone: Elegant, trustworthy.
- **Body & Controls (Sans-Serif):** *Inter* or *Quicksand*.
  - Use for: Form labels, input text, navigation labels.
  - Tone: Clean, legible, modern.

---

## 4. Components & Layout

### Cards (`AppCard`)
- **Background:** `#F4EFE0`
- **Border Radius:** `24px` (Very rounded for a friendly feel)
- **Shadow:** Minimal `elevation: 2` (Android) or `shadowOpacity: 0.05` (iOS). No harsh borders.
- **Padding:** `16px` to `20px`.

### Buttons & Inputs
- **Primary Button:** Large, rounded (`32px` radius), Sage Green background with white/cream text.
- **Input Fields:** Soft cream background, rounded corners (`12px`), subtle border.
- **Toggles/Switches:** Use Sage Green for the "on" state.
- **Selection Chips:** Circular or pill-shaped with Sage Green background for selected items.

### Navigation
- **Bottom Tab Bar:** Use the Cocoa Brown for the background with Sage Green or Gold for active icons.
- **Icons:** Use rounded, "filled" style icons rather than thin line icons for a softer look.

---

## 5. Design Principles
1. **Generous Spacing:** Allow elements to "breathe." Use `16px` as a base unit for margins and paddings.
2. **Circular Imagery:** Always use circular or highly rounded avatars for horses to maintain the soft aesthetic.
3. **Soft Status Indicators:** Use descriptive text and color-coded pills (e.g., "Detected" in green) rather than just raw numbers or icons.
