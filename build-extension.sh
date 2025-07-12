#!/bin/bash

# Chrome Extension Build Script
# This script removes console.log statements and creates a zip file for Chrome Web Store

echo "🚀 Starting Chrome Extension build process..."

# Create a temporary build directory
BUILD_DIR="build-extension"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "📁 Creating build directory..."

# Copy essential files to build directory
echo "📋 Copying essential files..."
cp manifest.json "$BUILD_DIR/"
cp popup.html "$BUILD_DIR/"
cp popup.js "$BUILD_DIR/"
cp background.js "$BUILD_DIR/"
cp content-script.js "$BUILD_DIR/"
cp styles.css "$BUILD_DIR/"

# Copy icons directory
if [ -d "icons" ]; then
    echo "🎨 Copying icons..."
    cp -r icons "$BUILD_DIR/"
fi

# Copy lib directory if it exists
if [ -d "lib" ]; then
    echo "📚 Copying libraries..."
    cp -r lib "$BUILD_DIR/"
fi

# Function to remove console.log statements from a file
remove_console_logs() {
    local file="$1"
    echo "🧹 Cleaning $file..."
    
    # Remove console.log statements (including multi-line ones)
    # This regex handles various console.log formats:
    # - console.log("message")
    # - console.log("message", variable)
    # - console.log(`template ${variable}`)
    # - console.log with multiple arguments
    sed -i '' '/console\.log(/d' "$file"
    
    # Also remove console.error, console.warn, console.info if needed
    # Uncomment the lines below if you want to remove these too:
    # sed -i '' '/console\.error(/d' "$file"
    # sed -i '' '/console\.warn(/d' "$file"
    # sed -i '' '/console\.info(/d' "$file"
}

# Remove console.log from all JS files in build directory
echo "🧹 Removing console.log statements..."
for js_file in "$BUILD_DIR"/*.js; do
    if [ -f "$js_file" ]; then
        remove_console_logs "$js_file"
    fi
done

# Create build folder for output
BUILD_OUTPUT_DIR="build"
mkdir -p "$BUILD_OUTPUT_DIR"

# Create the zip file
ZIP_NAME="chrome-extension-$(date +%Y%m%d-%H%M%S).zip"
echo "📦 Creating zip file: $ZIP_NAME"

cd "$BUILD_DIR"
zip -r "../$BUILD_OUTPUT_DIR/$ZIP_NAME" . -x "*.DS_Store*"
cd ..

# Clean up build directory
echo "🧹 Cleaning up build directory..."
rm -rf "$BUILD_DIR"

echo "✅ Build complete!"
echo "📦 Extension zip file created: $BUILD_OUTPUT_DIR/$ZIP_NAME"
echo "📏 File size: $(du -h "$BUILD_OUTPUT_DIR/$ZIP_NAME" | cut -f1)"
echo ""
echo "🎯 Ready for Chrome Web Store submission!"
echo "📝 Upload $BUILD_OUTPUT_DIR/$ZIP_NAME to the Chrome Web Store Developer Dashboard" 