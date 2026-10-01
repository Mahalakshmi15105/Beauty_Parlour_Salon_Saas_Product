"""
WebP Image Processing & Optimization Service
============================================
Converts and optimizes uploaded images (PNG, JPG, JPEG, GIF, BMP, etc.)
into lightweight WebP format to drastically reduce storage footprint
and accelerate frontend asset loading.
"""

import io
import logging
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

# Default dimensions for different image categories
CATEGORY_MAX_SIZES = {
    "logos": (600, 600),
    "services": (1200, 1200),
    "products": (1200, 1200),
    "campaigns": (1200, 1200),
    "general": (1200, 1200),
}


def optimize_and_convert_to_webp(file_stream_or_bytes, category="general", quality=82):
    """
    Takes an image file stream, bytes, or path and converts it into an optimized WebP format.

    :param file_stream_or_bytes: File object, BytesIO, or raw bytes of the image.
    :param category: The category determining max resolution ("logos", "services", "products", "campaigns").
    :param quality: WebP quality integer (default 82: optimal balance of quality and compression).
    :return: dict containing:
        - "bytes": io.BytesIO containing WebP data
        - "size": integer byte size of WebP
        - "width": final width
        - "height": final height
        - "mime_type": "image/webp"
    """
    try:
        if isinstance(file_stream_or_bytes, (bytes, bytearray)):
            img_input = io.BytesIO(file_stream_or_bytes)
        else:
            img_input = file_stream_or_bytes

        # Open image with Pillow
        img = Image.open(img_input)

        # 1. Correct EXIF orientation (e.g. smartphone portraits)
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # 2. Preserve transparency for RGBA/LA/P or convert to RGB
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")

        # 3. Downscale if dimensions exceed category max
        max_width, max_height = CATEGORY_MAX_SIZES.get(category.lower(), (1200, 1200))
        orig_width, orig_height = img.size
        
        if orig_width > max_width or orig_height > max_height:
            img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

        # 4. Save to BytesIO in WebP format
        output_buffer = io.BytesIO()
        img.save(
            output_buffer,
            format="WEBP",
            quality=quality,
            method=6,  # Highest compression efficiency
            optimize=True
        )
        output_buffer.seek(0)
        webp_bytes = output_buffer.getvalue()

        final_width, final_height = img.size
        logger.info(
            f"Image converted to WebP successfully. Original: {orig_width}x{orig_height} -> Final: {final_width}x{final_height}, Size: {len(webp_bytes)} bytes"
        )

        return {
            "bytes": io.BytesIO(webp_bytes),
            "raw_bytes": webp_bytes,
            "size": len(webp_bytes),
            "width": final_width,
            "height": final_height,
            "mime_type": "image/webp"
        }
    except Exception as e:
        logger.error(f"Error optimizing image to WebP: {str(e)}")
        raise ValueError(f"Failed to process and convert image to WebP: {str(e)}")
