# Battle HUD Mockup Designs

This component showcases 5 different design directions for the battle HUD interface.

## Design Options

### Design 1: Minimalist Clean Interface
- **Style**: Modern, clean, minimal
- **Features**: Horizontal layout with progress bars, centered crosshair, clear weapon status
- **Colors**: Clean gradients (red/orange/blue for defenses)
- **Best for**: Players who want clear, uncluttered information

### Design 2: Retro Terminal Style
- **Style**: 80s/90s computer terminal with green monochrome
- **Features**: ASCII-style bars, scanline effects, radar display, terminal text
- **Colors**: Green on black with retro CRT effects
- **Best for**: Players who love retro/vintage aesthetics

### Design 3: Military Tactical Interface
- **Style**: Modern military HUD with tactical elements
- **Features**: Corner brackets, targeting reticle with lock indicators, glowing bars
- **Colors**: Blue/cyan military theme with red alerts
- **Best for**: Players who want a serious, professional military feel

### Design 4: Futuristic Holographic
- **Style**: Sci-fi hologram display with glowing elements
- **Features**: Hexagon grid background, rotating reticles, holographic panels, energy orbs
- **Colors**: Cyan/blue holographic glow effects
- **Best for**: Players who want a futuristic, high-tech aesthetic

### Design 5: Organic/Alien Interface
- **Style**: Bio-mechanical, living organism interface
- **Features**: Cell-like defense displays, eye-shaped targeting, organic pulsing animations
- **Colors**: Orange/purple bio-luminescence
- **Best for**: Players who want something unique and alien

## Usage

The component displays when in battle mode. Users can select between the 5 designs using buttons at the top.

## Implementation Notes

- All designs are responsive and work on PC and mobile
- Each design takes approximately 50% of screen height
- Mock data is hardcoded for demonstration purposes
- Animations and visual effects are CSS-based for performance
- Each design displays:
  - Hull, Armor, Shield values (current/max)
  - Weapon ready status or cooldown timer
  - Target lock indicator
  - Distance to target
  - Enemy hull and shield status

## Next Steps

Once a design is selected:
1. Integrate real battle data from the battle status hook
2. Remove unused design variations
3. Add interactive elements (weapon firing, etc.)
4. Fine-tune animations and responsiveness
5. Add sound effects (optional)
