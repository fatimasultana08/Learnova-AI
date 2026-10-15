"""Directly test the background task logic with the actual server code."""
import io, time, pathlib, uuid
import pymupdf
from app.rag import UPLOAD_DIR, index_document, extract_text_from_pdf
from app.database import init_db

init_db()

# Make the PDF exactly as the smoke test does
doc_m = pymupdf.open()
page = doc_m.new_page()
lines = [
    "Exception Handling in Java - Chapter 5",
    "Exception handling is a mechanism to handle runtime errors gracefully.",
    "A try block encloses code that might throw an exception.",
    "A catch block catches and handles the exception.",
    "The finally block always runs regardless of whether an exception occurred.",
    "Checked exceptions must be declared or handled at compile time.",
    "Unchecked exceptions are subclasses of RuntimeException.",
    "NullPointerException occurs when a null object reference is used.",
    "ArrayIndexOutOfBoundsException is thrown for invalid array index.",
    "Custom exceptions extend the Exception class.",
    "The throw keyword raises an exception explicitly.",
    "The throws keyword declares exceptions in a method signature.",
]
for i, line in enumerate(lines):
    page.insert_text((50, 50 + i * 20), line, fontsize=11)
buf = doc_m.tobytes()
doc_m.close()

print(f"PDF bytes generated: {len(buf)}")

# Simulate the upload endpoint saving the file
fname = uuid.uuid4().hex + ".pdf"
file_path = UPLOAD_DIR / fname
with open(file_path, "wb") as f:
    f.write(buf)

print(f"Saved to: {file_path}")
print(f"File size on disk: {file_path.stat().st_size}")

# Now simulate the background task
abs_path = file_path.resolve()
print(f"Absolute path: {abs_path}")

# Test text extraction
pages = extract_text_from_pdf(abs_path)
total_text = sum(len(p[1]) for p in pages)
print(f"Extracted chars: {total_text}")
print(f"Page 1 text: {pages[0][1][:120]!r}")

# Test full indexing
try:
    count = index_document(9999, 1, "test.pdf", abs_path)
    print(f"Indexed: {count} chunks")
except Exception as e:
    import traceback; traceback.print_exc()

# cleanup
file_path.unlink(missing_ok=True)
print("DONE")
