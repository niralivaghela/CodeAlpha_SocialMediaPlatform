"""
VIBELY App Icon Generator
Generates high-res master SVG, PNG assets, and Windows multi-resolution icon.ico
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

SVG_CONTENT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E1B26"/>
      <stop offset="50%" stop-color="#14121A"/>
      <stop offset="100%" stop-color="#0E0C12"/>
    </linearGradient>

    <!-- Outer subtle rim glow -->
    <linearGradient id="rimGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF6B6B" stop-opacity="0.35"/>
      <stop offset="50%" stop-color="#6C5CE7" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#00D2D3" stop-opacity="0.3"/>
    </linearGradient>

    <!-- Left Wing Gradient: Coral to Warm Amber -->
    <linearGradient id="leftWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF5252"/>
      <stop offset="40%" stop-color="#FF7675"/>
      <stop offset="100%" stop-color="#FFAA5A"/>
    </linearGradient>

    <!-- Right Wing Gradient: Royal Violet to Electric Sky -->
    <linearGradient id="rightWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#845EC2"/>
      <stop offset="50%" stop-color="#6C5CE7"/>
      <stop offset="100%" stop-color="#00D2D3"/>
    </linearGradient>

    <!-- Apex Core Node Gradient -->
    <linearGradient id="coreNodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7675"/>
      <stop offset="100%" stop-color="#6C5CE7"/>
    </linearGradient>

    <!-- Drop Shadows -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.55"/>
    </filter>

    <filter id="symbolGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Squircle Canvas with Rim -->
  <rect x="16" y="16" width="480" height="480" rx="120" fill="url(#bgGrad)" stroke="url(#rimGlow)" stroke-width="4" filter="url(#shadow)"/>

  <!-- Subtle ambient inner glow ring -->
  <circle cx="256" cy="256" r="170" fill="none" stroke="#FFFFFF" stroke-opacity="0.04" stroke-width="1.5"/>

  <!-- Group for the V-Connection Emblem -->
  <g filter="url(#symbolGlow)">
    <!-- Left Connecting Stream (V-Left Wing) -->
    <path d="M 140,144 
             C 140,144 190,260 256,368
             C 240,368 180,240 120,154
             A 20,20 0 0 1 140,144 Z" 
          fill="url(#leftWingGrad)"/>

    <!-- Right Connecting Stream (V-Right Wing) -->
    <path d="M 372,144 
             C 372,144 322,260 256,368
             C 272,368 332,240 392,154
             A 20,20 0 0 0 372,144 Z" 
          fill="url(#rightWingGrad)"/>

    <!-- Left Connection Anchor Node -->
    <circle cx="132" cy="148" r="28" fill="#FF5252"/>
    <circle cx="132" cy="148" r="14" fill="#FFFFFF"/>

    <!-- Right Connection Anchor Node -->
    <circle cx="380" cy="148" r="28" fill="#00D2D3"/>
    <circle cx="380" cy="148" r="14" fill="#FFFFFF"/>

    <!-- Central Community Bridge Arc -->
    <path d="M 180,210 Q 256,170 332,210" fill="none" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="14" stroke-linecap="round"/>

    <!-- Apex Focal Community Node -->
    <circle cx="256" cy="368" r="34" fill="url(#coreNodeGrad)" stroke="#FFFFFF" stroke-width="6"/>
    <circle cx="256" cy="368" r="16" fill="#FFFFFF"/>

    <!-- Dynamic Sparkle Accent -->
    <path d="M 256,128 Q 256,152 240,152 Q 256,152 256,176 Q 256,152 272,152 Q 256,152 256,128 Z" fill="#FFAA5A"/>
  </g>
</svg>
"""

def generate_svg():
    svg_path = os.path.join(OUTPUT_DIR, 'icon.svg')
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(SVG_CONTENT)
    print(f"Created master SVG: {svg_path}")

def draw_icon_image(size):
    """
    Draw a clean, crisp, anti-aliased VIBELY icon at the requested size using Pillow.
    Uses super-sampling (4x) for ultra-sharp downscaling.
    """
    scale = 4
    canvas_size = size * scale
    img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = int(18 * (canvas_size / 512))
    corner_radius = int(112 * (canvas_size / 512))

    # Dark squircle background
    bg_rect = [margin, margin, canvas_size - margin, canvas_size - margin]
    draw.rounded_rectangle(bg_rect, radius=corner_radius, fill=(24, 23, 30, 255), outline=(255, 107, 107, 60), width=int(4 * (canvas_size / 512)))

    # Subtle inner circle
    center_x, center_y = canvas_size // 2, canvas_size // 2
    r_inner = int(165 * (canvas_size / 512))
    draw.ellipse([center_x - r_inner, center_y - r_inner, center_x + r_inner, center_y + r_inner], outline=(255, 255, 255, 15), width=max(1, int(2 * (canvas_size / 512))))

    # Left & right nodes coordinates
    left_node = (int(138 * (canvas_size / 512)), int(152 * (canvas_size / 512)))
    right_node = (int(374 * (canvas_size / 512)), int(152 * (canvas_size / 512)))
    apex_node = (center_x, int(368 * (canvas_size / 512)))

    # Draw Left Stream (Coral Wing)
    left_thickness = max(4, int(28 * (canvas_size / 512)))
    draw.line([left_node, apex_node], fill=(255, 107, 107, 255), width=left_thickness)

    # Draw Right Stream (Violet to Cyan Wing)
    right_thickness = max(4, int(28 * (canvas_size / 512)))
    draw.line([right_node, apex_node], fill=(108, 92, 231, 255), width=right_thickness)

    # Draw Community Bridge (White curved arc)
    bridge_thickness = max(2, int(16 * (canvas_size / 512)))
    # Simple arc approximation through center
    mid_bridge = (center_x, int(195 * (canvas_size / 512)))
    draw.line([left_node, mid_bridge], fill=(255, 255, 255, 220), width=bridge_thickness)
    draw.line([mid_bridge, right_node], fill=(255, 255, 255, 220), width=bridge_thickness)

    # Draw Left Node (Coral)
    node_r = max(3, int(30 * (canvas_size / 512)))
    draw.ellipse([left_node[0] - node_r, left_node[1] - node_r, left_node[0] + node_r, left_node[1] + node_r], fill=(255, 82, 82, 255), outline=(255, 255, 255, 255), width=max(1, int(4 * (canvas_size / 512))))
    inner_r = max(1, int(12 * (canvas_size / 512)))
    draw.ellipse([left_node[0] - inner_r, left_node[1] - inner_r, left_node[0] + inner_r, left_node[1] + inner_r], fill=(255, 255, 255, 255))

    # Draw Right Node (Cyan)
    draw.ellipse([right_node[0] - node_r, right_node[1] - node_r, right_node[0] + node_r, right_node[1] + node_r], fill=(0, 210, 211, 255), outline=(255, 255, 255, 255), width=max(1, int(4 * (canvas_size / 512))))
    draw.ellipse([right_node[0] - inner_r, right_node[1] - inner_r, right_node[0] + inner_r, right_node[1] + inner_r], fill=(255, 255, 255, 255))

    # Draw Apex Node (Center Core)
    apex_r = max(4, int(36 * (canvas_size / 512)))
    draw.ellipse([apex_node[0] - apex_r, apex_node[1] - apex_r, apex_node[0] + apex_r, apex_node[1] + apex_r], fill=(255, 118, 117, 255), outline=(255, 255, 255, 255), width=max(2, int(6 * (canvas_size / 512))))
    apex_inner_r = max(2, int(15 * (canvas_size / 512)))
    draw.ellipse([apex_node[0] - apex_inner_r, apex_node[1] - apex_inner_r, apex_node[0] + apex_inner_r, apex_node[1] + apex_inner_r], fill=(255, 255, 255, 255))

    # Center Community Star / Sparkle
    sparkle_y = int(140 * (canvas_size / 512))
    sparkle_r = max(2, int(16 * (canvas_size / 512)))
    draw.ellipse([center_x - sparkle_r, sparkle_y - sparkle_r, center_x + sparkle_r, sparkle_y + sparkle_r], fill=(255, 170, 90, 255))

    # Downscale smoothly to target size
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def main():
    generate_svg()

    sizes = [16, 24, 32, 48, 64, 128, 256, 512]
    images = {}

    for s in sizes:
        img = draw_icon_image(s)
        out_name = f"icon-{s}.png" if s != 512 else "icon.png"
        img.save(os.path.join(OUTPUT_DIR, out_name), format="PNG")
        images[s] = img
        print(f"Generated PNG: {out_name} ({s}x{s})")

    # Generate multi-resolution Windows .ico containing all sizes
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [images[s] for s in ico_sizes]
    ico_path = os.path.join(OUTPUT_DIR, 'icon.ico')
    
    # PIL supports saving multiple sizes into a single .ico file
    ico_images[-1].save(
        ico_path,
        format='ICO',
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[:-1]
    )
    print(f"Successfully compiled multi-resolution Windows icon: {ico_path} with sizes: {ico_sizes}")

if __name__ == '__main__':
    main()
