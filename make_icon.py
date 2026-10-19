
from PIL import Image

source_path = "./assets/icons/app-icon.png"
output_path = "./assets/icons/app-icon-square.png"

# Open your existing icon
image = Image.open(source_path).convert("RGBA")

# Resize proportionally so the entire image fits inside a square
size = 1024
image.thumbnail((size, size), Image.Resampling.LANCZOS)

# Create a square background
square = Image.new("RGBA", (size, size), "#0A2540")

# Center the icon without stretching it
x = (size - image.width) // 2
y = (size - image.height) // 2
square.alpha_composite(image, (x, y))

# Save the corrected square icon
square.save(output_path)

print(f"Square icon created successfully: {output_path}")
print(f"Dimensions: {square.width} x {square.height}")
