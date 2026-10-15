"""Quick doc upload test to diagnose background task error."""
import io, time, httpx, uuid, pymupdf

BASE = "http://127.0.0.1:8000"
client = httpx.Client(base_url=BASE, timeout=60)

# Create test subject
r = client.post("/api/subjects", json={"name": "DiagTest", "color": "#333"})
subj_id = r.json()["id"]
print("Subject id:", subj_id)

# Make valid PDF
doc = pymupdf.open()
page = doc.new_page()
for i, line in enumerate(["Exception Handling in Java", "try catch finally", "custom exceptions extend Exception"]):
    page.insert_text((50, 50+i*20), line, fontsize=11)
buf = doc.tobytes()
doc.close()

# Upload
files = {"file": ("test.pdf", io.BytesIO(buf), "application/pdf")}
data = {"subject_id": str(subj_id)}
r = client.post("/api/documents", files=files, data=data)
d = r.json()
doc_id = d["id"]
print(f"Uploaded doc id={doc_id} path={d.get('file_path','n/a')}")

# Wait up to 30s
for _ in range(15):
    time.sleep(2)
    s = client.get(f"/api/documents/{doc_id}").json()
    status = s["status"]
    err = s.get("error_message") or ""
    print(f"  status={status} error={err[:300]}")
    if status in ("ready", "error"):
        break

client.delete(f"/api/subjects/{subj_id}")
