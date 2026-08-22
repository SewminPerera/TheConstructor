
import os
import cv2
import numpy as np

def convert_pdf_to_image(pdf_path: str, output_path: str = None, dpi: int = 300) -> str:

    import fitz  # PyMuPDF lazy import

    if output_path is None:
        output_path = os.path.splitext(pdf_path)[0] + ".png"

    doc = fitz.open(pdf_path)

    if len(doc) == 0:
        raise ValueError("PDF has no pages")

    # Pick the best page for blueprint analysis
    best_page = _select_best_page(doc)


    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    pix = best_page.get_pixmap(matrix=matrix, alpha=False)

    # Convert to numpy array for OpenCV processing
    img_data = pix.samples
    img = np.frombuffer(img_data, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)

    # Convert RGB to BGR for OpenCV
    if pix.n == 3:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    elif pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)

    # Save as PNG
    cv2.imwrite(output_path, img)

    total_pages = len(doc)
    selected_page = best_page.number + 1
    doc.close()

    page_info = {
        "total_pages": total_pages,
        "selected_page": selected_page,
        "width_px": pix.w,
        "height_px": pix.h,
        "dpi": dpi,
    }

    print(f"📄 PDF converted: page {selected_page}/{total_pages}, "
          f"{pix.w}×{pix.h}px @ {dpi} DPI")

    return output_path, page_info

def _select_best_page(doc) -> object:

    if len(doc) == 1:
        return doc[0]

    best_score = -1
    best_page = doc[0]

    for page in doc:
        score = 0.0
        rect = page.rect
        area = rect.width * rect.height
        score += min(area / (420 * 297), 2.0) * 30  

    
        try:
            drawings = page.get_drawings()
            path_count = len(drawings) if drawings else 0
            score += min(path_count / 50, 1.0) * 40  
        except Exception:
            pass

       
        try:
            text = page.get_text("text")
            text_len = len(text.strip())
            if text_len > 2000:
                score -= 20  
            elif text_len > 500:
                score -= 5
        except Exception:
            pass

        if score > best_score:
            best_score = score
            best_page = page

    return best_page

def get_pdf_page_count(pdf_path: str) -> int:
   
    import fitz
    doc = fitz.open(pdf_path)
    count = len(doc)
    doc.close()
    return count
