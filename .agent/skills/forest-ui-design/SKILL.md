---
name: forest-ui-design
description: Guidelines and instructions for designing and implementing the user interface of "Experimental Forest" (实验小森林). Focuses on the Morandi Forest aesthetic, consistency, and accessibility.
---

# Forest UI Design - 实验小森林设计规范

This skill provides a comprehensive guide for maintaining and evolving the visual identity of **Experimental Forest**. Follow these principles to ensure all new components and pages feel part of the same "tranquil, professional, and scientific" ecosystem.

## 🎨 Core Design Principles

1. **Morandi Palette (莫兰迪色系)**:
   - Use low-saturation, high-gray-value colors.
   - Primary: Sage Green (`--forest-primary`).
   - Secondary: Linen/Taupe (`--earth-warm`, `--earth-beige`).
   - Accents: Slate Blue (`--water-slate`) for water elements or information.
   - *Constraint*: Avoid standard high-vibrancy colors (e.g., pure #FF0000).

2. **Nature-Inspired Layout**:
   - Prefer organic spacing and soft containers.
   - Use `shadow-nature` (soft, multi-layered shadows) to create depth without harsh borders.
   - Corner Radii: Standardize on `--radius-lg` (16px) for cards and `--radius-xl` (24px) for major sections.

3. **Typography**:
   - Header: Use `YouSheBiaoTiHei` for main page titles and brand elements.
   - Body: Clean sans-serif hierarchy (`Microsoft YaHei`, `Inter`).
   - Use `gradient-text` for headers to add a premium touch.

4. **"Breathable" Space**:
   - Generous white space (padding/margins) is essential to the "Forest" feel.
   - Avoid information density that feels cluttered.

## 🛠 Usage Guidelines

### 1. Applying Colors
Always use CSS variables from `tokens.css`. 

```css
/* Good */
.my-card {
  background-color: var(--earth-warm);
  border: 1px solid var(--forest-accent);
}

/* Bad */
.my-card {
  background-color: #f5f5f5; /* Avoid hardcoded hex */
}
```

### 2. Component Structure
Each new UI element should follow this pattern:
- **Base**: Accessible HTML structure.
- **Style**: Tailwind classes for layout + CSS tokens for brand identity.
- **Motion**: Subtle entry animations using `framer-motion`.

### 3. Iconic Elements
- **Seedling Icon**: Use `fa-seedling` as the primary brand marker.
- **Gradients**: Use `--grad-forest` for success actions and `--grad-water` for info/search.

## 📝 Design Patterns

### Cards
Cards should feel like "leaves" or "stones" in the forest.
- Background: `var(--earth-warm)` or white with low opacity.
- Border: Very subtle or non-existent (use shadows instead).
- Hover: Slight lift (`translateY(-4px)`) and increased shadow.

### Buttons
- **Primary**: Gradient forest background, white text.
- **Secondary**: Outlined or soft sage background.
- **Ghost**: Text-only with forest color, subtle background on hover.

## 🚫 Anti-Patterns
- **No Sharp Corners**: Unless explicitly required for technical diagrams.
- **No Jet Black**: Use `var(--text-main)` (#4A4B4D) for readability.
- **No Pure White Backgrounds**: Prefer `--earth-beige` for the main body to reduce eye strain.

## 🚀 Examples

### A New Record Card
```tsx
<div className="bg-white rounded-xl p-4 shadow-nature hover:shadow-lg transition-all cursor-pointer">
  <div className="flex items-center space-x-2 text-forest-primary mb-2">
    <i className="fa-solid fa-seedling"></i>
    <h3 className="font-header font-bold text-lg">新实验数据</h3>
  </div>
  <p className="text-text-soft text-sm">点击开始记录新的研究发现...</p>
</div>
```
