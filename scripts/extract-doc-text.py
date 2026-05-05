"""Extract text from .doc file using Word COM automation.
Usage: python extract-doc-text.py <input.doc> [output.txt]
If no output path, prints to stdout.
"""
import sys
import os

def extract(doc_path, out_path=None):
    doc_path = os.path.abspath(doc_path)
    import win32com.client
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    word.DisplayAlerts = False
    try:
        doc = word.Documents.Open(doc_path, ReadOnly=True)
        text = doc.Content.Text
        doc.Close(False)
    finally:
        word.Quit()

    text = text.replace('\r\n', '\n').replace('\r', '\n')

    if out_path:
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(text)
    else:
        sys.stdout.buffer.write(text.encode('utf-8'))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python extract-doc-text.py <input.doc> [output.txt]", file=sys.stderr)
        sys.exit(1)
    extract(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
