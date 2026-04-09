import os, sys
import win32com.client

out_path = r"C:\Users\26371\Documents\MLocalCoding\judicial-law-search\word_com_test.txt"
p = os.path.join(r"C:\Users\26371\Documents\EchoSyncMo\Mo Laws 法律法规", "江苏")
files = [f for f in os.listdir(p) if f.endswith('.doc') and not f.endswith('.docx')]

with open(out_path, 'w', encoding='utf-8') as out:
    out.write(f"Total .doc files: {len(files)}\n")
    out.write(f"Testing: {files[0]}\n\n")

    word = None
    try:
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = False

        fp = os.path.join(p, files[0])
        doc = word.Documents.Open(fp, ReadOnly=True)

        # Extract paragraphs
        para_count = doc.Paragraphs.Count
        out.write(f"Paragraphs: {para_count}\n\n")

        for i in range(1, min(para_count + 1, 20)):
            text = doc.Paragraphs(i).Range.Text.strip()
            out.write(f"{i:3d}: {text[:100]}\n")

        doc.Close(False)
        out.write("\nSUCCESS\n")
    except Exception as e:
        out.write(f"ERROR: {type(e).__name__}: {e}\n")
    finally:
        if word:
            word.Quit()
